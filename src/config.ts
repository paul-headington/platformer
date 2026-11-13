/**
 * Shared game constants. The game world is measured in "world units": a tile is TILE units,
 * and the camera shows GAME_WIDTH x GAME_HEIGHT units. The canvas is RENDER_SCALE times
 * bigger and every camera is zoomed by RENDER_SCALE, so high-res art (drawn at RENDER_SCALE
 * pixels per unit) shows at full detail while speeds, sizes and levels keep their units.
 */
export const TILE = 16;
export const GAME_WIDTH = 256;
export const GAME_HEIGHT = 160;
/**
 * High-res pixels per world unit, and the game camera's zoom. 5 makes the 1280x800 canvas show
 * 256x160 units: a room (9 tiles, 144 units) still fits top to bottom, with characters as big
 * as they can be. High-res art (tools/art) is rendered at this density.
 */
export const RENDER_SCALE = 5;
/** The HUD keeps its own 320x200 layout, zoomed to fill the same canvas. */
export const HUD_WIDTH = 320;
export const HUD_HEIGHT = 200;
export const HUD_SCALE = (GAME_WIDTH * RENDER_SCALE) / HUD_WIDTH;
/** Text style settings that keep small text sharp on the zoomed-in cameras. */
export const TEXT_RES = { resolution: RENDER_SCALE } as const;

/**
 * Where an object that ignores the camera's scroll (scroll factor 0) must sit for its top-left
 * corner to land on the screen's top-left corner, given the main camera zooms around its middle.
 */
export const SCREEN_ORIGIN = {
  x: (GAME_WIDTH * (RENDER_SCALE - 1)) / 2,
  y: (GAME_HEIGHT * (RENDER_SCALE - 1)) / 2,
} as const;

export const PLAYER = {
  runSpeed: 110,
  climbSpeed: 70,
  jumpVelocity: 300,
  gravity: 700,
  /** Grace period to still jump just after running off a ledge (ms). */
  coyoteTime: 90,
  /** A jump pressed this long before landing still counts (ms). */
  jumpBuffer: 110,
  startLives: 3,
  invulnerableAfterRespawn: 1500,
};

export const CAMERA = {
  /** Share of the distance to the player the camera covers each 1/60 s. */
  lerp: 0.12,
  /** The camera never moves slower than this (px/s) until it arrives, so scrolls end cleanly. */
  minSpeed: 60,
  /**
   * How far above the player the camera centres (world units), so the floor they stand on
   * sits near the bottom of the screen and the room above them, up to its ceiling, is in view.
   */
  lookUp: 48,
};

// ============================================================================
// WEAPONS
// Each weapon has a damage value: a shot takes that much off an enemy's health,
// so the number of shots an enemy takes is its health divided by the damage,
// rounded up. A shotgun fires several pellets at once, and each pellet that
// lands does the damage. Which weapons can hurt which enemy is set on the enemy
// (hurtBy, below). To add a weapon, add an entry here; its id is the key.
// ============================================================================

interface WeaponBase {
  /** What the player is told when they pick it up. */
  name: string;
  /** Health each bullet, pellet or cut takes off the enemy it hits. */
  damage: number;
  /** Shortest time between shots or swings (ms). */
  cooldown: number;
  /** The pickup and HUD image. */
  icon: string;
}

/** A gun: fires bullets or pellets. */
export interface GunStats extends WeaponBase {
  melee?: false;
  /** Bullet speed (px/s). */
  speed: number;
  /** No more than this many of this weapon's shots on screen at once. */
  maxOnScreen: number;
  /** Bullets or pellets per shot. */
  pellets: number;
  /** How wide the pellets fan out: degrees between the top and bottom pellet. */
  spread: number;
  /** Shots fade out and vanish after this far (px). Infinity: until they leave the screen. */
  range: number;
  /** The bullet's image (a key loaded in BootScene). */
  bullet: string;
}

/** A blade: swung up close, it cuts whatever is in front of the player. */
export interface BladeStats extends WeaponBase {
  melee: true;
  /** How far in front of the player the cut reaches (px). The player's body is 8 px wide. */
  reach: number;
  /** How long the whole swing takes (ms): the blade goes up, then comes down. */
  swingTime: number;
  /** When in the swing the blade lands (ms); before that the player is winding up. */
  hitAt: number;
  /** How hard an enemy that survives a cut is knocked back (px/s). */
  knockback: number;
  /**
   * While this blade is held, an enemy only hurts the player if it touches this smaller
   * box (px), so he can get close enough to cut. It sits in the middle of his body, on his
   * feet. His full body is 8 wide and 22 tall; use those numbers for no shrink.
   */
  hurtbox: { width: number; height: number };
}

