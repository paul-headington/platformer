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
import { clipCount, clipSlots } from './clips.mjs';
import { FRAME } from './hunter.mjs';
import { part, placeImage } from './parts.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = join(root, 'public', 'sprites', 'hd');
mkdirSync(out, { recursive: true });
const keepSvg = process.argv.includes('--svg');
const onlyArg = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
const only = onlyArg;

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

/**
 * An enemy sheet: its video clips (src/clips.json) after the frames of its pixel-art sheet,
 * which stay, scaled up, for moves with no clip yet (a zombie climbing). The first `stand`
 * cells (the old walk) become frames of the first clip, so code that sets them still works.
 */
function buildEnemy(name, spec, stand) {
  const dir = join(root, 'art', name);
  const png = readFileSync(join(root, 'public', 'sprites', `${name}.png`));
  const [pw, ph] = [png.readUInt32BE(16), png.readUInt32BE(20)];
  const href = `data:image/png;base64,${png.toString('base64')}`;
  const pixelW = (ph * FRAME.w) / FRAME.h;
  const { slots, scale } = clipSlots(dir, `${name}_clip_`, spec);
  const count = spec.start + clipCount(spec);
  const rows = Math.ceil(count / 10);
  let body = '';
  for (let i = 0; i < count; i++) {
    const at = t((i % 10) * FRAME.w, Math.floor(i / 10) * FRAME.h);
    const art =
      i < stand.length ? slots[spec.start + stand[i]].replace(/<defs>.*?<\/defs>/, '') :
      slots[i] ?? (i < spec.start ? `<svg width="${FRAME.w}" height="${FRAME.h}" viewBox="${i * pixelW} 0 ${pixelW} ${ph}" overflow="hidden"><image href="${href}" width="${pw}" height="${ph}" image-rendering="optimizeSpeed"/></svg>` : '');
    body += g(at, art);
  }
  // The first clip's frames reuse its mask, so define it once, outside every cell.
  const defs = slots[spec.start].match(/<defs>.*?<\/defs>/)[0];
  const svg = svgDoc(10 * FRAME.w, rows * FRAME.h, defs + body.replace(/<defs>.*?<\/defs>/g, ''));
  if (keepSvg) writeFileSync(join(out, `${name}.svg`), svg);
  writeFileSync(join(out, `${name}.png`), render(svg, atScale));
  console.log(`wrote public/sprites/hd/${name}.png (${count} frames, clips from ${spec.start})`);
  return scale;
}

/** A loose prop at the clips' scale: `width` in source pixels of the clips (halved art). */
function buildProp(name, file, width, scale) {
  const p = part(join(root, 'art', name), file, width * scale * 1.25);
  const w = width * scale;
  const h = (w * p.h) / p.w;
  const svg = svgDoc(w, h, placeImage(p, w, 0, 0));
  writeFileSync(join(out, `${name}-head.png`), render(svg, atScale));
  console.log(`wrote public/sprites/hd/${name}-head.png`);
}

/**
 * Pictures painted at 10 px per world unit (pickups, shots, house props), each scaled to the
 * game's RENDER_SCALE px per unit, as public/sprites/hd/<texture key>.png.
 */
const PROPS = {
  pickups: { gem: 'gem', key: 'key', gun: 'pistol', shotgun: 'shotgun', machete: 'machete', jacket: 'jacket', bullet: 'bullet', salt: 'salt' },
  house: { candle: 'candle', door: 'door', sky: 'sky', 'pull-book': 'pull_book', rug: 'rug', 'hatch-lid': 'hatch_lid' },
};
function buildProps(folder) {
  const files = PROPS[folder];
  for (const [key, file] of Object.entries(files)) {
    const png = readFileSync(join(root, 'art', folder, `${file}.png`));
    const [w, h] = [png.readUInt32BE(16), png.readUInt32BE(20)];
    const svg = svgDoc(w, h, `<image href="data:image/png;base64,${png.toString('base64')}" width="${w}" height="${h}" image-rendering="optimizeQuality"/>`);
    writeFileSync(join(out, `${key}.png`), render(svg, { fitTo: { mode: 'zoom', value: RENDER_SCALE / 10 } }));
  }
  console.log(`wrote ${Object.keys(files).length} ${folder} pictures to public/sprites/hd/`);
}

const ENEMIES = JSON.parse(readFileSync(join(root, 'src', 'clips.json'), 'utf8')).enemies;

for (const [name, spec] of Object.entries(HOUSE)) buildTiles(name, spec);
if (!onlyArg || 'pickups'.includes(onlyArg)) buildProps('pickups');
if (!onlyArg || 'house'.includes(onlyArg)) buildProps('house');
if (!onlyArg || 'zombie'.includes(onlyArg)) {
  // Zombie: cells 0-3 were the walk (3 is where it stands still); the head is about 0.3x.
  const scale = buildEnemy('zombie', ENEMIES.zombie, [0, 3, 6, 9]);
  buildProp('zombie', 'zombie_head', 816 * 0.3 / 2, scale);
}
// Ghost: cells 0-3 were the float.
if (!onlyArg || 'ghost'.includes(onlyArg)) buildEnemy('ghost', ENEMIES.ghost, [0, 5, 10, 15]);
if (!onlyArg || 'vampire'.includes(onlyArg)) {
  // Vampire: cell 0 was where it stands (idle 0-1, walk 2-5); its head is about 0.3x.
  const scale = buildEnemy('vampire', ENEMIES.vampire, [0, 10, 21, 25, 29, 33]);
  buildProp('vampire', 'vampire_head', 814 * 0.3 / 2, scale);
}
// Painted characters (art/<id>/), and the vector-drawn hunter when his parts are missing.
const sheets = PAINTED.some((s) => s.name === 'player-hunter') ? PAINTED : [vectorHunter, ...PAINTED];
for (const sheet of sheets) {
  if (only && !sheet.name.includes(only)) continue;
  const poses = buildSheet(sheet);
  preview(sheet, poses, [0, 1, 2, 40, 3, 41, 6, 7, 8, 10, 18, 26, 34, 35]);
}
