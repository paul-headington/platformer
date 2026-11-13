// The ghost hunter, redrawn as an anime chibi: messy dark-brown hair, big amber eyes,
// a worn brown leather jacket open over a red plaid flannel, jeans and boots.
// An original character: only the chibi style is borrowed.
//
// The body is a cut-out rig. Every part is drawn once, in its own space, hanging from
// its joint; a pose says how far each joint turns. Angles are in degrees, 0 = hanging
// straight down, negative = swung forward (the hunter faces right).

import { chainEnd, clipped, ellipse, g, id, limb, path, r, stroke, t, tr, vgrad } from './svg.mjs';

export const FRAME = { w: 80, h: 96 };
const GROUND = 95;
const HIP = 68; // hip height when standing straight
const THIGH = 11;
const SHIN = 10.5;
const UPPER_ARM = 8.5;
const FOREARM = 7.5;

const C = {
  skin: '#ffe6d6', skinShade: '#f5c3ae', skinLine: '#9a5a48', blush: '#ff8f8f',
  hair: '#4d3128', hairShade: '#33201a', hairHi: '#7d5547', hairLine: '#1f120d',
  irisTop: '#3a2116', irisBot: '#d99347', pupil: '#1c0f0a', eyeLine: '#24130d',
  jacket: '#8c5a38', jacketShade: '#6a3f25', jacketHi: '#a87150', jacketLine: '#3a2012',
  shirt: '#cc463e', shirtShade: '#9c2f2c', plaid: '#7c1f22', plaidLight: '#ecc9a2',
  jeans: '#5169a0', jeansShade: '#3d5080', jeansLine: '#1f2844',
  boot: '#5c3626', bootShade: '#41241a', sole: '#2a1a12', bootLine: '#1e100a',
  metal: '#4a505e', metalHi: '#8f97aa', metalLine: '#14161c', wood: '#7a4a2a',
  blade: '#d6dce8', bladeShade: '#9aa3b6', mouth: '#7a2a26', tongue: '#e0706a',
};

// ------------------------------------------------------------------ parts

