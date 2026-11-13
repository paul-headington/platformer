import CLIP_TABLE from './clips.json';

/**
 * Animation clips cut from AI videos (src/clips.json, also read by tools/art, which puts
 * their frames in a character's high-res sheet from `start` on, clip after clip).
 */
export interface Clip {
  /** Frames of the sheet, in order. */
  frames: number[];
  fps: number;
  /** Plays once and holds the last frame, instead of looping. */
  once: boolean;
  /** For an attack: the frame where the blow lands. */
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
interface CharacterClips {
  start: number;
  clips: ClipSpec[];
}

/** A character's clips by name, with their frame numbers worked out. */
function table(spec: CharacterClips): Record<string, Clip> {
  let next = spec.start;
  const out: Record<string, Clip> = {};
  for (const k of spec.clips) {
    const n = k.frames?.length ?? k.strip;
    out[k.name] = { frames: Array.from({ length: n }, (_, i) => next + i), fps: k.fps, once: !!k.once, hitFrame: k.hitFrame };
    next += n;
  }
  return out;
}

const map = (group: Record<string, CharacterClips>) =>
  Object.fromEntries(Object.entries(group).map(([id, spec]) => [id, table(spec)])) as Record<string, Record<string, Clip>>;

/** Player skins' clips, by skin id. */
export const PLAYER_CLIPS = map(CLIP_TABLE.players);
/** Enemies' clips, by sheet name. */
export const ENEMY_CLIPS = map(CLIP_TABLE.enemies);

/** How many frames a sheet with these clips has, at least. */
export const clipsEnd = (clips: Record<string, Clip>) => Math.max(0, ...Object.values(clips).map((c) => c.frames.at(-1)! + 1));

/** Makes an animation `<prefix>-<clip>` for each clip, on `texture`. */
export function createClipAnims(scene: Phaser.Scene, texture: string, prefix: string, clips: Record<string, Clip>): void {
  for (const [name, c] of Object.entries(clips)) {
    scene.anims.create({ key: `${prefix}-${name}`, frames: scene.anims.generateFrameNumbers(texture, { frames: c.frames }), frameRate: c.fps, repeat: c.once ? 0 : -1 });
  }
}
