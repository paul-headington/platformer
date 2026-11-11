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
export const GHOST = { speed: 28, range: 48, bob: 6 };

export const SCORE = { gem: 100, enemy: 200, key: 500, exit: 1000 };

/** Registry keys shared between the game scene and the HUD. */
export const REG = {
  score: 'score',
  lives: 'lives',
  hasGun: 'hasGun',
  hasKey: 'hasKey',
  message: 'message',
} as const;
