import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, PLAYER } from './config';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#1a1026',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: PLAYER.gravity }, debug: false },
  },
  scene: [BootScene, GameScene],
});
