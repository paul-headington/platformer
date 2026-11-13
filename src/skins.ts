import Phaser from 'phaser';
import { DEFAULT_SKIN, REG, RENDER_SCALE, SKINS, type SkinId, type SkinStats, type WeaponId } from './config';
import CLIP_TABLE from './playerClips.json';

/**
 * Player skins. Every skin's sheet is loaded as `skin-<id>`, and the game itself
 * only ever draws the 'player' texture: a high-res canvas that the chosen skin is
 * copied onto. Swapping skins repaints that canvas, so the player sprite and the HUD
 * face change at once without touching anything that uses them.
 *
 * The canvas is a grid of PLAYER_FRAME-sized frames at RENDER_SCALE pixels per world
 * unit, and the player sprite is drawn at 1 / RENDER_SCALE. A high-res skin (built by
 * tools/art) is copied as it is. An old pixel-art skin (a strip of 20x24 frames from
 * tools/sprites.py) is scaled up frame by frame with crisp pixels.
 */
const STORAGE_KEY = 'platformer.skin';
/** One frame of an old pixel-art skin sheet. */
const PIXEL_FRAME = { w: 20, h: 24 } as const;
/** One frame of the 'player' texture, in high-res pixels. */
export const PLAYER_FRAME = { w: PIXEL_FRAME.w * RENDER_SCALE, h: PIXEL_FRAME.h * RENDER_SCALE } as const;
/** Frames per row in a high-res sheet (and the 'player' texture). */
const COLUMNS = 10;
/** Frames 0-35 mean the same in every skin (see tools/sprites.py); high-res skins add in-betweens after them. */
const SHARED_FRAMES = 36;
/**
 * The in-between frames a high-res skin adds, for smoother animation. Each weapon gets
 * four idle and four run in-betweens, starting at its `held` frame.
 */
export const PLAYER_HD_FRAMES = {
  idle: [36, 37, 38, 39],
  run: [40, 41, 42, 43],
  climb: [44, 45],
  held: { pistol: 46, shotgun: 54, machete: 62 } as Record<WeaponId, number>,
  total: 70,
} as const;
/**
 * Animation clips cut from AI videos, for skins that have them (src/playerClips.json,
 * also read by tools/art, which puts their frames in the sheet after the rigged ones).
 * Each replaces the rigged animation of the same name: idle, run, jump, fall, land,
 * climb, run-pistol, run-shotgun and swing (the machete).
 */
export interface PlayerClip {
  /** Frames of the 'player' texture, in order. */
  frames: number[];
  fps: number;
  /** Plays once and holds the last frame, instead of looping. */
  once: boolean;
  /** For the swing: the frame where the blade lands, timed to the weapon's hitAt. */
  hitFrame?: number;
}
interface ClipSpec {
  name: string;
  strip: number;
  frames?: number[];
  fps: number;
  once?: boolean;
  hitFrame?: number;
}
const CLIPS: Partial<Record<SkinId, Record<string, PlayerClip>>> = {};
let textureFrames: number = PLAYER_HD_FRAMES.total;
for (const [skin, spec] of Object.entries(CLIP_TABLE) as [SkinId, { clips: ClipSpec[] }][]) {
  let next = PLAYER_HD_FRAMES.total;
  const clips: Record<string, PlayerClip> = {};
  for (const k of spec.clips) {
    const n = k.frames?.length ?? k.strip;
    clips[k.name] = { frames: Array.from({ length: n }, (_, i) => next + i), fps: k.fps, once: !!k.once, hitFrame: k.hitFrame };
    next += n;
  }
  CLIPS[skin] = clips;
  textureFrames = Math.max(textureFrames, next);
}
/** Frames in the 'player' texture: the rigged ones and every skin's clips. */
const TEXTURE_FRAMES = textureFrames;

/** A clip of the skin being worn (see PlayerClip), if it has that one. */
export function playerClip(scene: Phaser.Scene, name: string): PlayerClip | undefined {
  return CLIPS[currentSkin(scene)]?.[name];
}

/** The default face crop in the HUD (world units): the head of an old pixel-art skin. */
const PIXEL_FACE = [4, 1, 13, 11] as const;

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
  const rows = Math.ceil(TEXTURE_FRAMES / COLUMNS);
  const tex = scene.textures.createCanvas('player', COLUMNS * PLAYER_FRAME.w, rows * PLAYER_FRAME.h)!;
  for (let i = 0; i < TEXTURE_FRAMES; i++) {
    tex.add(i, 0, (i % COLUMNS) * PLAYER_FRAME.w, Math.floor(i / COLUMNS) * PLAYER_FRAME.h, PLAYER_FRAME.w, PLAYER_FRAME.h);
  }
  applySkin(scene, savedSkin());
}

