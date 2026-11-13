"""
Builds the game's sprite sheets from the ASCII pixel maps below.

    python3 tools/sprites.py            # writes public/sprites/*.png
    python3 tools/sprites.py --preview  # also writes docs/sprite-preview.png (8x zoom)

Player skins (PLAYER_SKINS) each get a whole sheet, player-<skin>.png, with its own palette.

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
    'n': (92, 60, 40),     # zombie hair
    'z': (46, 34, 30),     # hunter's short dark hair
    'Z': (82, 62, 50),     # hair highlight
    'j': (140, 90, 54),    # worn brown leather jacket
    'J': (96, 60, 38),     # leather shade
    'l': (184, 128, 80),   # scuffed leather highlight / lapel
    'f': (176, 46, 46),    # plaid flannel shirt
    'F': (74, 30, 36),     # flannel dark check
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
    'e': (150, 98, 58),    # shotgun stock (walnut)
    'E': (98, 62, 38),     # stock shade
    'x': (214, 220, 236),  # rock salt grain shade
    # The vampire: goth rock, not a cape. Pale skin, messy black hair, black leather.
    'q': (226, 222, 238),  # deathly pale skin
    'Q': (166, 156, 192),  # pale skin shade
    'h': (40, 30, 62),     # black hair
    'H': (86, 72, 126),    # hair sheen
    'L': (48, 42, 64),     # black leather
    'B': (104, 96, 132),   # leather highlight
    'i': (214, 218, 230),  # silver studs and chain
    'R': (128, 22, 44),    # oxblood shirt
    'u': (82, 14, 32),     # shirt shade
    'd': (60, 58, 80),     # black jeans
    'D': (32, 30, 44),     # jeans shade
    'K': (122, 92, 62),    # machete grip (wrapped cord)
    # Zombie gore: cartoony green goo rather than blood, with a little bone.
    'O': (170, 222, 74),   # bright goo
    'U': (78, 120, 40),    # dark goo
    'N': (112, 28, 40),    # raw neck
    'W': (232, 228, 204),  # bone / teeth
}

# ---------------------------------------------------------------- characters
# Characters are 20x24 frames assembled from parts (legs, then body, then head
# drawn on top), so a pose is a list of (part, x, y) placements. Parts are
# drawn facing right; Phaser flips them for walking left.

HEAD = """
............
...kkkkkk...
..kzzzzZzkk.
.kzzzzzzZzZk
.kzzzzzzzzzk
.kzzzssszzsk
.kzSsssswksk
.kzSsssssssk
..kssSsSSsk.
...kSSSSSk..
"""

BODY_IDLE = """
....kkkkkk....
...kjlfFljk...
..kJjjfFfjjk..
..kJjjFfFjjk..
..kJjjfFfjjk..
..ksJjFfFjsk..
...kkkkkkkk...
"""

BODY_RUN_A = """
....kkkkkk....
...kjlfFljk...
..kJjjfFfjjkk.
.kkJjjFfFjjjsk
ksJJjjfFfjkkk.
.kkJjjFfFjk...
...kkkkkkkk...
"""

BODY_RUN_B = """
....kkkkkk....
...kjlfFljk...
..kJjjfFfjjk..
kskJjjFfFjjkk.
.kkJjjfFfjjjsk
..kJjjFfFjkk..
...kkkkkkkk...
"""

BODY_JUMP = """
....kkkkkk.ks.
...kjlfFljkjk.
..kJjjfFfjjjk.
..kJjjFfFjjk..
.ksJjjfFfjjk..
..kJjjFfFjjk..
...kkkkkkkk...
"""

BODY_ARMS_UP = """
.ks.kkkkkk.ks.
.kjkjlfFljkjk.
..kJjjfFfjjk..
..kJjjFfFjjk..
..kJjjfFfjjk..
..kJjjFfFjjk..
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
............
...kkkkkk...
..kzzzZzzk..
.kzzZzzzzzk.
.kzzzzzzZzk.
.kzzzzzzzzk.
.kSzzzzzzSk.
.kSzzzzzzSk.
..kzzzzzzk..
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


# Holding the gun: the front arm points forward, the hand grips a small pistol
# (GUN_IN_HAND is stamped on top, level with the bullet's spawn point).
BODY_AIM = """
....kkkkkk....
...kjlfFljk...
..kJjjfFfjjkkk
..kJjjFfFjjjjk
..kJjjfFfjkkk.
..ksJjFfFjk...
...kkkkkkkk...
"""

BODY_AIM_RUN = """
....kkkkkk....
...kjlfFljk...
..kJjjfFfjjkkk
.kkJjjFfFjjjjk
ksJJjjfFfjkkk.
.kkJjjFfFjk...
...kkkkkkkk...
"""

GUN_IN_HAND = """
.kkkkkk
jjjsmmm
jJksMMM
kkkskkk
...kk..
"""


# The rock salt shotgun held at the hip: the same hand and barrel line as the
# pistol, with the walnut pump and stock running back under the forearm.
# Stamped at x=8, so the hand sits exactly where the pistol's does.
SHOTGUN_IN_HAND = """
.....kkkkkkk
.....jjjsmmm
.....jJksMMM
kkkkkkkeeemk
keeeeeeEEEk.
kEEkkkkkkkk.
kkk.........
"""


def mirror(part):
    return '\n'.join(row[::-1] for row in part.strip('\n').split('\n'))


# The machete, held up and ready beside the face: the grip is in the same hand
# as the guns', with the blade standing straight up. Stamped at x=13, y=3.
MACHETE_IN_HAND = """
....kk.
...kwMk
...kwMk
...kmMk
...kmMk
...kmMk
...kmMk
..kkkkk
...kKk.
jjjssk.
jJkssk.
kkkkKk.
...kk..
"""

