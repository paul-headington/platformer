import Phaser from 'phaser';
import { TILE } from '../config';

/**
 * Generates placeholder textures in code so the game runs with no art files.
 * Swap these for real sprite sheets later by loading them in preload().
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);

    // Brick tile
    g.fillStyle(0x7a3b2e).fillRect(0, 0, TILE, TILE);
    g.fillStyle(0x5a2a20);
    g.fillRect(0, 7, TILE, 1).fillRect(0, 15, TILE, 1);
    g.fillRect(7, 0, 1, 7).fillRect(3, 8, 1, 7).fillRect(11, 8, 1, 7);
    g.generateTexture('tile-brick', TILE, TILE);
    g.clear();

    // Player: 12x16 figure
    g.fillStyle(0xf2c28b).fillRect(3, 0, 6, 5); // head
    g.fillStyle(0x2f6fdc).fillRect(2, 5, 8, 6); // shirt
    g.fillStyle(0x30303a).fillRect(2, 11, 3, 5).fillRect(7, 11, 3, 5); // legs
    g.fillStyle(0xd23c3c).fillRect(2, 0, 8, 2); // cap
    g.generateTexture('player', 12, 16);
    g.destroy();

    this.scene.start('Game');
  }
}
