import Phaser from 'phaser';
import { TILE, ZOMBIE } from '../config';
import { EMOTE, emote } from './emote';
import type { Cell, NavGrid, Step } from './NavGrid';

type Sprite = Phaser.Physics.Arcade.Sprite;
type Body = Phaser.Physics.Arcade.Body;
type Mode = 'patrol' | 'alert' | 'chase';

/** What a zombie needs to know about the world around it. */
export interface ZombieWorld {
  nav: NavGrid;
  player: Sprite;
  /** False while the player is dying or flashing after a respawn: zombies leave them be. */
  playerIsFair(): boolean;
  playerIsClimbing(): boolean;
  /** The y of the stair step under a body's feet, or null (see GameScene.stairSurface). */
  stairSurface(body: Body, maxDrop: number): number | null;
}

const STAND_FRAME = 3;
const STEP_DOWN = 8;

/**
 * Drives one zombie. It shambles back and forth on its own floor until it sees
 * the player ahead of it (or hears them right next to it). Then it stops for a
 * moment with a "!" over its head, and gives chase along the level's walking map,
 * using stairs, ladders and holes in the floor. It can't jump, so the player can
 * always hop onto a shelf or over a crate to get away, and it is slower than the
 * player. If it loses track of the player for a few seconds it shrugs ("?") and
 * goes back to wandering wherever it ended up.
 */
export class ZombieBrain {
  /** Read by the tile collider: a climbing zombie passes through ladder tops. */
  climbing = false;
  private mode: Mode = 'patrol';
  private dir: number;
  private onStairs = false;
  private climbDir = 1;
  private path: Step[] = [];
  private reached = false;
  private plannedAt = -Infinity;
  private plannedFrom = '';
  private plannedTo = '';
  private alertUntil = 0;
  private lastSensedAt = -Infinity;
  private stuckCheckAt = 0;
  private stuckX = 0;
  private stuckY = 0;
  private stuckCount = 0;

  constructor(
    private readonly z: Sprite,
    private readonly world: ZombieWorld,
    dir = -1,
  ) {
    this.dir = dir;
  }

  private get body(): Body {
    return this.z.body as Body;
  }

  update(time: number): void {
    this.followStairs();
    const sensed = this.senses();
    if (sensed) this.lastSensedAt = time;

    switch (this.mode) {
      case 'patrol':
        if (sensed && !this.climbing) this.spot(time);
        else this.patrol();
        break;
      case 'alert':
        this.stand();
        if (!this.world.playerIsFair()) this.forget();
        else if (time >= this.alertUntil) {
          this.mode = 'chase';
          this.plannedAt = -Infinity;
          this.stuckCheckAt = time;
          this.stuckCount = 0;
        }
        break;
      case 'chase':
        if (!this.world.playerIsFair()) {
          this.forget();
          this.patrol();
        } else if (time - this.lastSensedAt > ZOMBIE.forgetAfter || this.isStuck(time)) {
          this.giveUp();
          this.patrol();
        } else {
          this.chase(time);
        }
        break;
    }
  }

  /** Stop chasing without fuss (the player died or respawned). */
  forget(): void {
    this.mode = 'patrol';
    this.path = [];
    this.lastSensedAt = -Infinity;
  }

  /** Shot but not killed: if it hadn't noticed the player yet, it has now. */
  shot(time: number): void {
    this.lastSensedAt = time;
    if (this.mode === 'patrol' && !this.climbing && this.world.playerIsFair()) this.spot(time);
  }

  // ---------------------------------------------------------------- senses

