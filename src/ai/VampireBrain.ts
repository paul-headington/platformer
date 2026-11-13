import Phaser from 'phaser';
import { TILE, VAMPIRE } from '../config';
import { EMOTE, emote } from './emote';
import type { ZombieWorld } from './ZombieBrain';

type Sprite = Phaser.Physics.Arcade.Sprite;
type Body = Phaser.Physics.Arcade.Body;
type Mode = 'guard' | 'alert' | 'stalk' | 'windup' | 'lunge' | 'recover' | 'stunned' | 'return';

/** Poses that hold still while it stands: breathing, or hissing (its clip ends and holds). */
type Stance = 'idle' | 'hiss';

/**
 * Drives the vampire that guards the exit. It stands at its post, looking about,
 * until it sees the player on its floor. Then it hisses, and stalks them, but never
 * further than its leash from the post and never off the edge of its floor. Close
 * up it crouches (the warning) and lunges a few tiles, then stands a moment to
 * recover: the time to cut it. A cut that doesn't kill it knocks it back. If it
 * loses the player for a few seconds it walks back to its post.
 */
export class VampireBrain {
  /** Read by the tile collider. A vampire never climbs. */
  readonly climbing = false;
  private mode: Mode = 'guard';
  private dir = -1;
  private until = 0;
  private lastSeenAt = -Infinity;
  private lungeFromX = 0;
  private windupFrom = 0;
  /** How far the sprite has been nudged sideways by the warning tremble (px). */
  private shake = 0;
  private nextLookAt = 0;
  private readonly postX: number;

  constructor(
    private readonly v: Sprite,
    private readonly world: ZombieWorld,
  ) {
    this.postX = v.x;
    this.face(-1);
  }

  private get body(): Body {
    return this.v.body as Body;
  }

  update(time: number): void {
    if (!this.v.active) return;
    const sees = this.sees();
    if (sees) this.lastSeenAt = time;
    const fair = this.world.playerIsFair();

    switch (this.mode) {
      case 'guard':
        this.stand('idle');
        if (sees) this.spot(time);
        else if (time >= this.nextLookAt) {
          // Glances the other way now and then, then back towards the way in.
          this.face(this.dir === -1 && Math.random() < 0.5 ? 1 : -1);
          this.nextLookAt = time + Phaser.Math.Between(1500, 3500);
        }
        break;
      case 'return':
        if (sees) this.spot(time);
        else if (Math.abs(this.v.x - this.postX) < 2) {
          this.mode = 'guard';
          this.face(-1);
        } else this.walk(Math.sign(this.postX - this.v.x), VAMPIRE.speed);
        break;
      case 'alert':
        this.stand('hiss');
        this.facePlayer();
        if (!fair) this.mode = 'return';
        else if (time >= this.until) this.mode = 'stalk';
        break;
      case 'stalk':
        this.stalk(time, fair);
        break;
      case 'windup':
        this.warn(time);
        if (time >= this.until) {
          this.endWarning();
          this.mode = 'lunge';
          this.lungeFromX = this.v.x;
        }
        break;
      case 'lunge': {
        const gone = Math.abs(this.v.x - this.lungeFromX) >= VAMPIRE.lungeDistance;
        if (gone || !this.canStep(this.dir) || this.blocked(this.dir) || !this.inTerritory(this.v.x + this.dir * 4, 2 * TILE)) {
          this.mode = 'recover';
          this.until = time + VAMPIRE.lungeRecover;
          this.v.setVelocityX(0);
          this.pose('vampire-land', 'vampire-idle');
        } else {
          this.pose('vampire-launch', 'vampire-fly');
          this.v.setVelocityX(this.dir * VAMPIRE.lungeSpeed);
        }
        break;
      }
      case 'recover':
        this.stand('idle');
        if (time >= this.until) this.mode = 'stalk';
        break;
      case 'stunned': {
        // Reeling back from a cut: slides to a stop, but not off its floor.
        const vx = this.body.velocity.x * 0.88;
        this.v.setVelocityX(this.canStep(Math.sign(vx)) ? vx : 0);
        this.pose('vampire-hiss');
        if (time >= this.until) this.mode = 'stalk';
        break;
      }
    }
  }

  /**
   * The warning before a lunge, so the player has time to jump: first it rears up and
   * hisses with its eyes flaring red, then it drops into a crouch and trembles, flashing
   * red faster and faster, until it springs.
   */
  private warn(time: number): void {
    this.v.setVelocityX(0);
    const t = time - this.windupFrom;
    const rearing = t < VAMPIRE.lungeWindup * VAMPIRE.warnRearShare;
    if (rearing) this.pose('vampire-hiss');
    else this.pose('vampire-crouch', 'vampire-tremble');
    // Red flashes that speed up towards the lunge.
    const left = this.until - time;
    const period = left > VAMPIRE.lungeWindup / 2 ? 160 : 80;
    if (Math.floor(t / period) % 2 === 0) this.v.setTint(VAMPIRE.warnTint);
    else this.v.clearTint();
    // Crouched, it trembles a pixel either way.
    const shake = rearing ? 0 : Math.floor(t / 50) % 2 === 0 ? 1 : -1;
    this.v.x += shake - this.shake;
    this.shake = shake;
  }

