// Characters made of painted parts (transparent PNGs in art/<id>/, made with an AI image
// tool: see the AI art guide), put on the shared chibi rig. The head, torso, hands, boots
// and any extras are pictures; arms and legs are smooth vector curves, so elbows and
// knees bend softly. Poses come from hunter.mjs, so every character moves the same way.
//
// Each character is a config: sizes in design units (4 per world unit), anchor points as
// fractions of each picture, limb colours, and optional extras drawn at fixed layers.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FOREARM, FRAME, GROUND, HIP, UPPER_ARM, bend, frames, softLimb } from './hunter.mjs';
import { clipCount, clipSlots } from './clips.mjs';
import { bottomCentre, part, placeImage } from './parts.mjs';
import { chainEnd, ellipse, g, id, r, t, tr } from './svg.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ART = join(ROOT, 'art');
/** Animation clips cut from AI videos, per character (shared with the game, see src/skins.ts). */
const CLIPS = JSON.parse(readFileSync(join(ROOT, 'src', 'clips.json'), 'utf8')).players;
/** Final pixels per design unit (RENDER_SCALE / 4, see build.mjs). */
const PX = 1.25;
const FACES = { smile: 'smile', open: 'open', o: 'o', grit: 'grit', smirk: 'smirk' };

function character(c) {
  const dir = join(ART, c.id);
  const img = (name, units) => part(dir, `${c.id}_${name}`, units * PX);
  const pic = (name, units, [fx, fy], extra = '') => placeImage(img(name, units), units, fx, fy, extra);
  const heightOf = (name, units) => (units * img(name, units).h) / img(name, units).w;
  const torsoH = heightOf('torso', c.size.torso);
  /** A point of the torso picture, relative to the hips, in design units. */
  const tp = ([fx, fy]) => ({ x: (fx - c.torso.hip[0]) * c.size.torso, y: (fy - c.torso.hip[1]) * torsoH });
  const sole = heightOf('boot', c.size.boot) * (1 - c.boot.ankle[1]);
  // Where the chin is in each head, found from the picture (the neck sits just above it).
  const chins = {};
  const chin = (name) => (chins[name] ??= bottomCentre(dir, `${c.id}_${name}`, 0.04, c.chinBand ?? [0, 1]));

  /** A pattern (Ink's tattoos) painted onto a limb: a skin tile with the picture on top. */
  const fillFor = (colour, back) => {
    if (!c.tattoo) return [colour, ''];
    const pid = id('tat');
    const tw = c.tattoo.width;
    const th = heightOf('tattoo', tw);
    const defs = `<pattern id="${pid}" patternUnits="userSpaceOnUse" width="${tw}" height="${th}"><rect width="${tw}" height="${th}" fill="${colour}"/>${pic('tattoo', tw, [0, 0], `opacity="${(c.tattoo.opacity ?? 1) * (back ? 0.8 : 1)}"`)}</pattern>`;
    return [`url(#${pid})`, `<defs>${defs}</defs>`];
  };

  function head(face) {
    const name = face.eyes === 'wince' ? 'head_wince' : `head_${FACES[face.mouth] ?? 'smile'}`;
    const ch = chin(name);
    return pic(name, c.size.head, [ch.x, ch.y - (c.chinLift ?? 0.06)]);
  }

  function arm({ shoulder, elbow, back = false, item = null }) {
    const col = c.arm;
    const [fill, defs] = fillFor(back ? col.back : col.fill, back);
    const [upper, fore] = c.arms ?? [UPPER_ARM, FOREARM];
    const [j, wrist] = bend(upper, shoulder, fore - 2, shoulder + elbow);
    const handAt = chainEnd(0, 0, [[upper, shoulder], [fore, elbow]]);
    const fistAt = c.fist.atWrist ? wrist : handAt;
    const fist = g(t(0, c.fist.atWrist ? 0 : 0.6), g(r(c.fist.turn), pic('hand_fist', c.size.fist, c.fist.anchor, back ? 'opacity="0.92"' : '')));
    return (
      defs +
      softLimb(j, wrist, col.width, fill, col.line, col.lineWidth ?? 1.2) +
      (c.sleeve ? g(r(shoulder * c.sleeve.follow), pic('sleeve', c.sleeve.width, c.sleeve.anchor, back ? 'opacity="0.85"' : '')) : '') +
      (c.sleeve ? '' : `<circle r="${col.width / 2 + 0.3}" fill="${back ? col.back : col.fill}" opacity="${c.tattoo ? 0 : 1}"/>`) +
      g(tr(fistAt.x, fistAt.y, shoulder + elbow), item && item.under ? item.svg : '', fist, item && !item.under ? item.svg : '') +
      (col.cuff ? g(tr(wrist.x, wrist.y, shoulder + elbow), ellipse(0, 0.2, col.width / 2 + 0.6, 1.8, back ? col.back : col.cuff, col.line, 1)) : '')
    );
  }

  function leg({ hip, knee, back = false }) {
    const col = c.leg;
    const [fill, defs] = fillFor(back ? col.back : col.fill, back);
    const [j, ankle] = bend(c.legs.thigh, hip, c.legs.shin, hip + knee);
    const boot = g(t(ankle.x, ankle.y), pic('boot', c.size.boot, c.boot.ankle, back ? 'opacity="0.9"' : ''));
    return defs + boot + softLimb(j, { x: ankle.x, y: ankle.y + 1 }, col.width, fill, col.line, col.lineWidth ?? 1.2);
  }

  function draw(p) {
    const pose = { bob: 0, lean: 0, nod: 0, armF: [10, -20], armB: [-8, -20], legF: [-4, 4], legB: [4, 4], face: {}, hair: 0, coat: 0, ground: true, ...p };
    // A long skirt keeps the steps small (legSwing < 1).
    const k = c.legSwing ?? 1;
    pose.legF = pose.legF.map((a) => a * k);
    pose.legB = pose.legB.map((a) => a * k);
    let hipY = HIP + pose.bob;
    const legTop = tp(c.torso.hipF).y;
    if (pose.ground) {
      const reach = (h, k) => legTop + chainEnd(0, 0, [[c.legs.thigh, h], [c.legs.shin, k]]).y + sole;
      hipY = GROUND - Math.max(reach(...pose.legF), reach(...pose.legB)) + Math.min(0, pose.bob);
    }
    const x = 40 + (pose.dx ?? 0);
    const at = (pt, ...k) => g(t(pt.x, pt.y), ...k);
    const torsoT = (...k) => g(tr(x, hipY, pose.lean), ...k);
    const neck = tp(c.torso.neck);
    const extra = (layer, view) => (c.extras?.[layer] ? c.extras[layer]({ pose, tp, pic, neck, view }) : '');

    if (pose.back) {
      return (
        torsoT(extra('behindAll', 'back')) +
        g(t(x - 3, hipY + legTop), leg({ hip: pose.legB[0], knee: pose.legB[1], back: true })) +
        g(t(x + 3, hipY + legTop), g('scale(-1 1)', leg({ hip: pose.legF[0], knee: pose.legF[1], back: true }))) +
        torsoT(
          g(t(-9, neck.y + 6), arm({ shoulder: pose.armB[0], elbow: pose.armB[1] })),
          g(t(9, neck.y + 6), g('scale(-1 1)', arm({ shoulder: pose.armF[0], elbow: pose.armF[1] }))),
          extra('overLegs', 'back'),
          pic('torso_back', c.size.torso, c.torso.hip),
          extra('behindHead', 'back'),
          g(t(0.5, neck.y + 2), pic('head_back', c.size.head * c.backHead, [0.5, 0.97])),
          extra('front', 'back'),
        )
      );
    }

    // The near armhole is on the back edge of the 3/4 torso and the far one on the front
    // edge, so the leading arm (armF, which holds the weapon) hangs from the far one.
    // leadOnTop: the leading arm comes in front of the body (a machete wind-up).
    const lead = at(tp(c.torso.shoulderB), arm({ shoulder: pose.armF[0], elbow: pose.armF[1], back: !pose.leadOnTop, item: pose.itemF }));
    return (
      torsoT(extra('behindAll', 'front'), g(tr(neck.x, neck.y, pose.nod), extra('behindHead', 'front')), pose.leadOnTop ? '' : lead) +
      g(t(x, hipY), at(tp(c.torso.hipB), leg({ hip: pose.legB[0], knee: pose.legB[1], back: true }))) +
      g(t(x, hipY), at(tp(c.torso.hipF), leg({ hip: pose.legF[0], knee: pose.legF[1] }))) +
      torsoT(
        extra('overLegs', 'front'),
        pic('torso', c.size.torso, c.torso.hip),
        g(tr(neck.x, neck.y, pose.nod), head(pose.face)),
        at(tp(c.torso.shoulderF), arm({ shoulder: pose.armB[0], elbow: pose.armB[1], item: pose.itemB })),
        extra('front', 'front'),
        pose.leadOnTop ? lead : '',
      )
    );
  }

  const clips = CLIPS[c.id];
  const videoFrames = () => (clips ? clipSlots(dir, `${c.id}_clip_`, clips).slots : {});
  return { name: c.sheet, frame: FRAME, columns: 10, count: clips ? clips.start + clipCount(clips) : 70, frames, draw, videoFrames, available: existsSync(join(dir, `${c.id}_head_smile.png`)) };
}

