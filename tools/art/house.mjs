// The haunted house tiles, redrawn in the same soft anime style as the characters:
// clean shapes, thin dark lines, flat shading with one shadow tone and a soft highlight.
// Each sheet keeps the frame order of the pixel-art sheet it replaces (see TILE_SHEETS in
// tools/sprites.py); frames not redrawn yet fall back to the old pixel art, scaled up.
//
// Everything is now painted (Scenario art in art/house/); the vector tiles below are kept
// for reference.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clipped, ellipse, g, path, stroke, t, vgrad } from './svg.mjs';

const PAINTED_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'art', 'house');

export const CELL = 64;

const STONE = { fill: '#5d5a74', shade: '#4a4760', hi: '#77748f', line: '#25222f', mortar: '#2f2c3c' };
const WOOD = { fill: '#8a5a3a', shade: '#6c4329', hi: '#b07a52', line: '#2e1a10', dark: '#3a2418' };
const TEAL = { paper: '#2a4752', paperShade: '#223b45', motif: '#3c6370', motifHi: '#4e7c88', line: '#132229' };
const PANEL = { fill: '#6e4630', shade: '#55331f', hi: '#93613f', line: '#2a160d' };
const GOLD = { fill: '#d6a548', shade: '#a77a2c', hi: '#f2d48a', line: '#4a3210' };

/** A stone block with a highlight along its top and a shadow along its bottom. */
function block(x, y, w, h) {
  const shape = `M${x + 3} ${y} L${x + w - 3} ${y} Q${x + w} ${y} ${x + w} ${y + 3} L${x + w} ${y + h - 3} Q${x + w} ${y + h} ${x + w - 3} ${y + h} L${x + 3} ${y + h} Q${x} ${y + h} ${x} ${y + h - 3} L${x} ${y + 3} Q${x} ${y} ${x + 3} ${y} Z`;
  return (
    path(shape, STONE.fill, STONE.line, 1.4) +
    clipped(`<path d="${shape}"/>`,
      path(`M${x} ${y} L${x + w} ${y} L${x + w} ${y + 4} L${x} ${y + 4} Z`, STONE.hi),
      path(`M${x} ${y + h - 6} Q${x + w / 2} ${y + h - 9} ${x + w} ${y + h - 6} L${x + w} ${y + h} L${x} ${y + h} Z`, STONE.shade)) +
    stroke(`M${x + w * 0.62} ${y + h * 0.45} l3 2 l-1 3`, STONE.shade, 1.1)
  );
}

function wall() {
  return (
    `<rect width="64" height="64" fill="${STONE.mortar}"/>` +
    block(1, 1, 38, 30) + block(41, 1, 22, 30) + block(-23, 33, 34, 30) + block(13, 33, 38, 30) + block(53, 33, 34, 30)
  );
}

/** Polished floorboards on top, the dark beam of the floor below. */
function floorboards(trap = false) {
  const top = 16;
  const lid = trap ? '#7a4d31' : WOOD.fill;
  const lidShade = trap ? '#5e3a24' : WOOD.shade;
  let s =
    `<rect y="${top}" width="64" height="${64 - top}" fill="${WOOD.dark}"/>` +
    // The joist under the boards, with a soft shadow.
    path(`M0 ${top} L64 ${top} L64 ${top + 7} L0 ${top + 7} Z`, '#2a180f') +
    stroke(`M0 ${top + 22} L64 ${top + 22}`, '#2f1c12', 1.2) + stroke(`M0 ${top + 38} L64 ${top + 38}`, '#2f1c12', 1.2) +
    ellipse(14, top + 30, 1.5, 1, '#4a3022') + ellipse(46, top + 15, 1.5, 1, '#4a3022') + ellipse(38, top + 43, 1.5, 1, '#4a3022') +
    path(`M0 0 L64 0 L64 ${top} L0 ${top} Z`, lid, WOOD.line, 1.4) +
    path(`M0 1 L64 1 L64 4 L0 4 Z`, WOOD.hi) +
    path(`M0 ${top - 5} L64 ${top - 5} L64 ${top - 1} L0 ${top - 1} Z`, lidShade) +
    stroke('M30 1 L30 15', WOOD.line, 1.3) +
    stroke('M8 8 Q14 7 20 8', lidShade, 1) + stroke('M40 7 Q48 6 56 8', lidShade, 1);
  if (trap) {
    // Subtle but spottable: dark gaps at the lid's edges and a pale iron ring.
    s +=
      path('M0 0 L2.4 0 L2.4 16 L0 16 Z', '#140b06') + path('M61.6 0 L64 0 L64 16 L61.6 16 Z', '#140b06') +
      ellipse(32, 8, 4, 2.4, 'none', '#c9c3b4', 1.4) + ellipse(32, 6, 1.6, 1.2, '#8f897c', '#3a362e', 0.8);
  }
  return s;
}