/** The head, drawn around the neck joint (0,0); it is about 44 px tall. */
function head({ eyes = 'open', mouth = 'smile', hair = 0, look = 0 }) {
  // hair: how far the loose locks swing back (+) or forward (-); look: eye shift.
  const faceShape = 'M-12 -30 C-13 -42 13 -44 16 -30 C18 -22 17 -12 12 -6 C8 -1 1 0 -4 -2 C-11 -6 -13 -18 -12 -30 Z';
  const backHair = path(
    `M-16 -24 C-21 -36 -12 -48 1 -47 C14 -47 21 -38 19 -26 C18 -18 14 -14 12 -13 L-10 -9 C${-17 - hair * 0.4} -11 ${-19 - hair * 0.6} -15 -16 -24 Z`,
    C.hair, C.hairLine,
  );
  // Loose locks at the back of the head, which swing with movement.
  const lock = (x, y, len, a, w) =>
    g(tr(x, y, a + hair), path(`M${-w} 0 C${-w} ${len * 0.5} ${-w * 0.2} ${len * 0.8} 0 ${len} C${w * 0.3} ${len * 0.7} ${w} ${len * 0.4} ${w} 0 Z`, C.hair, C.hairLine));
  const backLocks = lock(-15, -22, 11, 35, 4) + lock(-13, -15, 9, 20, 3.5) + lock(-17, -31, 10, 55, 4);

  const [irisId, irisDefs] = vgrad([[0, C.irisTop], [0.55, '#8a4f2a'], [1, C.irisBot]]);
  const eye = (x, y, w, h) => {
    if (eyes === 'closed') return stroke(`M${x - w} ${y + 1} Q${x} ${y + 3.5} ${x + w} ${y + 1}`, C.eyeLine, 1.6);
    if (eyes === 'wince') return stroke(`M${x - w} ${y - 1} L${x + w} ${y + 1.5} L${x - w * 0.6} ${y + 3}`, C.eyeLine, 1.5);
    const ex = x + look;
    return (
      ellipse(x, y + 0.5, w + 0.6, h, '#ffffff') +
      ellipse(ex + 0.4, y + 0.8, w * 0.82, h * 0.92, `url(#${irisId})`) +
      ellipse(ex + 0.6, y + 1.4, w * 0.4, h * 0.5, C.pupil) +
      ellipse(ex - w * 0.3, y - h * 0.35, w * 0.32, h * 0.26, '#ffffff') +
      ellipse(ex + w * 0.4, y + h * 0.5, w * 0.16, h * 0.12, '#ffffff', null, 0, 'opacity="0.85"') +
      // The thick upper lash line, flicking out at the outer corner.
      path(`M${x - w - 0.8} ${y - h + 1.8} Q${x} ${y - h - 1.2} ${x + w + 1} ${y - h + 1.2} L${x + w + 1.8} ${y - h + 0.4} L${x + w + 0.6} ${y - h + 2.8} Q${x} ${y - h + 0.6} ${x - w - 0.8} ${y - h + 2.6} Z`, C.eyeLine)
    );
  };
  let mouthArt;
  if (mouth === 'open') mouthArt = path('M8.4 -9 Q11 -8.6 12.8 -9.4 Q12.4 -5.6 10.2 -5.6 Q8.6 -5.8 8.4 -9 Z', C.mouth, C.skinLine, 0.9) + ellipse(10.6, -6.6, 1.5, 0.9, C.tongue);
  else if (mouth === 'o') mouthArt = ellipse(10.8, -7.4, 1.4, 1.8, C.mouth, C.skinLine, 0.9);
  else if (mouth === 'grit') mouthArt = path('M8 -8.4 L13 -8.8 L12.6 -6.4 L8.4 -6.4 Z', '#ffffff', C.skinLine, 0.9);
  else if (mouth === 'smirk') mouthArt = stroke('M8.6 -7.6 Q10.8 -6.8 13 -8.8', C.skinLine, 1.1);
  else mouthArt = stroke('M8.6 -8 Q10.8 -6 12.8 -8', C.skinLine, 1.1);

  const face =
    path(faceShape, C.skin, C.skinLine, 1.2) +
    clipped(
      `<path d="${faceShape}"/>`,
      // Shadow the hair casts on the forehead, and under the jaw.
      path('M-14 -44 L20 -44 L20 -24 C14 -27 10 -23 5 -26 C0 -23 -4 -27 -9 -25 L-14 -26 Z', C.skinShade),
      path('M-14 -12 C-8 -6 2 -3 14 -10 L14 4 L-14 4 Z', C.skinShade, null, 0, 'opacity="0.7"'),
    ) +
    ellipse(4.5, -12.5, 3.2, 1.6, C.blush, null, 0, 'opacity="0.45"') +
    ellipse(15, -13, 1.6, 1.3, C.blush, null, 0, 'opacity="0.4"');
  const ear = path('M-8 -21 C-12 -23 -13 -16 -9 -14 Z', C.skin, C.skinLine, 1.1) + stroke('M-10 -19.5 Q-11 -18 -9.8 -16.5', C.skinShade, 1);

  // Bangs: a fringe of pointed locks over the forehead, plus a side lock in front of the ear.
  const bangsShape =
    'M-14 -26 C-16 -42 -2 -50 9 -46 C17 -43 21 -35 19 -25 L17 -22 L15.5 -28 L13 -20 L10.5 -28 L7 -21.5 L5 -29 L1 -23 L0 -30 L-4 -24 L-6 -31 L-9 -25 L-11 -29 Z';
  const bangs =
    path(bangsShape, C.hair, C.hairLine) +
    clipped(
      `<path d="${bangsShape}"/>`,
      // The shine band ("angel ring") across the crown, and a shaded underside.
      path('M-16 -39 C-6 -44 8 -44 20 -38 L20 -35 C8 -40 -6 -40 -16 -35 Z', C.hairHi),
      path('M-16 -30 C-4 -33 8 -33 20 -30 L20 -18 L-16 -18 Z', C.hairShade, null, 0, 'opacity="0.55"'),
    ) +
    // A few strand lines and a spiky tuft on top.
    stroke('M2 -45 Q4 -38 3 -31', C.hairLine, 0.8) +
    stroke('M10 -44 Q13 -38 12 -30', C.hairLine, 0.8) +
    path(`M-4 -46 C-3 -51 ${1 + hair * 0.2} -54 ${4 + hair * 0.3} -55 C3 -51 5 -48 6 -46.5 Z`, C.hair, C.hairLine);
  const sideLock = g(tr(-8.5, -27, 8 + hair * 0.3), path('M-3.5 0 C-4 6 -2.5 10 -0.5 13 C0.5 9 2.5 5 2.5 0 Z', C.hair, C.hairLine), stroke('M-0.6 2 Q-0.8 6 -0.6 9', C.hairHi, 0.8));

  return `<defs>${irisDefs}</defs>` + backLocks + backHair + face + ear + eye(5, -18.5, 3.4, 4.4) + eye(14.6, -18.5, 2.2, 4.1) + mouthArt + sideLock + bangs;
}

