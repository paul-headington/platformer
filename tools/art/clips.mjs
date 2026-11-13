// Frames cut from AI video clips (src/clips.json) for a sheet of 80x96 design-unit cells.

import { FRAME, GROUND } from './hunter.mjs';
import { part, stripFrames } from './parts.mjs';

/** Final pixels per design unit (RENDER_SCALE / 4, see build.mjs). */
const PX = 1.25;

/** How many sheet cells a character's clips take. */
export const clipCount = (spec) => spec.clips.reduce((n, k) => n + (k.frames?.length ?? k.strip), 0);

/**
 * The SVG for each clip frame, by sheet cell, starting at `spec.start`, clip after clip.
 * The clips are `<prefix><file>.png` in `dir`: grids of frames, up to 8 a row (resvg
 * drops the far end of a very long strip). Every clip is drawn at one scale (times its
 * own `scale`, if any), set so that the first clip stands `standHeight` design units tall.
 * An "anchor": "strip" clip is placed as one, so the body stays registered from frame to
 * frame: its lowest point on the ground and its legs centred (or, with "centre": "all", the
 * whole drawing: a body lying flat). A "feet" clip (a jump, where the body moves up and down
 * in the video) puts each frame's lowest point on the ground, as the game moves the body.
 * A "video" clip (a floating ghost) keeps its place in the source video (`origin`, its crop
 * there), so every such clip lines up with the first, whose middle is the cell's middle.
 * What reaches past the sides of a cell (a muzzle blast, a swipe) fades out. `px` is the
 * final pixels per design unit of the sheet (bigger for the player, see build.mjs).
 */
export function clipSlots(dir, prefix, spec, px = PX) {
  const e = 5 / FRAME.w;
  const fadeEdges =
    `<defs><linearGradient id="clipfadeg"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="${e}" stop-color="#fff"/><stop offset="${1 - e}" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `<mask id="clipfade" maskUnits="userSpaceOnUse" x="0" y="0" width="${FRAME.w}" height="${FRAME.h}"><rect width="${FRAME.w}" height="${FRAME.h}" fill="url(#clipfadeg)"/></mask></defs>`;
  const measure = (k) => stripFrames(dir, `${prefix}${k.file}`, k.strip);
  const ref = measure(spec.clips[0]);
  const base = spec.standHeight / (ref.all.y1 - ref.all.y0); // design units per source pixel
  // For "video" clips: the middle of the first clip's drawing, in pixels of the source video
  // (halved, like the art), which goes in the middle of the cell.
  const origin = (k) => (k.origin ?? [0, 0]).map((v) => v / 2);
  // With `ground` (a character that stands), the first clip's feet go on the ground instead.
  const o0 = origin(spec.clips[0]);
  const mid = [o0[0] + (ref.all.x0 + ref.all.x1) / 2, o0[1] + (spec.ground ? ref.all.y1 : (ref.all.y0 + ref.all.y1) / 2)];
  const midY = spec.ground ? GROUND : FRAME.h / 2;
  const slots = {};
  let slot = spec.start;
  for (const k of spec.clips) {
    const m = measure(k);
    const scale = base * (k.scale ?? 1); // some videos framed the character a little smaller
    const [fw, fh] = [m.fw * scale, m.fh * scale];
    const sheet = part(dir, `${prefix}${k.file}`, fw * m.columns * px);
    const sx = sheet.w / m.columns; // one frame, in pixels of the (maybe shrunk) picture
    const sy = sheet.h / m.rows;
    const video = k.anchor === 'video';
    const x = video
      ? FRAME.w / 2 + (origin(k)[0] - mid[0]) * scale
      : FRAME.w / 2 + 1 - (k.centre === 'all' ? (m.all.x0 + m.all.x1) / 2 : m.legsX) * scale;
    for (const i of k.frames ?? [...Array(k.strip).keys()]) {
      const bottom = k.anchor === 'feet' ? m.boxes[i].y1 : m.all.y1;
      const y = video ? midY + (origin(k)[1] - mid[1]) * scale : GROUND - bottom * scale;
      slots[slot] =
        (slot === spec.start ? fadeEdges : '') +
        `<g mask="url(#clipfade)"><svg x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${fw.toFixed(2)}" height="${fh.toFixed(2)}" viewBox="${(i % m.columns) * sx} ${Math.floor(i / m.columns) * sy} ${sx} ${sy}" preserveAspectRatio="none" overflow="hidden">` +
        `<image href="${sheet.href}" width="${sheet.w}" height="${sheet.h}" image-rendering="optimizeQuality"/></svg></g>`;
      slot++;
    }
  }
  return { slots, scale: base };
}