  private endWarning(): void {
    this.v.x -= this.shake;
    this.shake = 0;
    this.v.clearTint();
  }

  /** The player died or respawned: back to its post. Its wounds stay. */
  forget(): void {
    if (this.mode === 'windup') this.endWarning();
    if (this.mode === 'stunned') return;
    this.mode = 'return';
    this.lastSeenAt = -Infinity;
  }

  /** Cut but not killed: reels back away from the blade, hissing. `from` is the side the cut came from. */
  shot(time: number, from = -this.dir): void {
    if (this.mode === 'windup') this.endWarning();
    this.mode = 'stunned';
    this.until = time + VAMPIRE.stunTime;
    this.lastSeenAt = time;
    this.face(from);
    this.v.setVelocityX(-from * VAMPIRE.stunKnockback);
  }

  // ---------------------------------------------------------------- senses

  /** Sees the player along its own floor, either way, if no wall is in between. */
  private sees(): boolean {
    if (!this.world.playerIsFair()) return false;
    const p = this.world.player.body as Body;
    const b = this.body;
    const dx = p.center.x - b.center.x;
    if (Math.abs(dx) > VAMPIRE.sight || Math.abs(p.bottom - b.bottom) > VAMPIRE.sightHeight) return false;
    const eyeRow = Math.floor((b.top + 6) / TILE);
    const x0 = Math.floor(b.center.x / TILE);
    const x1 = Math.floor(p.center.x / TILE);
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) if (this.world.nav.isSolid(x, eyeRow)) return false;
    return true;
  }

  private spot(time: number): void {
    this.mode = 'alert';
    this.until = time + VAMPIRE.alertTime;
    this.facePlayer();
    emote(this.v, this.body.top, EMOTE.spotted);
  }

  // ---------------------------------------------------------------- moving

  private stalk(time: number, fair: boolean): void {
    if (!fair || time - this.lastSeenAt > VAMPIRE.forgetAfter) {
      if (fair) emote(this.v, this.body.top, EMOTE.lost);
      this.mode = 'return';
      return;
    }
    const p = this.world.player.body as Body;
    const dx = p.center.x - this.body.center.x;
    this.facePlayer();
    const level = Math.abs(p.bottom - this.body.bottom) <= TILE;
    if (level && Math.abs(dx) <= VAMPIRE.lungeRange && this.lastSeenAt === time) {
      this.mode = 'windup';
      this.windupFrom = time;
      this.until = time + VAMPIRE.lungeWindup;
      this.stand('hiss');
      emote(this.v, this.body.top, EMOTE.spotted);
      return;
    }
    // Follows the player's x, but only as far as its own patch.
    const target = Phaser.Math.Clamp(p.center.x, this.postX - VAMPIRE.leash, this.postX + VAMPIRE.leash);
    const dir = Math.sign(target - this.v.x);
    if (Math.abs(target - this.v.x) < 3 || !this.canStep(dir) || this.blocked(dir)) this.stand('hiss');
    else this.walk(dir, VAMPIRE.stalkSpeed);
  }

  private walk(dir: number, speed: number): void {
    if (!this.canStep(dir) || this.blocked(dir)) {
      this.stand('idle');
      return;
    }
    this.face(dir);
    this.v.setVelocityX(dir * speed);
    this.pose('vampire-walk');
  }

  private stand(stance: Stance): void {
    this.v.setVelocityX(0);
    // Landing from a lunge runs into the idle by itself.
    this.pose(`vampire-${stance}`, undefined, ['vampire-land']);
  }

  /**
   * Plays a clip (then `next`, if given), unless it is already on: playing, or held at its
   * end, or `next` is. Clips in `also` are let finish first.
   */
  private pose(key: string, next?: string, also: string[] = []): void {
    const now = this.v.anims.currentAnim?.key;
    if (now === key || (next && now === next) || (now && also.includes(now) && this.v.anims.isPlaying)) return;
    this.v.anims.chain();
    this.v.anims.play(key);
    if (next) this.v.anims.chain(next);
  }

  private face(dir: number): void {
    if (dir === 0) return;
    this.dir = dir;
    this.v.setFlipX(dir < 0);
  }

  private facePlayer(): void {
    this.face(Math.sign(this.world.player.x - this.v.x) || this.dir);
  }

  /** Within its leash of its post; a lunge may carry it `extra` px further. */
  private inTerritory(x: number, extra = 0): boolean {
    return Math.abs(x - this.postX) <= VAMPIRE.leash + extra;
  }

  private blocked(dir: number): boolean {
    return (dir < 0 && this.body.blocked.left) || (dir > 0 && this.body.blocked.right);
  }

  /** There is floor to stand on just ahead (it won't walk off a ledge or into a hole). */
  private canStep(dir: number): boolean {
    if (dir === 0) return true;
    const b = this.body;
    const x = Math.floor((b.center.x + dir * (b.halfWidth + 3)) / TILE);
    const y = Math.floor((b.bottom - 1) / TILE);
    return this.world.nav.isStandable(x, y);
  }
}
