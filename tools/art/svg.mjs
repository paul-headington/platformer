// Small helpers for writing SVG by hand: shapes with an outline, transforms, clip paths.
// Everything here returns SVG markup as a string.

let uid = 0;
/** A unique id for clip paths and gradients, so frames on one sheet don't clash. */
export const id = (name) => `${name}${++uid}`;

const n = (v) => (Math.round(v * 100) / 100).toString();

export const g = (transform, ...children) => `<g transform="${transform}">${children.join('')}</g>`;
export const t = (x, y) => `translate(${n(x)} ${n(y)})`;
export const r = (deg) => `rotate(${n(deg)})`;
export const tr = (x, y, deg = 0) => `${t(x, y)} ${r(deg)}`;

/** A filled path with an outline. */
export const path = (d, fill, line, width = 1.3, extra = '') =>
  `<path d="${d}" fill="${fill}"${line ? ` stroke="${line}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"` : ''} ${extra}/>`;

/** A line (no fill). */
export const stroke = (d, line, width = 1.3, extra = '') =>
  `<path d="${d}" fill="none" stroke="${line}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round" ${extra}/>`;

export const ellipse = (cx, cy, rx, ry, fill, line, width = 1.3, extra = '') =>
  `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" fill="${fill}"${line ? ` stroke="${line}" stroke-width="${width}"` : ''} ${extra}/>`;

/**
 * A rounded limb from (0,0) to (0,len): an outline stroke under a fill stroke, the cheap way
 * to draw a capsule with a line around it.
 */
export const limb = (len, width, fill, line, lineWidth = 1.3) =>
  `<path d="M0 0 L0 ${n(len)}" stroke="${line}" stroke-width="${n(width + lineWidth * 2)}" stroke-linecap="round"/>` +
  `<path d="M0 0 L0 ${n(len)}" stroke="${fill}" stroke-width="${n(width)}" stroke-linecap="round"/>`;

/** Wraps children in a clip path made of the given shape markup. Returns [defs, clipped group]. */
export const clipped = (shape, ...children) => {
  const cid = id('c');
  return `<clipPath id="${cid}">${shape}</clipPath><g clip-path="url(#${cid})">${children.join('')}</g>`;
};

/** A vertical linear gradient. Returns [gradient id, defs markup]. */
export const vgrad = (stops) => {
  const gid = id('gr');
  const s = stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('');
  return [gid, `<linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">${s}</linearGradient>`];
};

export const svgDoc = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

/** Forward kinematics for a chain hanging from (x, y): each segment [length, angle], angles add up. 0 = straight down, positive = swung back (clockwise when facing right is forward... see rig). */
export function chainEnd(x, y, segments) {
  let a = 0;
  for (const [len, deg] of segments) {
    a += deg;
    const rad = (a * Math.PI) / 180;
    x += -Math.sin(rad) * len;
    y += Math.cos(rad) * len;
  }
  return { x, y };
}
