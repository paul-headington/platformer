// Builds the high-res sprite sheets in public/sprites/hd from the SVG rigs in this folder.
// Run with `npm run art`. Each sheet is a grid of frames, `columns` wide; the game's frame
// layout is documented in src/skins.ts (PLAYER_HD_FRAMES).
//
//   node tools/art/build.mjs            all sheets, plus docs/hd-preview.png
//   node tools/art/build.mjs --svg      also write the SVG next to each PNG, for debugging
//   node tools/art/build.mjs --only=ink just the sheets whose name contains 'ink'

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { svgDoc, g, t } from './svg.mjs';
import { sheet as vectorHunter } from './hunter.mjs';
import { PAINTED } from './painted.mjs';
import { CELL, SHEETS as HOUSE } from './house.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = join(root, 'public', 'sprites', 'hd');
mkdirSync(out, { recursive: true });
const keepSvg = process.argv.includes('--svg');

const render = (svg, opts = {}) => new Resvg(svg, { font: { loadSystemFonts: false }, ...opts }).render().asPng();
/**
 * The art is designed at 4 px per world unit (a tile is 64, the player frame 80x96) and
 * rendered at the game's RENDER_SCALE (src/config.ts) px per unit. Keep the two in step.
 */
const RENDER_SCALE = 5;
const atScale = { fitTo: { mode: 'zoom', value: RENDER_SCALE / 4 } };

function buildSheet(s) {
  const { w, h } = s.frame;
  const rows = Math.ceil(s.count / s.columns);
  const poses = s.frames();
  const video = s.videoFrames?.() ?? {};
  const body = Array.from({ length: s.count }, (_, i) => {
    const art = video[i] ?? (poses[i] ? s.draw(poses[i]) : '');
    return art ? g(t((i % s.columns) * w, Math.floor(i / s.columns) * h), art) : '';
  }).join('');
  const svg = svgDoc(s.columns * w, rows * h, body);
  if (keepSvg) writeFileSync(join(out, `${s.name}.svg`), svg);
  writeFileSync(join(out, `${s.name}.png`), render(svg, atScale));
  console.log(`wrote public/sprites/hd/${s.name}.png (${poses.filter(Boolean).length} rigged, ${Object.keys(video).length} video frames)`);
  return poses;
}

/** A preview of the main poses, zoomed in on a dark background (docs/hd-preview.png). */
function preview(s, poses, pick) {
  const { w, h } = s.frame;
  const bg = `<rect width="100%" height="100%" fill="#2a2238"/>`;
  const floor = (i) => `<rect x="${i * w}" y="${h - 1}" width="${w}" height="1" fill="#5a4a6a"/>`;
  const body = pick.map((n, i) => floor(i) + g(t(i * w, 0), s.draw(poses[n]))).join('');
  const svg = svgDoc(pick.length * w, h, bg + body);
  const file = s.name === 'player-hunter' ? 'hd-preview.png' : `hd-preview-${s.name.replace('player-', '')}.png`;
  writeFileSync(join(root, 'docs', file), render(svg, { fitTo: { mode: 'zoom', value: 3 } }));
  console.log(`wrote docs/${file}`);
}

/**
 * A tile sheet: one row of CELL-sized frames, in the frame order of the pixel-art sheet it
 * replaces. Frames not drawn in high res yet are the old pixel art, scaled up with crisp pixels.
 */
function buildTiles(name, { pixel, frames }) {
  const png = readFileSync(join(root, 'public', 'sprites', pixel));
  const [pw, ph] = [png.readUInt32BE(16), png.readUInt32BE(20)];
  const count = Math.floor(pw / ph);
  const href = `data:image/png;base64,${png.toString('base64')}`;
  let body = '';
  for (let i = 0; i < count; i++) {
    const x = i * CELL;
    body += frames[i]
      ? `<svg x="${x}" y="0" width="${CELL}" height="${CELL}" viewBox="0 0 ${CELL} ${CELL}" overflow="hidden">${frames[i]()}</svg>`
      : `<svg x="${x}" y="0" width="${CELL}" height="${CELL}" viewBox="${i * ph} 0 ${ph} ${ph}" overflow="hidden"><image href="${href}" width="${pw}" height="${ph}" image-rendering="optimizeSpeed"/></svg>`;
  }
  const svg = svgDoc(count * CELL, CELL, body);
  if (keepSvg) writeFileSync(join(out, `${name}.svg`), svg);
  writeFileSync(join(out, `${name}.png`), render(svg, atScale));
  console.log(`wrote public/sprites/hd/${name}.png (${Object.keys(frames).length} of ${count} frames redrawn)`);
}

for (const [name, spec] of Object.entries(HOUSE)) buildTiles(name, spec);
// Painted characters (art/<id>/), and the vector-drawn hunter when his parts are missing.
const sheets = PAINTED.some((s) => s.name === 'player-hunter') ? PAINTED : [vectorHunter, ...PAINTED];
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
for (const sheet of sheets) {
  if (only && !sheet.name.includes(only)) continue;
  const poses = buildSheet(sheet);
  preview(sheet, poses, [0, 1, 2, 40, 3, 41, 6, 7, 8, 10, 18, 26, 34, 35]);
}