/** The back of the head, for climbing: all hair. */
function headBack({ hair = 0 }) {
  const lock = (x, y, len, a, w) =>
    g(tr(x, y, a + hair), path(`M${-w} 0 C${-w} ${len * 0.5} ${-w * 0.2} ${len * 0.8} 0 ${len} C${w * 0.3} ${len * 0.7} ${w} ${len * 0.4} ${w} 0 Z`, C.hair, C.hairLine));
  const shape = 'M-17 -24 C-20 -40 -9 -48 1 -48 C11 -48 22 -40 18 -24 C17 -16 12 -9 0 -8 C-12 -9 -16 -16 -17 -24 Z';
  return (
    path('M-19 -22 C-23 -24 -22 -15 -17 -16 Z', C.skin, C.skinLine, 1.1) +
    path('M18 -22 C22 -24 22 -15 17 -16 Z', C.skin, C.skinLine, 1.1) +
    lock(-9, -12, 9, 10, 4) + lock(0, -11, 10, 0, 4.5) + lock(9, -12, 9, -10, 4) +
    path(shape, C.hair, C.hairLine) +
    clipped(`<path d="${shape}"/>`, path('M-20 -40 C-8 -45 10 -45 22 -40 L22 -36 C10 -41 -8 -41 -20 -36 Z', C.hairHi), path('M-20 -22 C-8 -18 8 -18 22 -22 L22 0 L-20 0 Z', C.hairShade, null, 0, 'opacity="0.5"')) +
    stroke('M-6 -46 Q-8 -36 -6 -26', C.hairLine, 0.8) + stroke('M6 -46 Q8 -36 6 -26', C.hairLine, 0.8) +
    path('M-2 -47 C-2 -52 2 -55 5 -56 C4 -52 5 -49 5 -47 Z', C.hair, C.hairLine)
  );
}

