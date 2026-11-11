import Phaser from 'phaser';
import { GAME_HEIGHT, PLAYER, TILE } from '../config';

/** Test room: a wide strip of floor and ledges to prove movement, collision and scrolling. */
const ROOM = [
  '                                                            ',
  '                                                            ',
  '                                                            ',
  '                                                            ',
  '                                             ####           ',
  '                                                            ',
  '                         ####                               ',
  '            ###                       ###                   ',
  '                                                       ##   ',
  '#      ##                                                  #',
  '#                 ##                         ##            #',
  '############################   ######################  #####',
];

export class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private jumpKeys: Phaser.Input.Keyboard.Key[] = [];

  constructor() {
    super('Game');
  }

  create(): void {
    const worldWidth = ROOM[0].length * TILE;
    const worldHeight = Math.max(ROOM.length * TILE, GAME_HEIGHT);

    const solids = this.physics.add.staticGroup();
    ROOM.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (ch === '#') solids.create(x * TILE + TILE / 2, y * TILE + TILE / 2, 'tile-brick');
      });
    });

    this.player = this.physics.add.sprite(TILE * 2, TILE * 9, 'player');
    this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, solids);

    this.physics.world.setBounds(0, 0, worldWidth, worldHeight + TILE * 4);
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);

    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.jumpKeys = [this.cursors.up, this.cursors.space, kb.addKey('Z')];

    this.add
      .text(4, 4, 'Arrows: move   Up/Space/Z: jump', { fontFamily: 'monospace', fontSize: '8px', color: '#ffffff' })
      .setScrollFactor(0);
  }

  update(): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body;

    if (this.cursors.left.isDown) {
      this.player.setVelocityX(-PLAYER.runSpeed).setFlipX(true);
    } else if (this.cursors.right.isDown) {
      this.player.setVelocityX(PLAYER.runSpeed).setFlipX(false);
    } else {
      this.player.setVelocityX(0);
    }

    const jumpPressed = this.jumpKeys.some((k) => Phaser.Input.Keyboard.JustDown(k));
    if (jumpPressed && body.blocked.down) {
      this.player.setVelocityY(-PLAYER.jumpVelocity);
    }

    // Fell into a pit: respawn at the start for now.
    if (this.player.y > ROOM.length * TILE + TILE * 2) {
      this.player.setPosition(TILE * 2, TILE * 9).setVelocity(0, 0);
    }
  }
}
