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

HEAD_BACK = """
....kkkkk...
..kkhhhiikk.
.khhhhhhhihk
.khhhhhhhhhk
kHHHHHHHHHHk
.knnnnnnnnk.
.knnnnnnnnk.
.knnnnnnnnk.
..knnnnnnk..
...kSSSSk...
"""

# Climbing, seen from behind: one hand reaches up while the other grips.
BODY_CLIMB = """
.ks.kkkkkk....
.kjkjjjjjjkk..
..kJjjjjjjjsk.
..kJjjjjjjjkk.
..kJjjjjjjjk..
..kJjjjjjjjk..
...kkkkkkkk...
"""

LEGS_CLIMB = """
...kppppppk...
...kpPkkpPk...
...kpPkkpPk...
...kbbbkpPk...
...kkkk.kpPk..
........kbbbk.
........kkkkk.
"""


def mirror(part):
    return '\n'.join(row[::-1] for row in part.strip('\n').split('\n'))


def climb_pose(flip):
    body, legs = (mirror(BODY_CLIMB), mirror(LEGS_CLIMB)) if flip else (BODY_CLIMB, LEGS_CLIMB)
    return [(legs, 3, 17), (body, 3, 10), (HEAD_BACK, 4, 0)]


def pose(head_dy, body, legs, legs_dy=0):
    return [(legs, 3, 17 + legs_dy), (body, 3, 10 + head_dy), (HEAD, 5, head_dy)]