/** The torso, from the hips (0,0) up to the neck (about (2,-19)). coat: how far the jacket hem flares back. */
function torso({ coat = 0 }) {
  const shirt = 'M1 -18 L8 -17 C10 -12 10 -6 9 2 L2 2 Z';
  const jacket = `M-9 -16 C-6 -19 -1 -20 2 -19 L3 -12 L4 3 L${-10 - coat} ${4 + coat * 0.2} C-11 -4 -11 -11 -9 -16 Z`;
  const lapel = 'M2 -19 L6 -18 L5.5 -10 L4 3 L2.6 3 L3 -12 Z';
  return (
    path(shirt, C.shirt, C.jacketLine) +
    clipped(`<path d="${shirt}"/>`,
      stroke('M0 -13 L12 -14', C.plaid, 1.2), stroke('M0 -6 L12 -7', C.plaid, 1.2), stroke('M0 0 L12 -1', C.plaid, 1.2),
      stroke('M5 -20 L5.5 4', C.plaid, 1), stroke('M0 -9.5 L12 -10.5', C.plaidLight, 0.5),
      path('M7.5 -20 L12 -20 L12 4 L7 4 Z', C.shirtShade, null, 0, 'opacity="0.6"')) +
    // The belt and jeans top under the shirt.
    path('M-8 1 L9 1 L9 4 L-8 4 Z', '#3a2418', C.jacketLine, 0.9) + path('M5 1.2 L8 1.2 L8 3.8 L5 3.8 Z', '#d9b46a', null) +
    path(jacket, C.jacket, C.jacketLine) +
    clipped(`<path d="${jacket}"/>`,
      path('M-12 -20 L-5 -20 C-6 -10 -5 -2 -4 6 L-12 6 Z', C.jacketShade),
      path('M-1 -19 C0 -12 0 -5 1 3 L-1 3 C-2 -5 -2 -12 -3 -19 Z', C.jacketHi, null, 0, 'opacity="0.6"')) +
    path(lapel, C.jacketHi, C.jacketLine, 1.1) +
    // Collar points.
    path('M-3 -20 L2 -19.5 L0 -15 Z', C.jacketHi, C.jacketLine, 1) +
    path('M2 -19.5 L7.5 -18.5 L6 -14.5 Z', '#f1e2c8', C.jacketLine, 1)
  );
}

function torsoBack({ coat = 0 }) {
  const jacket = `M-10 -16 C-6 -20 6 -20 10 -16 C11 -9 ${11 + coat * 0.3} -2 ${11 + coat * 0.3} 4 L${-11 - coat * 0.3} 4 C-11 -2 -11 -9 -10 -16 Z`;
  return (
    path(jacket, C.jacket, C.jacketLine) +
    clipped(`<path d="${jacket}"/>`, path('M-12 -20 L-6 -20 C-7 -10 -7 -2 -6 6 L-12 6 Z', C.jacketShade), path('M-4 -12 L4 -12 L4 -10 L-4 -10 Z', C.jacketShade, null, 0, 'opacity="0.6"')) +
    stroke('M0 -6 L0 4', C.jacketLine, 1) +
    path('M-6 -19.5 C-2 -21 2 -21 6 -19.5 L5 -16.5 C2 -17.5 -2 -17.5 -5 -16.5 Z', C.jacketHi, C.jacketLine, 1)
  );
}

/** An arm hanging from the shoulder (0,0): sleeve, cuff, hand. `item` is drawn in the hand. */
function arm({ shoulder, elbow, back = false, item = null, fist = true }) {
  const fill = back ? C.jacketShade : C.jacket;
  const hand = ellipse(0, 1.2, 2.7, 2.9, back ? C.skinShade : C.skin, C.skinLine, 1.1) + (fist ? stroke('M-1.5 0.6 Q0 1.6 1.6 0.6', C.skinLine, 0.7) : '');
  return g(r(shoulder),
    limb(UPPER_ARM, 6, fill, C.jacketLine),
    g(tr(0, UPPER_ARM, elbow),
      limb(FOREARM - 1.5, 5.4, fill, C.jacketLine),
      ellipse(0, FOREARM - 1.6, 3.2, 1.4, back ? C.jacketShade : C.jacketHi, C.jacketLine, 1),
      g(t(0, FOREARM), item && item.under ? item.svg : '', hand, item && !item.under ? item.svg : '')));
}

