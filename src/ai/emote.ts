import Phaser from 'phaser';

/** Frames in the 'emote' sheet. */
export const EMOTE = { spotted: 0, lost: 1 } as const;

/** Pops a little "!" or "?" over an enemy's head that floats up and fades. */
export function emote(sprite: Phaser.GameObjects.Sprite, top: number, frame: number): void {
  const scene = sprite.scene;
  const e = scene.add.image(sprite.x, top - 6, 'emote', frame).setDepth(11);
  scene.tweens.add({ targets: e, y: e.y - 5, duration: 250, ease: 'Back.out' });
  scene.tweens.add({ targets: e, alpha: 0, delay: 700, duration: 250, onComplete: () => e.destroy() });
}
