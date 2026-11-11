import Phaser from 'phaser';
import { BULLET, GHOST, PLAYER, REG, SCORE, TILE, ZOMBIE } from '../config';
import { LEVEL_1 } from '../levels/level1';

const BRICK = 0;
const STONE = 1;

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
  private keyJump: Phaser.Input.Keyboard.Key[] = [];
  private keyFire: Phaser.Input.Keyboard.Key[] = [];
  private keyRestart!: Phaser.Input.Keyboard.Key;

  private state: State = 'playing';
  private lastGroundedAt = -Infinity;
  private jumpPressedAt = -Infinity;
  private lastShotAt = -Infinity;
  private invulnerableUntil = 0;
  private lockedHintAt = -Infinity;

  constructor() {
    super('Game');
  }

  create(): void {
    this.state = 'playing';
    this.lastGroundedAt = this.jumpPressedAt = this.lastShotAt = this.lockedHintAt = -Infinity;
    this.invulnerableUntil = 0;

    this.registry.set(REG.score, 0);
    this.registry.set(REG.lives, PLAYER.startLives);
    this.registry.set(REG.hasGun, false);
    this.registry.set(REG.hasKey, false);
    if (!this.scene.isActive('Hud')) this.scene.launch('Hud');

    this.buildLevel(LEVEL_1);
    this.setupInput();
    this.say('Find the key and reach the door!\nArrows: move   Space: jump');
  }

  // ---------------------------------------------------------------- level

  private buildLevel(rows: string[]): void {
    const data = rows.map((row) => [...row].map((ch) => (ch === '#' ? BRICK : ch === '=' ? STONE : -1)));
    const map = this.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
    const tileset = map.addTilesetImage('tiles')!;
    this.layer = map.createLayer(0, tileset, 0, 0) as Phaser.Tilemaps.TilemapLayer;
    this.layer.setCollision([BRICK, STONE]);

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
            const gem = gems.create(cx, cy, 'gem') as Phaser.Physics.Arcade.Image;
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
            this.spawn.set(cx, bottom - 8);
            break;
          case 'z': {
            const z = this.zombies.create(cx, bottom - 8, 'zombie', 0) as Sprite;
            (z.body as Body).setSize(10, 16).setOffset(1, 0);
            z.setData('dir', -1).play('zombie-walk');
            break;
          }
          case 'g': {
            const gh = this.ghosts.create(cx, cy, 'ghost', 0) as Sprite;
            (gh.body as Body).setSize(10, 10).setOffset(2, 2);
            gh.setData({ ox: cx, oy: cy, phase: tx }).setAlpha(0.85).play('ghost-float');
            break;
          }
        }
      });
    });

    this.player = this.physics.add.sprite(this.spawn.x, this.spawn.y, 'player', 0);
    (this.player.body as Body).setSize(8, 15).setOffset(2, 1);
    this.player.setCollideWorldBounds(true).setDepth(10);

    // Open bottom edge so falling into a pit is possible.
    this.physics.world.setBounds(0, 0, worldWidth, this.levelHeight + TILE * 6);
    this.physics.world.setBoundsCollision(true, true, true, false);
    this.cameras.main.setBounds(0, 0, worldWidth, this.levelHeight);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    const oneWay = this.oneWayPlatform.bind(this);
    this.physics.add.collider(this.player, this.layer, undefined, oneWay);
    this.physics.add.collider(this.zombies, this.layer, undefined, oneWay);
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
        this.say('You found a gun!\nPress X to shoot');
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

  /** Stone ledges only block things landing on them from above. */
  private oneWayPlatform(obj: unknown, tileObj: unknown): boolean {
    const tile = tileObj as Phaser.Tilemaps.Tile;
    if (tile.index !== STONE) return true;
    const body = (obj as Sprite).body as Body;
    return body.velocity.y >= 0 && body.prev.y + body.height <= tile.pixelY + 2;
  }

  // ---------------------------------------------------------------- input

  private setupInput(): void {
    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.cursors = kb.createCursorKeys();
    this.keyLeft = [this.cursors.left, kb.addKey(K.A)];
    this.keyRight = [this.cursors.right, kb.addKey(K.D)];
    this.keyJump = [this.cursors.up, this.cursors.space, kb.addKey(K.W), kb.addKey(K.Z)];
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
      if (Phaser.Input.Keyboard.JustDown(this.keyRestart)) this.scene.restart();
      return;
    }
    if (this.state !== 'playing') return;

    this.updatePlayer(time);

    if (this.player.y > this.levelHeight + TILE) this.hurt(true);
  }

  private updatePlayer(time: number): void {
    const p = this.player;
    const body = p.body as Body;
    const onGround = body.blocked.down || body.touching.down;
    if (onGround) this.lastGroundedAt = time;

    const left = GameScene.anyDown(this.keyLeft);
    const right = GameScene.anyDown(this.keyRight);
    if (left && !right) p.setVelocityX(-PLAYER.runSpeed).setFlipX(true);
    else if (right && !left) p.setVelocityX(PLAYER.runSpeed).setFlipX(false);
    else p.setVelocityX(0);

    if (GameScene.anyJustDown(this.keyJump)) this.jumpPressedAt = time;
    const canJump = time - this.lastGroundedAt <= PLAYER.coyoteTime;
    if (time - this.jumpPressedAt <= PLAYER.jumpBuffer && canJump) {
      p.setVelocityY(-PLAYER.jumpVelocity);
      this.jumpPressedAt = this.lastGroundedAt = -Infinity;
    }
    // Letting go of jump early gives a shorter hop.
    if (GameScene.anyJustUp(this.keyJump) && body.velocity.y < 0) body.velocity.y *= 0.45;

    if (!onGround) {
      p.anims.stop();
      p.setFrame(3);
    } else if (body.velocity.x !== 0) {
      p.anims.play('player-run', true);
    } else {
      p.anims.stop();
      p.setFrame(0);
    }

    if (GameScene.anyJustDown(this.keyFire)) this.shoot(time);
  }

  private shoot(time: number): void {
    if (!this.registry.get(REG.hasGun)) return;
    if (time - this.lastShotAt < BULLET.cooldown) return;
    if (this.bullets.countActive() >= BULLET.maxOnScreen) return;
    this.lastShotAt = time;
    const dir = this.player.flipX ? -1 : 1;
    const b = this.bullets.create(this.player.x + dir * 8, this.player.y + 1, 'bullet') as Sprite;
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
      const floorAhead = this.layer.getTileAtWorldXY(ahead, body.bottom + 2);
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

    const body = this.player.body as Body;
    body.checkCollision.none = true;
    this.player.anims.stop();
    this.player.setFrame(3).setTint(0xff4040).setVelocity(0, -220);
    this.cameras.main.shake(150, 0.01);

    this.time.delayedCall(1000, () => (lives > 0 ? this.respawn() : this.gameOver()));
  }

  private respawn(): void {
    const body = this.player.body as Body;
    body.checkCollision.none = false;
    this.player.clearTint().setPosition(this.spawn.x, this.spawn.y).setVelocity(0, 0);
    this.invulnerableUntil = this.time.now + PLAYER.invulnerableAfterRespawn;
    this.tweens.add({ targets: this.player, alpha: 0.3, duration: 100, yoyo: true, repeat: 6, onComplete: () => this.player.setAlpha(1) });
    this.state = 'playing';
  }

  private gameOver(): void {
    this.state = 'over';
    this.player.setVisible(false);
    this.say('GAME OVER\nPress Enter to try again', true);
  }

  private reachDoor(): void {
    if (this.state !== 'playing') return;
    if (!this.registry.get(REG.hasKey)) {
      if (this.time.now - this.lockedHintAt > 3000) this.say('The door is locked.\nFind the key!');
      this.lockedHintAt = this.time.now;
      return;
    }
    this.state = 'won';
    this.addScore(SCORE.exit);
    this.player.setVelocity(0, 0).setVisible(false);
    this.say(`LEVEL COMPLETE!\nScore ${this.registry.get(REG.score)}\nPress Enter to play again`, true);
  }

  private killEnemy(enemy: Sprite): void {
    if (!enemy.active) return;
    this.addScore(SCORE.enemy);
    const puff = this.add.image(enemy.x, enemy.y, enemy.texture.key, 0).setFlipX(enemy.flipX);
    enemy.destroy();
    this.tweens.add({ targets: puff, alpha: 0, scaleX: 1.8, scaleY: 0.2, duration: 250, onComplete: () => puff.destroy() });
  }

  private addScore(n: number): void {
    this.registry.set(REG.score, (this.registry.get(REG.score) as number) + n);
  }

  private say(text: string, sticky = false): void {
    const msg: HudMessage = { text, sticky };
    this.registry.set(REG.message, msg);
  }
}
