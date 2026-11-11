import Phaser from 'phaser';
import { TILE } from '../config';

type Draw = (g: Phaser.GameObjects.Graphics, ox: number, frame: number) => void;

/**
 * Loads the character sprite sheets from public/sprites (built by tools/sprites.py)
 * and still draws the tiles, door and spikes in code as placeholders.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.load.setPath('sprites/');
    // Frame layouts are documented in tools/sprites.py.
    this.load.spritesheet('player', 'player.png', { frameWidth: 20, frameHeight: 24 });
    this.load.spritesheet('zombie', 'zombie.png', { frameWidth: 20, frameHeight: 24 });
    this.load.spritesheet('ghost', 'ghost.png', { frameWidth: 20, frameHeight: 20 });
    this.load.spritesheet('gem', 'gem.png', { frameWidth: 8, frameHeight: 8 });
    this.load.image('key', 'key.png');
    this.load.image('gun', 'gun.png');
    this.load.image('bullet', 'bullet.png');
  }

  create(): void {
    // Tileset: frame 0 = brick, frame 1 = stone ledge.
    this.sheet('tiles', TILE, TILE, 2, (g, ox, f) => {
      if (f === 0) {
        g.fillStyle(0x7a3b2e).fillRect(ox, 0, TILE, TILE);
        g.fillStyle(0x5a2a20);
        g.fillRect(ox, 7, TILE, 1).fillRect(ox, 15, TILE, 1);
        g.fillRect(ox + 7, 0, 1, 7).fillRect(ox + 3, 8, 1, 7).fillRect(ox + 11, 8, 1, 7);
      } else {
        g.fillStyle(0x8a8f9c).fillRect(ox, 0, TILE, 6);
        g.fillStyle(0xb4b9c6).fillRect(ox, 0, TILE, 1);
        g.fillStyle(0x5c606b).fillRect(ox, 5, TILE, 1).fillRect(ox + 5, 1, 1, 4).fillRect(ox + 12, 1, 1, 4);
      }
    });

    // Door: 0 closed, 1 open.
    this.sheet('door', TILE, TILE * 2, 2, (g, ox, f) => {
      g.fillStyle(0x3b2a1a).fillRect(ox, 0, TILE, TILE * 2);
      if (f === 0) {
        g.fillStyle(0x8a5a2b).fillRect(ox + 2, 2, 12, 30);
        g.fillStyle(0x6b431f).fillRect(ox + 7, 2, 1, 30);
        g.fillStyle(0xffd23f).fillRect(ox + 10, 16, 2, 2);
      } else {
        g.fillStyle(0x000000).fillRect(ox + 2, 2, 12, 30);
        g.fillStyle(0xffe680, 0.5).fillRect(ox + 4, 6, 8, 26);
      }
    });

    this.single('spikes', TILE, TILE, (g) => {
      g.fillStyle(0xc9ced8);
      for (let i = 0; i < 4; i++) g.fillTriangle(i * 4, 16, i * 4 + 2, 8, i * 4 + 4, 16);
    });
    const frames = (key: string, list: number[]) => this.anims.generateFrameNumbers(key, { frames: list });
    this.anims.create({ key: 'player-idle', frames: frames('player', [0, 0, 0, 1]), frameRate: 3, repeat: -1 });
    this.anims.create({ key: 'player-run', frames: frames('player', [2, 3, 4, 5]), frameRate: 10, repeat: -1 });
    this.anims.create({ key: 'zombie-walk', frames: frames('zombie', [0, 1, 2, 3]), frameRate: 5, repeat: -1 });
    this.anims.create({ key: 'ghost-float', frames: frames('ghost', [0, 1, 0, 1, 2, 3]), frameRate: 4, repeat: -1 });
    this.anims.create({ key: 'gem-sparkle', frames: frames('gem', [0, 1, 2, 3]), frameRate: 6, repeat: -1 });

    this.scene.start('Game');
  }

  /** Draws `count` frames side by side and registers them as numbered frames 0..count-1. */
  private sheet(key: string, w: number, h: number, count: number, draw: Draw): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    for (let i = 0; i < count; i++) draw(g, i * w, i);
    g.generateTexture(key, w * count, h);
    g.destroy();
    const tex = this.textures.get(key);
    for (let i = 0; i < count; i++) tex.add(i, 0, i * w, 0, w, h);
  }

  private single(key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
  }
}