/** A leg hanging from the hip (0,0): thigh, shin, boot. */
function leg({ hip, knee, back = false, toe = 0 }) {
  const fill = back ? C.jeansShade : C.jeans;
  const boot = g(r(-knee - hip + toe),
    path('M-4 -2 L3.6 -2 C6 -1 9 0 9.4 2.4 C9.6 4 8.4 4.6 6.4 4.6 L-4 4.6 C-4.8 3 -4.8 0 -4 -2 Z', back ? C.bootShade : C.boot, C.bootLine, 1.2) +
    path('M-4.3 3.2 L9.4 3.2 C9.2 4.4 8.4 4.8 6.4 4.8 L-4 4.8 Z', C.sole) +
    stroke('M-4.2 -1 L3.4 -1', back ? C.bootLine : C.bootShade, 1));
  return g(r(hip),
    limb(THIGH, 7.5, fill, C.jeansLine),
    g(tr(0, THIGH, knee),
      limb(SHIN - 3, 6.6, fill, C.jeansLine),
      stroke('M-3.6 3 L-2.6 6', C.jeansLine, 0.6, 'opacity="0.5"'),
      g(t(0, SHIN - 1.5), boot)));
}

// ------------------------------------------------------------------ items in hand

// Drawn in the hand's space: the forearm points down (+y), so "forward along the arm" is +y.
// Each item is drawn as if pointing right (+x) and turned to lie along the arm.
const along = (svg) => g(r(90), svg);

const PISTOL = {
  svg: along(
    path('M-2 -3.2 L11 -3.2 L11 0.2 L3 0.2 L2.4 4.6 L-1.6 4.6 L-1.2 0.2 L-2 0.2 Z', C.metal, C.metalLine, 1.1) +
    stroke('M0 -2 L10 -2', C.metalHi, 0.8) + path('M-1 1 L2 1 L1.6 4 L-0.8 4 Z', C.wood)),
};
const SHOTGUN = {
  svg: along(
    path('M-9 -1.6 L-2 -2.6 L20 -2.6 L20 0.4 L4 0.4 L2 1.8 L-2 1.8 L-9 3.4 Z', C.metal, C.metalLine, 1.1) +
    path('M-9 -1.6 L-2 -2.6 L-1 1.8 L-9 3.4 Z', C.wood, C.metalLine, 0.9) +
    path('M7 0.4 L15 0.4 L15 2.8 L7 2.8 Z', C.wood, C.metalLine, 0.9) +
    stroke('M0 -1.6 L19 -1.6', C.metalHi, 0.7)),
};
/** The machete: angle turns the blade relative to the arm. */
const machete = (angle) => ({
  svg: g(r(angle),
    along(
      path('M-1.6 -1.6 L4 -1.6 L4 1.6 L-1.6 1.6 Z', '#3a2418', C.metalLine, 1) +
      path('M4 -2.6 L18 -3 C21 -2.6 22 -1 21.4 0.4 L19 2 L4 2 Z', C.blade, C.metalLine, 1.1) +
      path('M5 0.6 L19.6 0.6 L19 2 L4 2 Z', C.bladeShade))),
});

// ------------------------------------------------------------------ the rig

/**
 * Builds one frame. Pose fields (all optional):
 *  bob: hips up/down (px); lean: torso tilt (deg, + = forward); nod: head tilt;
 *  armF/armB: [shoulder, elbow] of the near and far arm; legF/legB: [hip, knee];
 *  hair, coat: secondary motion; face: { eyes, mouth, look }; itemF/itemB: in hand;
 *  ground: true = drop the body so the lowest boot rests on the floor; back: seen from behind.
 */
