import Phaser from 'phaser';
import { BULLET, GHOST, PLAYER, REG, SCORE, TILE, ZOMBIE } from '../config';
import { pad } from '../input/VirtualPad';
import { LEVEL_1 } from '../levels/level1';

// Tile indexes in the 'tiles' sheet (see BootScene).
const BRICK = 0;
const STONE = 1;
const LADDER = 2;
/** The top rung of a ladder, which can be stood on like a ledge. */
const LADDER_TOP = 3;
/** Stairs climbing up to the right ('/') and up to the left ('\'). */
const STAIRS_UP_RIGHT = 4;
const STAIRS_UP_LEFT = 5;
/** Stairs can be stepped up or down this far in one frame. */
const STEP_UP = 10;
const STEP_DOWN = 8;
/** Player sheet frames (see tools/sprites.py). */
const PLAYER_FRAME = { jump: 6, fall: 7, hurt: 7 } as const;

type Sprite = Phaser.Physics.Arcade.Sprite;
type Body = Phaser.Physics.Arcade.Body;
type State = 'playing' | 'dying' | 'won' | 'over';

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
    pad.reset();

    this.registry.set(REG.score, 0);
    this.registry.set(REG.lives, PLAYER.startLives);
    this.registry.set(REG.hasGun, false);
    this.registry.set(REG.hasKey, false);
    if (!this.scene.isActive('Hud')) this.scene.launch('Hud');

    this.buildLevel(LEVEL_1);
    this.setupInput();
    this.say(
      this.isTouch()
        ? 'Find the key and reach the door!'
        : 'Find the key and reach the door!\nArrows: move and climb   Space: jump',
    );
  }

  // ---------------------------------------------------------------- level

  private buildLevel(rows: string[]): void {
    const data = rows.map((row, ty) => [...row].map((ch, tx) => GameScene.tileFor(ch, rows[ty - 1]?.[tx])));
    const map = this.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
    const tileset = map.addTilesetImage('tiles')!;
    this.layer = map.createLayer(0, tileset, 0, 0) as Phaser.Tilemaps.TilemapLayer;
    // Stairs are marked as colliding only so the bricks beside them don't get a wall
    // edge; tileCollides() lets bodies pass through them and stairSurface() does the rest.
    this.layer.setCollision([BRICK, STONE, LADDER_TOP, STAIRS_UP_RIGHT, STAIRS_UP_LEFT]);

    const worldWidth = map.widthInPixels;
    this.levelHeight = map.heightInPixels;

    const spikes = this.physics.add.staticGroup();
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
          case '^': {
            const s = spikes.create(cx, cy, 'spikes') as Phaser.Physics.Arcade.Image;
            (s.body as Phaser.Physics.Arcade.StaticBody).setSize(12, 6).setOffset(2, 10);
            break;
          }
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
          case 'P':
            this.spawn.set(cx, bottom - 12);
            break;
          case 'z': {
            const z = this.zombies.create(cx, bottom - 12, 'zombie', 0) as Sprite;
            (z.body as Body).setSize(8, 21).setOffset(6, 3);
            z.setData('dir', -1).play('zombie-walk');
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
      (_b, t) => (t as Phaser.Tilemaps.Tile).index === BRICK,
    );

    this.physics.add.overlap(this.player, spikes, () => this.hurt());
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

  private static tileFor(ch: string, above: string | undefined): number {
    switch (ch) {
      case '#': return BRICK;
      case '=': return STONE;
      case 'H': return above === 'H' ? LADDER : LADDER_TOP;
      case '/': return STAIRS_UP_RIGHT;
      case '\\': return STAIRS_UP_LEFT;
      default: return -1;
    }
  }

  private static isStairs(tile: Phaser.Tilemaps.Tile | null): boolean {
    return tile?.index === STAIRS_UP_RIGHT || tile?.index === STAIRS_UP_LEFT;
  }

  /**
   * Bricks are solid. Stone ledges and ladder tops only block things landing on them
   * from above, and not a climbing player. Stairs never collide (see stairSurface).
   */
  private tileCollides(obj: unknown, tileObj: unknown): boolean {
    const tile = tileObj as Phaser.Tilemaps.Tile;
    if (tile.index === BRICK) return true;
    if (GameScene.isStairs(tile)) return false;
    if (obj === this.player && this.climbing) return false;
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
    for (const z of this.zombies.getChildren() as Sprite[]) {
      const body = z.body as Body;
      let dir = z.getData('dir') as number;
      const ahead = z.x + dir * 7;
      const tile = this.layer.getTileAtWorldXY(ahead, body.bottom + 2);
      const floorAhead = tile?.collides && !GameScene.isStairs(tile);
      if ((dir < 0 && body.blocked.left) || (dir > 0 && body.blocked.right) || (body.blocked.down && !floorAhead)) {
        dir = -dir;
        z.setData('dir', dir);
      }
      z.setVelocityX(dir * ZOMBIE.speed).setFlipX(dir < 0);
    }

    for (const g of this.ghosts.getChildren() as Sprite[]) {
      const t = time / 1000 + (g.getData('phase') as number);
      const sway = (GHOST.speed / GHOST.range) * t;
      g.setPosition(g.getData('ox') + Math.sin(sway) * GHOST.range, g.getData('oy') + Math.sin(t * 2.5) * GHOST.bob);
      g.setFlipX(Math.cos(sway) < 0);
    }
  }

  // ---------------------------------------------------------------- events

  private hurt(force = false): void {
    if (this.state !== 'playing') return;
    if (!force && this.time.now < this.invulnerableUntil) return;

    this.state = 'dying';
    const lives = (this.registry.get(REG.lives) as number) - 1;
    this.registry.set(REG.lives, lives);

    if (this.climbing) this.stopClimbing();
    this.onStairs = false;
    const body = this.player.body as Body;
    body.checkCollision.none = true;
    this.player.anims.stop();
    this.player.setFrame(PLAYER_FRAME.hurt).setTint(0xff4040).setVelocity(0, -220);
    this.cameras.main.shake(150, 0.01);

    this.time.delayedCall(1000, () => (lives > 0 ? this.respawn() : this.gameOver()));
  }

  private respawn(): void {
    const body = this.player.body as Body;
    body.checkCollision.none = false;
    this.player.clearTint().setPosition(this.spawn.x, this.spawn.y).setVelocity(0, 0);
    this.invulnerableUntil = this.time.now + PLAYER.invulnerableAfterRespawn;
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