# A swing, 1: the arm goes up and the blade is raised high (body BODY_JUMP).
MACHETE_RAISED = """
.kk.
kwMk
kwMk
kwMk
kmMk
kmMk
kkkkk
.kKk.
"""

# A swing, 2: the arm snaps forward and the blade cuts down in front.
# Stamped at x=13, y=11, like the pistol; the slash itself is drawn by the game.
MACHETE_STRIKE = """
.kkkk..
jjjssk.
jJksskk
kkkkkmMk
....kmMk
....kkmMk
......kk.
"""

# ---------------------------------------------------------------- player skins
# Every skin has the same 36 frames in the same order, so the game can swap one
# sheet for another. A skin names the parts it redraws (anything it leaves out
# is the ghost hunter's) and the colours it changes. The held weapons use 'j'
# and 'J' for the sleeve and 's' for the hand, so they take on each skin's colours.
#   EXTRA:      parts stamped on top of the standing poses, as (art, x, y), moving with the head
#   EXTRA_BACK: the same for the climbing poses (seen from behind)
HUNTER = {
    'HEAD': HEAD, 'HEAD_BACK': HEAD_BACK,
    'BODY_IDLE': BODY_IDLE, 'BODY_RUN_A': BODY_RUN_A, 'BODY_RUN_B': BODY_RUN_B,
    'BODY_JUMP': BODY_JUMP, 'BODY_ARMS_UP': BODY_ARMS_UP, 'BODY_CLIMB': BODY_CLIMB,
    'BODY_AIM': BODY_AIM, 'BODY_AIM_RUN': BODY_AIM_RUN,
    'LEGS_STAND': LEGS_STAND, 'LEGS_STRIDE': LEGS_STRIDE, 'LEGS_PASS': LEGS_PASS,
    'LEGS_TUCK': LEGS_TUCK, 'LEGS_DANGLE': LEGS_DANGLE, 'LEGS_CLIMB': LEGS_CLIMB,
    'EXTRA': [], 'EXTRA_BACK': [],
}


def player_frames(skin: dict) -> list:
    g = {**HUNTER, **skin}

    def extra(key, dy):
        return [(art, x, y + dy) for art, x, y in g[key]]

    def pose(head_dy, body, legs, legs_dy=0):
        return [(g[legs], 3, 17 + legs_dy), (g[body], 3, 10 + head_dy), (g['HEAD'], 5, head_dy)] + extra('EXTRA', head_dy)

    def climb_pose(flip):
        body, legs = g['BODY_CLIMB'], g['LEGS_CLIMB']
        if flip:
            body, legs = mirror(body), mirror(legs)
        return [(legs, 3, 17), (body, 3, 10), (g['HEAD_BACK'], 4, 0)] + extra('EXTRA_BACK', 0)

    def holding(item, x, y):
        return lambda head_dy, body, legs: pose(head_dy, body, legs) + [(item, x, y + head_dy)]

    # Frames: 0-1 idle (breathe), 2-5 run, 6 jump, 7 fall / hurt, 8-9 climb.
    frames = [
        pose(0, 'BODY_IDLE', 'LEGS_STAND'),
        pose(1, 'BODY_IDLE', 'LEGS_STAND'),
        pose(1, 'BODY_RUN_A', 'LEGS_STRIDE'),
        pose(0, 'BODY_IDLE', 'LEGS_PASS'),
        pose(1, 'BODY_RUN_B', 'LEGS_STRIDE'),
        pose(0, 'BODY_IDLE', 'LEGS_PASS'),
        pose(0, 'BODY_JUMP', 'LEGS_TUCK'),
        pose(0, 'BODY_ARMS_UP', 'LEGS_DANGLE'),
        climb_pose(False),
        climb_pose(True),
    ]
    # Then the same idle/run/jump/fall poses holding each weapon: 10-17 the pistol
    # (GUN_IN_HAND sits level with the bullet's spawn point), 18-25 the rock salt
    # shotgun (stamped at x=8 so the hand is where the pistol's is), 26-33 the machete.
    for held in (holding(GUN_IN_HAND, 13, 11), holding(SHOTGUN_IN_HAND, 8, 11), holding(MACHETE_IN_HAND, 13, 3)):
        frames += [
            held(0, 'BODY_AIM', 'LEGS_STAND'),
            held(1, 'BODY_AIM', 'LEGS_STAND'),
            held(1, 'BODY_AIM_RUN', 'LEGS_STRIDE'),
            held(0, 'BODY_AIM', 'LEGS_PASS'),
            held(1, 'BODY_AIM', 'LEGS_STRIDE'),
            held(0, 'BODY_AIM', 'LEGS_PASS'),
            held(0, 'BODY_AIM', 'LEGS_TUCK'),
            held(0, 'BODY_AIM', 'LEGS_DANGLE'),
        ]
    # 34-35 a machete swing (raise, strike).
    frames += [
        pose(0, 'BODY_JUMP', 'LEGS_STAND') + [(MACHETE_RAISED, 13, 3)],
        pose(1, 'BODY_AIM', 'LEGS_STRIDE') + [(MACHETE_STRIKE, 13, 12)],
    ]
    return frames


PLAYER = player_frames(HUNTER)


# ---- The Weaver: a pale goth spirit in a dark teal kimono with red flowers and a
# red obi, waist-long straight black hair with blunt bangs, dark lips, a red streak
# under the eye, and a red-eyed spider riding on her shoulder.
WEAVER_PALETTE = {
    **PALETTE,
    's': (238, 230, 236),  # pale skin
    'S': (192, 176, 198),  # skin shade
    'z': (44, 38, 60),     # black hair
    'Z': (74, 68, 100),    # hair sheen
    'j': (46, 82, 88),     # dark teal kimono
    'J': (28, 52, 60),     # kimono shade
    'l': (234, 214, 180),  # cream collar and flower petals
    'f': (186, 44, 46),    # red obi
    'F': (118, 28, 36),    # obi shade, and the red streak under her eye
    'c': (218, 74, 60),    # red flowers on the kimono
    'p': (46, 82, 88),     # kimono skirt
    'P': (28, 52, 60),
    'b': (222, 214, 210),  # white tabi socks
    'u': (66, 20, 44),     # dark lipstick
    'r': (226, 40, 52),    # the spider's red eyes
    'H': (104, 70, 56),    # the spider's brown body
}

