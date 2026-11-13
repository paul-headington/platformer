# High-res graphics upgrade: plan

Status: draft for Paul's approval. Branch: `claude/project-thread-2sirg5`. Nothing is implemented yet.

## 0. Target style (open question)

I couldn't open the YouTube link from here (YouTube is blocked from my sandbox), so the
target style is not pinned down yet. Everything below works for any 2D style (clean
vector cartoon, thick-outline comic, painted HD, chibi, etc.). Once Paul describes the
look or drops 2-3 screenshots in the thread, I'll fill in a one-page style guide:
proportions (head-to-body ratio), outline weight, shading (flat / cel / painted),
palette and how expressive faces are. We match the style only and keep every
character original.

## 1. Resolution and scaling

- Today: 320x200 canvas, 16 px tiles, `pixelArt: true`, scaled up with nearest-neighbour.
- New: render at **1280x800** (4x, same 16:10 shape) with smooth filtering, and set the
  game camera to **zoom 4**. The game world keeps its current units (16-unit tiles,
  speeds, jump heights, AI ranges, level text files), so **physics, level layout and AI
  don't change at all**.
- Art is drawn at 4x density: a tile becomes 64x64 px, the player frame about 80x96 px.
  A single `ART_SCALE = 4` constant in config.ts lets sprites draw at 1/4 scale in world
  units, so they look razor sharp at zoom 4.
- HUD gets its own un-zoomed camera at 1280x800 so text and icons are crisp (real fonts
  instead of 6-8 px monospace).
- Mobile: we also export a 2x copy of every atlas and pick it on low-memory devices.

## 2. Art pipeline and tools

Recommended: **vector parts + a cutout rig, baked to frames by a build script.**

- Each character is a set of SVG parts (head, torso, upper/lower arms, legs, hands,
  props) in `art/<character>/`. SVG is text, so I can author and edit it the same way I
  edit tools/sprites.py today, and Paul (or an artist) can open it in Inkscape/Figma/
  Affinity and redraw anything.
- A small rig file per character lists bones (pivot points) and poses per animation
  frame (angles + offsets).
- `npm run art` (Node + `@resvg/resvg-js`, no system libraries needed) renders each pose
  to PNG and packs a texture atlas + JSON for Phaser. Replaces tools/sprites.py
  gradually; the old script keeps working until each sheet is replaced.
- Hand-painted or AI-assisted PNG frames can drop into the same atlas folders if Paul
  wants a look vectors can't do.

Why not the alternatives:
- Runtime skeletal (Spine): smoothest motion, but it's a paid licence and its Phaser 4
  runtime support needs checking. DragonBones is free but unmaintained.
- Hand-drawn frames only: best look, but needs an artist for every frame of every
  skin, which doesn't fit how this project is built.
Baking the rig gives skeletal-style smooth animation (8-12 frames per cycle instead of
4) while the game still just plays frame animations, so GameScene's animation code
barely changes.

## 3. Animation

- Same animation names as now (idle, run, jump, fall, climb, hurt, armed variants,
  machete slash, etc.), so game logic is untouched.
- More frames per cycle (run 8-10, idle breathing 6, climb 6) for smooth motion at high res.
- Gun / shotgun / machete become a hand-held prop part instead of separate "armed"
  copies of every frame, which halves the frame count.
- Extras that are cheap at high res: squash/stretch on landing, secondary motion on hair,
  coat tails and ghost trails, soft shadows.

## 4. How existing content migrates

| Content | Plan |
| --- | --- |
| Player skins (hunter, weaver, ink) | One shared rig; a skin swaps part SVGs + palette. Same idea as today's skin dicts. `skins.ts` keeps painting the chosen skin onto the 'player' texture, with frame size from the atlas. |
| Zombie (+ headshot gore, flying head) | Rig with detachable head part; gore as particle sprites. |
| Ghost | Mostly shader/tween work (wobble, glow, transparency) on a few painted frames. |
| Vampire (+ beheading, lunge) | Rig shared with the zombie body shape. |
| Snakes, lurker, tentacles | Simple rigs or a few frames each. |
| Tiles, walls, stairs, ladders, trapdoors | 64 px tiles with variation tiles so walls don't repeat; trapdoor cues kept subtle-but-spottable (Paul's rule). |
| Backgrounds | Parallax layers (sky, moon, distant house) and painted room backdrops. |
| Lighting | Keep candle/moon glows, add Phaser 4 lighting/normal maps later if the style suits it. |
| Pickups, HUD, touch buttons | Redrawn at 4x; HUD in real fonts. |

During the migration, any sheet not yet redrawn is just the old pixel art scaled up, so
the game stays playable at every step.

## 5. Physics and hitboxes

- World units don't change, so player/enemy speeds, jumps and level geometry stay the same.
- Phaser sizes a body in the texture's pixels times the sprite's scale, so every
  `setSize/setOffset` call (player 8x22, zombie 8x21, ghost 12x12, vampire 8x21) goes
  through a small helper that takes world units. Hitboxes keep their current size unless
  the new character shapes need tweaking.
- If the new style wants characters bigger relative to the rooms, that is a separate,
  later decision because it would mean rescaling levels.

## 6. Phases

1. **Resolution switch** (small): 1280x800 canvas, zoom 4, ART_SCALE, HUD camera, body-size
   helper, current art upscaled. The game should play exactly as before. Screenshot check.
2. **Proof of concept** (the approval gate): the hunter in the new style with a full
   animation set, plus one room (entrance hall) of new tiles and background. Paul plays
   it on the branch preview and says yes, tweak or rethink.
3. Remaining skins (Weaver, Ink).
4. Enemies: zombie, ghost, vampire, then snakes/lurker/tentacles.
5. Tiles, backgrounds and decor for the whole house; lighting pass.
6. Pickups, effects, HUD, touch controls; mobile performance pass (2x atlases, atlas size
   under 4096 px); then merge to main.

Each phase is its own PR into the test branch (or a stack of PRs), so main stays the
current pixel-art game until Paul is happy.

## 7. Risks

- Matching a reference style without a human artist: the proof of concept is there to
  find out early.
- Volume: tools/sprites.py is about 1,900 lines of art; the whole house is a big redraw.
  Phases keep it shippable.
- Load time and memory on phones: mitigated with 2x atlases and compressed PNGs.
