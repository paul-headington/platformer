import Phaser from 'phaser';
import { goToMenu } from './MenuScene';
import { GhostBrain } from '../ai/GhostBrain';
import { NavGrid } from '../ai/NavGrid';
import { VampireBrain } from '../ai/VampireBrain';
import { ZombieBrain, type ZombieWorld } from '../ai/ZombieBrain';
import {
  CAMERA,
  ENEMIES,
  ENEMY_HIT_FLASH,
  GAME_HEIGHT,
  GAME_WIDTH,
  PLAYER,
  PLAYER_SCALE,
  REG,
  RENDER_SCALE,
  SCORE,
  SCREEN_ORIGIN,
  TEXT_RES,
  TILE,
  WEAPON_PICKUPS,
  WEAPONS,
  type BladeStats,
  type EnemyStats,
  type EnemyType,
  type GunStats,
  type WeaponId,
  type WeaponStats,
} from '../config';
import { pad } from '../input/VirtualPad';
import { PLAYER_PX, playerAnim, playerClip } from '../skins';
import type { Clip } from '../clips';
import { LEVEL_1, type BackStyle, type Level } from '../levels/level1';

// Tile indexes in the 'tiles' sheet (see TILE_SHEETS in tools/sprites.py).
const WALL = 0;
const SHELF = 1;
const LADDER = 2;
/** The top rung of a ladder, which can be stood on like a ledge. */
const LADDER_TOP = 3;
/** Stairs climbing up to the right ('/') and up to the left ('\'). */
const STAIRS_UP_RIGHT = 4;
const STAIRS_UP_LEFT = 5;
const FLOORBOARDS = 6;
const ROOF = 7;
const FLAGSTONE = 8;
const CRATE = 9;
/** Trapdoors, closed and open, in floorboards and in the cellar flagstones. */
const TRAP_BOARDS = 10;
const TRAP_BOARDS_OPEN = 11;
const TRAP_FLAG = 12;
const TRAP_FLAG_OPEN = 13;
/** Tiles nothing can pass through, from any side. An open trapdoor still holds up zombies. */
const SOLID = new Set([WALL, FLOORBOARDS, ROOF, FLAGSTONE, CRATE, TRAP_BOARDS, TRAP_BOARDS_OPEN, TRAP_FLAG, TRAP_FLAG_OPEN]);
const TRAP_OPENS: Record<number, number> = { [TRAP_BOARDS]: TRAP_BOARDS_OPEN, [TRAP_FLAG]: TRAP_FLAG_OPEN };

/** Frames in the 'back' sheet: [plain wallpaper, wallpaper with dado rail, panelling] per zone. */
const BACK: Record<BackStyle, [number, number, number]> = {
  attic: [0, 0, 0],
  gallery: [9, 10, 11],
  upstairs: [1, 2, 3],
  downstairs: [4, 5, 6],
  cellar: [7, 7, 7],
};
const BACK_FLOOR_GAP = 8;
/** Frames in the 'decor' sheet. */
const DECOR = {
  window: 0, cobwebLeft: 4, cobwebRight: 5, portrait: 6, bookcase: 8, vent: 10,
  libraryTop: 11, libraryMid: 12, libraryBase: 14, libraryGap: 15, armchair: 16,
} as const;
/** How close (px) the player's middle must be to the loose book to pull it. */
const BOOK_REACH = { x: 10, y: 28 };
/** Stairs can be stepped up or down this far in one frame. */
const STEP_UP = 10;
const STEP_DOWN = 8;
/** Player sheet frames (see tools/sprites.py). */
const PLAYER_FRAME = { jump: 6, fall: 7, hurt: 7 } as const;
/**
 * Where each weapon's poses start in the player sheet: idle, idle, four run, jump, fall,
 * in the same order as frames 0-7 (see tools/sprites.py).
 */
export const PLAYER_HOLDING: Record<WeaponId, number> = { pistol: 10, shotgun: 18, machete: 26 };
/** A machete swing: the blade goes up, then comes down (frames in the player sheet). */
const MACHETE_SWING = { raise: 34, strike: 35 } as const;
/** Zombie sheet frames (see tools/sprites.py). */
/** A pistol headshot: when the head bursts after the hit (ms), and how many bits fly off. */
const ZOMBIE_HEADSHOT = { burstAt: 0, bits: 10 } as const;
/** How long a headless zombie lies on the floor before fading, and how long the fade takes (ms). */
const ZOMBIE_CORPSE = { lie: 1400, fade: 500 } as const;
/** Gore sheet frames. */
const GORE = { skin: 0, scalp: 1, eye: 2, goo: 3, tooth: 4 } as const;
/** How long a burning ghost takes to burn away (ms); the flames take a little longer to die down. */
const BURN_TIME = 900;

/** Plays a once-through animation from the start, unless it is already on (playing or held at its end). */
function playOnce(sprite: Phaser.GameObjects.Sprite, key: string): void {
  if (sprite.anims.currentAnim?.key !== key) sprite.anims.play(key);
}

/**
 * The frame of a video swing clip `elapsed` ms into a swing: the wind-up runs until the
 * blade's hitAt, when the clip reaches its hitFrame, and the follow-through fills the rest.
 */
function swingFrame(clip: Clip, elapsed: number, blade: BladeStats): number {
  const n = clip.frames.length;
  const hit = clip.hitFrame ?? Math.floor(n / 2);
  const i =
    elapsed < blade.hitAt
      ? (elapsed / blade.hitAt) * hit
      : hit + ((elapsed - blade.hitAt) / (blade.swingTime - blade.hitAt)) * (n - hit);
  return clip.frames[Phaser.Math.Clamp(Math.floor(i), 0, n - 1)];
}

type Sprite = Phaser.Physics.Arcade.Sprite;
type Body = Phaser.Physics.Arcade.Body;
type State = 'playing' | 'dying' | 'won' | 'over';

/**
 * A secret hatch: a run of h tiles over the top of a ladder, hidden under a rug.
 * It is floor until a loose book is pulled, then it swings open onto the ladder.
 */
interface Hatch {
  tiles: Phaser.Tilemaps.Tile[];
  rug: Phaser.GameObjects.Image;
  lid: Phaser.GameObjects.Image;
}

/** A book on a library shelf that opens the nearest secret hatch. */
interface LooseBook {
  book: Phaser.GameObjects.Image;
  hatch: Hatch | undefined;
  pulled: boolean;
}

/** A trapdoor: a run of T tiles in one floor that opens as one. */
interface Trap {
  tiles: Phaser.Tilemaps.Tile[];
  closed: number;
  snakes: Phaser.GameObjects.Sprite[];
}

export interface HudMessage {
  text: string;
  sticky: boolean;
}

export class GameScene extends Phaser.Scene {
  private layer!: Phaser.Tilemaps.TilemapLayer;
  private player!: Sprite;
  private door!: Phaser.Physics.Arcade.Image;
  private zombies!: Phaser.Physics.Arcade.Group;
  private ghosts!: Phaser.Physics.Arcade.Group;
  private vampires!: Phaser.Physics.Arcade.Group;
  private bullets!: Phaser.Physics.Arcade.Group;
  private spawn = new Phaser.Math.Vector2();
  private levelHeight = 0;
  private nav!: NavGrid;
  /** The level as the enemies see it: changes when a secret hatch opens. */
  private navRows: string[] = [];
  private world!: ZombieWorld;
  private traps: Trap[] = [];
  private hatches: Hatch[] = [];
  private books: LooseBook[] = [];
  /** The loose book the player is standing in front of, if any. */
  private bookInReach: LooseBook | null = null;
  /** A small key hint that floats over a loose book while the player is in front of it. */
  private useHint!: Phaser.GameObjects.Text;
  /** The trapdoor the player last fell through; it shuts again when they respawn. */
  private sprung: Trap | null = null;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyLeft: Phaser.Input.Keyboard.Key[] = [];
  private keyRight: Phaser.Input.Keyboard.Key[] = [];
  private keyUp: Phaser.Input.Keyboard.Key[] = [];
  private keyDown: Phaser.Input.Keyboard.Key[] = [];
  private keyJump: Phaser.Input.Keyboard.Key[] = [];
  private keyFire: Phaser.Input.Keyboard.Key[] = [];
  private keySwitch: Phaser.Input.Keyboard.Key[] = [];
  private keyUse: Phaser.Input.Keyboard.Key[] = [];
  private keyRestart!: Phaser.Input.Keyboard.Key;

  private state: State = 'playing';
  private lastGroundedAt = -Infinity;
  private jumpPressedAt = -Infinity;
  private lastShotAt = -Infinity;
  /** The swing in progress, if any: when it started and when it ends. */
  private swingStartedAt = -Infinity;
  /** Landing: the player was in the air last frame, and has just come down. */
  private wasAirborne = false;
  private landed = false;
  /** A shot was fired since the last frame: its clip starts (when standing). */
  private fired = false;
  private swingUntil = -Infinity;
  private invulnerableUntil = 0;
  private lockedHintAt = -Infinity;
  /** Enemy types (and whether by gun or blade) the player has already been told can't be hurt that way. */
  private toldImmune = new Set<string>();
  private climbing = false;
  private onStairs = false;
  /** What the camera follows: the player's x, but the height of the floor they last stood on. */
  private cameraTarget = new Phaser.Math.Vector2();
  /** High-res copies of tile layers, shown in their place (see tileLayer). */
  private hdLayers = new Map<Phaser.Tilemaps.TilemapLayer, Phaser.Tilemaps.TilemapLayer>();
  /** The camera's scroll position, eased towards cameraTarget each frame. */
  private cameraPos = new Phaser.Math.Vector2();
  /** No grabbing a ladder again straight after jumping off it. */
  private climbBlockedUntil = 0;

  constructor() {
    super('Game');
  }