WEAVER_HEAD = """
............
...kkkkkk...
..kzzzzzzkk.
.kzzZZZZzzzk
.kzzzzzzzzzk
.kzzzzzzzzzk
.kzzzSsSkssk
.kzzzSssFssk
.kzzzsssFuk.
.kzzzkSSSk..
.kzzzk......
.kzzzk......
.kzzzk......
.kzzzk......
.kzzk.......
..kk........
"""

WEAVER_HEAD_BACK = """
............
...kkkkkk...
..kzzzzzzk..
.kzZZZZZzzk.
.kzzzzzzzzk.
.kzzzzzzzzk.
.kzzzzzzzzk.
.kzzzzzzzzk.
.kzzzzzzzzk.
.kzzzzzzzzk.
..kzzzzzzk..
..kzzzzzzk..
..kzzzzzzk..
..kzzzzzzk..
..kzzzzzzk..
...kkkkkk...
"""

# A small black spider with red eyes, riding on her back shoulder.
SPIDER = """
k..kk.k
.kkHHkk
kkHHHrk
.kkHHkk
k.k..k.
"""


def kimono(body):
    """Re-dresses one of the hunter's torsos as the kimono: cream collar, red obi
    round the waist, red flowers; the sleeves keep their shape in teal."""
    rows = [list(r) for r in body.strip('\n').split('\n')]
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch not in 'jJfFl' or not 3 <= x <= 10:
                continue
            if y == 1:
                row[x] = 'l' if ch in 'fFl' else ch
            elif y == 2:
                row[x] = 'l' if x == 7 else ('c' if x == 4 else ('J' if ch == 'J' else 'j'))
            elif y in (3, 4):
                row[x] = 'J' if x == 3 else ('l' if (x, y) == (8, 4) else ('F' if y == 4 else 'f'))
            elif y == 5:
                row[x] = 'c' if x == 7 else ('J' if ch == 'J' else 'j')
    return '\n'.join(''.join(r) for r in rows)


# The robe falls to the ankles when she stands; walking and jumping show the hem
# parting over white tabi socks.
WEAVER_LEGS_STAND = """
...kjjjjjjk...
...kJjjcjjk...
...kJjjjjjk...
...kJjcjjjjk..
...kJjjjjjjk..
...kkbbkkbbk..
...kkkkkkkkk..
"""

WEAVER = {
    'HEAD': WEAVER_HEAD, 'HEAD_BACK': WEAVER_HEAD_BACK,
    **{k: kimono(HUNTER[k]) for k in HUNTER if k.startswith('BODY_')},
    'LEGS_STAND': WEAVER_LEGS_STAND,
    'EXTRA': [(SPIDER, 2, 7)],
    'EXTRA_BACK': [(SPIDER, 2, 8)],
}

# ---- Ink: silver hair in a messy high ponytail, round glasses, a cross earring,
# an oversized black tee and dark shorts, with grey ink tattoos and red roses
# all down her arms and legs.
INK_PALETTE = {
    **PALETTE,
    's': (240, 226, 222),  # pale skin
    'S': (196, 176, 182),  # skin shade
    'z': (214, 218, 232),  # silver-white hair
    'Z': (156, 162, 190),  # hair shade
    'j': (222, 206, 208),  # tattooed arm: skin...
    'J': (120, 116, 134),  # ...and grey ink
    'p': (222, 206, 208),  # tattooed leg: skin...
    'P': (120, 116, 134),  # ...and grey ink
    'r': (204, 38, 50),    # red roses in the tattoos
    'L': (40, 36, 50),     # oversized black tee
    'h': (26, 24, 34),     # tee shade
    'd': (64, 62, 78),     # dark shorts
    'D': (40, 38, 52),     # shorts shade
    'b': (36, 32, 44),     # black boots
    'M': (120, 124, 140),  # glasses frames (and gun metal shade)
    'i': (146, 146, 166),  # ear piercings and the little cross earring
}

INK_HEAD = """
............
...kkkkkk...
..kzzzzzzkk.
.kzzzzzzzzzk
.kzzzzzzzzzk
.kzZzzzZzkzk
.kzzzsSsMssk
.kzZiMMMkMsk
.kzzisSsMsk.
.kZkiSSSSk..
.kzk.kkkk...
.kzk........
..k.........
"""

INK_HEAD_BACK = """
............
...kkkkkk...
..kzzzzzzk..
.kzzzZZzzzk.
.kzzzZZzzzk.
.kzzzzzzzzk.
.kzZzzzzZzk.
.kzzzzzzzzk.
.kZzzzzzzZk.
..kzzzzzzk..
...kkzzkk...
....kzzk....
....kZzk....
.....kk.....
"""

# The high ponytail, flicking up and back from the crown.
PONYTAIL = """
.kkkk...
kzzzzkk.
kzZkk...
kzzk....
kzZk....
.kzk....
.kzk....
..k.....
"""


def tee(body):
    """Re-dresses one of the hunter's torsos in a baggy black tee whose sleeves
    reach the elbow; the rest of each arm is tattooed skin with a rose."""
    rows = [list(r) for r in body.strip('\n').split('\n')]
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in 'jJfFl' and 2 <= x <= 11:
                row[x] = 'h' if ch == 'J' else 'L'
            elif ch == 'j' and (x + y) % 3 == 0:
                row[x] = 'J'
    return '\n'.join(''.join(r) for r in rows)