function shelf() {
  // A plank on a carved moulding (brackets would repeat on every tile of a long shelf).
  return (
    path('M2 12 L62 12 L62 16 Q32 21 2 16 Z', WOOD.shade, WOOD.line, 1.2) +
    path('M0 0 L64 0 L64 12 L0 12 Z', WOOD.fill, WOOD.line, 1.4) +
    path('M1 1 L63 1 L63 4 L1 4 Z', WOOD.hi) + path('M1 8 L63 8 L63 11 L1 11 Z', WOOD.shade) +
    stroke('M20 2 L20 11', WOOD.line, 1) + ellipse(32, 15.5, 2, 1.4, WOOD.hi)
  );
}

/** Four steps climbing to the right (flip = climbing to the left). */
function stairs(flip = false) {
  let s = '';
  for (let i = 0; i < 4; i++) {
    const x = 48 - i * 16;
    const y = i * 16;
    // Each step: a tread on top, the riser and the solid stair beneath.
    s +=
      path(`M${x} ${y} L64 ${y} L64 64 L${x} 64 Z`, WOOD.dark, WOOD.line, 1.2) +
      path(`M${x} ${y} L64 ${y} L64 ${y + 6} L${x} ${y + 6} Z`, WOOD.fill, WOOD.line, 1.2) +
      path(`M${x + 1} ${y + 1} L63 ${y + 1} L63 ${y + 2.6} L${x + 1} ${y + 2.6} Z`, WOOD.hi) +
      path(`M${x} ${y + 6} L${x + 3} ${y + 6} L${x + 3} 64 L${x} 64 Z`, '#2a180f');
  }
  // A strip of red carpet up the middle of the treads.
  for (let i = 0; i < 4; i++) {
    const x = 48 - i * 16;
    const y = i * 16;
    s += path(`M${x + 2} ${y} L${x + 14} ${y} L${x + 14} ${y + 5} L${x + 2} ${y + 5} Z`, '#a8343a', '#4a1418', 0.9) + path(`M${x + 2} ${y + 5} L${x + 14} ${y + 5} L${x + 14} ${y + 16} L${x + 2} ${y + 16} Z`, '#7c2328', '#4a1418', 0.9);
  }
  return flip ? g('translate(64 0) scale(-1 1)', s) : s;
}

// ------------------------------------------------------------------ back wall

/** Teal damask wallpaper: soft stripes and a little fleur motif. */
function wallpaper() {
  const motif = (x, y) =>
    path(`M${x} ${y - 6} C${x + 3} ${y - 3} ${x + 3} ${y + 1} ${x} ${y + 4} C${x - 3} ${y + 1} ${x - 3} ${y - 3} ${x} ${y - 6} Z`, TEAL.motif) +
    path(`M${x - 6} ${y} C${x - 4} ${y - 3} ${x - 2} ${y - 2} ${x - 1} ${y} C${x - 2} ${y + 2} ${x - 4} ${y + 3} ${x - 6} ${y} Z`, TEAL.motif) +
    path(`M${x + 6} ${y} C${x + 4} ${y - 3} ${x + 2} ${y - 2} ${x + 1} ${y} C${x + 2} ${y + 2} ${x + 4} ${y + 3} ${x + 6} ${y} Z`, TEAL.motif) +
    ellipse(x, y - 2, 1, 1.2, TEAL.motifHi);
  return (
    `<rect width="64" height="64" fill="${TEAL.paper}"/>` +
    `<rect x="0" width="4" height="64" fill="${TEAL.paperShade}"/><rect x="32" width="4" height="64" fill="${TEAL.paperShade}"/>` +
    motif(18, 16) + motif(50, 48)
  );
}

function dadoRail() {
  return (
    wallpaper() +
    path('M0 52 L64 52 L64 64 L0 64 Z', PANEL.fill, PANEL.line, 1.2) +
    path('M0 53 L64 53 L64 56 L0 56 Z', PANEL.hi) + path('M0 61 L64 61 L64 64 L0 64 Z', PANEL.shade)
  );
}

function panelling() {
  const panel = (x) => {
    const d = `M${x + 4} 6 L${x + 28} 6 L${x + 28} 58 L${x + 4} 58 Z`;
    return path(d, PANEL.shade, PANEL.line, 1.2) + path(`M${x + 6} 8 L${x + 26} 8 L${x + 26} 11 L${x + 6} 11 Z`, PANEL.fill) + stroke(`M${x + 27} 8 L${x + 27} 57`, PANEL.hi, 1);
  };
  return `<rect width="64" height="64" fill="${PANEL.fill}"/>` + panel(0) + panel(32) + path('M0 0 L64 0 L64 3 L0 3 Z', PANEL.hi);
}

// ------------------------------------------------------------------ decorations

