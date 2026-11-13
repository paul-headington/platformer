import Phaser from 'phaser';
import { DEFAULT_SKIN, REG, SKINS, type SkinId } from './config';

/**
 * Player skins. Every skin's sheet is loaded as `skin-<id>`, and the game itself
 * only ever draws the 'player' texture: a canvas that the chosen skin is copied
 * onto. Swapping skins repaints that canvas, so the player sprite, its animations
 * and the HUD face all change at once without touching anything that uses them.
 */
const STORAGE_KEY = 'platformer.skin';
const FRAME_W = 20;
const FRAME_H = 24;

export const skinIds = Object.keys(SKINS) as SkinId[];

export function savedSkin(): SkinId {
  try {
    const id = localStorage.getItem(STORAGE_KEY);
    if (id && id in SKINS) return id as SkinId;
  } catch {
    // Storage can be blocked (private mode, file://): fall back to the default.
  }
  return DEFAULT_SKIN;
}

export function loadSkins(load: Phaser.Loader.LoaderPlugin, version: string): void {
  for (const id of skinIds) load.image(`skin-${id}`, `${SKINS[id].sheet}${version}`);
}

/** Makes the 'player' texture, cut into frames like a sprite sheet, wearing the saved skin. */
export function createPlayerTexture(scene: Phaser.Scene): void {
  const src = scene.textures.get(`skin-${DEFAULT_SKIN}`).getSourceImage() as HTMLImageElement;
  const tex = scene.textures.createCanvas('player', src.width, src.height)!;
  for (let i = 0; i < Math.floor(src.width / FRAME_W); i++) tex.add(i, 0, i * FRAME_W, 0, FRAME_W, FRAME_H);
  applySkin(scene, savedSkin());
}

/** Repaints the 'player' texture with a skin and remembers the choice. */
export function applySkin(scene: Phaser.Scene, id: SkinId): void {
  const tex = scene.textures.get('player') as Phaser.Textures.CanvasTexture;
  const key = scene.textures.exists(`skin-${id}`) ? `skin-${id}` : `skin-${DEFAULT_SKIN}`;
  const src = scene.textures.get(key).getSourceImage() as HTMLImageElement;
  tex.clear();
  tex.draw(0, 0, src);
  scene.registry.set(REG.skin, id);
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Not saved, but still worn for this session.
  }
}

/** Switches to the next skin in SKINS and returns it. */
export function nextSkin(scene: Phaser.Scene): SkinId {
  const now = (scene.registry.get(REG.skin) as SkinId | undefined) ?? savedSkin();
  const next = skinIds[(skinIds.indexOf(now) + 1) % skinIds.length];
  applySkin(scene, next);
  return next;
}