/** True when a skin has a high-res sheet (and so the in-between frames). */
export function isHd(id: SkinId): boolean {
  return !!(SKINS[id] as SkinStats).hd;
}

/** The skin being worn. */
export function currentSkin(scene: Phaser.Scene): SkinId {
  return (scene.registry.get(REG.skin) as SkinId | undefined) ?? savedSkin();
}

/** Which part of frame 0 to show as the face in the HUD, for a skin, in high-res pixels. */
export function faceCrop(id: SkinId): readonly [number, number, number, number] {
  const [x, y, w, h] = (SKINS[id] as SkinStats).face ?? PIXEL_FACE;
  return [x * RENDER_SCALE, y * RENDER_SCALE, w * RENDER_SCALE, h * RENDER_SCALE];
}

/** Repaints the 'player' texture with a skin and remembers the choice. */
export function applySkin(scene: Phaser.Scene, id: SkinId): void {
  const tex = scene.textures.get('player') as Phaser.Textures.CanvasTexture;
  if (!scene.textures.exists(`skin-${id}`)) id = DEFAULT_SKIN;
  const src = scene.textures.get(`skin-${id}`).getSourceImage() as HTMLImageElement;
  tex.clear();
  const ctx = tex.getContext();
  if (isHd(id)) {
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(src, 0, 0);
  } else {
    // Each pixel becomes a RENDER_SCALE square, so the old art stays crisp.
    ctx.imageSmoothingEnabled = false;
    const count = Math.min(SHARED_FRAMES, Math.floor(src.width / PIXEL_FRAME.w));
    for (let i = 0; i < count; i++) {
      const frame = tex.get(i);
      ctx.drawImage(src, i * PIXEL_FRAME.w, 0, PIXEL_FRAME.w, PIXEL_FRAME.h, frame.cutX, frame.cutY, PLAYER_FRAME.w, PLAYER_FRAME.h);
    }
  }
  tex.refresh();
  scene.registry.set(REG.skin, id);
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Not saved, but still worn for this session.
  }
}

/** Switches to the next skin in SKINS and returns it. */
export function nextSkin(scene: Phaser.Scene): SkinId {
  const next = skinIds[(skinIds.indexOf(currentSkin(scene)) + 1) % skinIds.length];
  applySkin(scene, next);
  return next;
}

/**
 * The player's animations, made twice: once with the frames every skin has, and once
 * (keys ending in -hd) with a high-res skin's in-between frames for smoother motion.
 * Use playerAnim() to pick the right one for the skin being worn.
 */
export function createPlayerAnims(scene: Phaser.Scene, holding: Record<WeaponId, number>): void {
  const make = (key: string, frames: number[], frameRate: number) =>
    scene.anims.create({ key, frames: scene.anims.generateFrameNumbers('player', { frames }), frameRate, repeat: -1 });
  const hd = PLAYER_HD_FRAMES;
  make('player-idle', [0, 0, 0, 1], 3);
  make('player-climb', [8, 9], 6);
  make('player-run', [2, 3, 4, 5], 10);
  make('player-idle-hd', [0, hd.idle[0], hd.idle[1], 1, hd.idle[2], hd.idle[3]], 5);
  make('player-climb-hd', [8, hd.climb[0], 9, hd.climb[1]], 9);
  make('player-run-hd', [2, hd.run[0], 3, hd.run[1], 4, hd.run[2], 5, hd.run[3]], 16);
  // The same idle and run holding each weapon (see PLAYER_HOLDING in GameScene).
  for (const [weapon, first] of Object.entries(holding) as [WeaponId, number][]) {
    make(`player-idle-${weapon}`, [first, first, first, first + 1], 3);
    make(`player-run-${weapon}`, [first + 2, first + 3, first + 4, first + 5], 10);
    const e = hd.held[weapon];
    make(`player-idle-${weapon}-hd`, [first, e, e + 1, first + 1, e + 2, e + 3], 5);
    make(`player-run-${weapon}-hd`, [first + 2, e + 4, first + 3, e + 5, first + 4, e + 6, first + 5, e + 7], 16);
  }
  // Each skin's video clips, as player-<clip>-<skin> (playerAnim prefers them).
  for (const [skin, clips] of Object.entries(CLIPS)) {
    for (const [name, c] of Object.entries(clips!)) {
      scene.anims.create({ key: `player-${name}-${skin}`, frames: scene.anims.generateFrameNumbers('player', { frames: c.frames }), frameRate: c.fps, repeat: c.once ? 0 : -1 });
    }
  }
}

/** The key of one of the player's animations, in the version that suits the skin being worn. */
export function playerAnim(scene: Phaser.Scene, key: string): string {
  const skin = currentSkin(scene);
  if (scene.anims.exists(`${key}-${skin}`)) return `${key}-${skin}`;
  return isHd(skin) ? `${key}-hd` : key;
}