  create(): void {
    this.state = 'playing';
    this.lastGroundedAt = this.jumpPressedAt = this.lastShotAt = this.lockedHintAt = -Infinity;
    this.swingStartedAt = this.swingUntil = -Infinity;
    this.invulnerableUntil = this.climbBlockedUntil = 0;
    this.climbing = this.onStairs = false;
    this.toldImmune.clear();
    this.traps = [];
    this.hatches = [];
    this.books = [];
    this.bookInReach = null;
    this.sprung = null;
    pad.reset();

    this.registry.set(REG.score, 0);
    this.registry.set(REG.lives, PLAYER.startLives);
    this.registry.set(REG.hasGun, false);
    this.registry.set(REG.weapon, null);
    this.registry.set(REG.weapons, []);
    this.registry.set(REG.hasKey, false);
    this.registry.set(REG.canUse, false);
    if (!this.scene.isActive('Hud')) this.scene.launch('Hud');

    this.buildLevel(LEVEL_1);
    this.addAtmosphere();
    this.setupInput();
    this.say(
      this.isTouch()
        ? 'Find the key and reach the door!'
        : 'Find the key and reach the door!\nArrows: move and climb   Space: jump',
    );
  }

  // ---------------------------------------------------------------- level

  private buildLevel(level: Level): void {
    // M marks the cupboard monster's corner; underneath it is ordinary wall.
    const lurkers: [number, number][] = [];
    level.rows.forEach((row, ty) => [...row].forEach((ch, tx) => ch === 'M' && lurkers.push([tx, ty])));
    // T marks a trapdoor; until it opens it is floor, to the zombies and the floor art alike.
    const trapCells = new Set<string>();
    level.rows.forEach((row, ty) => [...row].forEach((ch, tx) => ch === 'T' && trapCells.add(`${tx},${ty}`)));
    // h marks a secret hatch over a ladder; until it opens it is floor too.
    const hatchCells: [number, number][] = [];
    level.rows.forEach((row, ty) => [...row].forEach((ch, tx) => ch === 'h' && hatchCells.push([tx, ty])));
    const rows = level.rows.map((row) => row.replaceAll('M', '#').replaceAll('T', '#').replaceAll('h', '#'));
    const outside = GameScene.findSky(rows);
    const zoneOf = (ty: number) => level.zones.filter((z) => z.fromRow <= ty).at(-1)?.style ?? 'downstairs';
    const at = (tx: number, ty: number) => rows[ty]?.[tx] ?? '#';
    this.navRows = rows;
    this.nav = new NavGrid(rows);

    const data = rows.map((row, ty) =>
      [...row].map((ch, tx) => {
        // A ladder under a closed hatch carries on up to it, so its top rung is the hatch's.
        if (ch !== '#') return GameScene.tileFor(ch, level.rows[ty - 1]?.[tx] === 'h' ? 'H' : at(tx, ty - 1));
        if (outside[ty - 1]?.[tx]) return ROOF;
        const above = at(tx, ty - 1);
        if (above === '#' || GameScene.isStairsChar(above)) return WALL;
        const trap = trapCells.has(`${tx},${ty}`);
        if (zoneOf(ty) === 'cellar') return trap ? TRAP_FLAG : FLAGSTONE;
        return trap ? TRAP_BOARDS : FLOORBOARDS;
      }),
    );
    this.layer = this.tileLayer(data, 'tiles', 0);
    this.findTraps();
    // Stairs are marked as colliding only so the walls beside them don't get an open
    // edge; tileCollides() lets bodies pass through them and stairSurface() does the rest.
    this.layer.setCollision([...SOLID, SHELF, LADDER_TOP, STAIRS_UP_RIGHT, STAIRS_UP_LEFT]);
    this.buildBackdrop(rows, outside, zoneOf);
    for (const [tx, ty] of lurkers) this.addLurker(tx * TILE, (ty + 1) * TILE);
    this.addHatches(hatchCells);

    const worldWidth = this.layer.width;
    this.levelHeight = this.layer.height;

    const gems = this.physics.add.staticGroup();
    this.zombies = this.physics.add.group();
    this.ghosts = this.physics.add.group({ allowGravity: false });
    this.vampires = this.physics.add.group();
    this.bullets = this.physics.add.group({ allowGravity: false });
    const weaponPickups: { image: Phaser.Physics.Arcade.Image; weapon: WeaponId }[] = [];
    let key: Phaser.Physics.Arcade.Image | undefined;
    const jackets: Phaser.Physics.Arcade.Image[] = [];

    rows.forEach((row, ty) => {
      [...row].forEach((ch, tx) => {
        const cx = tx * TILE + TILE / 2;
        const cy = ty * TILE + TILE / 2;
        const bottom = (ty + 1) * TILE;
        if (ch in WEAPON_PICKUPS) {
          const weapon = WEAPON_PICKUPS[ch];
          weaponPickups.push({ image: this.physics.add.staticImage(cx, cy + 4, WEAPONS[weapon].icon).setScale(1 / RENDER_SCALE).refreshBody(), weapon });
        }
        switch (ch) {
          case '*': {
            const gem = (gems.create(cx, cy, 'gem') as Sprite).setScale(1 / RENDER_SCALE).refreshBody();
            gem.play({ key: 'gem-sparkle', startFrame: tx % 4 });
            this.tweens.add({ targets: gem, y: cy - 2, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: tx * 40 });
            break;
          }
          case 'K':
            key = this.physics.add.staticImage(cx, cy, 'key').setScale(1 / RENDER_SCALE).refreshBody();
            this.tweens.add({ targets: key, y: cy - 3, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
            break;
          case 'J': {
            // Sits on the floor, with a slow bob and a faint glow so it reads as a pickup.
            const glow = this.add.image(cx, bottom - 6, 'glow-warm').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5).setDepth(-1);
            this.tweens.add({ targets: glow, alpha: 0.25, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
            const jacket = this.physics.add.staticImage(cx, bottom - 7, 'jacket').setScale(1 / RENDER_SCALE).refreshBody().setData('glow', glow);
            this.tweens.add({ targets: jacket, y: bottom - 9, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
            jackets.push(jacket);
            break;
          }
          case 'D':
            this.door = this.physics.add.staticImage(cx, bottom, 'door', 0).setScale(1 / RENDER_SCALE).setOrigin(0.5, 1).refreshBody();
            break;
          case 'c': {
            const glow = this.add.image(cx, cy - 4, 'glow-warm').setBlendMode(Phaser.BlendModes.ADD).setDepth(-1);
            this.tweens.add({ targets: glow, alpha: 0.7, scale: 0.92, duration: 140, yoyo: true, repeat: -1, delay: tx * 37, repeatDelay: 90 });
            this.add.sprite(cx, cy, 'candle', 0).setScale(1 / RENDER_SCALE).setDepth(-1).play({ key: 'candle-flicker', startFrame: tx % 3 });
            break;
          }
          case 'P':
            this.spawn.set(cx, bottom - 12 * PLAYER_SCALE);
            break;
          case 'B':
            this.addLooseBook(tx, ty);
            break;
          case 'z': {
            // High-res like the player: drawn at 1 / RENDER_SCALE, its body sized in texture pixels.
            const z = (this.zombies.create(cx, bottom - 12, 'zombie', 0) as Sprite).setScale(1 / RENDER_SCALE);
            (z.body as Body).setSize(8 * RENDER_SCALE, 21 * RENDER_SCALE).setOffset(6 * RENDER_SCALE, 3 * RENDER_SCALE);
            this.setEnemy(z, 'zombie').play('zombie-walk');
            break;
          }
          case 'g': {
            // High-res: a 20x24-unit cell (the old ghost was 20x20, so the body sits 2 lower in it).
            const gh = (this.ghosts.create(cx, cy, 'ghost', 0) as Sprite).setScale(1 / RENDER_SCALE);
            (gh.body as Body).setSize(12 * RENDER_SCALE, 12 * RENDER_SCALE).setOffset(4 * RENDER_SCALE, 5 * RENDER_SCALE);
            this.setEnemy(gh, 'ghost').setData('phase', tx).setAlpha(0.85).play('ghost-float');
            break;
          }
          case 'V': {
            const v = (this.vampires.create(cx, bottom - 12, 'vampire', 0) as Sprite).setScale(1 / RENDER_SCALE);
            (v.body as Body).setSize(8 * RENDER_SCALE, 21 * RENDER_SCALE).setOffset(6 * RENDER_SCALE, 3 * RENDER_SCALE);
            this.setEnemy(v, 'vampire').play('vampire-idle');
            break;
          }
        }
      });
    });

    // The 'player' texture is high-res (PLAYER_PX pixels per unit of the 20x24 frame) and the
    // sprite is drawn at 1 / RENDER_SCALE, so he is PLAYER_SCALE times the frame. His body is
    // sized in the texture's pixels: 8x20 units of the frame, 6 in and 4 down (12x30 in the
    // world). That leaves the top of his hair out, so he still fits under a ceiling two tiles up.
    this.player = this.physics.add.sprite(this.spawn.x, this.spawn.y, 'player', 0).setScale(1 / RENDER_SCALE);
    (this.player.body as Body).setSize(8 * PLAYER_PX, 20 * PLAYER_PX).setOffset(6 * PLAYER_PX, 4 * PLAYER_PX);
    this.player.setCollideWorldBounds(true).setDepth(10);

    const world: ZombieWorld = (this.world = {
      nav: this.nav,
      player: this.player,
      playerIsFair: () => this.state === 'playing' && this.time.now >= this.invulnerableUntil,
      playerIsClimbing: () => this.climbing,
      stairSurface: (body, maxDrop) => this.stairSurface(body, maxDrop),
    });
    for (const z of this.zombies.getChildren() as Sprite[]) z.setData('brain', new ZombieBrain(z, world));
    this.useHint = this.add
      .text(0, 0, 'E', { ...TEXT_RES, fontFamily: 'monospace', fontSize: '7px', color: '#fff4c0', backgroundColor: '#1a1026', padding: { x: 2, y: 0 } })
      .setOrigin(0.5, 1)
      .setDepth(12)
      .setAlpha(0.85)
      .setVisible(false);
    for (const g of this.ghosts.getChildren() as Sprite[]) g.setData('brain', new GhostBrain(g, world, g.getData('phase')));
    for (const v of this.vampires.getChildren() as Sprite[]) v.setData('brain', new VampireBrain(v, world));

    // Open bottom edge so falling into a pit is possible.
    this.physics.world.setBounds(0, 0, worldWidth, this.levelHeight + TILE * 6);
    this.physics.world.setBoundsCollision(true, true, true, false);
    this.cameras.main.setZoom(RENDER_SCALE).setBounds(0, 0, worldWidth, this.levelHeight);
    // Follow a point that tracks the player sideways but only changes height when they land,
    // climb or fall below the floor, so the screen doesn't bob up and down with every jump.
    // It is moved after physics has placed the player each frame, so it is never a frame behind.
    this.cameraTarget.set(this.player.x, this.player.y);
    this.cameraPos.set(this.cameraScrollFor('x'), this.cameraScrollFor('y'));
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.updateCamera, this);
    this.updateCamera();

    const collides = this.tileCollides.bind(this);
    this.physics.add.collider(this.player, this.layer, undefined, collides);
    this.physics.add.collider([this.zombies, this.vampires], this.layer, undefined, collides);
    this.physics.add.collider(
      this.bullets,
      this.layer,
      (b) => (b as Sprite).destroy(),
      (_b, t) => SOLID.has((t as Phaser.Tilemaps.Tile).index),
    );

    this.physics.add.overlap(
      this.player,
      [this.zombies, this.ghosts, this.vampires],
      (_p, e) => {
        const enemy = e as Sprite;
        this.hurt(false, (enemy.getData('stats') as EnemyStats).damage);
        // A zombie or ghost that catches the player swipes at them.
        const type = enemy.getData('type') as EnemyType;
        if (this.state === 'dying' && (type === 'zombie' || type === 'ghost') && enemy.anims.currentAnim?.key !== `${type}-attack`) {
          enemy.play(`${type}-attack`);
          if (type === 'ghost') enemy.anims.chain('ghost-float');
        }
      },
      (_p, e) => this.touchesHurtbox(e as Sprite),
    );
    this.physics.add.overlap(this.player, gems, (_p, g) => {
      (g as Phaser.Physics.Arcade.Image).destroy();
      this.addScore(SCORE.gem);
    });
    for (const { image, weapon } of weaponPickups) {
      this.physics.add.overlap(this.player, image, () => {
        image.destroy();
        this.pickUpWeapon(weapon);
      });
    }
    if (key) {
      this.physics.add.overlap(this.player, key, () => {
        key!.destroy();
        this.registry.set(REG.hasKey, true);
        this.door.setFrame(1);
        this.addScore(SCORE.key);
        this.say('Got the key! The door is open.');
      });
    }
    for (const jacket of jackets) {
      this.physics.add.overlap(this.player, jacket, () => {
        (jacket.getData('glow') as Phaser.GameObjects.Image).destroy();
        jacket.destroy();
        this.registry.set(REG.lives, (this.registry.get(REG.lives) as number) + 1);
        this.addScore(SCORE.jacket);
        this.say('A spare leather jacket!\nExtra life!');
      });
    }
    this.physics.add.overlap(this.player, this.door, () => this.reachDoor());
    this.physics.add.overlap(this.bullets, this.enemyGroups(), (b, e) => {
      const bullet = b as Sprite;
      const enemy = e as Sprite;
      if (!bullet.active || !enemy.active) return;
      const weapon = bullet.getData('weapon') as WeaponId;
      if (!(enemy.getData('stats') as EnemyStats).hurtBy.includes(weapon)) {
        this.passThrough(enemy, weapon, bullet);
        return;
      }
      const from = Math.sign((bullet.body as Body).velocity.x) || 1;
      bullet.destroy();
      this.shootEnemy(enemy, WEAPONS[weapon].damage, -from, weapon);
    });
  }

  /** Groups the trapdoor tiles into trapdoors, and hides a snake in the pit under each tile. */
  private findTraps(): void {
    let current: Trap | null = null;
    this.layer.forEachTile((tile) => {
      const closed = tile.index;
      if (!(closed in TRAP_OPENS)) {
        current = null;
        return;
      }
      const prev = current?.tiles.at(-1);
      if (!current || !prev || prev.y !== tile.y || prev.x !== tile.x - 1) {
        current = { tiles: [], closed, snakes: [] };
        this.traps.push(current);
      }
      current.tiles.push(tile);
      const snake = this.add.sprite(tile.getCenterX(), tile.pixelY + 3, 'snake', 0).setScale(1 / RENDER_SCALE).setOrigin(0.5, 1).setDepth(11);
      current.snakes.push(snake.setFlipX(tile.x % 2 === 1).setVisible(false));
    });
  }

  /**
   * Groups the h tiles into hatches. Each is hidden under a rug, with its lid ready
   * to swing up on its left-hand hinge when it opens.
   */
  private addHatches(cells: [number, number][]): void {
    let current: Phaser.Tilemaps.Tile[] = [];
    const runs: Phaser.Tilemaps.Tile[][] = [];
    for (const [tx, ty] of cells) {
      const tile = this.layer.getTileAt(tx, ty)!;
      const prev = current.at(-1);
      if (!prev || prev.y !== ty || prev.x !== tx - 1) runs.push((current = []));
      current.push(tile);
    }
    for (const tiles of runs) {
      const left = tiles[0].pixelX;
      const width = tiles.length * TILE;
      const top = tiles[0].pixelY;
      const rug = this.add.image(left + width / 2, top, 'rug').setScale(1 / RENDER_SCALE).setOrigin(0.5, 1).setDepth(1);
      const lid = this.add.image(left, top, 'hatch-lid').setOrigin(0, 0).setDisplaySize(width, 3).setDepth(1).setVisible(false);
      this.hatches.push({ tiles, rug, lid });
    }
  }

  /** A loose book on the gap tile of a library bookcase, tied to the hatch nearest it. */
  private addLooseBook(tx: number, ty: number): void {
    // It fills the gap in the painted gap tile (about 1.3 x 5.8 units, its bottom 15.1 down).
    const x = tx * TILE + 8;
    const y = ty * TILE + 15.1;
    const book = this.add.image(x, y, 'pull-book').setOrigin(0.5, 1).setDisplaySize(2.9, 5.8).setDepth(-1.9);
    const dist = (h: Hatch) => Phaser.Math.Distance.Between(x, y, h.tiles[0].getCenterX(), h.tiles[0].pixelY);
    const hatch = this.hatches.slice().sort((a, b) => dist(a) - dist(b))[0];
    // Every few seconds a faint glint runs up its gilt spine: easy to miss, but there to spot.
    const glint = this.add.rectangle(x, y - 6, 2, 1, 0xfff4c0).setDepth(-1.8).setAlpha(0);
    this.tweens.add({ targets: glint, alpha: 0.9, y: y - 2, duration: 260, yoyo: true, repeat: -1, repeatDelay: 4200, delay: 1500 });
    book.setData('glint', glint);
    this.books.push({ book, hatch, pulled: false });
  }

  private static tileFor(ch: string, above: string | undefined): number {
    switch (ch) {
      case 'X': return CRATE;
      case '=': return SHELF;
      case 'H': return above === 'H' ? LADDER : LADDER_TOP;
      case '/': return STAIRS_UP_RIGHT;
      case '\\': return STAIRS_UP_LEFT;
      default: return -1;
    }
  }

  private static isStairsChar(ch: string | undefined): boolean {
    return ch === '/' || ch === '\\';
  }

  /** Marks the empty cells joined to the top edge of the map: that is the night sky. */
  private static findSky(rows: string[]): boolean[][] {
    const sky = rows.map((row) => [...row].map(() => false));
    const open = (x: number, y: number) => y >= 0 && y < rows.length && x >= 0 && x < rows[y].length && !'#X/\\'.includes(rows[y][x]);
    const todo: [number, number][] = [];
    for (let x = 0; x < rows[0].length; x++) if (open(x, 0)) todo.push([x, 0]);
    while (todo.length > 0) {
      const [x, y] = todo.pop()!;
      if (!open(x, y) || sky[y][x]) continue;
      sky[y][x] = true;
      todo.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    return sky;
  }

  private tileLayer(data: number[][], sheet: string, depth: number): Phaser.Tilemaps.TilemapLayer {
    const map = this.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
    const layer = map.createLayer(0, map.addTilesetImage(sheet)!, 0, 0) as Phaser.Tilemaps.TilemapLayer;
    // With a high-res version of the sheet (tools/art), the game still uses this layer for
    // collisions, but hides it and shows a high-res copy instead (kept in step by setTile).
    const hdKey = `${sheet}-hd`;
    if (this.textures.exists(hdKey)) {
      const size = TILE * RENDER_SCALE;
      const hdMap = this.make.tilemap({ data, tileWidth: size, tileHeight: size });
      const hd = hdMap.createLayer(0, hdMap.addTilesetImage(hdKey)!, 0, 0) as Phaser.Tilemaps.TilemapLayer;
      hd.setScale(1 / RENDER_SCALE).setDepth(depth);
      layer.setVisible(false);
      this.hdLayers.set(layer, hd);
    }
    return layer.setDepth(depth);
  }

  /** Changes a tile (a trapdoor opening, say), in its high-res copy too. */
  private setTile(tile: Phaser.Tilemaps.Tile, index: number): void {
    tile.index = index;
    const hd = this.hdLayers.get(tile.tilemapLayer as Phaser.Tilemaps.TilemapLayer)?.getTileAt(tile.x, tile.y, true);
    if (hd) hd.index = index;
  }

  /**
   * The wallpaper behind each room (with a dado rail and panelling just above
   * each floor), the cut edge of broken floors, and the decorations.
   */
  private buildBackdrop(rows: string[], outside: boolean[][], zoneOf: (ty: number) => BackStyle): void {
    const solidAt = (x: number, y: number) => rows[y]?.[x] === '#';
    // A row that is mostly wall is a floor; gaps in it are holes in the floorboards.
    const isFloorRow = rows.map((row) => [...row].filter((ch) => ch === '#').length > row.length * 0.7);
    const back = rows.map((row, ty) =>
      [...row].map((_ch, tx) => {
        if (outside[ty][tx]) return -1;
        if (isFloorRow[ty]) return BACK_FLOOR_GAP;
        const [plain, rail, panel] = BACK[zoneOf(ty)];
        if (solidAt(tx, ty + 1)) return panel;
        if (solidAt(tx, ty + 2)) return rail;
        return plain;
      }),
    );
    this.tileLayer(back, 'back', -3);

    const decor = rows.map((row, ty) =>
      [...row].map((ch, tx) => {
        switch (ch) {
          case 'w':
            return DECOR.window + (row[tx - 1] === 'w' ? 1 : 0) + (rows[ty - 1]?.[tx] === 'w' ? 2 : 0);
          case '%':
            return solidAt(tx + 1, ty) && !solidAt(tx - 1, ty) ? DECOR.cobwebRight : DECOR.cobwebLeft;
          case 'f':
            return DECOR.portrait + (tx % 2);
          case 'b':
            return DECOR.bookcase + (rows[ty - 1]?.[tx] === 'b' ? 1 : 0);
          case 'L': {
            // Library bookcases stack: a cornice on top, a cupboard at the floor, shelves between.
            if (!'LB'.includes(rows[ty - 1]?.[tx] ?? '')) return DECOR.libraryTop;
            if (solidAt(tx, ty + 1)) return DECOR.libraryBase;
            return DECOR.libraryMid + ((tx * 3 + ty) % 2);
          }
          case 'B':
            return DECOR.libraryGap;
          case 'a':
            return DECOR.armchair;
          case 'v':
            this.addTentacle(tx * TILE, ty * TILE);
            return DECOR.vent;
          default:
            return -1;
        }
      }),
    );
    this.tileLayer(decor, 'decor', -2);

    // Cold moonlight spilling in around each window (found by its top-left tile).
    rows.forEach((row, ty) =>
      [...row].forEach((ch, tx) => {
        if (ch === 'w' && row[tx - 1] !== 'w' && rows[ty - 1]?.[tx] !== 'w') {
          this.add.image((tx + 1) * TILE, (ty + 1) * TILE, 'glow-moon').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5).setDepth(-2);
        }
      }),
    );
  }

  /**
   * Scenery: every so often a tentacle slides down out of an air vent, sways about
   * and pulls back in. It is drawn between the wallpaper and the vent's slats, so
   * it really looks like it comes out of the duct. It hides if the player is close.
   */
  private addTentacle(left: number, top: number): void {
    const tentacle = this.add.sprite(left - 4, top, 'tentacle', 0).setScale(1 / RENDER_SCALE).setOrigin(0, 0).setDepth(-2.5);
    const tooClose = () => Math.abs(this.player.x - left - 8) < TILE * 2 && Math.abs(this.player.y - top - 16) < TILE * 3;
    const out = [1, 2, 3, 4, 3, 5, 4, 3, 5, 4, 3];
    // Where the tip of the tentacle is in each frame, relative to the vent's top-left.
    const TIP: [number, number][] = [[8, 0], [7, 16], [9, 22], [3, 29], [12, 30], [10, 29]];
    let i = 0;
    const drip = () => {
      const frame = Number(tentacle.frame.name);
      if (frame >= 2 && Math.random() < 0.7) {
        const [dx, dy] = TIP[frame];
        const drop = this.add.rectangle(left + dx, top + dy, 2, 3, 0xa6e86a).setDepth(-2.4);
        this.tweens.add({
          targets: drop,
          y: top + dy + Phaser.Math.Between(40, 90),
          alpha: 0,
          scaleY: 2,
          duration: 700,
          ease: 'Quad.in',
          onComplete: () => drop.destroy(),
        });
      }
      this.time.delayedCall(Phaser.Math.Between(250, 600), drip);
    };
    this.time.delayedCall(500, drip);
    const retract = (then: number) => {
      tentacle.setFrame(1);
      this.time.delayedCall(90, () => tentacle.setFrame(0));
      this.time.delayedCall(then, reach);
    };
    const reach = () => {
      i = 0;
      const step = () => {
        if (tooClose()) return retract(Phaser.Math.Between(2500, 4000));
        if (i >= out.length) return retract(Phaser.Math.Between(4000, 9000));
        tentacle.setFrame(out[i++]);
        this.time.delayedCall(i <= 2 ? 160 : 320, step);
      };
      step();
    };
    this.time.delayedCall(Phaser.Math.Between(1000, 6000), reach);
  }

  /**
   * Something lives in the cupboard under the stairs. It is only scenery: now and
   * then its eyes open, follow the player, blink, and long fingers curl round the
   * door. It hides if the player comes close.
   */
  private addLurker(left: number, bottom: number): void {
    const FRAME = { dark: 0, eyes: 1, blink: 2, left: 3, right: 4, fingers: 5 };
    const lurker = this.add.sprite(left, bottom, 'lurker', FRAME.dark).setScale(1 / RENDER_SCALE).setOrigin(0, 1).setDepth(1);
    const cx = left + 20;
    const tooClose = () => Math.abs(this.player.x - cx) < TILE * 3 && Math.abs(this.player.y - bottom) < TILE * 3;
    const look = () => (this.player.x < cx - TILE ? FRAME.left : this.player.x > cx + TILE ? FRAME.right : FRAME.eyes);

    const steps: [number | (() => number), number][] = [];
    const peek = () => {
      steps.length = 0;
      steps.push([FRAME.eyes, 400], [look, 1200], [FRAME.blink, 120], [look, 900]);
      if (Math.random() < 0.6) steps.push([FRAME.fingers, 1400], [look, 500]);
      steps.push([FRAME.blink, 120], [look, 700], [FRAME.blink, 150], [FRAME.dark, Phaser.Math.Between(3000, 7000)]);
      next();
    };
    const next = () => {
      const step = steps.shift();
      if (!step) return peek();
      if (tooClose() && step[0] !== FRAME.dark) {
        lurker.setFrame(FRAME.dark); // shy: slam back into the dark
        this.time.delayedCall(Phaser.Math.Between(3000, 5000), peek);
        return;
      }
      lurker.setFrame(typeof step[0] === 'function' ? step[0]() : step[0]);
      this.time.delayedCall(step[1], next);
    };
    this.time.delayedCall(Phaser.Math.Between(1500, 3000), peek);
  }

  /** The night sky behind the house, a dark vignette, and the odd flash of lightning. */
  private addAtmosphere(): void {
    this.add.image(SCREEN_ORIGIN.x, SCREEN_ORIGIN.y, 'sky').setScale(1 / RENDER_SCALE).setOrigin(0, 0).setScrollFactor(0.1).setDepth(-10);
    this.add.image(SCREEN_ORIGIN.x, SCREEN_ORIGIN.y, 'vignette').setOrigin(0, 0).setScrollFactor(0).setDepth(50);

    const flash = this.add.rectangle(SCREEN_ORIGIN.x, SCREEN_ORIGIN.y, GAME_WIDTH, GAME_HEIGHT, 0xc8d0ff, 0).setOrigin(0, 0).setScrollFactor(0).setDepth(49);
    const strike = () => {
      this.tweens.chain({
        targets: flash,
        tweens: [
          { alpha: 0.22, duration: 60 },
          { alpha: 0.04, duration: 90 },
          { alpha: 0.16, duration: 50 },
          { alpha: 0, duration: 500 },
        ],
      });
      this.time.delayedCall(Phaser.Math.Between(9000, 17000), strike);
    };
    this.time.delayedCall(Phaser.Math.Between(4000, 8000), strike);
  }

  private static isStairs(tile: Phaser.Tilemaps.Tile | null): boolean {
    return tile?.index === STAIRS_UP_RIGHT || tile?.index === STAIRS_UP_LEFT;
  }

  /**
   * Walls, floors and crates are solid. Shelves and ladder tops only block things landing on them
   * from above, and not a climbing player. Stairs never collide (see stairSurface).
   */
  private tileCollides(obj: unknown, tileObj: unknown): boolean {
    const tile = tileObj as Phaser.Tilemaps.Tile;
    if (SOLID.has(tile.index)) return true;
    if (GameScene.isStairs(tile)) return false;
    if (obj === this.player && this.climbing) return false;
    if ((obj as Sprite).getData?.('brain')?.climbing) return false;
    const body = (obj as Sprite).body as Body;
    return body.velocity.y >= 0 && body.prev.y + body.height <= tile.pixelY + 2;
  }

  private ladderAt(x: number, y: number): Phaser.Tilemaps.Tile | null {
    const tile = this.layer.getTileAtWorldXY(x, y);
    return tile && (tile.index === LADDER || tile.index === LADDER_TOP) ? tile : null;
  }

  /**
   * The y of the stair step under the player's feet, or null. Steps are 4px tall,
   * matching the art. Both feet are checked and the higher step wins, so the player
   * steps up onto the next stair instead of walking into it.
   */
  private stairSurface(body: Body, maxDrop: number): number | null {
    let best: number | null = null;
    for (const x of [body.left + 0.5, body.right - 0.5]) {
      const tx = Math.floor(x / TILE);
      const lx = x - tx * TILE;
      const step = Math.floor(lx / 4);
      for (let ty = Math.floor((body.bottom - STEP_UP) / TILE); ty <= Math.floor((body.bottom + maxDrop) / TILE); ty++) {
        const tile = this.layer.getTileAt(tx, ty);
        if (!GameScene.isStairs(tile)) continue;
        const y = ty * TILE + (tile!.index === STAIRS_UP_RIGHT ? 12 - 4 * step : 4 * step);
        if (y < body.bottom - STEP_UP || y > body.bottom + maxDrop) continue;
        if (best === null || y < best) best = y;
      }
    }
    return best;
  }

  // ---------------------------------------------------------------- input

  private setupInput(): void {
    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.cursors = kb.createCursorKeys();
    this.keyLeft = [this.cursors.left, kb.addKey(K.A)];
    this.keyRight = [this.cursors.right, kb.addKey(K.D)];
    // Up climbs a ladder when there is one, and jumps otherwise.
    this.keyUp = [this.cursors.up, kb.addKey(K.W)];
    this.keyDown = [this.cursors.down, kb.addKey(K.S)];
    this.keyJump = [this.cursors.space, kb.addKey(K.Z)];
    this.keyFire = [kb.addKey(K.X), kb.addKey(K.CTRL)];
    this.keySwitch = [kb.addKey(K.C), kb.addKey(K.Q)];
    this.keyUse = [kb.addKey(K.E)];
    this.keyRestart = kb.addKey(K.ENTER);
    // Esc goes back to the title screen.
    kb.once('keydown-ESC', () => goToMenu(this));
  }

  private static anyDown(keys: Phaser.Input.Keyboard.Key[]): boolean {
    return keys.some((k) => k.isDown);
  }

  /** Checks every key so no "just pressed" flag is left stale. */
  private static anyJustDown(keys: Phaser.Input.Keyboard.Key[]): boolean {
    return keys.map((k) => Phaser.Input.Keyboard.JustDown(k)).some(Boolean);
  }

  private static anyJustUp(keys: Phaser.Input.Keyboard.Key[]): boolean {
    return keys.map((k) => Phaser.Input.Keyboard.JustUp(k)).some(Boolean);
  }

  // ---------------------------------------------------------------- loop

  update(time: number, delta: number): void {
    this.updateEnemies(time, delta);
    this.cullBullets();

    if (this.state === 'won' || this.state === 'over') {
      const restart = Phaser.Input.Keyboard.JustDown(this.keyRestart);
      if (pad.justDown('start') || restart) this.scene.restart();
      return;
    }
    if (this.state !== 'playing') return;

    this.updatePlayer(time);
    this.checkTrapdoors();
    this.checkBooks();

    if (this.player.y > this.levelHeight + TILE) this.hurt(true);
  }

  /**
   * Moves the camera towards the player. It eases in like a lerp, but never slower than
   * CAMERA.minSpeed, and stops dead once it arrives. A plain lerp spends its last few pixels
   * crawling, so the screen ends each scroll with uneven one-pixel nudges spread over half a
   * second, which looks rough at this resolution.
   */
  private updateCamera(): void {
    const p = this.player;
    const body = p.body as Body;
    const grounded = body.blocked.down || body.touching.down || this.onStairs || this.climbing;
    this.cameraTarget.x = p.x;
    if (grounded || this.state !== 'playing' || p.y > this.cameraTarget.y) this.cameraTarget.y = p.y;

    const dt = Math.min(this.game.loop.delta, 1000 / 30) / 1000;
    const ease = 1 - Math.pow(1 - CAMERA.lerp, dt * 60); // the same feel at any frame rate
    const minStep = CAMERA.minSpeed * dt;
    const cam = this.cameras.main;
    for (const axis of ['x', 'y'] as const) {
      const gap = this.cameraScrollFor(axis) - this.cameraPos[axis];
      const step = Math.abs(gap) <= minStep ? gap : Math.sign(gap) * Math.max(Math.abs(gap) * ease, minStep);
      this.cameraPos[axis] += step;
    }
    // Left unrounded: roundPixels snaps each sprite relative to the camera, which keeps the
    // player steady on screen while the camera keeps pace with them.
    cam.setScroll(this.cameraPos.x, this.cameraPos.y);
  }

  /** The scroll that would put the camera target in the middle of the screen, kept inside the level. */
  private cameraScrollFor(axis: 'x' | 'y'): number {
    const cam = this.cameras.main;
    return axis === 'x'
      ? cam.clampX(this.cameraTarget.x - cam.width / 2)
      : cam.clampY(this.cameraTarget.y - CAMERA.lookUp - cam.height / 2);
  }

  private updatePlayer(time: number): void {
    const p = this.player;
    const body = p.body as Body;

    // Read every input once, so no "just pressed" flag is left stale.
    const left = GameScene.anyDown(this.keyLeft) || pad.isDown('left');
    const right = GameScene.anyDown(this.keyRight) || pad.isDown('right');
    const up = GameScene.anyDown(this.keyUp) || pad.isDown('up');
    const down = GameScene.anyDown(this.keyDown) || pad.isDown('down');
    const upKeyPressed = GameScene.anyJustDown(this.keyUp);
    const upPressed = pad.justDown('up') || upKeyPressed;
    const jumpKeyPressed = GameScene.anyJustDown(this.keyJump);
    const jumpPressed = pad.justDown('jump') || jumpKeyPressed;
    const releasedKeys = GameScene.anyJustUp(this.keyJump) || GameScene.anyJustUp(this.keyUp);
    const padReleased = [pad.justUp('jump'), pad.justUp('up')].some(Boolean);
    const jumpReleased = releasedKeys || padReleased;
    const fireKey = GameScene.anyJustDown(this.keyFire);
    if (pad.justDown('fire') || fireKey) this.shoot(time);
    const switchKey = GameScene.anyJustDown(this.keySwitch);
    if (pad.justDown('switch') || switchKey) this.switchWeapon();

    if (this.climbing) {
      this.updateClimbing(left || right, up, down, jumpPressed, time);
      return;
    }

    // Grab a ladder: Up when in front of one, Down when standing on top of one.
    const onSolidGround = body.blocked.down || body.touching.down;
    if (time >= this.climbBlockedUntil) {
      const inFront = up && (this.ladderAt(body.center.x, body.bottom - 4) ?? this.ladderAt(body.center.x, body.center.y));
      const below = down && onSolidGround && !this.onStairs && this.ladderAt(body.center.x, body.bottom + 2);
      const ladder = inFront || below;
      if (ladder) {
        this.startClimbing(ladder, below ? 3 : 0);
        return;
      }
    }

    // Walk up and down stairs by standing the player on the step under their feet.
    const wasOnStairs = this.onStairs;
    this.onStairs = false;
    if (body.velocity.y >= 0) {
      const surface = this.stairSurface(body, wasOnStairs || onSolidGround ? STEP_DOWN : 0);
      if (surface !== null) {
        body.position.y += surface - body.bottom;
        body.velocity.y = 0;
        this.onStairs = true;
      }
    }

    const onGround = onSolidGround || this.onStairs;
    if (onGround) this.lastGroundedAt = time;

    if (left && !right) p.setVelocityX(-PLAYER.runSpeed).setFlipX(true);
    else if (right && !left) p.setVelocityX(PLAYER.runSpeed).setFlipX(false);
    else p.setVelocityX(0);

    if (jumpPressed || upPressed) this.jumpPressedAt = time;
    const canJump = time - this.lastGroundedAt <= PLAYER.coyoteTime;
    if (time - this.jumpPressedAt <= PLAYER.jumpBuffer && canJump) {
      p.setVelocityY(-PLAYER.jumpVelocity);
      this.jumpPressedAt = this.lastGroundedAt = -Infinity;
      this.onStairs = false;
    }
    // Letting go of jump early gives a shorter hop.
    if (jumpReleased && body.velocity.y < 0) body.velocity.y *= 0.45;

    const held = this.heldWeapon();
    // A skin with video clips has its own jump, fall and landing (the same with or without
    // a weapon), armed idles, and a clip for each gun firing.
    const rise = body.velocity.y < 0;
    const airClip = playerClip(this, rise ? 'jump' : 'fall');
    const land = playerClip(this, 'land') && playerAnim(this, 'player-land');
    const fireAnim = held && playerClip(this, `fire-${held}`) && playerAnim(this, `player-fire-${held}`);
    /** True while a once-through animation is still going. */
    const going = (key: string) => p.anims.currentAnim?.key === key && p.anims.isPlaying;
    if (onGround && this.wasAirborne && land) this.landed = true;
    this.wasAirborne = !onGround;
    if (time < this.swingUntil) {
      p.anims.stop();
      const blade = WEAPONS.machete as BladeStats;
      const swing = playerClip(this, 'swing');
      if (swing) p.setFrame(swingFrame(swing, time - this.swingStartedAt, blade));
      else p.setFrame(time - this.swingStartedAt < blade.hitAt ? MACHETE_SWING.raise : MACHETE_SWING.strike);
    } else if (!onGround && airClip) {
      playOnce(p, playerAnim(this, rise ? 'player-jump' : 'player-fall'));
    } else if (!onGround) {
      p.anims.stop();
      p.setFrame((rise ? PLAYER_FRAME.jump : PLAYER_FRAME.fall) + (held ? PLAYER_HOLDING[held] : 0));
    } else if (body.velocity.x !== 0) {
      p.anims.play(playerAnim(this, held ? `player-run-${held}` : 'player-run'), true);
    } else if (fireAnim && this.fired) {
      p.anims.play(fireAnim); // from the start, even mid-way through the last shot's clip
    } else if (fireAnim && going(fireAnim)) {
      // Let the shot's clip finish.
    } else if (land && (this.landed || going(land))) {
      playOnce(p, land);
    } else {
      p.anims.play(playerAnim(this, held ? `player-idle-${held}` : 'player-idle'), true);
    }
    this.fired = this.landed = false;
  }

  // ---------------------------------------------------------------- ladders

  /** Lines the player up with the ladder and switches off gravity. */
  private startClimbing(ladder: Phaser.Tilemaps.Tile, nudgeDown: number): void {
    const body = this.player.body as Body;
    this.climbing = true;
    this.onStairs = false;
    body.setAllowGravity(false);
    // The body has already moved this frame, so move it rather than the sprite.
    body.position.x += ladder.getCenterX() - body.center.x;
    body.position.y += nudgeDown;
    this.player.setVelocity(0, 0);
    this.player.anims.play(playerAnim(this, 'player-climb'));
  }

  private stopClimbing(): void {
    this.climbing = false;
    (this.player.body as Body).setAllowGravity(true);
    this.player.anims.stop();
  }

  private updateClimbing(sideways: boolean, up: boolean, down: boolean, jumpPressed: boolean, time: number): void {
    const p = this.player;
    const body = p.body as Body;

    if (jumpPressed) {
      this.stopClimbing();
      this.climbBlockedUntil = time + 300;
      p.setVelocityY(-PLAYER.jumpVelocity * 0.75);
      return;
    }
    // Step off at the bottom, either by walking away or by climbing down onto the floor.
    if (body.blocked.down && (sideways || down)) {
      this.stopClimbing();
      return;
    }

    if (!this.ladderAt(body.center.x, body.bottom - 1)) {
      const top = this.ladderAt(body.center.x, body.bottom + 1);
      if (!top) {
        this.stopClimbing(); // climbed off the bottom of a ladder with no floor under it
        return;
      }
      if (!down) {
        // Climbed out of the top: stand on the top rung.
        body.position.y += top.pixelY - body.bottom;
        this.stopClimbing();
        p.setVelocityY(0);
        return;
      }
    }

    const vy = up === down ? 0 : up ? -PLAYER.climbSpeed : PLAYER.climbSpeed;
    p.setVelocity(0, vy);
    if (vy === 0) p.anims.pause();
    else if (p.anims.isPaused) p.anims.resume();
  }

  /** The weapon to draw the player holding, if they have one and the sheet has its frames. */
  private heldWeapon(): WeaponId | null {
    const id = this.registry.get(REG.weapon) as WeaponId | null;
    if (!id) return null;
    return this.textures.get('player').has(String(PLAYER_HOLDING[id] + PLAYER_FRAME.fall)) ? id : null;
  }

  /**
   * Adds a weapon to the player's kit. The weapon in hand stays in hand: a new one is
   * only equipped when the player has nothing yet. The hint says how to switch to it.
   */
  private pickUpWeapon(id: WeaponId): void {
    const owned = this.registry.get(REG.weapons) as WeaponId[];
    if (!owned.includes(id)) this.registry.set(REG.weapons, [...owned, id]);
    this.registry.set(REG.hasGun, true);
    const equip = !this.registry.get(REG.weapon);
    if (equip) this.registry.set(REG.weapon, id);
    const touch = this.isTouch();
    const use = (WEAPONS[id] as WeaponStats).melee
      ? `${touch ? 'Tap SLASH' : 'Press X'} to swing`
      : `${touch ? 'Tap FIRE' : 'Press X'} to shoot`;
    const howTo = equip ? use : touch ? 'Tap the weapons up top to switch' : 'Press C to switch weapons';
    const about: Partial<Record<WeaponId, string>> = {
      shotgun: 'Only rock salt stops a ghost,\nbut it bounces off zombies.',
      machete: "One cut fells a zombie, and it's\nthe only way to stop a vampire.",
    };
    this.say([`You found ${WEAPONS[id].name}!`, about[id], howTo].filter(Boolean).join('\n'));
  }

  /** Changes to the next weapon the player has picked up. */
  private switchWeapon(): void {
    const owned = this.registry.get(REG.weapons) as WeaponId[];
    if (owned.length < 2) return;
    const current = owned.indexOf(this.registry.get(REG.weapon) as WeaponId);
    this.registry.set(REG.weapon, owned[(current + 1) % owned.length]);
  }

  private shoot(time: number): void {
    const id = this.registry.get(REG.weapon) as WeaponId | null;
    if (!id) return;
    const stats: WeaponStats = WEAPONS[id];
    if (time - this.lastShotAt < stats.cooldown) return;
    if (stats.melee) {
      this.swing(time, id, stats);
      return;
    }
    const weapon = stats;
    const live = (this.bullets.getChildren() as Sprite[]).filter((b) => b.getData('weapon') === id).length;
    if (live >= weapon.maxOnScreen * weapon.pellets) return;
    this.lastShotAt = time;
    this.fired = true;
    const dir = this.player.flipX ? -1 : 1;
    const x = this.player.x + dir * 10 * PLAYER_SCALE;
    const y = this.player.y + PLAYER_SCALE;
    for (let i = 0; i < weapon.pellets; i++) {
      // Pellets fan out evenly from the top of the spread to the bottom.
      const angle = weapon.pellets === 1 ? 0 : weapon.spread * (i / (weapon.pellets - 1) - 0.5);
      const rad = Phaser.Math.DegToRad(angle);
      const b = (this.bullets.create(x, y, weapon.bullet) as Sprite).setScale(1 / RENDER_SCALE);
      b.setData({ weapon: id, fromX: x, fromY: y, passed: [] as Sprite[] });
      b.setVelocity(dir * weapon.speed * Math.cos(rad), weapon.speed * Math.sin(rad));
    }
    if (weapon.pellets > 1) {
      // A short flash of light at the muzzle, so a blast feels like one.
      const flash = this.add.image(x + dir * 4, y, 'glow-warm').setBlendMode(Phaser.BlendModes.ADD).setScale(0.6).setDepth(11);
      this.tweens.add({ targets: flash, alpha: 0, scale: 0.9, duration: 120, onComplete: () => flash.destroy() });
    }
  }

  /**
   * A swing of a blade: the arm goes up, and after `hitAt` comes down in a slash that cuts
   * every enemy just in front of the player. Not while climbing: they need that hand.
   */
  private swing(time: number, id: WeaponId, blade: BladeStats): void {
    if (this.climbing) return;
    this.lastShotAt = this.swingStartedAt = time;
    this.swingUntil = time + blade.swingTime;
    this.time.delayedCall(blade.hitAt, () => {
      if (this.state !== 'playing') return;
      const p = this.player;
      const body = p.body as Body;
      const dir = p.flipX ? -1 : 1;
      const front = dir > 0 ? body.right : body.left;
      const hitbox = new Phaser.Geom.Rectangle(Math.min(front, front + dir * blade.reach), body.top - 4, blade.reach, body.height + 4);

      const slash = this.add.image(front + dir * 6 * PLAYER_SCALE, p.y, 'slash').setScale(PLAYER_SCALE).setFlipX(dir < 0).setDepth(11).setAlpha(0.9);
      this.tweens.add({ targets: slash, alpha: 0, x: slash.x + dir * 4 * PLAYER_SCALE, scaleY: 1.15 * PLAYER_SCALE, duration: 160, onComplete: () => slash.destroy() });

      for (const group of this.enemyGroups()) {
        for (const enemy of [...group.getChildren()] as Sprite[]) {
          if (!enemy.active) continue;
          const eb = enemy.body as Body;
          if (!Phaser.Geom.Intersects.RectangleToRectangle(hitbox, new Phaser.Geom.Rectangle(eb.x, eb.y, eb.width, eb.height))) continue;
          if (!(enemy.getData('stats') as EnemyStats).hurtBy.includes(id)) this.passThrough(enemy, id);
          else this.shootEnemy(enemy, blade.damage, dir < 0 ? 1 : -1, id);
        }
      }
    });
  }

  /**
   * Whether an enemy touching the player can hurt him. With a blade in hand only a smaller
   * box in the middle of his body counts (the blade's `hurtbox`), so he can get in close
   * enough to cut; with a gun, or nothing, his whole body does.
   */
  private touchesHurtbox(enemy: Sprite): boolean {
    const id = this.registry.get(REG.weapon) as WeaponId | null;
    const stats = id ? (WEAPONS[id] as WeaponStats) : null;
    if (!stats?.melee) return true;
    const body = this.player.body as Body;
    const { width, height } = stats.hurtbox;
    const box = new Phaser.Geom.Rectangle(body.center.x - width / 2, body.bottom - height, width, height);
    const eb = enemy.body as Body;
    return Phaser.Geom.Intersects.RectangleToRectangle(box, new Phaser.Geom.Rectangle(eb.x, eb.y, eb.width, eb.height));
  }

  private enemyGroups(): Phaser.Physics.Arcade.Group[] {
    return [this.zombies, this.ghosts, this.vampires];
  }

  /** Bullets go when they leave the screen; short-range shots fade out and go at the end of their range. */
  private cullBullets(): void {
    const view = this.cameras.main.worldView;
    for (const b of this.bullets.getChildren() as Sprite[]) {
      if (b.x < view.x - 16 || b.x > view.right + 16) {
        b.destroy();
        continue;
      }
      const range = (WEAPONS[b.getData('weapon') as WeaponId] as GunStats).range;
      if (range === Infinity) continue;
      const travelled = Phaser.Math.Distance.Between(b.getData('fromX'), b.getData('fromY'), b.x, b.y) / range;
      if (travelled >= 1) b.destroy();
      else b.setAlpha(1 - travelled ** 3);
    }
  }

  /**
   * A shot or cut from a weapon the enemy shrugs off. Bullets and blades go straight
   * through a ghost, which wavers so the player can see it landed and did nothing.
   * Rock salt bounces off a zombie, and bullets and salt both bounce off a vampire,
   * who hisses back. The first time each happens, the player is told what to use instead.
   */
  private passThrough(enemy: Sprite, weapon: WeaponId, bullet?: Sprite): void {
    if (bullet) {
      const passed = bullet.getData('passed') as Sprite[];
      if (passed.includes(enemy)) return;
      passed.push(enemy);
    }
    const type = enemy.getData('type') as EnemyType;
    if (type === 'ghost') {
      const alpha = enemy.alpha;
      this.tweens.add({ targets: enemy, alpha: alpha * 0.35, duration: 70, yoyo: true, onComplete: () => enemy.setAlpha(alpha) });
    } else if (bullet) {
      const { x, y } = bullet;
      const back = (bullet.body as Body).velocity.x > 0 ? -1 : 1;
      const key = bullet.texture.key;
      bullet.destroy();
      const grain = this.add.image(x, y, key).setScale(1 / RENDER_SCALE).setDepth(9);
      this.tweens.add({ targets: grain, x: x + back * Phaser.Math.Between(6, 14), y: y + 10, alpha: 0, angle: back * 90, duration: 300, ease: 'Quad.in', onComplete: () => grain.destroy() });
    }

    const blade = !!(WEAPONS[weapon] as WeaponStats).melee;
    const told = `${type}/${blade ? 'blade' : weapon}`;
    if (this.toldImmune.has(told)) return;
    this.toldImmune.add(told);
    const owned = this.registry.get(REG.weapons) as WeaponId[];
    const swap = this.swapHint();
    if (type === 'ghost') {
      const what = blade ? 'The blade goes' : 'Bullets go';
      this.say(
        owned.includes('shotgun')
          ? `${what} straight through ghosts!\n${swap} for the rock salt`
          : `${what} straight through ghosts!\nThere must be something else...`,
      );
    } else if (type === 'vampire') {
      this.say(
        owned.includes('machete')
          ? `${blade ? 'That' : 'Guns'} can't hurt a vampire!\n${swap} for the machete.\nOff with its head!`
          : `${blade ? 'That' : 'Guns'} can't hurt a vampire!\nOnly a blade will take its head...`,
      );
    } else {
      this.say(`Rock salt just bounces off zombies!\n${swap} for the gun${owned.includes('machete') ? ' or machete' : ''}`);
    }
  }

  private swapHint(): string {
    return this.isTouch() ? 'Tap the weapons up top' : 'Press C';
  }

  private updateEnemies(time: number, delta: number): void {
    for (const z of this.zombies.getChildren() as Sprite[]) (z.getData('brain') as ZombieBrain).update(time);

    for (const g of this.ghosts.getChildren() as Sprite[]) (g.getData('brain') as GhostBrain).update(time, delta);

    for (const v of this.vampires.getChildren() as Sprite[]) (v.getData('brain') as VampireBrain).update(time);
  }

  // ---------------------------------------------------------------- trapdoors

  /**
   * A trapdoor gives way as soon as the player's middle is over it with their feet
   * on it. Running fast doesn't save them; jumping over it does. Zombies never set
   * one off, and it doesn't care about the blink after respawning either.
   */
  private checkTrapdoors(): void {
    if (this.state !== 'playing' || this.climbing || this.onStairs) return;
    const body = this.player.body as Body;
    if (!body.blocked.down) return;
    const tile = this.layer.getTileAtWorldXY(body.center.x, body.bottom + 1);
    if (!tile || !(tile.index in TRAP_OPENS)) return;
    const trap = this.traps.find((t) => t.tiles.includes(tile));
    if (trap) this.fallThrough(trap);
  }

  /** The lid drops, the player sinks into the dark, and the snakes come up to see. */
  private fallThrough(trap: Trap): void {
    this.sprung = trap;
    for (const tile of trap.tiles) this.setTile(tile, TRAP_OPENS[trap.closed]);
    const p = this.player;
    const lives = this.loseLife();
    const floor = trap.tiles[0].pixelY;
    const body = p.body as Body;
    body.moves = false; // the tween below moves the player now
    p.setVelocity(0, 0);
    p.anims.stop();
    p.setFrame(PLAYER_FRAME.fall).setX(Phaser.Math.Clamp(p.x, trap.tiles[0].pixelX + 6, trap.tiles.at(-1)!.right - 6));
    this.cameras.main.shake(120, 0.006);

    // Hide whatever of the player has sunk below the floor.
    const crop = () => {
      const top = p.y - p.displayHeight * p.originY;
      p.setCrop(0, 0, p.width, Phaser.Math.Clamp(floor - top, 0, p.height));
    };
    this.tweens.add({ targets: p, y: floor + 16, duration: 380, ease: 'Quad.in', onUpdate: crop, onComplete: crop });

    trap.snakes.forEach((snake, i) => {
      const frames = [0, 1, 2, 3, 2, 3, 2, 1, 0];
      this.time.delayedCall(330 + i * 90, () => {
        snake.setVisible(true);
        frames.forEach((f, k) => this.time.delayedCall(k * 110, () => snake.setFrame(f)));
        this.time.delayedCall(frames.length * 110, () => snake.setVisible(false));
      });
    });
    this.time.delayedCall(560, () => this.cameras.main.shake(160, 0.01));
    this.time.delayedCall(1500, () => (lives > 0 ? this.respawn() : this.gameOver()));
  }

  private closeTrap(): void {
    if (!this.sprung) return;
    for (const tile of this.sprung.tiles) this.setTile(tile, this.sprung.closed);
    for (const snake of this.sprung.snakes) snake.setVisible(false);
    this.sprung = null;
  }

  // ---------------------------------------------------------------- secret hatch

  /**
   * Finds the loose book the player is standing in front of. While there is one, a
   * key hint floats over it (the USE button lights up on touch screens), and pressing
   * E or USE pulls it.
   */
  private checkBooks(): void {
    const usePressed = [GameScene.anyJustDown(this.keyUse), pad.justDown('use')].some(Boolean);
    const body = this.player.body as Body;
    const near = this.climbing
      ? null
      : this.books.find(
          (b) => !b.pulled && Math.abs(body.center.x - b.book.x) <= BOOK_REACH.x && Math.abs(body.center.y - (b.book.y - 4)) <= BOOK_REACH.y,
        ) ?? null;
    if (near !== this.bookInReach) {
      this.bookInReach = near;
      this.registry.set(REG.canUse, !!near);
      if (near && !this.isTouch()) this.useHint.setPosition(near.book.x, near.book.y - 14).setVisible(true);
      else this.useHint.setVisible(false);
    }
    if (near && usePressed) this.pullBook(near);
  }

  /** The book tips out of the shelf with a clunk, and somewhere in the floor a bolt slides back. */
  private pullBook(entry: LooseBook): void {
    entry.pulled = true;
    this.bookInReach = null;
    this.registry.set(REG.canUse, false);
    this.useHint.setVisible(false);
    (entry.book.getData('glint') as Phaser.GameObjects.Rectangle).destroy();
    this.tweens.add({ targets: entry.book, angle: -28, x: entry.book.x - 1, duration: 220, ease: 'Back.out' });
    const hatch = entry.hatch;
    if (!hatch) return;
    this.time.delayedCall(350, () => {
      this.cameras.main.shake(260, 0.004);
      this.openHatch(hatch);
    });
  }

  /**
   * The rug slides away, the lid swings up on its hinge and the ladder underneath
   * is free to climb. Zombies and ghosts can use the way down from now on too.
   */
  private openHatch(hatch: Hatch): void {
    const width = hatch.tiles.length * TILE;
    this.tweens.add({ targets: hatch.rug, x: hatch.rug.x - width - 6, scaleX: 0.75, duration: 500, ease: 'Quad.out' });
    this.time.delayedCall(300, () => {
      for (const tile of hatch.tiles) this.setTile(tile, LADDER_TOP);
      hatch.lid.setVisible(true);
      this.tweens.add({ targets: hatch.lid, angle: -100, duration: 450, ease: 'Bounce.out' });
      this.navRows = this.navRows.map((row, ty) =>
        [...row].map((ch, tx) => (hatch.tiles.some((t) => t.x === tx && t.y === ty) ? 'H' : ch)).join(''),
      );
      this.nav = new NavGrid(this.navRows);
      this.world.nav = this.nav;
      // The book can be a floor or more away from its hatch, so say where to look when it's off screen.
      const inView = this.cameras.main.worldView.contains(hatch.rug.x, hatch.rug.y);
      this.say(
        inView
          ? `A secret passage!\n${this.isTouch() ? 'Hold down' : 'Press Down'} on the hatch to climb into the cellar`
          : 'Far below, something heavy slides open...\nCheck the library',
      );
    });
  }

  // ---------------------------------------------------------------- events

  /** Takes a life, stops the player in their tracks and returns how many lives are left. */
  private loseLife(count = 1): number {
    this.state = 'dying';
    const lives = Math.max(0, (this.registry.get(REG.lives) as number) - count);
    this.registry.set(REG.lives, lives);
    if (this.climbing) this.stopClimbing();
    this.onStairs = false;
    (this.player.body as Body).checkCollision.none = true;
    return lives;
  }

  /** The player is caught (by an enemy, taking `damage` lives) or falls to their death (`force`). */
  private hurt(force = false, damage = 1): void {
    if (this.state !== 'playing') return;
    if (!force && this.time.now < this.invulnerableUntil) return;

    const lives = this.loseLife(damage);
    // A skin with video clips flinches, or on the last life falls down dead where it stands.
    const clip = lives > 0 ? 'hurt' : 'death';
    if (playerClip(this, clip)) {
      this.player.anims.play(playerAnim(this, `player-${clip}`));
      this.player.setTint(0xff9a9a);
      if (lives > 0) this.player.setVelocity(0, -220);
      else (this.player.body as Body).moves = false;
    } else {
      this.player.anims.stop();
      this.player.setFrame(PLAYER_FRAME.hurt).setTint(0xff4040).setVelocity(0, -220);
    }
    this.cameras.main.shake(150, 0.01);

    this.time.delayedCall(1000, () => (lives > 0 ? this.respawn() : this.gameOver()));
  }

  private respawn(): void {
    const body = this.player.body as Body;
    body.checkCollision.none = false;
    body.moves = true;
    this.closeTrap();
    this.player.setCrop().clearTint().setPosition(this.spawn.x, this.spawn.y).setVelocity(0, 0);
    this.invulnerableUntil = this.time.now + PLAYER.invulnerableAfterRespawn;
    for (const z of this.zombies.getChildren() as Sprite[]) (z.getData('brain') as ZombieBrain).forget();
    for (const g of this.ghosts.getChildren() as Sprite[]) (g.getData('brain') as GhostBrain).forget();
    for (const v of this.vampires.getChildren() as Sprite[]) (v.getData('brain') as VampireBrain).forget();
    this.tweens.add({ targets: this.player, alpha: 0.3, duration: 100, yoyo: true, repeat: 6, onComplete: () => this.player.setAlpha(1) });
    pad.clearPresses();
    this.state = 'playing';
  }

  private gameOver(): void {
    this.state = 'over';
    pad.clearPresses();
    // He lies where he fell when the skin has a death clip; otherwise he has dropped off screen.
    if (!playerClip(this, 'death')) this.player.setVisible(false);
    this.say(`GAME OVER\n${this.isTouch() ? 'Tap' : 'Press Enter'} to try again${this.isTouch() ? '' : '\nEsc for the menu'}`, true);
  }

  private reachDoor(): void {
    if (this.state !== 'playing') return;
    if (!this.registry.get(REG.hasKey)) {
      if (this.time.now - this.lockedHintAt > 3000) this.say('The door is locked.\nFind the key!');
      this.lockedHintAt = this.time.now;
      return;
    }
    if (this.vampires.countActive() > 0) {
      if (this.time.now - this.lockedHintAt > 3000) this.say("The vampire won't let you near the door!\nOnly a blade can take its head.");
      this.lockedHintAt = this.time.now;
      return;
    }
    this.state = 'won';
    pad.clearPresses();
    this.addScore(SCORE.exit);
    this.player.setVelocity(0, 0).setVisible(false);
    this.say(`LEVEL COMPLETE!\nScore ${this.registry.get(REG.score)}\n${this.isTouch() ? 'Tap' : 'Press Enter'} to play again${this.isTouch() ? '' : '\nEsc for the menu'}`, true);
  }

  /** Gives a new enemy sprite its type's stats and full health. */
  private setEnemy(enemy: Sprite, type: EnemyType): Sprite {
    const stats: EnemyStats = ENEMIES[type];
    return enemy.setData({ type, stats, health: stats.health });
  }

  /**
   * A shot takes `damage` off an enemy's health: at 0 it dies, otherwise it flashes and turns on the player.
   * `from` is the side (-1 left, 1 right) the shot came from, `weapon` what it was fired from.
   */
  private shootEnemy(enemy: Sprite, damage: number, from = 0, weapon?: WeaponId): void {
    if (!enemy.active) return;
    const health = (enemy.getData('health') as number) - damage;
    enemy.setData('health', health);
    if (health > 0) {
      enemy.setTint(ENEMY_HIT_FLASH.tint).setTintMode(Phaser.TintModes.FILL);
      this.time.delayedCall(ENEMY_HIT_FLASH.duration, () => enemy.active && enemy.clearTint().setTintMode(Phaser.TintModes.MULTIPLY));
      const brain = enemy.getData('brain') as ZombieBrain | GhostBrain | VampireBrain;
      if (brain instanceof VampireBrain) brain.shot(this.time.now, from || undefined);
      else brain.shot(this.time.now);
      if (brain instanceof ZombieBrain) enemy.play('zombie-hurt');
      if (brain instanceof GhostBrain) enemy.play('ghost-hurt').anims.chain('ghost-float');
      return;
    }
    this.killEnemy(enemy, from, weapon);
  }

  private killEnemy(enemy: Sprite, from = 0, weapon?: WeaponId): void {
    const stats = enemy.getData('stats') as EnemyStats;
    this.addScore(stats.points);
    if (stats.death === 'behead') {
      this.behead(enemy, from);
      return;
    }
    if (stats.death === 'headshot') {
      this.blowHeadOff(enemy, from, weapon !== undefined && !!(WEAPONS[weapon] as WeaponStats).melee);
      return;
    }
    const body = this.add.sprite(enemy.x, enemy.y, enemy.texture.key, enemy.frame.name).setScale(enemy.scaleX).setFlipX(enemy.flipX).setAlpha(enemy.alpha);
    enemy.destroy();
    if (stats.death === 'burn') this.burnUp(body);
    else this.tweens.add({ targets: body, alpha: 0, scaleX: 1.8, scaleY: 0.2, duration: 250, onComplete: () => body.destroy() });
  }

  /**
   * The killing cut takes the vampire's head clean off. The head spins away and
   * rolls to a stop, the body stands a moment, then both crumble into ash.
   * `from` is the side the blade came from; the head flies the other way.
   */
  private behead(enemy: Sprite, from: number): void {
    const away = from ? -from : enemy.flipX ? 1 : -1;
    const feet = (enemy.body as Body).bottom;
    const flip = enemy.flipX;
    const x = enemy.x;
    enemy.destroy();
    // The death clip starts headless: the body twitches, greys and crumbles to an ash pile.
    const body = this.add.sprite(x, feet, 'vampire').setScale(1 / RENDER_SCALE).setOrigin(0.5, 1).setFlipX(flip).setDepth(5).play('vampire-death');
    const head = this.add.image(x + (flip ? -1 : 1), feet - 19, 'vampire-head').setScale(1 / RENDER_SCALE).setFlipX(flip).setDepth(6);
    this.cameras.main.shake(140, 0.006);

    // The head: up, over and down to the floor, spinning, then a short roll.
    const landX = x + away * 30;
    this.tweens.add({ targets: head, x: landX, angle: away * 540, duration: 650, ease: 'Linear' });
    this.tweens.chain({
      targets: head,
      tweens: [
        { y: head.y - 16, duration: 230, ease: 'Quad.out' },
        { y: feet - 5, duration: 420, ease: 'Quad.in' },
        { y: feet - 8, duration: 120, ease: 'Quad.out', yoyo: true },
        { x: landX + away * 8, angle: away * 720, duration: 300, ease: 'Quad.out' },
      ],
      onComplete: () => this.crumble(head, feet, 300),
    });
    // A dark spray from the neck.
    for (let i = 0; i < 6; i++) {
      const drop = this.add.rectangle(x, feet - 20, 2, 2, 0x5a0c22).setDepth(6);
      this.tweens.add({
        targets: drop,
        x: x + away * Phaser.Math.Between(2, 18),
        y: feet - Phaser.Math.Between(0, 8),
        alpha: 0,
        duration: Phaser.Math.Between(300, 550),
        ease: 'Quad.in',
        onComplete: () => drop.destroy(),
      });
    }
    // The ash pile lingers, then fades.
    body.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.tweens.add({ targets: body, alpha: 0, delay: 1200, duration: 600, onComplete: () => body.destroy() });
    });
    this.time.delayedCall(900, () => this.say('The vampire crumbles to dust!\nThe way out is clear.'));
  }

  /**
   * A zombie's head comes off. A bullet bursts it in a spray of goo, scalp, teeth and
   * an eyeball; a machete (`cut`) sends it flying whole. Either way the headless body
   * stands a moment pumping goo, its knees go, it falls flat on its back and fades.
   * `from` is the side the shot came from: the zombie turns to face it and everything
   * flies the other way.
   */
  private blowHeadOff(enemy: Sprite, from: number, cut: boolean): void {
    const feet = (enemy.body as Body).bottom;
    const flip = from ? from < 0 : enemy.flipX;
    const away = flip ? 1 : -1;
    const { x } = enemy;
    const neckY = feet - 15;
    enemy.destroy();

    // The death clip starts headless: smoke at the neck, a stumble, then flat on its face.
    const body = this.add.sprite(x, feet, 'zombie').setScale(1 / RENDER_SCALE).setOrigin(0.5, 1).setFlipX(flip).setDepth(5);
    body.play('zombie-death');
    body.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.tweens.add({ targets: body, alpha: 0, delay: ZOMBIE_CORPSE.lie, duration: ZOMBIE_CORPSE.fade, onComplete: () => body.destroy() });
    });

    if (cut) {
      // The head flies off whole, spinning, and rolls to a stop.
      const head = this.add.image(x - away * 1, neckY - 4, 'zombie-head').setScale(1 / RENDER_SCALE).setFlipX(flip).setDepth(6);
      const landX = x + away * 28;
      this.tweens.add({ targets: head, x: landX, angle: away * 540, duration: 600, ease: 'Linear' });
      this.tweens.chain({
        targets: head,
        tweens: [
          { y: head.y - 14, duration: 220, ease: 'Quad.out' },
          { y: feet - 4, duration: 380, ease: 'Quad.in' },
          { y: feet - 7, duration: 110, ease: 'Quad.out', yoyo: true },
          { x: landX + away * 8, angle: away * 720, duration: 280, ease: 'Quad.out' },
        ],
        onComplete: () => this.tweens.add({
          targets: head, alpha: 0, delay: ZOMBIE_CORPSE.lie, duration: ZOMBIE_CORPSE.fade, onComplete: () => head.destroy(),
        }),
      });
      this.splatter(x, neckY, feet, away, 6, [GORE.goo]);
      return;
    }

    // The head bursts as the bullet lands (the death clip starts headless).
    this.time.delayedCall(ZOMBIE_HEADSHOT.burstAt, () => {
      this.cameras.main.shake(90, 0.004);
      this.splatter(x, neckY - 4, feet, away, ZOMBIE_HEADSHOT.bits,
        [GORE.skin, GORE.skin, GORE.scalp, GORE.goo, GORE.goo, GORE.tooth], true);
    });
  }