export type WeaponStats = GunStats | BladeStats;

export const WEAPONS = {
  /** The gun found in level 1 (G in the level text). Ghosts shrug it off. */
  pistol: {
    name: 'a gun',
    damage: 10,
    speed: 320,
    cooldown: 280,
    maxOnScreen: 3,
    pellets: 1,
    spread: 0,
    range: Infinity,
    bullet: 'bullet',
    icon: 'gun',
  },
  /**
   * The rock salt shotgun (S in the level text): the only thing that hurts a ghost,
   * and useless against zombies.
   * Three grains of salt in a fan that only carry six tiles, so it's best up close.
   */
  shotgun: {
    name: 'a rock salt shotgun',
    damage: 5,
    speed: 240,
    cooldown: 650,
    maxOnScreen: 1,
    pellets: 3,
    spread: 20,
    range: 6 * TILE,
    bullet: 'salt',
    icon: 'shotgun',
  },
  /**
   * The machete (m in the level text): a blade, not a gun. One cut fells a zombie, and
   * it is the only thing that can stop a vampire, by taking its head (two cuts).
   */
  machete: {
    name: 'a machete',
    melee: true,
    damage: 20,
    cooldown: 380,
    reach: 24,
    swingTime: 260,
    hitAt: 90,
    knockback: 170,
    hurtbox: { width: 4, height: 16 },
    icon: 'machete',
  },
} satisfies Record<string, WeaponStats>;

export type WeaponId = keyof typeof WEAPONS;

/** Which weapon each pickup letter in the level text gives the player. */
export const WEAPON_PICKUPS: Record<string, WeaponId> = { G: 'pistol', S: 'shotgun', m: 'machete' };
export const GUN_PICKUP: WeaponId = 'pistol';

// ============================================================================
// ENEMIES
// Every number that changes how an enemy behaves lives here. Distances are in
// pixels (one tile is TILE = 16 px), speeds in pixels per second and times in
// milliseconds. For scale, the player runs at PLAYER.runSpeed (110).
//
// Health works with weapon damage (see WEAPONS): with 30 health and the
// pistol's 10 damage, an enemy takes 3 shots, as long as the pistol is in its
// hurtBy list. Every enemy type has the
// EnemyStats numbers; the rest is particular to how that enemy moves.
// ============================================================================

export interface EnemyStats {
  /** Health it starts with. Each shot takes the weapon's damage off it; it dies at 0. */
  health: number;
  /** Lives the player loses when it touches them. */
  damage: number;
  /** Points for killing one. */
  points: number;
  /** The weapons that can hurt it. Shots from any other weapon pass straight through. */
  hurtBy: readonly WeaponId[];
  /**
   * How it dies: 'puff' squashes flat and fades, 'burn' goes up in flames, 'behead' loses its head and
   * crumbles to dust, 'headshot' has its head blown off by a bullet (or cut off by a blade) and falls down.
   */
  death: 'puff' | 'burn' | 'behead' | 'headshot';
}

/** Zombies (z in the level text): walk the floors, take stairs and ladders, can't jump. */
export const ZOMBIE = {
  // ---- Combat ---------------------------------------------------------------
  /** Health it starts with: the pistol does 10 a shot, so 20 = two shots. */
  health: 20,
  /** Lives the player loses when it touches them. */
  damage: 1,
  /** Points for killing one. */
  points: 200,
  /** Bullets and the machete. The shotgun is loaded with rock salt, which just bounces off. */
  hurtBy: ['pistol', 'machete'],
  death: 'headshot',
  /**
   * Hit but not killed, it staggers while its hurt clip plays (about 0.7 s): it moves at
   * flinchSpeed (a share of its speed, 0 = stops dead) until flinchHold of the way through
   * the clip (0 to 1), then eases back up to full speed as the clip ends.
   */
  flinchSpeed: 0.1,
  flinchHold: 0.6,

  // ---- Movement -------------------------------------------------------------
  /** Wandering speed. */
  speed: 32,
  /** Chasing speed: quicker than wandering, still well under PLAYER.runSpeed so the player can get away. */
  chaseSpeed: 52,
  /** Speed up and down ladders. */
  climbSpeed: 36,

  // ---- Spotting the player -----------------------------------------------------
  /** How far ahead it can see along its own floor (px). It only looks the way it faces while wandering. */
  sight: 8 * TILE,
  /** How far above or below its feet the player can be and still be "on its floor" to be seen (px). */
  sightHeight: 1.5 * TILE,
  /** Hears the player this close from any side, walls or not (px). */
  hearing: 36,
  /** The "!" pause after spotting the player, before it gives chase (ms). */
  alertTime: 500,

  // ---- Chasing and giving up ---------------------------------------------------
  /** Gives up with a "?" after losing track of the player for this long (ms). */
  forgetAfter: 3500,
  /** While the player is this few steps away on the walking map, it keeps track of them unseen. */
  trackSteps: 10,
  /** Re-plans its route at least this often (ms). Lower is sharper but costs more CPU. */
  replanEvery: 300,
} satisfies EnemyStats & Record<string, number | string | readonly string[]>;