/** A gilt-framed portrait (n: 0 a pale lady with red eyes, 1 a moonlit graveyard). */
function portrait(n) {
  const frame = 'M8 6 L56 6 L56 58 L8 58 Z';
  const inner = 'M15 13 L49 13 L49 51 L15 51 Z';
  const [skyId, skyDefs] = vgrad(n ? [[0, '#1a2a4a'], [1, '#3a4f78']] : [[0, '#3a2a40'], [1, '#22182a']]);
  const art = n
    ? `<rect x="15" y="13" width="34" height="38" fill="url(#${skyId})"/>` +
      ellipse(40, 22, 4.5, 4.5, '#f4f0c8') +
      path('M15 42 Q30 36 49 41 L49 51 L15 51 Z', '#2c3a2c') +
      path('M28 32 L30 32 L30 35 L33 35 L33 37 L30 37 L30 45 L28 45 L28 37 L25 37 L25 35 L28 35 Z', '#6a6a72', '#1a1a20', 0.8)
    : `<rect x="15" y="13" width="34" height="38" fill="url(#${skyId})"/>` +
      path('M22 51 C22 40 26 37 32 37 C38 37 42 40 42 51 Z', '#5a1e2a', '#1a0a10', 1) +
      path('M23 30 C21 18 43 18 41 30 C41 38 36 41 32 41 C28 41 23 38 23 30 Z', '#2a1a22', '#1a0a10', 1) +
      ellipse(32, 30, 6.5, 8, '#f0e2e0', '#5a3a3a', 0.9) +
      ellipse(29.5, 29, 1.2, 1.6, '#e0303a') + ellipse(34.5, 29, 1.2, 1.6, '#e0303a') +
      stroke('M30.5 34.5 Q32 35.5 33.5 34.5', '#8a3a40', 0.8);
  return (
    `<defs>${skyDefs}</defs>` +
    path(frame, GOLD.fill, GOLD.line, 1.5) +
    path('M8 6 L56 6 L52 10 L12 10 Z', GOLD.hi) + path('M8 58 L56 58 L52 54 L12 54 Z', GOLD.shade) +
    path(inner, '#000', GOLD.line, 1.3) + art + stroke('M15 13 L49 13', '#000', 1.5, 'opacity="0.4"')
  );
}

const BOOK_COLOURS = ['#8a2c34', '#2c4a7a', '#3a6a3e', '#c49a3a', '#5a3a6e', '#9a5a2a', '#2a5a5a'];
function books(x0, x1, base, seed) {
  let s = '';
  let x = x0;
  let k = seed;
  while (x < x1 - 3) {
    k = (k * 7 + 3) % 97;
    const w = 4 + (k % 3);
    const h = 13 + (k % 5);
    const c = BOOK_COLOURS[k % BOOK_COLOURS.length];
    const lean = k % 11 === 0 && x + w + 4 < x1;
    const d = lean ? `M${x} ${base} L${x + w} ${base} L${x + w + 4} ${base - h + 1} L${x + 4} ${base - h} Z` : `M${x} ${base} L${x + w} ${base} L${x + w} ${base - h} L${x} ${base - h} Z`;
    s += path(d, c, '#1a0f0a', 0.9) + (lean ? '' : stroke(`M${x + 1} ${base - h + 3} L${x + w - 1} ${base - h + 3}`, '#e8d49a', 0.8, 'opacity="0.7"'));
    x += w + (lean ? 4 : 0.5);
  }
  return s;
}

/** A bookcase two tiles tall: top (shelves of books), bottom (books over a cupboard). */
function bookcase(bottom) {
  const side = path('M4 0 L60 0 L60 64 L4 64 Z', WOOD.shade, WOOD.line, 1.4) + path('M8 0 L56 0 L56 64 L8 64 Z', '#2a1810');
  if (!bottom) {
    return side + path('M2 2 L62 2 L62 10 L2 10 Z', WOOD.fill, WOOD.line, 1.3) + path('M2 3 L62 3 L62 5 L2 5 Z', WOOD.hi) +
      books(9, 55, 34, 3) + path('M8 34 L56 34 L56 38 L8 38 Z', WOOD.fill, WOOD.line, 1) +
      books(9, 55, 62, 11) + path('M8 62 L56 62 L56 64 L8 64 Z', WOOD.fill);
  }
  return side + books(9, 55, 26, 23) + path('M8 26 L56 26 L56 30 L8 30 Z', WOOD.fill, WOOD.line, 1) +
    path('M8 30 L56 30 L56 62 L8 62 Z', WOOD.fill, WOOD.line, 1.2) + stroke('M32 30 L32 62', WOOD.line, 1.2) +
    path('M12 34 L29 34 L29 58 L12 58 Z', WOOD.shade, WOOD.line, 1) + path('M35 34 L52 34 L52 58 L35 58 Z', WOOD.shade, WOOD.line, 1) +
    ellipse(28, 46, 1.4, 1.4, GOLD.fill, GOLD.line, 0.6) + ellipse(36, 46, 1.4, 1.4, GOLD.fill, GOLD.line, 0.6) +
    path('M4 62 L60 62 L60 64 L4 64 Z', WOOD.dark);
}