def shorts(legs):
    """The hunter's jeans cut off as shorts: tattooed legs below, a rose on one shin."""
    rows = [list(r) for r in legs.strip('\n').split('\n')]
    rose = False
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch not in 'pP':
                continue
            if y <= 1:
                row[x] = 'D' if ch == 'P' else 'd'
            elif ch == 'p' and y >= 3 and not rose:
                row[x], rose = 'r', True
    return '\n'.join(''.join(r) for r in rows)


INK = {
    'HEAD': INK_HEAD, 'HEAD_BACK': INK_HEAD_BACK,
    **{k: tee(HUNTER[k]) for k in HUNTER if k.startswith('BODY_')},
    **{k: shorts(HUNTER[k]) for k in HUNTER if k.startswith('LEGS_')},
    'EXTRA': [(PONYTAIL, 2, 1)],
    'EXTRA_BACK': [],
}

# Each skin's sheet, built with its palette. The game picks one (SKINS in src/config.ts).
PLAYER_SKINS = {
    'player': (PLAYER, PALETTE),
    'player-weaver': (player_frames(WEAVER), WEAVER_PALETTE),
    'player-ink': (player_frames(INK), INK_PALETTE),
}

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


# The back of a zombie's head: patchy hair over green skin.
ZOMBIE_HEAD_BACK = """
....kkkkk...
..kknnnGnkk.
.knnGgnnnGnk
.kngggnGggnk
kGgggggnggGk
.kGgggggggk.
.kGgggggGgk.
.kGGgggggGk.
..kGGgggGk..
...kGGGGk...
"""


def zombie_climb_pose(flip):
    body = BODY_CLIMB.replace('j', 'c').replace('J', 'C').replace('s', 'g')
    legs = trousers(LEGS_CLIMB)
    if flip:
        body, legs = mirror(body), mirror(legs)
    return [(legs, 3, 17), (body, 3, 10), (ZOMBIE_HEAD_BACK, 4, 0)]


# ---- Headshot: the zombie's head is blown clean off.
# The bullet lands: the head snaps back and cracks, goo bursting out of the front.
ZOMBIE_HEAD_HIT = """
..knkkkkk....
.knngggggkO..
.knggggOggkOO
.kGggggkOOO.O
.kGGggggOgUk.
.kGgggkwkUO.O
..kGggkkkk...
..kGGgggGk...
...kkkkkk....
"""

# The head bursts in a spray of goo, hair, bone and one red eye.
ZOMBIE_HEAD_BURST = """
...O...U...O....
.O...UnOn.U...O.
....UOOnOOOU....
..UOOOOWOOOOU..O
O.UOOOrOOOOOOU..
..UOOOOOOWOOU...
.O.UUOOOOOUU..O.
...O..UOOU...O..
.......NN.......
"""

# Where the head was, with goo pumping out (tall, short, done).
ZOMBIE_STUMP = [
    """
.O..O.
..OO..
.O.O..
..OO..
.kkkk.
kNUUNk
.kkkk.
""",
    """
......
......
..O.O.
..OO..
.kkkk.
kNUUNk
.kkkk.
""",
    """
......
......
......
......
.kkkk.
kNUUNk
.kkkk.
""",
]

# Arms dropped: nothing left to lurch after.
ZOMBIE_BODY_LIMP = (BODY_IDLE.replace('j', 'c').replace('J', 'C').replace('l', 'c')
                    .replace('f', 'c').replace('F', 'c').replace('s', 'g'))

# Flat on its back, fallen away from the shot: neck to the left, a boot in the air.
ZOMBIE_FALLEN = """
....................
....................
....................
....................
....................
....................
....................
....................
....................
....................
....................
....................
....................
....................
....................
....................
....................
....................
....................
.....kk.........kk..
.....kgk.......kbbk.
.kk.kkgkkkkkkkkkbbk.
kNUkcCcccccctttTTkk.
UOUkkkkkkkkkkkkkkk..
"""


def zombie_headless(dy, body, legs, spurt, legs_y=17, x=3):
    return [(trousers(legs), 3, legs_y), (body, x, 10 + dy), (ZOMBIE_STUMP[spurt], x + 4, 4 + dy)]


# Frames 0-3: lurching walk. 4-5: climbing a ladder, seen from behind.
# 6-11: headshot death. 6 hit, 7 head bursts, 8-9 headless body stands and sways,
# 10 knees go, 11 flat on its back. A machete cut skips 6-7: the head flies off
# whole (the 'zombie-head' image) and the body plays 8-11.
ZOMBIE = [
    zombie_pose(1, ZOMBIE_BODY_A, LEGS_STRIDE),
    zombie_pose(0, ZOMBIE_BODY_B, LEGS_PASS),
    zombie_pose(1, ZOMBIE_BODY_A, LEGS_STRIDE),
    zombie_pose(0, ZOMBIE_BODY_B, LEGS_STAND),
    zombie_climb_pose(False),
    zombie_climb_pose(True),
    [(trousers(LEGS_STAND), 3, 17), (ZOMBIE_BODY_A, 3, 10), (ZOMBIE_HEAD_HIT, 4, 0)],
    [(trousers(LEGS_STAND), 3, 17), (ZOMBIE_BODY_A, 3, 10), (ZOMBIE_HEAD_BURST, 2, 0)],
    zombie_headless(0, ZOMBIE_BODY_A, LEGS_STAND, 0),
    zombie_headless(0, ZOMBIE_BODY_LIMP, LEGS_STRIDE, 1, x=2),
    zombie_headless(3, ZOMBIE_BODY_LIMP, LEGS_TUCK, 2, legs_y=19, x=2),
    [(ZOMBIE_FALLEN, 0, 0)],
]
ZOMBIE_HEAD_ONLY = [ZOMBIE_HEAD]