/** Ghosts (g in the level text): drift over their haunt, fly through any open space, never through walls. */
export const GHOST = {
  // ---- Combat ---------------------------------------------------------------
  /** Health it starts with: two grains of rock salt (5 each), so one blast from close up. */
  health: 10,
  /** Lives the player loses when it touches them. */
  damage: 1,
  /** Points for killing one. */
  points: 200,
  /** Only rock salt hurts a ghost; bullets pass straight through. */
  hurtBy: ['shotgun'],
  /** Burns up in a burst of flame. */
  death: 'burn',
  /**
   * Hit but not killed, it reels while its hurt clip plays (about 1.25 s): it moves at
   * flinchSpeed (a share of its speed, 0 = stops dead) until flinchHold of the way through
   * the clip (0 to 1), then eases back up to full speed as the clip ends. The bob carries on.
   */
  flinchSpeed: 0.15,
  flinchHold: 0.65,

  // ---- Movement -------------------------------------------------------------
  /** Drifting back and forth over its haunt: speed, and how far each way from home (px). */
  speed: 28,
  range: 48,
  /** The up-and-down bob: how high (px) and how fast. */
  bob: 6,
  bobSpeed: 2.5,
  /** Chasing speed. Slower than a zombie, because a ghost flies straight over crates and up to shelves. */
  chaseSpeed: 40,
  /** Speed floating home after it gives up. */
  returnSpeed: 30,

  // ---- Spotting the player -----------------------------------------------------
  /** Sees the player this far away in any direction, if no wall or floor is in the way (px). */
  sight: 7 * TILE,
  /** The "!" pause after spotting the player, before it gives chase (ms). */
  alertTime: 600,

  // ---- Chasing and giving up ---------------------------------------------------
  /** Gives up with a "?" after losing sight of the player for this long (ms). */
  forgetAfter: 3000,
  /** Won't chase further than this from its haunt; it gives up and floats home (px). */
  leash: 14 * TILE,
  /** Re-plans its flight at least this often (ms). */
  replanEvery: 250,
} satisfies EnemyStats & Record<string, number | string | readonly string[]>;

/**
 * The vampire (V in the level text) guards the way out. Bullets and rock salt bounce
 * off it; only the machete hurts it, and the last cut takes its head. It keeps to its
 * own stretch of floor round where it starts, stalks the player when it sees them, and
 * crouches before it lunges, which is the moment to jump over it or cut first.
 * The exit door won't open while it stands.
 */