# Frames: 0-1 idle (breathe), 2-5 run, 6 jump, 7 fall / hurt, 8-9 climb.
PLAYER = [
    pose(0, BODY_IDLE, LEGS_STAND),
    pose(1, BODY_IDLE, LEGS_STAND),
    pose(1, BODY_RUN_A, LEGS_STRIDE),
    pose(0, BODY_IDLE, LEGS_PASS),
    pose(1, BODY_RUN_B, LEGS_STRIDE),
    pose(0, BODY_IDLE, LEGS_PASS),
    pose(0, BODY_JUMP, LEGS_TUCK),
    pose(0, BODY_ARMS_UP, LEGS_DANGLE),
    climb_pose(False),
    climb_pose(True),
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


# ================================================================ house tiles
# The haunted house: a moonlit palette of cold violets and blues, with warm
# wood and candlelight as the only bright spots. Tiles are 16x16. Several
# tiles share one map drawn in different palettes (see TILE_SHEETS).

STONE = """
cccccccccacccccc
bbbbbbbbdacbbbbb
bbbbbbbbdacbbbbb
bbbdbbbbdacbbbbb
bbbbbbbbdacbbdbb
bbbbbbbbdacbbbbb
dddddddddadddddd
aaaaaaaaaaaaaaaa
cccacccccccccacc
bbdacbbbbbbbdacb
bbdacbbbbbbbdacb
bbdacbbdbbbbdacb
bbdacbbbbbbbdacb
bbdacbbbbbbbdacb
dddadddddddddadd
aaaaaaaaaaaaaaaa
"""

# A wall stone with a mossy top edge, used for the cellar floor.
FLAGSTONE = '\nmmmmMmmmmmmmMmmm' + STONE.strip('\n')[16:]

FLOORBOARDS = """
wwwwwwwwwwwwwwww
WWWWWWWxWWWWWWWW
WWWWWWWxWWWWWWWW
WWWWWWWxWWWWWWWW
xxxxxxxxxxxxxxxx
qqqqqqqqqqqqqqqq
qqqqqQqqqqqqqqqq
qqqqqqqqqqqQqqqq
qqqqqqqqqqqqqqqq
qqQqqqqqqqqqqqqq
qqqqqqqqqQqqqqqq
qqqqqqqqqqqqqqqq
qqqqqqQqqqqqqqqq
qqqqqqqqqqqqqQqq
QQQQQQQQQQQQQQQQ
QQQQQQQQQQQQQQQQ
"""

SHINGLES = """
yyyyyyyyyyyyyyyy
rrrrrrrRrrrrrrrR
rrrrrrrRrrrrrrrR
RRRRRRRRRRRRRRRR
yyyyyyyyyyyyyyyy
rrrRrrrrrrrRrrrr
rrrRrrrrrrrRrrrr
RRRRRRRRRRRRRRRR
yyyyyyyyyyyyyyyy
rrrrrrrRrrrrrrrR
rrrrrrrRrrrrrrrR
RRRRRRRRRRRRRRRR
yyyyyyyyyyyyyyyy
rrrRrrrrrrrRrrrr
rrrRrrrrrrrRrrrr
RRRRRRRRRRRRRRRR
"""

# Stone ledge from before is now a wooden shelf on two brackets.
SHELF = """
wwwwwwwwwwwwwwww
WWWWWWWWWWWWWWWW
WWWWWWWWWWWWWWWW
xxxxxxxxxxxxxxxx
.qqqQ......qqqQ.
.qqQ.......qqQ..
.qQ........qQ...
.Q.........Q....
................
................
................
................
................
................
................
................
"""

LADDER = """
..wq........wq..
..wq........wq..
..wq........wq..
..wwwwwwwwwwwq..
..wqxxxxxxxxwq..
..wq........wq..
..wq........wq..
..wq........wq..
..wq........wq..
..wq........wq..
..wq........wq..
..wwwwwwwwwwwq..
..wqxxxxxxxxwq..
..wq........wq..
..wq........wq..
..wq........wq..
"""

# Each 4px step top must sit on the walking line in GameScene.stairSurface.
STAIRS = """
............wwww
............WWWW
............Qqqq
............Qqqq
........wwwwqqqq
........WWWWqqqq
........Qqqqqqqq
........Qqqqqqqq
....wwwwqqqqqqqq
....WWWWqqqqqqqq
....Qqqqqqqqqqqq
....Qqqqqqqqqqqq
wwwwqqqqqqqqqqqq
WWWWqqqqqqqqqqqq
qqqqqqqqqqqqqqqq
QQQQQQQQQQQQQQQQ
"""

CRATE = """
kkkkkkkkkkkkkkkk
kwwwwwwwwwwwwwwk
kwWWWWWWWWWWWWxk
kwWxxxxxxxxxxWxk
kwWxWWWWWWWxWWxk
kwWxWWWWWWxWxWxk
kwWxWWWWWxWWxWxk
kwWxWWWWxWWWxWxk
kwWxWWWxWWWWxWxk
kwWxWWxWWWWWxWxk
kwWxWxWWWWWWxWxk
kwWxxWWWWWWWxWxk
kwWxxxxxxxxxxWxk
kwWWWWWWWWWWWWxk
kxxxxxxxxxxxxxxk
kkkkkkkkkkkkkkkk
"""

WALLPAPER = """
UUuuuuuuUUuuuuuu
UUuuuuuuUUuuuuuu
UUuuvvuuUUuuuuuu
UUuvVVvuUUuuuuuu
UUuuvvuuUUuuuuuu
UUuuuuuuUUuuuuuu
UUuuuuuuUUuuuuuu
UUuuuuuuUUuuuuuu
UUuuuuuuUUuuuuuu
UUuuuuuuUUuuuuuu
UUuuuuuuUUuuvvuu
UUuuuuuuUUuvVVvu
UUuuuuuuUUuuvvuu
UUuuuuuuUUuuuuuu
UUuuuuuuUUuuuuuu
UUuuuuuuUUuuuuuu
"""

# Wallpaper with the wooden dado rail along its bottom edge.
WALLPAPER_RAIL = '\n'.join(WALLPAPER.strip('\n').split('\n')[:13] + ['tttttttttttttttt', 'TTTTTTTTTTTTTTTT', 'kkkkkkkkkkkkkkkk'])

WAINSCOT = """
TTTTTTTTTTTTTTTT
TtttttkTTtttttkT
TtqqqqkTTtqqqqkT
TtqqqqkTTtqqqqkT
TtqqqqkTTtqqqqkT
TtqqqqkTTtqqqqkT
TtqqqqkTTtqqqqkT
TtqqqqkTTtqqqqkT
TtqqqqkTTtqqqqkT
TtqqqqkTTtqqqqkT
TtqqqqkTTtqqqqkT
TtqqqqkTTtqqqqkT
TtqqqqkTTtqqqqkT
TkkkkkkTTkkkkkkT
TTTTTTTTTTTTTTTT
kkkkkkkkkkkkkkkk
"""

ATTIC_PLANKS = """
pppoPPPopppoPPPo
pppoPPPopppoPPPo
pnpoPPPopppoPnPo
pppoPPPopppoPPPo
pppoPPPopopoPPPo
pppoPPPoppooPPPo
pppoPoPopppoPPPo
pppoPPPopppoPPPo
pppoPPPopppoPPPo
ooooPPPopppooooo
pppoPPPopppoPPPo
pppoPPPopopoPPPo
pppoPPPopppoPPPo
pnpoPPPopppoPnPo
pppoPPPopppoPPPo
pppoPPPopppoPPPo
"""

# The broken edge of a floor seen in cross-section (holes, stairwells).
FLOOR_GAP = """
oooooooooooooooo
oooooooooooooooo
oooooooooooooooo
oooooooooooooooo
oooooooooooooooo
oPPPoooPPPoooPPP
oPpPoooPpPoooPpP
oPpPoooPpPoooPpP
oPpPoooPpPoooPpP
oPpPoooPpPoooPpP
oPpPoooPpPoooPpP
oPpPoooPpPoooPpP
oPpPoooPpPoooPpP
oPPPoooPPPoooPPP
oooooooooooooooo
oooooooooooooooo
"""

PORTRAIT_LADY = """
................
.YYYYYYYYYYYYYY.
.YyyyyyyyyyyyyY.
.Yy0000000000yY.
.Yy0000hhh000yY.
.Yy000hhhhh00yY.
.Yy000hfffh00yY.
.Yy000frfrf00yY.
.Yy000fffff00yY.
.Yy0000fff000yY.
.Yy000ccccc00yY.
.Yy00ccccccc0yY.
.Yy0cccccccccyY.
.YyyyyyyyyyyyyY.
.YYYYYYYYYYYYYY.
................
"""

PORTRAIT_MOON = """
................
.YYYYYYYYYYYYYY.
.YyyyyyyyyyyyyY.
.YynnnnnnnmmnyY.
.YynnnnnnmmmmyY.
.YynnnnnnnmmnyY.
.YynnhnnnnnnnyY.
.YynhhhnnnnnnyY.
.YynnhnnnnnnnyY.
.YynnhngggnnnyY.
.YygghggggggnyY.
.YyggggggggggyY.
.YyggggggggggyY.
.YyyyyyyyyyyyyY.
.YYYYYYYYYYYYYY.
................
"""

CANDLE_FLAMES = [
    ['................', '........o.......', '.......oo.......', '.......oOo......', '.......OO.......'],
    ['.......o........', '.......oo.......', '......oOo.......', '.......oOo......', '.......OO.......'],
    ['................', '................', '........o.......', '.......oOo......', '.......OO.......'],
]
CANDLE_BASE = [
    '.......ww.......', '.......wW.......', '.......wW.......', '.......wW.......', '.......wW.......',
    '......YyyY......', '.....YyyyyY.....', '........Y.......', '........Y.......',
    '.......yY.......', '......YyyY......',
]
CANDLE = ['\n'.join(flame + CANDLE_BASE) for flame in CANDLE_FLAMES]

SPIKES = """
................
................
................
................
................
................
................
................
.ll..ll..ll..ll.
.lm..lm..lm..lm.
.lm..lm..lm..lm.
lmmMlmmMlmmMlmmM
lmmMlmmMlmmMlmmM
lmMMlmMMlmMMlmMM
rrrrrrrrrrrrrrrr
RRRRRRRRRRRRRRRR
"""


class Canvas:
    """A small character grid for art that is easier to draw with code than by hand."""

    def __init__(self, w, h, fill='.'):
        self.w, self.h = w, h
        self.g = [[fill] * w for _ in range(h)]

    def px(self, x, y, ch):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.g[y][x] = ch

    def rect(self, x, y, w, h, ch):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.px(xx, yy, ch)

    def line(self, x0, y0, x1, y1, ch):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(n + 1):
            self.px(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n), ch)

    def crop(self, x, y, w, h):
        return '\n'.join(''.join(row[x:x + w]) for row in self.g[y:y + h])