export function frame(p) {
  const pose = { bob: 0, lean: 0, nod: 0, armF: [10, -20], armB: [-8, -20], legF: [-4, 4], legB: [4, 4], hair: 0, coat: 0, face: {}, ground: true, ...p };
  let hipY = HIP + pose.bob;
  if (pose.ground) {
    // Forward kinematics: how far below the hip each boot sole reaches.
    const sole = (h, k) => chainEnd(0, 0, [[THIGH, h], [SHIN, k]]).y + 3.4;
    hipY = GROUND - Math.max(sole(...pose.legF), sole(...pose.legB)) + Math.min(0, pose.bob);
  }
  const x = 40 + (pose.dx ?? 0);
  if (pose.back) return climbFrame(pose, x, hipY);

  const shoulderF = { x: 1.5, y: -15.5 };
  const shoulderB = { x: -3, y: -16 };
  const neck = { x: 1.5, y: -18 };
  const torsoT = (...c) => g(tr(x, hipY, pose.lean), ...c);
  return (
    torsoT(g(t(shoulderB.x, shoulderB.y), arm({ shoulder: pose.armB[0], elbow: pose.armB[1], back: true, item: pose.itemB }))) +
    g(t(x - 2.5, hipY), leg({ hip: pose.legB[0], knee: pose.legB[1], back: true })) +
    g(t(x + 1.5, hipY), leg({ hip: pose.legF[0], knee: pose.legF[1] })) +
    torsoT(
      torso(pose),
      g(tr(neck.x, neck.y, pose.nod), path('M-3 -4 L3 -4 L3.5 1 L-3 1 Z', C.skinShade, C.skinLine, 1), head({ ...pose.face, hair: pose.hair })),
      g(t(shoulderF.x, shoulderF.y), arm({ shoulder: pose.armF[0], elbow: pose.armF[1], item: pose.itemF })),
    )
  );
}

/** Climbing, seen from behind: arms reach up the ladder in turn. */
function climbFrame(pose, x, hipY) {
  const torsoT = (...c) => g(t(x, hipY), ...c);
  return (
    g(t(x - 4, hipY), leg({ hip: pose.legB[0], knee: pose.legB[1], back: true, toe: 90 })) +
    g(t(x + 4, hipY), g('scale(-1 1)', leg({ hip: pose.legF[0], knee: pose.legF[1], back: true, toe: 90 }))) +
    torsoT(
      g(t(-8.5, -15), arm({ shoulder: pose.armB[0], elbow: pose.armB[1] })),
      g(t(8.5, -15), g('scale(-1 1)', arm({ shoulder: pose.armF[0], elbow: pose.armF[1] }))),
      torsoBack(pose),
      g(t(0, -17.5), headBack({ hair: pose.hair })),
    )
  );
}

// ------------------------------------------------------------------ the frames

const smile = { eyes: 'open', mouth: 'smile' };
const sin = Math.sin;
const cos = Math.cos;

/** Breathing idle at phase 0..1. `aim` keeps a weapon pose on the arms. */
function idle(ph, arms = {}, face = smile) {
  const a = ph * Math.PI * 2;
  return {
    bob: 0.6 - 0.6 * cos(a), // only ever sinks: the ground solver keeps the boots down
    lean: 1 + 0.8 * sin(a),
    nod: 1.5 * sin(a + 0.6),
    armF: [8 + 3 * sin(a), -22], armB: [-6 - 2 * sin(a), -22],
    legF: [-5, 5], legB: [5, 3],
    hair: 3 * sin(a - 1), coat: 0.6 * sin(a - 1),
    face,
    ...arms,
  };
}

/** Running at phase 0..1 (0 = near leg forward at full stride). */
function run(ph, arms = null, face = { eyes: 'open', mouth: 'open' }) {
  const a = ph * Math.PI * 2;
  const s = sin(a + Math.PI / 2); // 1 at phase 0: near leg forward
  const leg = (sw, c) => [-36 * sw, 12 + 62 * Math.max(0, c) ** 1.4];
  return {
    bob: -2.2 * Math.abs(cos(a)),
    lean: 9,
    nod: -3 + 1.5 * sin(2 * a),
    legF: leg(s, -cos(a + Math.PI / 2)),
    legB: leg(-s, cos(a + Math.PI / 2)),
    armF: arms?.armF ?? [34 * s, -70], armB: arms?.armB ?? [-34 * s, -70],
    hair: 10 + 4 * sin(2 * a + 1.2), coat: 3 + 1.5 * sin(2 * a + 1),
    face,
    ...(arms ?? {}),
  };
}

const JUMP = { bob: -3, ground: false, lean: 4, legF: [-58, 92], legB: [-12, 70], armF: [-45, -60], armB: [-160, -20], hair: -8, coat: -2, face: { eyes: 'open', mouth: 'open' } };
const FALL = { bob: -2, ground: false, lean: -3, legF: [-16, 22], legB: [12, 26], armF: [-115, -15], armB: [-165, 25], hair: -14, coat: -4, face: { eyes: 'open', mouth: 'o' } };