export const VAMPIRE = {
  // ---- Combat ---------------------------------------------------------------
  /** Health it starts with: the machete does 20 a cut, so 40 = two cuts. */
  health: 40,
  /** Lives the player loses when it touches them. */
  damage: 1,
  /** Points for killing one. */
  points: 1000,
  /** Only a blade. */
  hurtBy: ['machete'],
  /** Its head comes off and it crumbles to dust. */
  death: 'behead',

  // ---- Movement -------------------------------------------------------------
  /** Walking back to its post. */
  speed: 30,
  /** Stalking the player. Slower than the player, so they can always back off. */
  stalkSpeed: 56,
  /** Never goes further than this from where it starts, either way (px). */
  leash: 7 * TILE,

  // ---- Spotting the player -----------------------------------------------------
  /** Sees the player this far along its floor, either way (px). It's on guard, so it looks both ways. */
  sight: 9 * TILE,
  /** How far above or below its feet the player can be and still be seen (px). */
  sightHeight: 1.5 * TILE,
  /** The hiss after spotting the player, before it comes for them (ms). */
  alertTime: 700,
  /** Gives up and goes back to its post after losing sight of the player this long (ms). */
  forgetAfter: 3000,

  // ---- Lunging --------------------------------------------------------------------
  /** Lunges when the player is this close (px). */
  lungeRange: 3.5 * TILE,
  /**
   * The warning before a lunge (ms): it rears up hissing with a "!", then crouches
   * and trembles, flashing red faster and faster. Long enough to see it and jump.
   */
  lungeWindup: 900,
  /** The share of the warning spent rearing up before it drops into the crouch. */
  warnRearShare: 0.4,
  /** The red it flashes while it gets ready to lunge. */
  warnTint: 0xff5070,
  /** Lunge speed (px/s) and how far it goes (px). */
  lungeSpeed: 210,
  lungeDistance: 5 * TILE,
  /** Stands still after a lunge, open to a cut (ms). */
  lungeRecover: 650,
  /**
   * After a cut that doesn't kill it, it reels back hissing and can't attack for this long (ms).
   * It has no hurt clip of its own; the reel is its flinch.
   */
  stunTime: 650,
  /** How hard a cut knocks it back (px/s). It slides to a stop over the reel. */
  stunKnockback: 170,
} satisfies EnemyStats & Record<string, number | string | readonly string[]>;

/** Every enemy type by name. A new enemy type gets its own block above and an entry here. */
export const ENEMIES = { zombie: ZOMBIE, ghost: GHOST, vampire: VAMPIRE } satisfies Record<string, EnemyStats>;
export type EnemyType = keyof typeof ENEMIES;

/** How a hit that doesn't kill an enemy looks: it flashes this colour for this long (ms). */
export const ENEMY_HIT_FLASH = { tint: 0xffffff, duration: 120 };

/** Points for pickups and finishing. Enemy points are in each enemy's block above. */
export const SCORE = { gem: 100, key: 500, jacket: 250, exit: 1000 };

/** Registry keys shared between the game scene and the HUD. */
export const REG = {
  score: 'score',
  lives: 'lives',
  hasGun: 'hasGun',
  /** The WeaponId the player is holding, or null. */
  weapon: 'weapon',
  /** Every WeaponId the player has picked up, in the order found. */
  weapons: 'weapons',
  hasKey: 'hasKey',
  /** True while the player is in front of something they can use (a loose book): shows the USE button. */
  canUse: 'canUse',
  message: 'message',
  /** The SkinId the player is wearing. */
  skin: 'skin',
} as const;

// ============================================================================
// PLAYER SKINS
// Each skin is a whole player sheet drawn by tools/sprites.py with the same 36
// frames in the same order, so any skin can stand in for any other. K (or tapping
// the face next to LIVES) cycles through them; the choice is saved in the browser.
// To add one: draw it in tools/sprites.py (PLAYER_SKINS), then add it here.
// ============================================================================

export interface SkinStats {
  /** Shown when the player switches to it. */
  name: string;
  /** The sheet in public/sprites. */
  sheet: string;
  /**
   * A high-res sheet built by tools/art (npm run art): a grid of PLAYER_FRAME-sized frames,
   * RENDER_SCALE pixels per world unit, with the extra in-between frames of PLAYER_HD_FRAMES.
   * Without it the sheet is the old 20x24 pixel-art strip, scaled up with crisp pixels.
   */
  hd?: boolean;
  /** The part of frame 0 shown as the face in the HUD, in world units (a frame is 20x24): x, y, width, height. */
  face?: readonly [number, number, number, number];
}

export const SKINS = {
  hunter: { name: 'GHOST HUNTER', sheet: 'hd/player-hunter.png', hd: true, face: [3.5, 0.5, 13, 11] },
  weaver: { name: 'THE WEAVER', sheet: 'hd/player-weaver.png', hd: true, face: [3.5, 0.5, 13, 11] },
  ink: { name: 'INK', sheet: 'hd/player-ink.png', hd: true, face: [3.5, 0.5, 13, 11] },
} satisfies Record<string, SkinStats>;

export type SkinId = keyof typeof SKINS;

/** The skin a new player starts with. */
export const DEFAULT_SKIN: SkinId = 'hunter';