/** A cobweb strung across a top corner (right = in the top-right corner). */
function cobweb(right) {
  const web = '#d8dcf0';
  let s = '';
  const rays = [0, 22, 45, 68, 90];
  const R = 46;
  for (const a of rays) {
    const rad = (a * Math.PI) / 180;
    s += stroke(`M0 0 L${Math.cos(rad) * R} ${Math.sin(rad) * R}`, web, 0.8, 'opacity="0.55"');
  }
  for (const rr of [10, 20, 31, 42]) {
    let d = '';
    rays.forEach((a, i) => {
      const rad = (a * Math.PI) / 180;
      const p = [Math.cos(rad) * rr, Math.sin(rad) * rr];
      if (i === 0) d += `M${p[0]} ${p[1]}`;
      else {
        const mid = ((a - 11) * Math.PI) / 180;
        d += ` Q${Math.cos(mid) * rr * 0.86} ${Math.sin(mid) * rr * 0.86} ${p[0]} ${p[1]}`;
      }
    });
    s += stroke(d, web, 0.8, 'opacity="0.5"');
  }
  return right ? g('translate(64 0) scale(-1 1)', s) : s;
}

/**
 * A painted tile from art/house/ (Scenario art at 10 px per unit), filling the cell;
 * `mirror` flips it left to right.
 */
function painted(file, mirror = false, crop = null) {
  const png = readFileSync(join(PAINTED_DIR, `${file}.png`));
  const [w, h] = [png.readUInt32BE(16), png.readUInt32BE(20)];
  const href = `data:image/png;base64,${png.toString('base64')}`;
  // `crop` picks one tile-sized piece of a bigger picture: [column, row] in tiles of 160 px.
  const [cx, cy] = crop ?? [0, 0];
  const [vw, vh] = crop ? [160, 160] : [w, h];
  const image = `<svg width="${CELL}" height="${CELL}" viewBox="${cx * 160} ${cy * 160} ${vw} ${vh}" preserveAspectRatio="none" overflow="hidden"><image href="${href}" width="${w}" height="${h}" image-rendering="optimizeQuality"/></svg>`;
  return () => (mirror ? g(`translate(${CELL} 0) scale(-1 1)`, image) : image);
}

/**
 * Frames to draw in high res, per sheet; any other frame falls back to the pixel art.
 * Everything is painted (art/house/); the vector tiles above are no longer used.
 */
export const SHEETS = {
  tiles: {
    pixel: 'tiles.png',
    frames: Object.fromEntries(
      ['tile_stone', 'tile_shelf', 'tile_ladder', 'tile_ladder_top', 'tile_stairs', ['tile_stairs', true], 'tile_floorboards', 'tile_roof',
        'tile_flagstone', 'tile_crate', 'tile_trap_boards', 'tile_trap_boards_open', 'tile_trap_flag', 'tile_trap_flag_open']
        .map((f, i) => [i, Array.isArray(f) ? painted(...f) : painted(f)]),
    ),
  },
  back: {
    pixel: 'back.png',
    frames: Object.fromEntries(
      ['back_attic_planks', 'back_mauve_paper', 'back_mauve_rail', 'back_mauve_panel', 'back_teal_paper', 'back_teal_rail', 'back_teal_panel',
        'back_cellar_stone', 'back_floor_gap', 'back_sage_paper', 'back_sage_rail', 'back_sage_panel']
        .map((f, i) => [i, painted(f)]),
    ),
  },
  // 0-3 window (a 2x2 picture), 4-5 cobweb (left, right), 6-7 portraits, 8-9 bookcase (top,
  // bottom), 10 vent, 11-15 library bookcase (top, middle, middle, base, gap), 16 armchair.
  decor: {
    pixel: 'decor.png',
    frames: {
      0: painted('window', false, [0, 0]), 1: painted('window', false, [1, 0]), 2: painted('window', false, [0, 1]), 3: painted('window', false, [1, 1]),
      4: painted('cobweb'), 5: painted('cobweb', true), 6: painted('portrait_lady'), 7: painted('portrait_moon'),
      8: painted('bookcase', false, [0, 0]), 9: painted('bookcase', false, [0, 1]), 10: painted('vent'),
      11: painted('library_top'), 12: painted('library_mid'), 13: painted('library_mid'), 14: painted('library_base'), 15: painted('library_gap'),
      16: painted('armchair'),
    },
  },
};

export { t };
