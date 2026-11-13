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
 * The box around everything drawn in a strip of `count` equal frames (all frames together),
 * as fractions of one frame: { x0, y0, x1, y1 }.
 */
export function stripBounds(dir, name, count) {
  const png = readFileSync(join(dir, `${name}.png`));
  const [w, h] = sizeOf(png);
  const px = rasterize(`data:image/png;base64,${png.toString('base64')}`, w, h, w, h).pixels;
  const fw = w / count;
  let [x0, y0, x1, y1] = [fw, h, 0, 0];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] < 64) continue;
      const fx = x % fw;
      x0 = Math.min(x0, fx); x1 = Math.max(x1, fx); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
  }
  return { x0: x0 / fw, y0: y0 / h, x1: x1 / fw, y1: y1 / h, aspect: fw / h };
}