  /**
   * Throws `n` bits of gore up and away from (x, y): they arc over, land on the floor at
   * `floor`, and fade. `eye` adds one eyeball that bounces.
   */
  private splatter(x: number, y: number, floor: number, away: number, n: number, bits: number[], eye = false): void {
    const throwBit = (frame: number, spread: number, rise: number, bounce: boolean) => {
      const bit = this.add.image(x + Phaser.Math.Between(-3, 3), y + Phaser.Math.Between(-2, 2), 'gore', frame).setDepth(7);
      const landX = bit.x + away * Phaser.Math.Between(spread / 3, spread) + Phaser.Math.Between(-4, 4);
      const up = Phaser.Math.Between(4, rise);
      const fall = Phaser.Math.Between(320, 520);
      this.tweens.add({ targets: bit, x: landX, angle: away * Phaser.Math.Between(90, 360), duration: 180 + fall, ease: 'Linear' });
      this.tweens.chain({
        targets: bit,
        tweens: [
          { y: bit.y - up, duration: 180, ease: 'Quad.out' },
          { y: floor - 2, duration: fall, ease: 'Quad.in' },
          ...(bounce ? [{ y: floor - 6, duration: 100, ease: 'Quad.out', yoyo: true }, { x: landX + away * 6, duration: 240, ease: 'Quad.out' }] : []),
        ],
        onComplete: () => this.tweens.add({
          targets: bit, alpha: 0, delay: ZOMBIE_CORPSE.lie, duration: ZOMBIE_CORPSE.fade, onComplete: () => bit.destroy(),
        }),
      });
    };
    for (let i = 0; i < n; i++) throwBit(bits[i % bits.length], 26, 18, false);
    if (eye) throwBit(GORE.eye, 34, 22, true);
  }

