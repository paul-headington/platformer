import type Phaser from 'phaser';

/** The flinch settings in an enemy's config block (see ZOMBIE and GHOST in config.ts). */
export interface FlinchStats {
  /** Share of its normal speed it moves at while flinching (0 = stops dead). */
  flinchSpeed: number;
  /** How far through the hurt clip (0 to 1) it stays that slow, before easing back to full speed by the clip's end. */
  flinchHold: number;
}

/**
 * How fast an enemy may move, as a share of its normal speed (0 to 1). While its hurt clip
 * (`hurtKey`) plays it moves at `flinchSpeed` up to `flinchHold` of the way through, then
 * eases back up to full speed as the clip ends. Going by the clip's own progress keeps the
 * slowdown in step with the animation whatever the frame rate.
 */
export function flinchPace(sprite: Phaser.GameObjects.Sprite, hurtKey: string, f: FlinchStats): number {
  const anims = sprite.anims;
  if (anims.currentAnim?.key !== hurtKey || !anims.isPlaying) return 1;
  const p = anims.getProgress();
  if (p < f.flinchHold) return f.flinchSpeed;
  const t = Math.min(1, (p - f.flinchHold) / Math.max(0.01, 1 - f.flinchHold));
  // Smoothstep, so it picks up speed without a jolt.
  return f.flinchSpeed + (1 - f.flinchSpeed) * t * t * (3 - 2 * t);
}
