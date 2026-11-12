/** Shared game constants. Low resolution, scaled up with crisp pixels for a retro look. */
export const TILE = 16;
export const GAME_WIDTH = 320;
export const GAME_HEIGHT = 200;

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
};

export const BULLET = { speed: 320, cooldown: 280, maxOnScreen: 3 };
// ============================================================================
// ENEMIES
// Every number that changes how an enemy behaves lives here. Distances are in
// pixels (one tile is TILE = 16 px), speeds in pixels per second and times in
// milliseconds. For scale, the player runs at PLAYER.runSpeed (110).
// ============================================================================

/** Zombies (z in the level text): walk the floors, take stairs and ladders, can't jump. */
export const ZOMBIE = {
  // ---- Combat ---------------------------------------------------------------
  /** Bullets it takes to kill one. */
  hits: 1,
  /** Lives the player loses when it touches them. */
  damage: 1,
  /** Points for killing one. */
  points: 200,

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
};

/** Ghosts (g in the level text): drift over their haunt, fly through any open space, never through walls. */
export const GHOST = {
  // ---- Combat ---------------------------------------------------------------
  /** Bullets it takes to kill one. */
  hits: 1,
  /** Lives the player loses when it touches them. */
  damage: 1,
  /** Points for killing one. */
  points: 200,

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
};

/** How a hit that doesn't kill an enemy looks: it flashes this colour for this long (ms). */
export const ENEMY_HIT_FLASH = { tint: 0xffffff, duration: 120 };

/** Points for pickups and finishing. Enemy points are in ZOMBIE.points and GHOST.points. */
export const SCORE = { gem: 100, key: 500, exit: 1000 };

/** Registry keys shared between the game scene and the HUD. */
export const REG = {
  score: 'score',
  lives: 'lives',
  hasGun: 'hasGun',
  hasKey: 'hasKey',
  message: 'message',
} as const;