const HUNTER = character({
  id: 'hunter', sheet: 'player-hunter',
  size: { head: 45, torso: 21.5, fist: 6.8, boot: 15 },
  legs: { thigh: 8.5, shin: 7.5 },
  torso: { hip: [0.5, 0.86], neck: [0.56, 0.05], shoulderF: [0.09, 0.27], shoulderB: [0.93, 0.24], hipF: [0.37, 0.92], hipB: [0.62, 0.92] },
  fist: { anchor: [0.47, 0.52], turn: 62 },
  boot: { ankle: [0.3, 0.22] },
  backHead: 0.86,
  // Leather sleeves with rolled cuffs, and jeans, in colours from the design sheet.
  arm: { fill: '#6f4b3a', back: '#5b3c2e', cuff: '#82593f', line: '#432820', width: 6 },
  leg: { fill: '#566884', back: '#46556e', line: '#2b2d3c', width: 8 },
});

/** A loose lock of hair hanging from (x, y), swinging with the hair. */
const lock = (pic, name, width, anchor, x, y, angle) => g(tr(x, y, angle), pic(name, width, anchor));

const WEAVER = character({
  id: 'weaver', sheet: 'player-weaver',
  size: { head: 43, torso: 20, fist: 6, boot: 11 },
  legs: { thigh: 8, shin: 7 },
  legSwing: 0.45,
  torso: { hip: [0.5, 0.8], neck: [0.52, 0.03], shoulderF: [0.12, 0.13], shoulderB: [0.88, 0.12], hipF: [0.4, 0.95], hipB: [0.6, 0.95] },
  chinBand: [0.35, 0.75],
  fist: { anchor: [0.5, 0.52], turn: 75 },
  boot: { ankle: [0.33, 0.42] },
  backHead: 0.8,
  // Pale arms under wide kimono sleeves; black tights under the kimono skirt.
  arm: { fill: '#f6e2d6', back: '#e2c8bc', line: '#6a4040', lineWidth: 0.9, width: 4.4 },
  leg: { fill: '#2a2428', back: '#1e1a1e', line: '#100c10', width: 6 },
  sleeve: { width: 14, anchor: [0.2, 0.05], follow: 1 },
  extras: {
    // Waist-length hair down her back, behind everything.
    behindAll: ({ pose, pic, neck, view }) =>
      view === 'back'
        ? lock(pic, 'lock_1', 18, [0.5, 0.02], 0, neck.y - 12, pose.hair * 0.3)
        : lock(pic, 'lock_1', 15, [0.5, 0.02], -7, neck.y - 14, 4 + pose.hair * 0.5) + lock(pic, 'lock_2', 11, [0.5, 0.02], -1, neck.y - 12, 2 + pose.hair * 0.35),
    // The kimono skirt, from the obi down to her ankles; it sways with her steps.
    overLegs: ({ pose, tp, pic }) => {
      const top = tp([0.5, 0.82]);
      return g(tr(top.x, top.y, -pose.coat * 0.8), pic('skirt', 20, [0.5, 0.01]));
    },
    // Her spider, riding on her near shoulder.
    front: ({ pose, tp, pic, view }) => {
      if (view === 'back') return '';
      const s = tp([0.04, 0.2]);
      return g(tr(s.x, s.y, pose.nod * 0.3), pic('spider', 11, [0.5, 0.85]));
    },
  },
});