def window_art():
    """A 32x32 moonlit window with tattered curtains, cut into four tiles."""
    c = Canvas(32, 32)
    c.rect(5, 2, 22, 26, 'F')            # outer frame
    c.rect(7, 4, 18, 22, 'n')            # night glass
    c.rect(7, 15, 18, 11, 'N')           # lower panes catch a little light
    for x, y in [(9, 6), (13, 9), (19, 12), (10, 18), (22, 20), (17, 6)]:
        c.px(x, y, 's')
    c.rect(19, 6, 4, 4, 'm')             # the moon in the top-right pane
    c.rect(18, 7, 6, 2, 'm')
    c.px(20, 7, 'M'), c.px(21, 9, 'M')
    c.rect(15, 4, 2, 22, 'F'), c.rect(7, 14, 18, 2, 'F')   # glazing bars
    c.rect(16, 4, 1, 22, 'f'), c.rect(7, 14, 18, 1, 'f')
    c.rect(5, 2, 22, 1, 'f')
    c.rect(3, 27, 26, 2, 'f'), c.rect(3, 29, 26, 1, 'F')   # sill
    c.rect(0, 1, 32, 1, 'k')             # curtain rod
    c.rect(0, 0, 2, 3, 'y'), c.rect(30, 0, 2, 3, 'y')
    for side in (0, 1):                  # tattered curtains, longer in the middle of each fold
        for i, length in enumerate([27, 30, 26, 22, 15, 9]):
            x = i if side == 0 else 31 - i
            c.rect(x, 2, 1, length, 'C' if i % 2 else 'c')
    return [c.crop(0, 0, 16, 16), c.crop(16, 0, 16, 16), c.crop(0, 16, 16, 16), c.crop(16, 16, 16, 16)]


