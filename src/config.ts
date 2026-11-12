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
export const ZOMBIE = {
  /** Wandering speed. */
  speed: 32,
  /** Chasing speed: quicker than wandering, still well under PLAYER.runSpeed so the player can get away. */
  chaseSpeed: 52,
  climbSpeed: 36,
  /** How far ahead it can see along its own floor, and how close it hears the player from any side (px). */
  sight: 8 * TILE,
  hearing: 36,
  /** The "!" pause after spotting the player, before it gives chase (ms). */
  alertTime: 500,
  /** Gives up after losing track of the player for this long (ms). */
  forgetAfter: 3500,
  /** While the player is this few steps away on the walking map, it keeps track of them unseen. */
  trackSteps: 10,
  /** Re-plans its route at least this often (ms). */
  replanEvery: 300,
};
export const GHOST = {
  /** Drifting back and forth over its haunt: speed, how far each way, and the up-and-down bob (px). */
  speed: 28,
  range: 48,
  bob: 6,
  /** Chasing speed. Slower than a zombie, because a ghost flies straight over crates and up to shelves. */
  chaseSpeed: 40,
  /** Speed floating home after it gives up. */
  returnSpeed: 30,
  /** Sees the player this far away in any direction, if no wall is in the way (px). */
  sight: 7 * TILE,
  alertTime: 600,
  forgetAfter: 3000,
  /** Won't chase further than this from its haunt; it gives up and floats home (px). */
  leash: 14 * TILE,
  replanEvery: 250,
};

export const SCORE = { gem: 100, enemy: 200, key: 500, exit: 1000 };

/** Registry keys shared between the game scene and the HUD. */
export const REG = {
  score: 'score',
  lives: 'lives',
  hasGun: 'hasGun',
  hasKey: 'hasKey',
  message: 'message',
} as const;