# Bits of zombie that fly off in a headshot: 0 skin, 1 scalp, 2 eyeball, 3 goo, 4 tooth.
GORE = ["""
.kk.
kggk
kGgk
.kk.
""", """
.kk.
knnk
kgGk
.kk.
""", """
.kk.
kwrk
kwwk
.kk.
""", """
....
.OO.
.OU.
....
""", """
....
.WW.
.Wk.
....
"""]

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

# ---------------------------------------------------------------- vampire
# An original goth-rock vampire guarding the way out: deathly pale, messy black
# hair falling over one eye, red eyes and fangs, a studded black leather jacket
# over an oxblood shirt, a silver chain belt, black jeans and boots. No cape.

VAMP_HEAD = """
.k.kk.kk....
khkhhkhhkk..
khhHhhhHhhk.
khhhhhHhhhhk
khhhhHhhhqhk
khhhhqqqkrqk
khhhQqqqqqqk
khhhQqqqqkkk
.khhkQqqkwwk
.khk.kQQqqk.
..k...kkkk..
"""

# Hissing: the mouth gapes, fangs out.
VAMP_HEAD_HISS = """
.k.kk.kk....
khkhhkhhkk..
khhHhhhHhhk.
khhhhhHhhhhk
khhhhHhhhqhk
khhhhqqqkrqk
khhhQqqqqqkk
khhhQqqqkwRk
.khhkQqqkRRk
.khk.kQQkwkk
..k...kkkk..
"""

VAMP_BODY = """
....kkkkkk....
...kBiRRuBk...
..kLLBRuRBLk..
..kLLLRRuLLk..
..kLLLuRRLLk..
..kqLLiiiLqk..
...kkkkkkkk...
"""

# Stalking: the front hand reaches out, clawed.
VAMP_BODY_REACH = """
....kkkkkk....
...kBiRRuBk...
..kLLBRuRBkkk.
..kLLLRRuLLLqk
..kLLLuRRLkkqk
..kqLLiiiLk...
...kkkkkkkk...
"""

# Lunging: both arms thrown forward, claws first.
VAMP_BODY_LUNGE = """
....kkkkkk.....
...kBiRRuBkkkk.
..kLLBRuRBLLqqk
..kLLLRRuLLkkqk
..kLLLuRRLk.k.k
..kLLLiiiLk....
...kkkkkkkk....
"""

# Where the head was.
VAMP_STUMP = """
.kkkk.
kRuuRk
.kkkk.
"""


def vamp_legs(legs):
    return legs.replace('p', 'd').replace('P', 'D').replace('b', 'L')


def vamp_pose(dy, body, legs, head=VAMP_HEAD):
    return [(vamp_legs(legs), 3, 17), (body, 3, 10 + dy), (head, 5, dy)]


# Frames 0-1 idle, 2-5 stalking walk, 6 crouched to lunge, 7 lunging, 8 hissing,
# 9 headless (the head on its own is the 'vampire-head' image).
VAMPIRE = [
    vamp_pose(0, VAMP_BODY, LEGS_STAND),
    vamp_pose(1, VAMP_BODY, LEGS_STAND),
    vamp_pose(1, VAMP_BODY_REACH, LEGS_STRIDE),
    vamp_pose(0, VAMP_BODY_REACH, LEGS_PASS),
    vamp_pose(1, VAMP_BODY_REACH, LEGS_STRIDE),
    vamp_pose(0, VAMP_BODY_REACH, LEGS_STAND),
    [(vamp_legs(LEGS_TUCK), 3, 19), (VAMP_BODY_LUNGE, 3, 12), (VAMP_HEAD_HISS, 5, 2)],
    [(vamp_legs(LEGS_STRIDE), 3, 17), (VAMP_BODY_LUNGE, 4, 11), (VAMP_HEAD_HISS, 7, 1)],
    vamp_pose(0, VAMP_BODY_REACH, LEGS_STAND, VAMP_HEAD_HISS),
    [(vamp_legs(LEGS_STAND), 3, 17), (VAMP_BODY, 3, 10), (VAMP_STUMP, 7, 8)],
]
VAMPIRE_HEAD = [VAMP_HEAD]

CHAR_SIZE = {'player': (20, 24), 'zombie': (20, 24), 'ghost': (20, 20), 'vampire': (20, 24)}

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

# The rock salt shotgun pickup (and HUD icon): double barrel, walnut pump and stock.
SHOTGUN = ["""
.............kk.
.kkkkkkkkkkkkmk.
kmmmmmmmmmmmmmmk
kMMMMMMMMMMMMMMk
.kkkkkeeeekkkkk.
kkk..kEEEEk.....
keekkk..........
kEeeek..........
.kkkkk..........
"""]

# The machete pickup (and HUD icon): a long broad blade on a cord-wrapped grip.
MACHETE = ["""
.......kkkkkkkkk..
.kkkk.kwwwwwwwwwkk
kKyKKkkmmmmmmmmmmk
kKKyKkkMMMMMMMMMk.
.kkkk.kkkkkkkkkk..
"""]

# The spare leather jacket in the attic (an extra life): worn brown leather with the
# plaid flannel lining showing down the open front, and a pocket flap on each side.
JACKET = ["""
...kkkkkkkk...
..klllFFlllk..
.kjjllfflljjk.
kjjjlJFFJljjjk
kjkjjJffJjjkjk
kjkjjJFFJjjkjk
kjkjjJffJjjkjk
kjklkJFFJklkjk
kjkjjJffJjjkjk
kJkJJJFFJJJkJk
kkkkkkkkkkkkkk
"""]