  /** Sees the player straight ahead on about the same level, or hears them right next to it. */
  private senses(): boolean {
    if (!this.world.playerIsFair()) return false;
    const p = this.world.player.body as Body;
    const b = this.body;
    const dx = p.center.x - b.center.x;
    const dy = p.bottom - b.bottom;
    if (Math.hypot(dx, dy) < ZOMBIE.hearing) return true;
    if (Math.abs(dx) > ZOMBIE.sight || Math.abs(dy) > ZOMBIE.sightHeight) return false;
    // Wandering zombies only see what is in front of them.
    if (this.mode === 'patrol' && Math.sign(dx) !== this.dir && Math.abs(dx) > TILE) return false;
    const eyeRow = Math.floor((b.top + 6) / TILE);
    const x0 = Math.floor(b.center.x / TILE);
    const x1 = Math.floor(p.center.x / TILE);
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
      if (this.world.nav.isSolid(x, eyeRow)) return false;
    }
    return true;
  }

  private spot(time: number): void {
    this.mode = 'alert';
    this.alertUntil = time + ZOMBIE.alertTime;
    this.dir = this.world.player.x < this.z.x ? -1 : 1;
    this.z.setFlipX(this.dir < 0);
    this.emote(EMOTE.spotted);
  }

  private giveUp(): void {
    this.forget();
    this.emote(EMOTE.lost);
  }

  private emote(frame: number): void {
    emote(this.z, this.body.top, frame);
  }

  // ---------------------------------------------------------------- where am I

  /** The walking-map cell the zombie stands in (or hangs on), or null while it is falling. */
  private cell(): Cell | null {
    const b = this.body;
    if (!this.climbing && !this.onStairs && !b.blocked.down && !b.touching.down) return null;
    const x = Math.floor(b.center.x / TILE);
    const y = Math.floor((b.bottom - 1) / TILE);
    for (const cy of [y, y + 1]) if (this.world.nav.isNode(x, cy)) return { x, y: cy };
    return null;
  }

  /** Where the player is on the walking map: the spot under them if they are in the air. */
  private playerCell(): Cell | null {
    const nav = this.world.nav;
    const p = this.world.player.body as Body;
    const x = Math.floor(p.center.x / TILE);
    const y = Math.floor((p.bottom - 1) / TILE);
    if (this.world.playerIsClimbing() && nav.isNode(x, y)) return { x, y };
    for (let cy = y; cy < Math.min(y + 12, nav.height); cy++) {
      if (nav.isStandable(x, cy)) return { x, y: cy };
      if (nav.isSolid(x, cy)) break;
    }
    return null;
  }

  // ---------------------------------------------------------------- movement

  /** Walks up and down stairs the same way the player does. */
  private followStairs(): void {
    if (this.climbing) return;
    const b = this.body;
    const wasOnStairs = this.onStairs;
    this.onStairs = false;
    if (b.velocity.y < 0) return;
    const surface = this.world.stairSurface(b, wasOnStairs || b.blocked.down || b.touching.down ? STEP_DOWN : 0);
    if (surface === null) return;
    b.position.y += surface - b.bottom;
    b.velocity.y = 0;
    this.onStairs = true;
  }

  private walk(dir: number, speed: number): void {
    this.dir = dir;
    this.z.setVelocityX(dir * speed).setFlipX(dir < 0);
    this.z.anims.play('zombie-walk', true);
  }

  private stand(): void {
    this.z.setVelocityX(0);
    if (this.climbing) {
      this.z.setVelocityY(0);
      this.z.anims.pause();
    } else {
      this.z.anims.stop();
      this.z.setFrame(STAND_FRAME);
    }
  }

  /** Wanders its own floor, turning at walls and ledges. It won't start up a staircase on its own. */
  private patrol(): void {
    if (this.climbing) {
      // Gave up halfway up a ladder: carry on to the next floor.
      const here = this.cell();
      if (here && this.world.nav.isStandable(here.x, here.y)) this.finishClimb(here);
      else this.z.setVelocity(0, this.climbDir * ZOMBIE.climbSpeed);
      return;
    }
    const nav = this.world.nav;
    const b = this.body;
    const here = this.cell();
    if (here) {
      const aheadX = Math.floor((b.center.x + this.dir * 7) / TILE);
      if (aheadX !== here.x) {
        const fromStairs = nav.isStairs(here.x, here.y);
        const canGo = nav
          .neighbours(here.x, here.y)
          .some((n) => n.x === aheadX && n.move === 'walk' && (fromStairs || !nav.isStairs(n.x, n.y)));
        if (!canGo) this.dir = -this.dir;
      }
    }
    if ((this.dir < 0 && b.blocked.left) || (this.dir > 0 && b.blocked.right)) this.dir = -this.dir;
    this.walk(this.dir, ZOMBIE.speed);
  }

  private chase(time: number): void {
    const here = this.cell();
    if (!here) {
      // Falling: drift to the middle of the cell it is dropping into.
      const next = this.path[1];
      if (next) this.steerTo(next.x * TILE + TILE / 2, ZOMBIE.chaseSpeed);
      return;
    }

    const target = this.playerCell();
    const from = `${here.x},${here.y}`;
    const to = target ? `${target.x},${target.y}` : this.plannedTo;
    if (target && (time - this.plannedAt > ZOMBIE.replanEvery || from !== this.plannedFrom || to !== this.plannedTo)) {
      const result = this.world.nav.findPath(here, target);
      this.path = result?.path ?? [];
      this.reached = result?.reached ?? false;
      this.plannedAt = time;
      this.plannedFrom = from;
      this.plannedTo = to;
      // Close behind the player by the walking map: it can tell where they went.
      if (this.reached && this.path.length - 1 <= ZOMBIE.trackSteps) this.lastSensedAt = time;
    }

    // Find where it is on the path (it may have moved on since planning).
    const at = this.path.findIndex((s) => s.x === here.x && s.y === here.y);
    const next = at >= 0 ? this.path[at + 1] : undefined;

    if (!next) {
      if (this.climbing) {
        if (this.world.nav.isStandable(here.x, here.y)) this.finishClimb(here);
        else this.stand(); // the player is on this ladder too: hang on and wait
        return;
      }
      // Arrived. If the player is right here, lunge for them; if they are out of reach, wait below.
      const dx = this.world.player.x - this.z.x;
      if (this.reached && Math.abs(dx) > 2) this.walk(Math.sign(dx), ZOMBIE.chaseSpeed);
      else {
        this.stand();
        this.z.setFlipX(dx < 0);
      }
      return;
    }

    if (next.move === 'climb') this.climbTo(here, next);
    else if (this.climbing) this.finishClimb(here);
    else this.walk(Math.sign(next.x - here.x), ZOMBIE.chaseSpeed);
  }

  private steerTo(x: number, speed: number): void {
    const dx = x - this.body.center.x;
    if (Math.abs(dx) < 1) this.z.setVelocityX(0);
    else this.walk(Math.sign(dx), Math.min(speed, Math.abs(dx) * 8));
  }

  // ---------------------------------------------------------------- ladders

  private climbTo(here: Cell, next: Step): void {
    const b = this.body;
    const cx = here.x * TILE + TILE / 2;
    if (!this.climbing) {
      if (Math.abs(b.center.x - cx) > 1.5) {
        this.steerTo(cx, ZOMBIE.chaseSpeed);
        return;
      }
      this.climbing = true;
      this.onStairs = false;
      b.setAllowGravity(false);
      b.position.x += cx - b.center.x;
      this.z.anims.play('zombie-climb');
    }
    this.climbDir = next.y < here.y ? -1 : 1;
    this.z.setVelocity(0, this.climbDir * ZOMBIE.climbSpeed);
    if (this.z.anims.isPaused) this.z.anims.resume();
  }

  /** Climbs until its feet are level with this cell's floor, then steps off the ladder. */
  private finishClimb(here: Cell): void {
    const b = this.body;
    const d = (here.y + 1) * TILE - b.bottom;
    if (Math.abs(d) > 1.5) {
      this.climbDir = Math.sign(d);
      this.z.setVelocity(0, this.climbDir * ZOMBIE.climbSpeed);
      return;
    }
    b.position.y += d;
    this.climbing = false;
    b.setAllowGravity(true);
    this.z.setVelocity(0, 0);
  }

  // ---------------------------------------------------------------- stuck

  /** Gives up if it has been trying to move for a while without getting anywhere. */
  private isStuck(time: number): boolean {
    if (time - this.stuckCheckAt < 700) return false;
    const moved = Math.abs(this.z.x - this.stuckX) + Math.abs(this.z.y - this.stuckY);
    const trying = this.body.velocity.x !== 0 || (this.climbing && this.body.velocity.y !== 0);
    this.stuckCount = trying && moved < 2 ? this.stuckCount + 1 : 0;
    this.stuckX = this.z.x;
    this.stuckY = this.z.y;
    this.stuckCheckAt = time;
    return this.stuckCount >= 2;
  }
}
