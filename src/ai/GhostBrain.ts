import Phaser from 'phaser';
import { GHOST, TILE } from '../config';
import { EMOTE, emote } from './emote';
import type { Cell, NavGrid } from './NavGrid';

type Sprite = Phaser.Physics.Arcade.Sprite;
type Body = Phaser.Physics.Arcade.Body;
type Mode = 'haunt' | 'alert' | 'chase' | 'return';

/** What a ghost needs to know about the world around it. */
export interface GhostWorld {
  nav: NavGrid;
  player: Sprite;
  /** False while the player is dying or flashing after a respawn: ghosts leave them be. */
  playerIsFair(): boolean;
}

/**
 * Drives one ghost. It drifts back and forth over its haunt until it sees the
 * player (any direction, as long as no wall is in the way). Then it freezes with
 * a "!" and floats after them, flying through any open space: over crates, past
 * shelves and ladders and up stairwells, but never through walls or floors.
 * It is slower than a zombie, since nothing stops it, and it won't stray too far
 * from home. When it loses sight of the player for a while, or gets pulled too
 * far from its haunt, it shrugs ("?") and floats back home to drift again.
 */
export class GhostBrain {
  private mode: Mode = 'haunt';
  private readonly homeX: number;
  private readonly homeY: number;
  /** Where the ghost really is; the sprite bobs up and down around this. */
  private x: number;
  private y: number;
  private sway = 0;
  private bob: number;
  private path: Cell[] = [];
  private reached = false;
  private plannedAt = -Infinity;
  private plannedTo = '';
  private alertUntil = 0;
  private lastSeenAt = -Infinity;

  constructor(
    private readonly g: Sprite,
    private readonly world: GhostWorld,
    phase = 0,
  ) {
    this.homeX = this.x = g.x;
    this.homeY = this.y = g.y;
    this.bob = phase * 2.5;
  }

  update(time: number, delta: number): void {
    const dt = Math.min(delta, 50) / 1000;
    const seen = this.sees();
    if (seen) this.lastSeenAt = time;

    switch (this.mode) {
      case 'haunt':
        if (seen) this.spot(time);
        else this.drift(dt);
        break;
      case 'alert':
        if (!this.world.playerIsFair()) this.forget();
        else if (time >= this.alertUntil) {
          this.mode = 'chase';
          this.plannedAt = -Infinity;
        }
        break;
      case 'chase':
        if (!this.world.playerIsFair()) this.forget();
        else if (time - this.lastSeenAt > GHOST.forgetAfter || this.farFromHome()) this.giveUp();
        else this.chase(time, dt);
        break;
      case 'return':
        if (seen) this.spot(time);
        else this.goHome(time, dt);
        break;
    }

    // A slow bob, whatever it is doing.
    this.bob += dt * 2.5;
    this.g.setPosition(this.x, this.y + Math.sin(this.bob) * GHOST.bob);
  }

  /** Stop chasing without fuss (the player died or respawned) and float home. */
  forget(): void {
    if (this.mode === 'haunt') return;
    this.mode = 'return';
    this.path = [];
    this.plannedAt = -Infinity;
    this.lastSeenAt = -Infinity;
  }

  // ---------------------------------------------------------------- senses

  /** Sees the player within range in any direction, unless a wall or floor is in between. */
  private sees(): boolean {
    if (!this.world.playerIsFair()) return false;
    const p = (this.world.player.body as Body).center;
    const dx = p.x - this.x;
    const dy = p.y - this.y;
    const d = Math.hypot(dx, dy);
    if (d > GHOST.sight) return false;
    // Not worth spotting someone it isn't allowed to follow.
    if (this.mode !== 'chase' && Math.hypot(p.x - this.homeX, p.y - this.homeY) > GHOST.leash) return false;
    const steps = Math.ceil(d / 4);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.world.nav.isSolid(Math.floor((this.x + dx * t) / TILE), Math.floor((this.y + dy * t) / TILE))) return false;
    }
    return true;
  }

  private farFromHome(): boolean {
    return Math.hypot(this.x - this.homeX, this.y - this.homeY) > GHOST.leash;
  }

  private spot(time: number): void {
    this.mode = 'alert';
    this.alertUntil = time + GHOST.alertTime;
    this.g.setFlipX(this.world.player.x < this.x);
    emote(this.g, (this.g.body as Body).top, EMOTE.spotted);
  }

  private giveUp(): void {
    this.forget();
    emote(this.g, (this.g.body as Body).top, EMOTE.lost);
  }

  // ---------------------------------------------------------------- movement

  /** Back and forth over its haunt, as ghosts always have. */
  private drift(dt: number): void {
    this.sway += dt * (GHOST.speed / GHOST.range);
    this.x = this.homeX + Math.sin(this.sway) * GHOST.range;
    this.y = this.homeY;
    this.g.setFlipX(Math.cos(this.sway) < 0);
  }

  private cellAt(x: number, y: number): Cell {
    return { x: Math.floor(x / TILE), y: Math.floor(y / TILE) };
  }

  private chase(time: number, dt: number): void {
    const p = (this.world.player.body as Body).center;
    const target = this.cellAt(p.x, p.y);
    if (!this.world.nav.isOpen(target.x, target.y)) target.y -= 1; // standing in a doorway's top edge, etc.
    this.plan(time, target);
    const next = this.nextCell();
    if (next) this.flyTo(next.x * TILE + TILE / 2, next.y * TILE + TILE / 2, GHOST.chaseSpeed, dt);
    // Same cell as the player: go straight for them. Out of reach: hover as close as it can.
    else if (this.reached) this.flyTo(p.x, p.y, GHOST.chaseSpeed, dt);
  }

  private goHome(time: number, dt: number): void {
    this.plan(time, this.cellAt(this.homeX, this.homeY));
    const next = this.nextCell();
    if (next) {
      this.flyTo(next.x * TILE + TILE / 2, next.y * TILE + TILE / 2, GHOST.returnSpeed, dt);
      return;
    }
    if (this.flyTo(this.homeX, this.homeY, GHOST.returnSpeed, dt)) {
      this.mode = 'haunt';
      this.sway = 0;
    }
  }

  /** Plans a flight to `to`, at most every so often or when the target moves to another cell. */
  private plan(time: number, to: Cell): void {
    const key = `${to.x},${to.y}`;
    if (time - this.plannedAt < GHOST.replanEvery && key === this.plannedTo) return;
    const result = this.world.nav.findFlightPath(this.cellAt(this.x, this.y), to);
    this.path = result?.path ?? [];
    this.reached = result?.reached ?? false;
    this.plannedAt = time;
    this.plannedTo = key;
  }

  /** The next cell along the planned flight, or null if it is already in the last one. */
  private nextCell(): Cell | null {
    const here = this.cellAt(this.x, this.y);
    const at = this.path.findIndex((c) => c.x === here.x && c.y === here.y);
    if (at < 0) {
      // Off its planned route (or inside a wall): plan again next frame, and don't move meanwhile.
      this.plannedAt = -Infinity;
      this.reached = false;
      return null;
    }
    return this.path[at + 1] ?? null;
  }

  /** Floats towards a point. True once it is there. */
  private flyTo(x: number, y: number, speed: number, dt: number): boolean {
    const dx = x - this.x;
    const dy = y - this.y;
    const d = Math.hypot(dx, dy);
    const step = speed * dt;
    if (d <= step) {
      this.x = x;
      this.y = y;
      return true;
    }
    this.x += (dx / d) * step;
    this.y += (dy / d) * step;
    if (Math.abs(dx) > 0.5) this.g.setFlipX(dx < 0);
    return false;
  }
}
