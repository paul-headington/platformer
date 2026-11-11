import Phaser from 'phaser';
import { NavGrid } from '../ai/NavGrid';
import { ZombieBrain, type ZombieWorld } from '../ai/ZombieBrain';
import { BULLET, GAME_HEIGHT, GAME_WIDTH, GHOST, PLAYER, REG, SCORE, TILE } from '../config';
import { pad } from '../input/VirtualPad';
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
  upstairs: [1, 2, 3],
  downstairs: [4, 5, 6],
  cellar: [7, 7, 7],
};
const BACK_FLOOR_GAP = 8;
/** Frames in the 'decor' sheet. */
const DECOR = { window: 0, cobwebLeft: 4, cobwebRight: 5, portrait: 6, bookcase: 8, vent: 10 } as const;
/** Stairs can be stepped up or down this far in one frame. */
const STEP_UP = 10;
const STEP_DOWN = 8;
/** Player sheet frames (see tools/sprites.py). */
const PLAYER_FRAME = { jump: 6, fall: 7, hurt: 7 } as const;

type Sprite = Phaser.Physics.Arcade.Sprite;
type Body = Phaser.Physics.Arcade.Body;
type State = 'playing' | 'dying' | 'won' | 'over';

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
  private bullets!: Phaser.Physics.Arcade.Group;
  private spawn = new Phaser.Math.Vector2();
  private levelHeight = 0;
  private nav!: NavGrid;
  private traps: Trap[] = [];
  /** The trapdoor the player last fell through; it shuts again when they respawn. */
  private sprung: Trap | null = null;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyLeft: Phaser.Input.Keyboard.Key[] = [];
  private keyRight: Phaser.Input.Keyboard.Key[] = [];
  private keyUp: Phaser.Input.Keyboard.Key[] = [];
  private keyDown: Phaser.Input.Keyboard.Key[] = [];
  private keyJump: Phaser.Input.Keyboard.Key[] = [];
  private keyFire: Phaser.Input.Keyboard.Key[] = [];
  private keyRestart!: Phaser.Input.Keyboard.Key;

  private state: State = 'playing';
  private lastGroundedAt = -Infinity;
  private jumpPressedAt = -Infinity;
  private lastShotAt = -Infinity;
  private invulnerableUntil = 0;
  private lockedHintAt = -Infinity;
  private climbing = false;
  private onStairs = false;
  /** No grabbing a ladder again straight after jumping off it. */
  private climbBlockedUntil = 0;

  constructor() {
    super('Game');
  }

  create(): void {
    this.state = 'playing';
    this.lastGroundedAt = this.jumpPressedAt = this.lastShotAt = this.lockedHintAt = -Infinity;
    this.invulnerableUntil = this.climbBlockedUntil = 0;
    this.climbing = this.onStairs = false;
    this.traps = [];
    this.sprung = null;
    pad.reset();

    this.registry.set(REG.score, 0);
    this.registry.set(REG.lives, PLAYER.startLives);
    this.registry.set(REG.hasGun, false);
    this.registry.set(REG.hasKey, false);
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
    const rows = level.rows.map((row) => row.replaceAll('M', '#').replaceAll('T', '#'));
    const outside = GameScene.findSky(rows);
    const zoneOf = (ty: number) => level.zones.filter((z) => z.fromRow <= ty).at(-1)?.style ?? 'downstairs';
    const at = (tx: number, ty: number) => rows[ty]?.[tx] ?? '#';
    this.nav = new NavGrid(rows);

    const data = rows.map((row, ty) =>
      [...row].map((ch, tx) => {
        if (ch !== '#') return GameScene.tileFor(ch, at(tx, ty - 1));
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

    const worldWidth = this.layer.width;
    this.levelHeight = this.layer.height;

    const gems = this.physics.add.staticGroup();
    this.zombies = this.physics.add.group();
    this.ghosts = this.physics.add.group({ allowGravity: false });
    this.bullets = this.physics.add.group({ allowGravity: false });
    let gun: Phaser.Physics.Arcade.Image | undefined;
    let key: Phaser.Physics.Arcade.Image | undefined;

    rows.forEach((row, ty) => {
      [...row].forEach((ch, tx) => {
        const cx = tx * TILE + TILE / 2;
        const cy = ty * TILE + TILE / 2;
        const bottom = (ty + 1) * TILE;
        switch (ch) {
          case '*': {
            const gem = gems.create(cx, cy, 'gem') as Sprite;
            gem.play({ key: 'gem-sparkle', startFrame: tx % 4 });
            this.tweens.add({ targets: gem, y: cy - 2, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: tx * 40 });
            break;
          }
          case 'G':
            gun = this.physics.add.staticImage(cx, cy + 4, 'gun');
            break;
          case 'K':
            key = this.physics.add.staticImage(cx, cy, 'key');
            this.tweens.add({ targets: key, y: cy - 3, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
            break;
          case 'D':
            this.door = this.physics.add.staticImage(cx, bottom, 'door', 0).setOrigin(0.5, 1).refreshBody();
            break;
          case 'c': {
            const glow = this.add.image(cx, cy - 4, 'glow-warm').setBlendMode(Phaser.BlendModes.ADD).setDepth(-1);
            this.tweens.add({ targets: glow, alpha: 0.7, scale: 0.92, duration: 140, yoyo: true, repeat: -1, delay: tx * 37, repeatDelay: 90 });
            this.add.sprite(cx, cy, 'candle', 0).setDepth(-1).play({ key: 'candle-flicker', startFrame: tx % 3 });
            break;
          }
          case 'P':
            this.spawn.set(cx, bottom - 12);
            break;
          case 'z': {
            const z = this.zombies.create(cx, bottom - 12, 'zombie', 0) as Sprite;
            (z.body as Body).setSize(8, 21).setOffset(6, 3);
            z.play('zombie-walk');
            break;
          }
          case 'g': {
            const gh = this.ghosts.create(cx, cy, 'ghost', 0) as Sprite;
            (gh.body as Body).setSize(12, 12).setOffset(4, 3);
            gh.setData({ ox: cx, oy: cy, phase: tx }).setAlpha(0.85).play('ghost-float');
            break;
          }
        }
      });
    });

    this.player = this.physics.add.sprite(this.spawn.x, this.spawn.y, 'player', 0);
    (this.player.body as Body).setSize(8, 22).setOffset(6, 2);
    this.player.setCollideWorldBounds(true).setDepth(10);

    const world: ZombieWorld = {
      nav: this.nav,
      player: this.player,
      playerIsFair: () => this.state === 'playing' && this.time.now >= this.invulnerableUntil,
      playerIsClimbing: () => this.climbing,
      stairSurface: (body, maxDrop) => this.stairSurface(body, maxDrop),
    };
    for (const z of this.zombies.getChildren() as Sprite[]) z.setData('brain', new ZombieBrain(z, world));

    // Open bottom edge so falling into a pit is possible.
    this.physics.world.setBounds(0, 0, worldWidth, this.levelHeight + TILE * 6);
    this.physics.world.setBoundsCollision(true, true, true, false);
    this.cameras.main.setBounds(0, 0, worldWidth, this.levelHeight);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    const collides = this.tileCollides.bind(this);
    this.physics.add.collider(this.player, this.layer, undefined, collides);
    this.physics.add.collider(this.zombies, this.layer, undefined, collides);
    this.physics.add.collider(
      this.bullets,
      this.layer,
      (b) => (b as Sprite).destroy(),
      (_b, t) => SOLID.has((t as Phaser.Tilemaps.Tile).index),
    );

    this.physics.add.overlap(this.player, this.zombies, () => this.hurt());
    this.physics.add.overlap(this.player, this.ghosts, () => this.hurt());
    this.physics.add.overlap(this.player, gems, (_p, g) => {
      (g as Phaser.Physics.Arcade.Image).destroy();
      this.addScore(SCORE.gem);
    });
    if (gun) {
      this.physics.add.overlap(this.player, gun, () => {
        gun!.destroy();
        this.registry.set(REG.hasGun, true);
        this.say(`You found a gun!\n${this.isTouch() ? 'Tap FIRE' : 'Press X'} to shoot`);
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
    this.physics.add.overlap(this.player, this.door, () => this.reachDoor());
    this.physics.add.overlap(this.bullets, [this.zombies, this.ghosts], (b, e) => {
      (b as Sprite).destroy();
      this.killEnemy(e as Sprite);
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
      const snake = this.add.sprite(tile.getCenterX(), tile.pixelY + 3, 'snake', 0).setOrigin(0.5, 1).setDepth(11);
      current.snakes.push(snake.setFlipX(tile.x % 2 === 1).setVisible(false));
    });
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
    return layer.setDepth(depth);
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
    const tentacle = this.add.sprite(left - 4, top, 'tentacle', 0).setOrigin(0, 0).setDepth(-2.5);
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
    const lurker = this.add.sprite(left, bottom, 'lurker', FRAME.dark).setOrigin(0, 1).setDepth(1);
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
    this.add.image(0, 0, 'sky').setOrigin(0, 0).setScrollFactor(0.1).setDepth(-10);
    this.add.image(0, 0, 'vignette').setOrigin(0, 0).setScrollFactor(0).setDepth(50);

    const flash = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xc8d0ff, 0).setOrigin(0, 0).setScrollFactor(0).setDepth(49);
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
    this.keyRestart = kb.addKey(K.ENTER);
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

  update(time: number): void {
    this.updateEnemies(time);
    this.cullBullets();

    if (this.state === 'won' || this.state === 'over') {
      const restart = Phaser.Input.Keyboard.JustDown(this.keyRestart);
      if (pad.justDown('start') || restart) this.scene.restart();
      return;
    }
    if (this.state !== 'playing') return;

    this.updatePlayer(time);
    this.checkTrapdoors();

    if (this.player.y > this.levelHeight + TILE) this.hurt(true);
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

    if (!onGround) {
      p.anims.stop();
      p.setFrame(body.velocity.y < 0 ? PLAYER_FRAME.jump : PLAYER_FRAME.fall);
    } else if (body.velocity.x !== 0) {
      p.anims.play('player-run', true);
    } else {
      p.anims.play('player-idle', true);
    }
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
    this.player.anims.play('player-climb');
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

  private shoot(time: number): void {
    if (!this.registry.get(REG.hasGun)) return;
    if (time - this.lastShotAt < BULLET.cooldown) return;
    if (this.bullets.countActive() >= BULLET.maxOnScreen) return;
    this.lastShotAt = time;
    const dir = this.player.flipX ? -1 : 1;
    const b = this.bullets.create(this.player.x + dir * 10, this.player.y + 1, 'bullet') as Sprite;
    b.setVelocityX(dir * BULLET.speed);
  }

  private cullBullets(): void {
    const view = this.cameras.main.worldView;
    for (const b of this.bullets.getChildren() as Sprite[]) {
      if (b.x < view.x - 16 || b.x > view.right + 16) b.destroy();
    }
  }

  private updateEnemies(time: number): void {
    for (const z of this.zombies.getChildren() as Sprite[]) (z.getData('brain') as ZombieBrain).update(time);

    for (const g of this.ghosts.getChildren() as Sprite[]) {
      const t = time / 1000 + (g.getData('phase') as number);
      const sway = (GHOST.speed / GHOST.range) * t;
      g.setPosition(g.getData('ox') + Math.sin(sway) * GHOST.range, g.getData('oy') + Math.sin(t * 2.5) * GHOST.bob);
      g.setFlipX(Math.cos(sway) < 0);
    }
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
    for (const tile of trap.tiles) tile.index = TRAP_OPENS[trap.closed];
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
    for (const tile of this.sprung.tiles) tile.index = this.sprung.closed;
    for (const snake of this.sprung.snakes) snake.setVisible(false);
    this.sprung = null;
  }

  // ---------------------------------------------------------------- events

  /** Takes a life, stops the player in their tracks and returns how many lives are left. */
  private loseLife(): number {
    this.state = 'dying';
    const lives = (this.registry.get(REG.lives) as number) - 1;
    this.registry.set(REG.lives, lives);
    if (this.climbing) this.stopClimbing();
    this.onStairs = false;
    (this.player.body as Body).checkCollision.none = true;
    return lives;
  }

  private hurt(force = false): void {
    if (this.state !== 'playing') return;
    if (!force && this.time.now < this.invulnerableUntil) return;

    const lives = this.loseLife();
    this.player.anims.stop();
    this.player.setFrame(PLAYER_FRAME.hurt).setTint(0xff4040).setVelocity(0, -220);
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
    this.tweens.add({ targets: this.player, alpha: 0.3, duration: 100, yoyo: true, repeat: 6, onComplete: () => this.player.setAlpha(1) });
    pad.clearPresses();
    this.state = 'playing';
  }

  private gameOver(): void {
    this.state = 'over';
    pad.clearPresses();
    this.player.setVisible(false);
    this.say(`GAME OVER\n${this.isTouch() ? 'Tap' : 'Press Enter'} to try again`, true);
  }

  private reachDoor(): void {
    if (this.state !== 'playing') return;
    if (!this.registry.get(REG.hasKey)) {
      if (this.time.now - this.lockedHintAt > 3000) this.say('The door is locked.\nFind the key!');
      this.lockedHintAt = this.time.now;
      return;
    }
    this.state = 'won';
    pad.clearPresses();
    this.addScore(SCORE.exit);
    this.player.setVelocity(0, 0).setVisible(false);
    this.say(`LEVEL COMPLETE!\nScore ${this.registry.get(REG.score)}\n${this.isTouch() ? 'Tap' : 'Press Enter'} to play again`, true);
  }

  private killEnemy(enemy: Sprite): void {
    if (!enemy.active) return;
    this.addScore(SCORE.enemy);
    const puff = this.add.image(enemy.x, enemy.y, enemy.texture.key, 0).setFlipX(enemy.flipX);
    enemy.destroy();
    this.tweens.add({ targets: puff, alpha: 0, scaleX: 1.8, scaleY: 0.2, duration: 250, onComplete: () => puff.destroy() });
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