const INK = character({
  id: 'ink', sheet: 'player-ink',
  size: { head: 46, torso: 21, fist: 6.4, boot: 15 },
  arms: [6.8, 6.4],
  legs: { thigh: 7.5, shin: 6.5 },
  torso: { hip: [0.5, 0.72], neck: [0.5, 0.03], shoulderF: [0.08, 0.3], shoulderB: [0.92, 0.28], hipF: [0.38, 0.93], hipB: [0.62, 0.93] },
  fist: { anchor: [0.38, 0.9], turn: 165, atWrist: true },
  boot: { ankle: [0.3, 0.26] },
  backHead: 0.86,
  // Bare tattooed arms and legs (skin under the rose tattoo pattern).
  arm: { fill: '#fbdcc4', back: '#ecc8b2', line: '#6a4034', lineWidth: 0.9, width: 5 },
  leg: { fill: '#fbdcc4', back: '#ecc8b2', line: '#6a4034', lineWidth: 0.9, width: 6.6 },
  tattoo: { width: 10, opacity: 0.7 },
  extras: {
    // The high ponytail, tied at the back of the crown; it swings as she moves.
    behindHead: ({ pose, pic, view }) =>
      view === 'back' ? '' : lock(pic, 'lock_1', 30, [0.42, 0.22], -12, -40, -8 + pose.hair * 0.8),
  },
});

/** Every painted character with its parts present in art/. */
export const PAINTED = [HUNTER, WEAVER, INK].filter((s) => s.available);