function climb(ph) {
  // 0: left (far) arm high, 0.5: right arm high.
  const a = ph * Math.PI * 2;
  const c = cos(a);
  return {
    back: true, ground: true, bob: -1 + Math.abs(sin(a)) * -1.2,
    armB: [160 - 25 * c, 10 + 15 * c], armF: [160 + 25 * c, 10 - 15 * c],
    legB: [-10 - 30 * Math.max(0, -c), 20 + 50 * Math.max(0, -c)],
    legF: [-10 - 30 * Math.max(0, c), 20 + 50 * Math.max(0, c)],
    hair: 3 * sin(a),
  };
}

/** Arm poses for holding each weapon (near arm forward and level). */
const HOLD = {
  pistol: { armF: [-88, -4], itemF: PISTOL, armB: [-40, -50] },
  shotgun: { armF: [-80, -12], itemF: SHOTGUN, armB: [-70, -40] },
  machete: { armF: [-25, -80], itemF: machete(-95), armB: [-10, -40] },
};
const HOLD_FACE = { pistol: { eyes: 'open', mouth: 'smirk' }, shotgun: { eyes: 'open', mouth: 'grit' }, machete: { eyes: 'open', mouth: 'smirk' } };

/** Every frame of the sheet, in order (see PLAYER_HD_FRAMES in src/skins.ts). */
export function frames() {
  const f = [];
  // 0-1 idle, 2-5 run, 6 jump, 7 fall, 8-9 climb.
  f[0] = idle(0); f[1] = idle(0.5);
  [2, 3, 4, 5].forEach((n, i) => (f[n] = run(i / 4)));
  f[6] = JUMP; f[7] = FALL;
  f[8] = climb(0); f[9] = climb(0.5);
  // 36-39 idle in-betweens, 40-43 run in-betweens, 44-45 climb in-betweens.
  [36, 37, 38, 39].forEach((n, i) => (f[n] = idle([1, 2, 4, 5][i] / 6)));
  [40, 41, 42, 43].forEach((n, i) => (f[n] = run((2 * i + 1) / 8)));
  f[44] = climb(0.25); f[45] = climb(0.75);
  // Each weapon: 8 shared frames (idle x2, run x4, jump, fall) and 8 in-betweens.
  const held = { pistol: [10, 46], shotgun: [18, 54], machete: [26, 62] };
  for (const [w, [first, extra]] of Object.entries(held)) {
    const hold = HOLD[w];
    const face = HOLD_FACE[w];
    f[first] = idle(0, hold, face); f[first + 1] = idle(0.5, hold, face);
    [0, 1, 2, 3].forEach((i) => (f[first + 2 + i] = run(i / 4, hold, { ...face, mouth: 'grit' })));
    f[first + 6] = { ...JUMP, ...hold };
    f[first + 7] = { ...FALL, ...hold };
    [0, 1, 2, 3].forEach((i) => (f[extra + i] = idle([1, 2, 4, 5][i] / 6, hold, face)));
    [0, 1, 2, 3].forEach((i) => (f[extra + 4 + i] = run((2 * i + 1) / 8, hold, { ...face, mouth: 'grit' })));
  }
  // 34-35 machete swing: blade raised high, then struck down and forward.
  f[34] = { ...idle(0, {}, { eyes: 'open', mouth: 'grit' }), lean: -4, armF: [165, -15], itemF: machete(-30), armB: [-30, -40], hair: 4 };
  f[35] = { ...idle(0, {}, { eyes: 'wince', mouth: 'open' }), lean: 12, legF: [-30, 20], legB: [20, 10], armF: [-70, -10], itemF: machete(-20), armB: [20, -30], hair: 10, coat: 3 };
  return f;
}

export const sheet = { name: 'player-hunter', frame: FRAME, columns: 10, count: 70, frames, draw: frame };
