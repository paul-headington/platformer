"""
Builds the game's sprite sheets from the ASCII pixel maps below.

    python3 tools/sprites.py            # writes public/sprites/*.png
    python3 tools/sprites.py --preview  # also writes docs/sprite-preview.png (8x zoom)

Each character in a map is one pixel; '.' is transparent. Colours come from
PALETTE. Frames of one sheet sit side by side, left to right, so frame N in
Phaser is the Nth map in the list. Edit a map, re-run, refresh the game.
Needs Pillow (pip install pillow).
"""
import sys
from pathlib import Path
from PIL import Image

PALETTE = {
    'k': (26, 16, 38),     # outline / ink
    'w': (255, 255, 255),
    's': (242, 194, 139),  # skin
    'S': (201, 143, 94),   # skin shade
    'h': (47, 168, 154),   # beanie
    'H': (29, 110, 102),   # beanie shade
    'i': (126, 220, 204),  # beanie highlight
    'n': (92, 60, 40),     # hair
    'j': (232, 118, 45),   # jacket
    'J': (169, 76, 26),    # jacket shade
    'l': (255, 176, 102),  # jacket zip / highlight
    'p': (59, 74, 122),    # jeans
    'P': (40, 51, 87),     # jeans shade
    'b': (90, 58, 36),     # boots
    'g': (138, 176, 92),   # zombie skin
    'G': (88, 124, 60),    # zombie skin shade
    'r': (255, 64, 64),    # red eye glow
    'c': (120, 98, 148),   # zombie shirt (faded purple)
    'C': (84, 66, 108),    # zombie shirt shade
    't': (110, 92, 70),    # torn trousers
    'T': (78, 64, 48),
    'v': (232, 236, 255),  # ghost body
    'V': (170, 178, 222),  # ghost shade
    'y': (255, 210, 63),   # gold
    'Y': (196, 140, 30),   # gold shade
    'a': (63, 224, 255),   # gem
    'A': (30, 140, 200),   # gem shade
    'm': (154, 160, 170),  # metal
    'M': (92, 96, 107),    # metal shade
    'o': (255, 242, 122),  # bullet glow
}

# ---------------------------------------------------------------- characters
# Characters are 20x24 frames assembled from parts (legs, then body, then head
# drawn on top), so a pose is a list of (part, x, y) placements. Parts are
# drawn facing right; Phaser flips them for walking left.

HEAD = """
....kkkkk...
..kkhhhiikk.
.khhhhhhhihk
.khhhhhhhhhk
kHHHHHHHHHHk
.knnssssssk.
.knssswksk..
.knssssssssk
..ksssssSsk.
...kSSSSSk..
"""

BODY_IDLE = """
....kkkkkk....
...kjjjjljk...
..kJjjjjljjk..
..kJjjjjljjk..
..kJjjjjljjk..
..ksJjjjljsk..
...kkkkkkkk...
"""

BODY_RUN_A = """
....kkkkkk....
...kjjjjljk...
..kJjjjjljjkk.
.kkJjjjjljjjsk
ksJJjjjjljkkk.
.kkJjjjjljk...
...kkkkkkkk...
"""

BODY_RUN_B = """
....kkkkkk....
...kjjjjljk...
..kJjjjjljjk..
kskJjjjjljjkk.
.kkJjjjjljjjsk
..kJjjjjljkk..
...kkkkkkkk...
"""

BODY_JUMP = """
....kkkkkk.ks.
...kjjjjljkjk.
..kJjjjjljjjk.
..kJjjjjljjk..
.ksJjjjjljjk..
..kJjjjjljjk..
...kkkkkkkk...
"""

BODY_ARMS_UP = """
.ks.kkkkkk.ks.
.kjkjjjjljkjk.
..kJjjjjljjk..
..kJjjjjljjk..
..kJjjjjljjk..
..kJjjjjljjk..
...kkkkkkkk...
"""

LEGS_STAND = """
...kppppppk...
...kpPkkpPk...
...kpPkkpPk...
...kpPkkpPk...
...kpPkkpPk...
...kbbbkbbbk..
...kkkkkkkkk..
"""

LEGS_STRIDE = """
...kppppppk...
...kpPppPpk...
..kpPpkkpPpk..
.kpPk...kpPpk.
kpPk.....kpPk.
kbbk.....kbbbk
kkk.......kkkk
"""