def cobweb_art():
    """Threads fanning out from a top-left corner, joined by sagging rings."""
    c = Canvas(16, 16)
    import math
    angles = [0, 22, 45, 68, 90]
    for a in angles:
        r = math.radians(a)
        c.line(0, 0, round(15 * math.cos(r)), round(15 * math.sin(r)), 'e')
    for radius in (4, 8, 12):
        pts = [(round(radius * math.cos(math.radians(a))), round(radius * math.sin(math.radians(a)))) for a in angles]
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            c.line(x0, y0, x1, y1, 'E')
    return c.crop(0, 0, 16, 16)


def bookcase_art():
    """A 16x32 bookcase full of dusty books, cut into top and bottom tiles."""
    import random
    rnd = random.Random(7)
    c = Canvas(16, 32)
    c.rect(0, 0, 16, 32, 'F')
    c.rect(0, 0, 16, 2, 'f')
    for top in (3, 11, 19):
        c.rect(2, top, 12, 7, 'o')       # shadowy shelf back
        x = 2
        while x < 14:
            h = rnd.choice([5, 6, 7])
            book = rnd.choice('1234')
            c.rect(x, top + 7 - h, 1 if rnd.random() < 0.3 else 2, h, book)
            x += 2 if rnd.random() < 0.85 else 3
        c.rect(1, top + 7, 14, 1, 'f')   # shelf
    c.rect(2, 27, 12, 4, 'q')            # cupboard doors
    c.rect(7, 27, 1, 4, 'F'), c.px(6, 29, 'y'), c.px(8, 29, 'y')
    return [c.crop(0, 0, 16, 16), c.crop(0, 16, 16, 16)]


