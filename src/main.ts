import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, PLAYER } from './config';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { HudScene } from './scenes/HudScene';

const game = new Phaser.Game({
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
  // Never step more than 1/30 s at once (e.g. after a hiccup), so fast bodies can't skip through a tile.
  fps: { min: 30 },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: PLAYER.gravity },
      // Step physics once per rendered frame. With the default fixed 60 Hz step, a 120 Hz or
      // 144 Hz screen moves the player only every other frame while the camera glides every
      // frame, so the player shakes back and forth by a pixel as they move.
      fixedStep: false,
      debug: false,
    },
  },
  scene: [BootScene, GameScene, HudScene],
});

// Handy for poking at the game from the browser console while developing.
if (import.meta.env.DEV) (window as unknown as { game: Phaser.Game }).game = game;