  /** Greys out, sinks into a heap and blows away as ash. */
  private crumble(thing: Phaser.GameObjects.Image, floor: number, duration: number): void {
    thing.setTint(0x8c8498);
    const { x } = thing;
    const w = thing.displayWidth;
    this.tweens.add({
      targets: thing,
      scaleY: 0.05,
      alpha: 0,
      y: thing.originY === 1 ? floor : floor - 2,
      duration,
      ease: 'Quad.in',
      onComplete: () => thing.destroy(),
    });
    for (let i = 0; i < Math.round(w); i++) {
      const ash = this.add.rectangle(x + Phaser.Math.Between(-w / 2, w / 2), floor - Phaser.Math.Between(0, 18), 1, 1, 0xb0a8bc).setDepth(7);
      this.tweens.add({
        targets: ash,
        x: ash.x + Phaser.Math.Between(4, 16),
        y: floor - Phaser.Math.Between(0, 3),
        alpha: 0,
        delay: Phaser.Math.Between(0, duration),
        duration: Phaser.Math.Between(400, 900),
        onComplete: () => ash.destroy(),
      });
    }
  }

  /**
   * The rock salt sets a ghost alight: she catches fire from the tail up and burns to
   * embers (her death clip), under a flickering warm glow.
   */
  private burnUp(ghost: Phaser.GameObjects.Sprite): void {
    const { x, y } = ghost;
    ghost.setDepth(7).setAlpha(1).play('ghost-death');
    ghost.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => ghost.destroy());

    const glow = this.add.image(x, y, 'glow-warm').setBlendMode(Phaser.BlendModes.ADD).setScale(1.3).setDepth(4);
    this.tweens.add({ targets: glow, alpha: 0.6, scale: 1.15, duration: 90, yoyo: true, repeat: 4 });
    this.tweens.add({ targets: glow, alpha: 0, delay: BURN_TIME, duration: 400, onComplete: () => glow.destroy() });
  }

  private isTouch(): boolean {
    return this.sys.game.device.input.touch;
  }

  private addScore(n: number): void {
    this.registry.set(REG.score, (this.registry.get(REG.score) as number) + n);
  }

  private say(text: string, sticky = false): void {
    const msg: HudMessage = { text, sticky };
    this.registry.set(REG.message, msg);
  }
}