def vent_art():
    """A 16x16 iron air vent: a dark duct behind four slats."""
    c = Canvas(16, 16)
    c.rect(1, 2, 14, 11, 'M')
    c.rect(2, 3, 12, 9, 'k')
    for y in (4, 6, 8, 10):
        c.rect(2, y, 12, 1, 'm')
    c.rect(1, 2, 14, 1, 'l')
    for x, y in ((2, 3), (13, 3), (2, 11), (13, 11)):
        c.px(x, y, 'l')                  # screws
    for x, h in ((4, 3), (5, 2), (9, 4), (11, 2)):
        c.rect(x, 12, 1, h, 's')         # slime oozing out of the bottom
        c.px(x, 12 + h, 'S')
    return c.crop(0, 0, 16, 16)


def tentacle_art(length, sway, curl=False):
    """
    A 24x32 tentacle hanging down out of a vent (the vent is the middle 16px of
    the top tile, and its slats are drawn over the tentacle).
    length: pixels below the vent; sway: how far the tip swings sideways.
    """
    import math
    c = Canvas(24, 32)
    if length <= 0:
        return c.crop(0, 0, 24, 32)
    top, n = 4, 8 + length
    for i in range(n):
        t = i / max(n - 1, 1)
        x = 11.5 + sway * math.sin(t * 2.4) * t + (3 * math.sin(t * 9) * t * t if curl else 0)
        y = top + i
        r = 4.6 * (1 - t) + 0.9
        for xx in range(int(x - r), int(x + r) + 1):
            if abs(xx + 0.5 - x) <= r:
                c.px(xx, y, 'G' if xx + 0.5 > x + r * 0.4 else 'g')
        if r > 1.6 and i % 5 != 3:
            c.px(round(x - r * 0.15), y, 'h')    # wet shine down the front
        if i % 3 == 1 and r > 1.5:
            c.px(round(x - r * 0.55), y, 'p')    # suckers down one side
    return c.crop(0, 0, 24, 32)


def lurker_art(eyes, look=0, fingers=False):
    """
    A 32x32 cupboard under the stairs, its door ajar, with something inside.
    eyes: None (just darkness), 'open' or 'half'; look: pupils -1 left, 0 ahead, 1 right;
    fingers: long grey fingers curled round the edge of the door.
    """
    c = Canvas(32, 32)
    c.rect(3, 5, 26, 27, 'F')            # wooden frame
    c.rect(3, 5, 26, 1, 'f')
    c.rect(5, 7, 22, 25, 'k')            # the dark inside
    c.rect(18, 9, 9, 23, 'K')
    c.rect(5, 7, 10, 25, 'W')            # door, swung half open
    for x in (7, 10, 13):
        c.rect(x, 9, 1, 21, 'x')
    c.rect(5, 7, 10, 1, 'w')
    c.rect(14, 7, 1, 25, 'x')
    c.px(13, 19, 'y')                    # door knob
    if eyes:
        for ex in (18, 23):
            if eyes == 'open':
                c.rect(ex, 15, 4, 2, 'e'), c.rect(ex + 1, 14, 2, 1, 'e'), c.rect(ex + 1, 17, 2, 1, 'E')
                c.rect(ex + 1 + look, 15, 2, 2, 'p')
            else:
                c.rect(ex, 16, 4, 1, 'E')
    if fingers:
        for i, y in enumerate((17, 20, 23)):
            c.rect(15, y, 3, 1, 'g'), c.px(15, y + 1, 'G'), c.px(14, y + 1, 'c')
            c.rect(16, y + 1, 2 + i % 2, 1, 'G')
    return c.crop(0, 0, 32, 32)


