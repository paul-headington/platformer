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
 * What reaches past the sides of a cell (a muzzle blast, a swipe) fades out.
 */
export function clipSlots(dir, prefix, spec) {
  const e = 5 / FRAME.w;
  const fadeEdges =
    `<defs><linearGradient id="clipfadeg"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="${e}" stop-color="#fff"/><stop offset="${1 - e}" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `<mask id="clipfade" maskUnits="userSpaceOnUse" x="0" y="0" width="${FRAME.w}" height="${FRAME.h}"><rect width="${FRAME.w}" height="${FRAME.h}" fill="url(#clipfadeg)"/></mask></defs>`;
  const measure = (k) => stripFrames(dir, `${prefix}${k.file}`, k.strip);
  const ref = measure(spec.clips[0]);
  const base = spec.standHeight / (ref.all.y1 - ref.all.y0); // design units per source pixel
  const slots = {};
  let slot = spec.start;
  for (const k of spec.clips) {
    const m = measure(k);
    const scale = base * (k.scale ?? 1); // some videos framed the character a little smaller
    const [fw, fh] = [m.fw * scale, m.fh * scale];
    const sheet = part(dir, `${prefix}${k.file}`, fw * m.columns * PX);
    const sx = sheet.w / m.columns; // one frame, in pixels of the (maybe shrunk) picture
    const sy = sheet.h / m.rows;
    const x = FRAME.w / 2 + 1 - (k.centre === 'all' ? (m.all.x0 + m.all.x1) / 2 : m.legsX) * scale;
    for (const i of k.frames ?? [...Array(k.strip).keys()]) {
      const bottom = k.anchor === 'feet' ? m.boxes[i].y1 : m.all.y1;
      const y = GROUND - bottom * scale;
      slots[slot] =
        (slot === spec.start ? fadeEdges : '') +
        `<g mask="url(#clipfade)"><svg x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${fw.toFixed(2)}" height="${fh.toFixed(2)}" viewBox="${(i % m.columns) * sx} ${Math.floor(i / m.columns) * sy} ${sx} ${sy}" preserveAspectRatio="none" overflow="hidden">` +
        `<image href="${sheet.href}" width="${sheet.w}" height="${sheet.h}" image-rendering="optimizeQuality"/></svg></g>`;
      slot++;
    }
  }
  return { slots, scale: base };
}