LEGS_PASS = """
...kppppppk...
...kpPppPpk...
...kpPkkpPk...
..kbbk.kpPk...
..kkk..kpPk...
.......kbbbk..
.......kkkkk..
"""

LEGS_TUCK = """
...kppppppk...
...kpPppPppk..
..kpPk.kpPpk..
.kbbbk..kbbbk.
.kkkk...kkkk..
"""

LEGS_DANGLE = """
...kppppppk...
...kpPkkpPk...
...kpPkkpPk...
..kpPk..kpPk..
..kbbk..kbbbk.
..kkkk..kkkkk.
"""


def pose(head_dy, body, legs, legs_dy=0):
    return [(legs, 3, 17 + legs_dy), (body, 3, 10 + head_dy), (HEAD, 5, head_dy)]


# Frames: 0-1 idle (breathe), 2-5 run, 6 jump, 7 fall / hurt.
PLAYER = [
    pose(0, BODY_IDLE, LEGS_STAND),
    pose(1, BODY_IDLE, LEGS_STAND),
    pose(1, BODY_RUN_A, LEGS_STRIDE),
    pose(0, BODY_IDLE, LEGS_PASS),
    pose(1, BODY_RUN_B, LEGS_STRIDE),
    pose(0, BODY_IDLE, LEGS_PASS),
    pose(0, BODY_JUMP, LEGS_TUCK),
    pose(0, BODY_ARMS_UP, LEGS_DANGLE),
]

ZOMBIE_HEAD = """
..knkkkkk...
.knngggggk..
.knggggggggk
.kGggggkrgk.
.kGGgggggggk
.kGgggkwkwk.
..kGggkkkkk.
..kGGgggGk..
...kkkkkk...
"""

ZOMBIE_BODY_A = """
...kkkkkkkk...
..kcCcccckkkkk
..kcCccccccggk
..kcCcccckkkkk
..kcCtcccck...
..kcCcccCck...
...kkkkkkk....
"""

ZOMBIE_BODY_B = """
...kkkkkkkk...
..kcCcccccck..
..kcCcccckkkkk
..kcCccccccggk
..kcCcccckkkkk
..kcCcccCck...
...kkkkkkk....
"""


def trousers(legs):
    return legs.replace('p', 't').replace('P', 'T')


def zombie_pose(dy, body, legs):
    return [(trousers(legs), 3, 17), (body, 3, 10 + dy), (ZOMBIE_HEAD, 5, 1 + dy)]


# Frames 0-3: lurching walk.
ZOMBIE = [
    zombie_pose(1, ZOMBIE_BODY_A, LEGS_STRIDE),
    zombie_pose(0, ZOMBIE_BODY_B, LEGS_PASS),
    zombie_pose(1, ZOMBIE_BODY_A, LEGS_STRIDE),
    zombie_pose(0, ZOMBIE_BODY_B, LEGS_STAND),
]

GHOST_TOP = """
.......kkkkk........
.....kkvvvvvkk......
....kvvvvvvvvvk.....
...kvvvvvvvvvvvk....
...kvvvvkkvvkkvk....
...kVvvvkkvvkkvk....
...kVvvvvvvvvvvk....
...kVvvvvvkkkvvkk...
...kVVvvvvkkkvvvvk..
...kVVvvvvvvvvkkk...
...kVVVvvvvvvvk.....
....kVVvvvvvvk......
"""

GHOST_BLINK = """
....................
....................
....................
....................
...kvvvvvvvvvvvk....
...kVvvvkkvvkkvk....
"""

GHOST_TAILS = [
"""
....kVVVvvvvk.......
.....kVVvvvk........
......kVVvk.........
.......kVVk.........
.....kkVVk..........
....kVVkk...........
....kkk.............
""",
"""
....kVVVvvvvk.......
.....kVVvvvk........
......kVVvk.........
......kVVk..........
.....kVVk...........
....kVVk............
...kkkk.............
""",
"""
....kVVVvvvvk.......
.....kVVvvvk........
......kVVvk.........
.......kVVk.........
.......kVVk.........
......kVVk..........
.....kkkk...........
""",
]


def ghost(tail, blink=False):
    parts = [(GHOST_TOP, 0, 1), (GHOST_TAILS[tail], 0, 13)]
    if blink:
        parts.append((GHOST_BLINK, 0, 1))
    return parts