def door_art(open_):
    """The 16x32 exit door: an arched oak door with iron bands, or open onto warm light."""
    c = Canvas(16, 32)
    for y in range(32):
        for x in range(16):
            # Round the top into an arch.
            if y < 8 and (x - 7.5) ** 2 + (y - 8) ** 2 > 8.2 ** 2:
                continue
            inner = y >= 2 and 2 <= x <= 13 and not (y < 8 and (x - 7.5) ** 2 + (y - 8) ** 2 > 6.2 ** 2)
            if not inner:
                c.px(x, y, 'a' if (x + y // 4) % 5 else 'd')    # stone arch
            elif open_:
                c.px(x, y, 'O' if y > 20 else 'o' if y > 10 else 'k')
            else:
                c.px(x, y, 'x' if x in (5, 8, 11) else 'W')
    if open_:
        c.rect(2, 8, 2, 24, 'x')         # the door swung back against the frame
        c.rect(4, 26, 8, 6, 'O')
    else:
        c.rect(2, 10, 12, 1, 'm'), c.rect(2, 23, 12, 1, 'm')  # iron bands
        c.px(11, 17, 'y'), c.px(11, 18, 'k'), c.px(10, 17, 'Y')  # lock
    return c.crop(0, 0, 16, 32)


def sky_art(w=448, h=248):
    """The night sky behind the house: a violet gradient, stars and a big moon."""
    import random
    rnd = random.Random(3)
    img = Image.new('RGBA', (w, h))
    top, bottom = (10, 8, 28), (52, 34, 82)
    for y in range(h):
        t = y / (h - 1)
        col = tuple(round(a + (b - a) * t) for a, b in zip(top, bottom)) + (255,)
        for x in range(w):
            img.putpixel((x, y), col)
    for _ in range(140):
        x, y = rnd.randrange(w), rnd.randrange(h)
        b = rnd.choice([120, 160, 210, 255])
        img.putpixel((x, y), (b, b, min(255, b + 30), 255))
    mx, my, r = 300, 30, 18
    for y in range(my - r - 6, my + r + 7):
        for x in range(mx - r - 6, mx + r + 7):
            d = ((x - mx) ** 2 + (y - my) ** 2) ** 0.5
            if d <= r:
                shade = 228 - (12 if ((x - mx + 6) ** 2 + (y - my + 4) ** 2) < 25 or ((x - mx - 7) ** 2 + (y - my - 6) ** 2) < 16 else 0)
                img.putpixel((x, y), (shade, shade, shade - 24, 255))
            elif d <= r + 6:                 # soft halo
                old = img.getpixel((x, y))
                k = 0.25 * (1 - (d - r) / 6)
                img.putpixel((x, y), tuple(round(o + (200 - o) * k) for o in old[:3]) + (255,))
    for cy, cx, cw in [(48, 240, 90), (52, 330, 70), (120, 60, 120), (160, 260, 140)]:   # thin clouds
        for x in range(cx, cx + cw):
            for y in (cy, cy + 1):
                if 0 <= x < w:
                    old = img.getpixel((x, y))
                    img.putpixel((x, y), tuple(round(o * 0.75 + 70 * 0.25) for o in old[:3]) + (255,))
    return img


# Moonlit palettes. Letters are reused between palettes on purpose: the same
# map drawn in a different palette gives the cellar stone, the two wallpapers, etc.
STONE_PAL = {'a': (34, 30, 50), 'b': (82, 76, 104), 'c': (112, 106, 136), 'd': (62, 56, 84)}
CELLAR_STONE_PAL = {'a': (30, 32, 36), 'b': (60, 64, 70), 'c': (84, 90, 94), 'd': (46, 50, 56),
                    'm': (70, 104, 70), 'M': (48, 76, 52)}
CELLAR_BACK_PAL = {'a': (16, 16, 22), 'b': (32, 32, 42), 'c': (40, 40, 52), 'd': (26, 26, 34)}
WOOD_PAL = {'w': (156, 108, 70), 'W': (120, 82, 54), 'x': (66, 42, 32), 'q': (72, 50, 44), 'Q': (48, 32, 32),
            'k': (30, 20, 22)}
ROOF_PAL = {'y': (100, 82, 122), 'r': (70, 56, 92), 'R': (44, 34, 62)}
LADDER_PAL = {'w': (140, 100, 64), 'q': (96, 66, 42), 'x': (54, 36, 26)}
MAUVE_PAL = {'U': (46, 32, 54), 'u': (54, 38, 62), 'v': (78, 56, 88), 'V': (66, 46, 76),
             't': (104, 70, 54), 'T': (74, 50, 40), 'k': (30, 20, 22), 'q': (58, 38, 34)}
TEAL_PAL = {**MAUVE_PAL, 'U': (26, 36, 50), 'u': (30, 42, 58), 'v': (46, 64, 84), 'V': (38, 54, 72)}
ATTIC_PAL = {'p': (52, 42, 52), 'P': (44, 35, 45), 'o': (26, 20, 28), 'n': (96, 90, 104)}
WINDOW_PAL = {'F': (66, 46, 40), 'f': (98, 70, 54), 'n': (20, 28, 64), 'N': (32, 44, 92), 's': (210, 220, 255),
              'm': (230, 230, 206), 'M': (200, 200, 178), 'k': (24, 18, 22), 'y': (196, 150, 60),
              'c': (98, 26, 46), 'C': (70, 18, 36)}
DECOR_PAL = {**WINDOW_PAL, 'e': (196, 196, 216, 170), 'E': (170, 170, 196, 120),
             'Y': (176, 128, 40), 'y': (224, 180, 80), '0': (24, 16, 28), 'h': (60, 56, 72),
             'f': (206, 200, 186), 'r': (255, 64, 64), 'c': (84, 30, 56), 'g': (26, 36, 38),
             'n': (24, 32, 70), 'm': (230, 230, 206),
             'F': (64, 44, 36), 'o': (22, 16, 20), 'q': (84, 58, 42),
             '1': (110, 40, 52), '2': (40, 72, 90), '3': (96, 86, 50), '4': (60, 46, 82)}
BOOK_PAL = {**DECOR_PAL, 'f': (98, 70, 54), 'y': (196, 150, 60)}
CANDLE_PAL = {'o': (255, 160, 48), 'O': (255, 240, 170), 'w': (232, 224, 200), 'W': (190, 180, 160),
              'y': (214, 170, 80), 'Y': (150, 110, 40)}
SPIKE_PAL = {'l': (206, 184, 168), 'm': (150, 96, 70), 'M': (96, 58, 46), 'r': (110, 70, 56), 'R': (70, 44, 38)}
DOOR_PAL = {'a': (82, 76, 104), 'd': (62, 56, 84), 'W': (110, 72, 44), 'x': (70, 44, 28), 'm': (60, 60, 70),
            'y': (230, 190, 70), 'Y': (160, 120, 40), 'k': (10, 6, 10), 'o': (120, 80, 40), 'O': (255, 210, 120)}

VENT_PAL = {'M': (44, 44, 54), 'm': (92, 94, 108), 'l': (130, 132, 146), 'k': (6, 4, 10),
            's': (96, 170, 70), 'S': (150, 220, 110)}
TENTACLE_PAL = {'g': (86, 150, 72), 'G': (52, 100, 50), 'p': (196, 230, 140), 'h': (176, 236, 140)}
LURKER_PAL = {'F': (60, 42, 36), 'f': (86, 60, 46), 'k': (6, 4, 10), 'K': (12, 9, 18), 'W': (84, 56, 40),
              'w': (110, 76, 52), 'x': (52, 34, 26), 'y': (196, 150, 60), 'e': (226, 246, 110),
              'E': (150, 170, 60), 'p': (40, 8, 8), 'g': (150, 148, 136), 'G': (100, 98, 92), 'c': (226, 224, 206)}

WINDOW, BOOKCASE, COBWEB = window_art(), bookcase_art(), cobweb_art()

# Each sheet is a list of (map, palette). Frame order matters: GameScene and
# BootScene refer to frames by index (see the constants at the top of GameScene).
TILE_SHEETS = {
    # 0 stone wall, 1 shelf, 2 ladder, 3 ladder top, 4 stairs up-right, 5 stairs up-left,
    # 6 floorboards, 7 roof, 8 cellar floor, 9 crate
    'tiles': [(STONE, STONE_PAL), (SHELF, WOOD_PAL), (LADDER, LADDER_PAL), (LADDER, LADDER_PAL),
              (STAIRS, WOOD_PAL), (mirror(STAIRS), WOOD_PAL), (FLOORBOARDS, WOOD_PAL), (SHINGLES, ROOF_PAL),
              (FLAGSTONE, CELLAR_STONE_PAL), (CRATE, WOOD_PAL)],
    # 0 attic planks, 1-3 upstairs wallpaper / rail / panelling, 4-6 downstairs, 7 cellar wall, 8 floor gap
    'back': [(ATTIC_PLANKS, ATTIC_PAL), (WALLPAPER, MAUVE_PAL), (WALLPAPER_RAIL, MAUVE_PAL), (WAINSCOT, MAUVE_PAL),
             (WALLPAPER, TEAL_PAL), (WALLPAPER_RAIL, TEAL_PAL), (WAINSCOT, TEAL_PAL), (STONE, CELLAR_BACK_PAL),
             (FLOOR_GAP, ATTIC_PAL)],
    # 0-3 window (top-left, top-right, bottom-left, bottom-right), 4-5 cobweb (left, right corner),
    # 6-7 portraits, 8-9 bookcase (top, bottom), 10 air vent
    'decor': [(w, WINDOW_PAL) for w in WINDOW] + [(COBWEB, DECOR_PAL), (mirror(COBWEB), DECOR_PAL),
              (PORTRAIT_LADY, DECOR_PAL), (PORTRAIT_MOON, DECOR_PAL)] + [(b, BOOK_PAL) for b in BOOKCASE] +
             [(vent_art(), VENT_PAL)],
    'candle': [(f, CANDLE_PAL) for f in CANDLE],
    'spikes': [(SPIKES, SPIKE_PAL)],
    'door': [(door_art(False), DOOR_PAL), (door_art(True), DOOR_PAL)],
    # Tentacles reaching out of a vent: 0 none, 1-2 sliding out, 3-5 swaying
    'tentacle': [(tentacle_art(l, sw, cu), TENTACLE_PAL) for l, sw, cu in
                 [(0, 0, False), (5, 0, False), (11, 3, False), (18, -7, False), (19, 7, False), (18, 2, True)]],
    # The thing under the stairs: 0 dark, 1 eyes, 2 blink, 3 looking left, 4 looking right, 5 fingers out
    'lurker': [(lurker_art(None), LURKER_PAL), (lurker_art('open'), LURKER_PAL), (lurker_art('half'), LURKER_PAL),
               (lurker_art('open', -1), LURKER_PAL), (lurker_art('open', 1), LURKER_PAL),
               (lurker_art('open', -1, True), LURKER_PAL)],
}


def build_tiles(frames) -> Image.Image:
    """Like build(), but each frame has its own palette, and colours may carry an alpha."""
    imgs = []
    for art, pal in frames:
        grid = parse(art)
        h, w = len(grid), len(grid[0])
        img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        for y, row in enumerate(grid):
            for x, ch in enumerate(row):
                if ch != '.':
                    col = pal[ch]
                    img.putpixel((x, y), col if len(col) == 4 else col + (255,))
        imgs.append(img)
    w, h = imgs[0].size
    for i, im in enumerate(imgs):
        assert im.size == (w, h), f'frame {i} is {im.size}, not {(w, h)}'
    sheet = Image.new('RGBA', (w * len(imgs), h), (0, 0, 0, 0))
    for i, im in enumerate(imgs):
        sheet.alpha_composite(im, (i * w, 0))
    return sheet


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
    built.update({name: build_tiles(frames) for name, frames in TILE_SHEETS.items()})
    built['sky'] = sky_art()
    for name, im in built.items():
        im.save(out_dir / f'{name}.png')
        print(f'{name}.png  {im.width}x{im.height}')
    if '--preview' in sys.argv:
        (root / 'docs').mkdir(exist_ok=True)
        preview({k: v for k, v in built.items() if k != 'sky'}).save(root / 'docs' / 'sprite-preview.png')
        print('docs/sprite-preview.png')
