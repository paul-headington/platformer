// Painted parts (transparent PNGs in art/<character>/) for the rigs: loads them, measures
// them, and shrinks them close to the size they will be drawn at, so the final render
// only has a small step left to scale (big downscales in one go look jagged).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const cache = new Map();

const sizeOf = (png) => [png.readUInt32BE(16), png.readUInt32BE(20)];

function rasterize(href, w, h, outW, outH) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${outW}" height="${outH}" viewBox="0 0 ${w} ${h}"><image href="${href}" width="${w}" height="${h}" image-rendering="optimizeQuality"/></svg>`;
  return new Resvg(svg).render();
}

/**
 * A part, ready to embed: { href, w, h, at(fx, fy) } where w and h are its natural size in
 * pixels. `drawWidth` is the width (in final pixels) it will roughly be drawn at.
 */
export function part(dir, name, drawWidth) {
  const key = `${dir}/${name}@${drawWidth}`;
  if (cache.has(key)) return cache.get(key);
  let png = readFileSync(join(dir, `${name}.png`));
  const [w, h] = sizeOf(png);
  // Halve until within 2x of the target size.
  let cw = w;
  let ch = h;
  let href = `data:image/png;base64,${png.toString('base64')}`;
  while (cw / 2 >= drawWidth * 2) {
    const nw = Math.round(cw / 2);
    const nh = Math.round(ch / 2);
    png = rasterize(href, cw, ch, nw, nh).asPng();
    href = `data:image/png;base64,${png.toString('base64')}`;
    [cw, ch] = [nw, nh];
  }
  const p = { href, w, h };
  cache.set(key, p);
  return p;
}

/** The middle of the lowest opaque rows of a part (between x0 and x1, as fractions), as fractions of its size: where a chin or a hem ends. */
export function bottomCentre(dir, name, band = 0.04, [x0, x1] = [0, 1]) {
  const png = readFileSync(join(dir, `${name}.png`));
  const [w, h] = sizeOf(png);
  const img = rasterize(`data:image/png;base64,${png.toString('base64')}`, w, h, w, h);
  const px = img.pixels;
  const [xa, xb] = [Math.floor(x0 * w), Math.ceil(x1 * w)];
  let bottom = 0;
  for (let y = h - 1; y >= 0 && !bottom; y--) for (let x = xa; x < xb; x++) if (px[(y * w + x) * 4 + 3] > 128) { bottom = y; break; }
  let sum = 0;
  let n = 0;
  for (let y = Math.floor(bottom - h * band); y <= bottom; y++) for (let x = xa; x < xb; x++) if (px[(y * w + x) * 4 + 3] > 128) { sum += x; n++; }
  return { x: sum / n / w, y: bottom / h };
}

/** An <image> of a part, scaled to `width` units, with the point (fx, fy) (fractions of its size) at the origin. */
export function placeImage(p, width, fx, fy, extra = '') {
  const height = (width * p.h) / p.w;
  return `<image href="${p.href}" x="${(-fx * width).toFixed(2)}" y="${(-fy * height).toFixed(2)}" width="${width.toFixed(2)}" height="${height.toFixed(2)}" image-rendering="optimizeQuality" preserveAspectRatio="none" ${extra}/>`;
}

/**
 * Measures a strip of `count` equal frames: { fw, fh } (one frame, in pixels), the box
 * around each frame's drawing and around all of them together ({ x0, y0, x1, y1 } in
 * pixels of one frame), and `legsX`: the middle, across all frames, of what is drawn in
 * the lowest `band` of the union box (the legs, a steadier centre than arms or blades).
 */
export function stripFrames(dir, name, count, band = 0.3) {
  const png = readFileSync(join(dir, `${name}.png`));
  const [w, h] = sizeOf(png);
  const px = rasterize(`data:image/png;base64,${png.toString('base64')}`, w, h, w, h).pixels;
  const fw = w / count;
  const boxes = Array.from({ length: count }, () => ({ x0: fw, y0: h, x1: 0, y1: 0 }));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] < 64) continue;
      const b = boxes[Math.floor(x / fw)];
      const fx = x % fw;
      b.x0 = Math.min(b.x0, fx); b.x1 = Math.max(b.x1, fx); b.y0 = Math.min(b.y0, y); b.y1 = Math.max(b.y1, y);
    }
  }
  const all = boxes.reduce((u, b) => ({ x0: Math.min(u.x0, b.x0), y0: Math.min(u.y0, b.y0), x1: Math.max(u.x1, b.x1), y1: Math.max(u.y1, b.y1) }));
  const top = all.y1 - (all.y1 - all.y0) * band;
  let [lx0, lx1] = [fw, 0];
  for (let y = Math.floor(top); y <= all.y1; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] < 64) continue;
      lx0 = Math.min(lx0, x % fw); lx1 = Math.max(lx1, x % fw);
    }
  }
  return { fw, fh: h, boxes, all, legsX: (lx0 + lx1) / 2 };
}