# One grain of rock salt; a shotgun blast fires a few in a fan.
SALT = ["""
.w.
wwx
.x.
"""]

# Pops up over a zombie's head: 0 "!" when it spots the player, 1 "?" when it loses them.
EMOTE = ["""
..kkk..
..kyk..
..kyk..
..kyk..
..kyk..
..kkk..
..kyk..
..kkk..
""", """
.kkkkk.
kkwwwkk
kwkkkwk
kkk.kwk
..kwwkk
..kkkk.
..kwk..
..kkk..
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


# ================================================================ fire
# A burning ghost: 0-3 roaring flames (loop), 4-6 dying down to embers.
# Drawn from a height for each column, with the hottest colours at the
# bottom middle, so the flames are generated rather than hand drawn.
FIRE_PAL = {'R': (122, 24, 26), 'r': (214, 58, 34), 'o': (255, 140, 40), 'y': (255, 214, 84), 'w': (255, 250, 214)}


def fire_art(t, size=1.0, w=20, h=26):
    import math
    rows = [['.'] * w for _ in range(h)]
    cx = (w - 1) / 2
    for x in range(w):
        dx = (x - cx) / (w / 2)
        envelope = max(0.0, 1 - dx * dx * 1.15)
        tongues = 0.22 * math.sin(x * 1.9 + t * 2.1) + 0.14 * math.sin(x * 3.7 - t * 2.9)
        height = h * size * envelope * (0.72 + tongues)
        for y in range(h):
            up = h - 1 - y
            if up >= height:
                continue
            heat = (1 - up / max(height, 1)) * (1 - abs(dx) * 0.8)
            rows[y][x] = 'w' if heat > 0.78 else 'y' if heat > 0.55 else 'o' if heat > 0.32 else 'r' if heat > 0.14 else 'R'
    # A few loose flecks of flame above the tips.
    for i in range(3):
        fx = int(cx + 6 * math.sin(t * 1.7 + i * 2.3))
        fy = int(h - h * size * 0.95 - 2 - ((t * 3 + i * 4) % 6))
        if 0 <= fx < w and 0 <= fy < h and size > 0.3:
            rows[fy][fx] = 'o' if i % 2 else 'y'
    return '\n'.join(''.join(r) for r in rows)


FIRE = [(fire_art(t), FIRE_PAL) for t in range(4)] + [(fire_art(4, s), FIRE_PAL) for s in (0.6, 0.35, 0.15)]
EMBER_PAL = {'o': (255, 150, 50), 'y': (255, 226, 120)}
EMBER = [("yo\noo", EMBER_PAL)]


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

# Trapdoors. Closed, each looks a lot like the floor it sits in, but a careful
# player can spot it: a dark gap at each edge of the lid, an iron ring, and lid
# planks a shade darker than the boards around them.
TRAP_BOARDS = """
kvvvvvvvvvvvvvvk
kVVVVVrrrVVVVVVk
kVVVVVrVrVVVVVVk
kVVVVVRRRVVVVVVk
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

# A flagstone that is really a lid: a dark gap at each edge breaks the moss along the
# floor, and an iron ring is set into it.
TRAP_FLAG = """
kmmmmmMmmmmmmmMk
kbbbbbbbbbbbbbbk
kbbbbbbrrrbbbbbk
kbbdbbbrbrbbbbbk
kbbbbbbRRRbbbdbk
kbbbbbbbbbbbbbbk
dddddddddddddddd
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

# Open: the lid has dropped away, and far below, in the dark, something coils. Drawn in the same palettes as the closed lids plus SNAKE_PAL.
TRAP_OPEN = """
xkkkkkkkkkkkkkkx
kkkkkkkkkkkkkkkk
kkkkkkkkkkkkkkkk
kkkkkkkkkkkkkkkk
kkkkkkkkkkkkkkkk
kkkkkkkkkkkkkkkk
kkkkkkkkkkkkkkkk
kkkkkkkkkkkkkkkk
kkkkkkkkkkkkkkkk
kkkkkkkkkkkkkkkk
kkkkkkkkkkkkkkkk
kkkkkkkkkkkkkkkk
kkkkkGGkkkkkkkkk
kkkkGgggGkkGGGkk
kkGGgkkgGGGgkgGk
kGggkkkkggggkkgk
"""
TRAP_OPEN_FLAG = TRAP_OPEN.replace('x', 'd')

# A snake rearing up out of the pit, facing right. Frames shift it up out of the hole.
SNAKE_BODY = """
................
......GGGGG.....
.....GghhgggG...
.....GggggrggG..
.....GgyyyyyGG..
......GGgyyy....
........Ggy.....
........Ggy.....
.......Gggy.....
......Gghy......
......Ggy.......
......Ggy.......
......Gggy......
.......Gghy.....
........Ggy.....
........Ggy.....
.......Gggy.....
......Gghy......
......Ggy.......
......Ggy.......
"""
SNAKE_TONGUE = SNAKE_BODY.replace('GgyyyyyGG..', 'GgyyyyyGGtt').replace('GGgyyy....', 'GGgyyy..t.', 1)
SNAKE_STRIKE = SNAKE_BODY.replace('GggggrggG..', 'GggggrgggGG').replace('GgyyyyyGG..', 'Ggyyffkkkkf').replace(
    '......GGgyyy....', '......GGgyyyyGGt', 1)


def rise(art, dy):
    """The snake `dy` pixels lower, its tail cut off by the bottom of the frame."""
    rows = art.strip('\n').split('\n')
    return '\n' + '\n'.join(['.' * len(rows[0])] * dy + rows[:len(rows) - dy]) + '\n'



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


def _books(c, rnd, x0, x1, top, h):
    """Fills one shelf, from x0 to x1 (exclusive), with books up to h pixels tall standing on row top + h."""
    c.rect(x0, top, x1 - x0, h, 'o')     # shadowy shelf back
    x = x0
    while x < x1:
        bh = min(h, rnd.choice([h - 2, h - 1, h, h]))
        width = 1 if rnd.random() < 0.3 else 2
        c.rect(x, top + h - bh, min(width, x1 - x), bh, rnd.choice('123456'))
        if bh >= 5 and width == 2 and rnd.random() < 0.5:
            c.rect(x, top + h - bh + 1, min(width, x1 - x), 1, 'y')   # gilt band on the spine
        x += width + (1 if rnd.random() < 0.15 else 0)


def library_art():
    """
    Tall library bookcases, 16px wide, that stack into a wall of books: a top with a
    carved cornice, two middle tiles (different books), a cupboard base, and a middle
    tile with a gap on its lower shelf where the loose book (see PULL_BOOK) stands.
    """
    import random
    tiles = []
    for kind in ('top', 'mid', 'mid', 'base', 'gap'):
        rnd = random.Random(len(tiles) * 11 + 5)
        c = Canvas(16, 16)
        c.rect(0, 0, 16, 16, 'F')
        c.rect(15, 0, 1, 16, 'k')        # a dark seam between neighbouring cases
        shelves = {'top': [(4, 3)], 'mid': [(0, 7), (8, 7)], 'base': [(0, 7)], 'gap': [(0, 7), (8, 7)]}[kind]
        for top, h in shelves:
            _books(c, rnd, 2, 14, top, h)
            c.rect(1, top + h, 14, 1, 'f')   # the shelf
        if kind == 'top':
            c.rect(0, 0, 16, 2, 'f'), c.rect(0, 2, 16, 1, 'F')
            for x in range(1, 16, 3):
                c.px(x, 1, 'q')          # carved dentils
            c.rect(2, 11, 12, 4, 'o')    # top shelf of the middle tile carries on below
            _books(c, rnd, 2, 14, 8, 7)
            c.rect(1, 15, 14, 1, 'f')
        if kind == 'base':
            c.rect(2, 9, 12, 6, 'q')     # cupboard doors
            c.rect(7, 9, 1, 6, 'F'), c.px(6, 12, 'y'), c.px(8, 12, 'y')
            c.rect(0, 15, 16, 1, 'f')
        if kind == 'gap':
            c.rect(6, 8, 3, 7, 'o')      # where the loose book stands
        tiles.append(c.crop(0, 0, 16, 16))
    return tiles


def armchair_art():
    """A 16x16 high-backed reading chair in worn wine-red velvet, facing right."""
    c = Canvas(16, 16)
    c.rect(2, 2, 4, 11, 'c')             # tall back
    c.rect(2, 2, 4, 1, 'C'), c.rect(3, 1, 2, 1, 'c')
    c.rect(5, 3, 1, 9, 'C')
    c.rect(4, 9, 10, 3, 'c')             # seat cushion
    c.rect(4, 9, 10, 1, '1')
    c.rect(11, 6, 3, 4, 'c'), c.rect(11, 6, 3, 1, '1')   # arm
    c.rect(3, 12, 11, 2, 'C')            # skirt
    c.rect(3, 14, 1, 2, 'F'), c.rect(12, 14, 1, 2, 'F')  # legs
    c.px(13, 15, 'F'), c.px(2, 15, 'F')
    c.px(4, 6, 'C'), c.px(3, 8, '1')     # a worn patch
    return c.crop(0, 0, 16, 16)


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


def sky_art(w=448, h=264):
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


# The book on the library shelf that is really a lever: a fat old book with a
# cracked gilt spine. Phaser tips it out of the shelf when it is pulled.
PULL_BOOK = """
.ry.
rRRr
rYYr
rRRr
rRRr
rRRr
rYYr
rrrr
"""

# A rug that hides the secret hatch. Seen from the side it is a thin strip on the
# floor, with a woven border and a fringe at each end.
def rug_art(w=44):
    c = Canvas(w, 3)
    c.rect(2, 0, w - 4, 3, 'c')
    for x in range(3, w - 3, 4):
        c.px(x, 1, 'y'), c.px(x + 2, 1, '4')
    c.rect(2, 2, w - 4, 1, 'C')
    for x in (0, 1, w - 2, w - 1):
        c.px(x, 2, 'f')                  # fringe
    return c.crop(0, 0, w, 3)


# The secret hatch's lid, seen edge-on: Phaser swings it up on its hinge.
HATCH_LID = """
wwwwwwwwwwwwwwww
WWWkWWWWWWWWkWWW
xxxxxxxxxxxxxxxx
"""

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
SAGE_PAL = {**MAUVE_PAL, 'U': (30, 44, 38), 'u': (36, 52, 44), 'v': (58, 80, 64), 'V': (48, 68, 54)}
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
LIBRARY_PAL = {**BOOK_PAL, 'k': (30, 20, 24), '5': (70, 92, 60), '6': (128, 96, 70)}
CHAIR_PAL = {'c': (110, 34, 52), 'C': (72, 22, 38), '1': (148, 58, 72), 'F': (54, 36, 30)}
PULL_BOOK_PAL = {'r': (60, 22, 30), 'R': (122, 34, 44), 'Y': (214, 170, 80), 'y': (255, 236, 170)}
RUG_PAL = {'c': (104, 36, 44), 'C': (70, 24, 34), 'y': (200, 156, 72), '4': (60, 46, 82), 'f': (210, 196, 160)}
CANDLE_PAL = {'o': (255, 160, 48), 'O': (255, 240, 170), 'w': (232, 224, 200), 'W': (190, 180, 160),
              'y': (214, 170, 80), 'Y': (150, 110, 40)}
SNAKE_PAL = {'G': (28, 70, 34), 'g': (62, 132, 56), 'h': (128, 176, 64), 'y': (196, 186, 96), 'r': (255, 70, 50),
             't': (230, 40, 70), 'f': (236, 236, 220), 'k': (40, 8, 14)}
# Trapdoor cues: a near-black gap all round the lid, an iron ring with a glint on top,
# and (wood only) lid planks a shade darker than the floor.
TRAP_RING = {'r': (128, 120, 118), 'R': (62, 56, 58)}
TRAP_WOOD_PAL = {**WOOD_PAL, **TRAP_RING, 'k': (22, 14, 16), 'v': (140, 96, 62), 'V': (106, 72, 48)}
TRAP_OPEN_PAL = {**WOOD_PAL, 'k': (8, 6, 10), 'G': (24, 44, 26), 'g': (40, 80, 40)}
TRAP_STONE_PAL = {**CELLAR_STONE_PAL, **TRAP_RING, 'k': (14, 14, 18)}
TRAP_OPEN_STONE_PAL = {**CELLAR_STONE_PAL, 'k': (8, 6, 10), 'G': (24, 44, 26), 'g': (40, 80, 40)}
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
    # 6 floorboards, 7 roof, 8 cellar floor, 9 crate,
    # 10-11 trapdoor in floorboards (closed, open), 12-13 trapdoor in the cellar floor (closed, open)
    'tiles': [(STONE, STONE_PAL), (SHELF, WOOD_PAL), (LADDER, LADDER_PAL), (LADDER, LADDER_PAL),
              (STAIRS, WOOD_PAL), (mirror(STAIRS), WOOD_PAL), (FLOORBOARDS, WOOD_PAL), (SHINGLES, ROOF_PAL),
              (FLAGSTONE, CELLAR_STONE_PAL), (CRATE, WOOD_PAL),
              (TRAP_BOARDS, TRAP_WOOD_PAL), (TRAP_OPEN, TRAP_OPEN_PAL),
              (TRAP_FLAG, TRAP_STONE_PAL), (TRAP_OPEN_FLAG, TRAP_OPEN_STONE_PAL)],
    # 0 attic planks, 1-3 upstairs wallpaper / rail / panelling, 4-6 downstairs, 7 cellar wall, 8 floor gap,
    # 9-11 top-floor gallery and nursery (sage green)
    'back': [(ATTIC_PLANKS, ATTIC_PAL), (WALLPAPER, MAUVE_PAL), (WALLPAPER_RAIL, MAUVE_PAL), (WAINSCOT, MAUVE_PAL),
             (WALLPAPER, TEAL_PAL), (WALLPAPER_RAIL, TEAL_PAL), (WAINSCOT, TEAL_PAL), (STONE, CELLAR_BACK_PAL),
             (FLOOR_GAP, ATTIC_PAL),
             (WALLPAPER, SAGE_PAL), (WALLPAPER_RAIL, SAGE_PAL), (WAINSCOT, SAGE_PAL)],
    # 0-3 window (top-left, top-right, bottom-left, bottom-right), 4-5 cobweb (left, right corner),
    # 6-7 portraits, 8-9 bookcase (top, bottom), 10 air vent,
    # 11-15 library bookcase (top, middle, middle, base, middle with the loose book's gap), 16 armchair
    'decor': [(w, WINDOW_PAL) for w in WINDOW] + [(COBWEB, DECOR_PAL), (mirror(COBWEB), DECOR_PAL),
              (PORTRAIT_LADY, DECOR_PAL), (PORTRAIT_MOON, DECOR_PAL)] + [(b, BOOK_PAL) for b in BOOKCASE] +
             [(vent_art(), VENT_PAL)] + [(t, LIBRARY_PAL) for t in library_art()] + [(armchair_art(), CHAIR_PAL)],
    'pull-book': [(PULL_BOOK, PULL_BOOK_PAL)],
    'rug': [(rug_art(), RUG_PAL)],
    'hatch-lid': [(HATCH_LID, WOOD_PAL)],
    'candle': [(f, CANDLE_PAL) for f in CANDLE],
    # A snake in the pit under a trapdoor: 0 just its head, 1 halfway, 2 reared up, tongue out, 3 striking
    'snake': [(rise(SNAKE_BODY, 13), SNAKE_PAL), (rise(SNAKE_BODY, 6), SNAKE_PAL),
              (SNAKE_TONGUE, SNAKE_PAL), (SNAKE_STRIKE, SNAKE_PAL)],
    'door': [(door_art(False), DOOR_PAL), (door_art(True), DOOR_PAL)],
    'fire': FIRE,
    'ember': EMBER,
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
    'zombie': ZOMBIE, 'ghost': GHOST,
    'gem': GEM, 'key': KEY, 'gun': GUN, 'bullet': BULLET,
    'shotgun': SHOTGUN, 'salt': SALT, 'emote': EMOTE,
    'vampire': VAMPIRE, 'vampire-head': VAMPIRE_HEAD, 'machete': MACHETE,
    'zombie-head': ZOMBIE_HEAD_ONLY, 'gore': GORE, 'jacket': JACKET,
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
    built = {name: build(frames, pal, size=CHAR_SIZE['player']) for name, (frames, pal) in PLAYER_SKINS.items()}
    built.update({name: build(frames, size=CHAR_SIZE.get(name)) for name, frames in SHEETS.items()})
    built.update({name: build_tiles(frames) for name, frames in TILE_SHEETS.items()})
    built['sky'] = sky_art()
    for name, im in built.items():
        im.save(out_dir / f'{name}.png')
        print(f'{name}.png  {im.width}x{im.height}')
    if '--preview' in sys.argv:
        (root / 'docs').mkdir(exist_ok=True)
        preview({k: v for k, v in built.items() if k != 'sky'}).save(root / 'docs' / 'sprite-preview.png')
        print('docs/sprite-preview.png')