# Frames 0-3: wisp tail sways, frame 3 blinks.
GHOST = [ghost(0), ghost(1), ghost(2), ghost(1, blink=True)]

CHAR_SIZE = {'player': (20, 24), 'zombie': (20, 24), 'ghost': (20, 20)}

# ---------------------------------------------------------------- pickups
GEM = [  # 8x8, 4-frame sparkle
"""
..kkkk..
.kaawak.
kaaaaaak
kAaaaaAk
.kAaaAk.
..kAAk..
...kk...
........
""",
"""
..kkkk..
.kawaak.
kaaaaaak
kAaaaaAk
.kAaaAk.
..kAAk..
...kk...
........
""",
"""
..kkkk..
.kaaaak.
kaaawaak
kAaaaaAk
.kAaaAk.
..kAAk..
...kk...
........
""",
"""
..kkkk..
.kaaaak.
kaaaaaak
kAaaawAk
.kAaaAk.
..kAAk..
...kk...
........
""",
]

KEY = ["""
.kkk........
kyyyk.......
kykykkkkkkk.
kyyyyyyyyyyk
kYYYkkkYkYk.
.kkk...k.k..
"""]

GUN = ["""
..........kk
.kkkkkkkkkmk
kmmmmmmmmmmk
kMMMMMMMmmMk
.kkkkbbkkkk.
....kbbk....
....kkkk....
"""]

BULLET = ["""
.kkkk.
kyoook
.kkkk.
"""]


def parse(art: str) -> list[str]:
    rows = [r for r in art.strip('\n').split('\n')]
    w = max(len(r) for r in rows)
    return [r.ljust(w, '.') for r in rows]


def compose(parts, w: int, h: int) -> str:
    """Stamps (art, x, y) parts onto a w x h canvas; later parts draw on top."""
    canvas = [['.'] * w for _ in range(h)]
    for art, ox, oy in parts:
        for y, row in enumerate(parse(art)):
            for x, ch in enumerate(row):
                if ch != '.' and 0 <= ox + x < w and 0 <= oy + y < h:
                    canvas[oy + y][ox + x] = ch
    return '\n'.join(''.join(r) for r in canvas)


def build(frames, palette=PALETTE, size=None) -> Image.Image:
    if size:
        frames = [compose(f, *size) for f in frames]
    grids = [parse(f) for f in frames]
    h, w = len(grids[0]), len(grids[0][0])
    for i, g in enumerate(grids):
        assert len(g) == h and all(len(r) == w for r in g), f'frame {i} is not {w}x{h}'
    img = Image.new('RGBA', (w * len(grids), h), (0, 0, 0, 0))
    for i, g in enumerate(grids):
        for y, row in enumerate(g):
            for x, ch in enumerate(row):
                if ch != '.':
                    img.putpixel((i * w + x, y), palette[ch] + (255,))
    return img


SHEETS = {
    'player': PLAYER, 'zombie': ZOMBIE, 'ghost': GHOST,
    'gem': GEM, 'key': KEY, 'gun': GUN, 'bullet': BULLET,
}


def preview(sheets: dict[str, Image.Image], zoom=8, bg=(40, 30, 52)) -> Image.Image:
    pad = 2
    width = max(im.width + i * 0 for i, im in enumerate(sheets.values())) + pad * 2
    height = sum(im.height + pad for im in sheets.values()) + pad
    out = Image.new('RGBA', (width, height), bg + (255,))
    y = pad
    for im in sheets.values():
        out.alpha_composite(im, (pad, y))
        y += im.height + pad
    return out.resize((width * zoom, height * zoom), Image.NEAREST)


if __name__ == '__main__':
    root = Path(__file__).resolve().parent.parent
    out_dir = root / 'public' / 'sprites'
    out_dir.mkdir(parents=True, exist_ok=True)
    built = {name: build(frames, size=CHAR_SIZE.get(name)) for name, frames in SHEETS.items()}
    for name, im in built.items():
        im.save(out_dir / f'{name}.png')
        print(f'{name}.png  {im.width}x{im.height}')
    if '--preview' in sys.argv:
        (root / 'docs').mkdir(exist_ok=True)
        preview(built).save(root / 'docs' / 'sprite-preview.png')
        print('docs/sprite-preview.png')
