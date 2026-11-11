import Phaser from 'phaser';
import { TILE } from '../config';

type Draw = (g: Phaser.GameObjects.Graphics, ox: number, frame: number) => void;

/**
 * Generates placeholder pixel art in code so the game runs with no image files.
 * To swap in real art later, load sprite sheets in preload() using the same keys
 * and frame numbers, and delete the matching drawing code here.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
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

    // Player: 0 idle, 1-2 run, 3 jump.
    this.sheet('player', 12, 16, 4, (g, ox, f) => {
      g.fillStyle(0xd23c3c).fillRect(ox + 2, 0, 8, 2); // cap
      g.fillStyle(0xf2c28b).fillRect(ox + 3, 2, 6, 3); // face
      g.fillStyle(0x000000).fillRect(ox + 7, 3, 1, 1); // eye
      g.fillStyle(0x2f6fdc).fillRect(ox + 2, 5, 8, 6); // shirt
      g.fillStyle(0x30303a);
      if (f === 0) g.fillRect(ox + 3, 11, 2, 5).fillRect(ox + 7, 11, 2, 5);
      if (f === 1) g.fillRect(ox + 1, 11, 3, 4).fillRect(ox + 7, 11, 2, 5);
      if (f === 2) g.fillRect(ox + 3, 11, 2, 5).fillRect(ox + 8, 11, 3, 4);
      if (f === 3) g.fillRect(ox + 1, 11, 3, 3).fillRect(ox + 8, 11, 3, 3);
    });

    // Zombie: 2 walk frames.
    this.sheet('zombie', 12, 16, 2, (g, ox, f) => {
      g.fillStyle(0x7fbf5a).fillRect(ox + 3, 0, 6, 5);
      g.fillStyle(0xff3030).fillRect(ox + 7, 2, 1, 1);
      g.fillStyle(0x5b4a3a).fillRect(ox + 2, 5, 8, 6);
      g.fillStyle(0x7fbf5a).fillRect(ox + 8, 6, 4, 2); // arms out
      g.fillStyle(0x3a3328);
      if (f === 0) g.fillRect(ox + 3, 11, 2, 5).fillRect(ox + 7, 11, 2, 5);
      else g.fillRect(ox + 2, 11, 2, 5).fillRect(ox + 8, 11, 2, 5);
    });

    // Ghost: 2 wobble frames.
    this.sheet('ghost', 14, 14, 2, (g, ox, f) => {
      g.fillStyle(0xe8ecff, 0.9).fillRect(ox + 2, 0, 10, 2).fillRect(ox, 2, 14, 9);
      const tail = f === 0 ? [0, 4, 8] : [2, 6, 10];
      tail.forEach((t) => g.fillRect(ox + t, 11, 4, 3));
      g.fillStyle(0x1a1026).fillRect(ox + 3, 4, 2, 3).fillRect(ox + 9, 4, 2, 3);
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
    this.single('gem', 8, 8, (g) => {
      g.fillStyle(0x3fe0ff).fillTriangle(4, 0, 0, 3, 8, 3).fillTriangle(0, 3, 8, 3, 4, 8);
      g.fillStyle(0xffffff).fillRect(3, 1, 2, 1);
    });
    this.single('key', 12, 6, (g) => {
      g.fillStyle(0xffd23f).fillRect(0, 0, 5, 6).fillRect(5, 2, 7, 2).fillRect(9, 4, 1, 2).fillRect(11, 4, 1, 2);
      g.fillStyle(0x1a1026).fillRect(2, 2, 1, 2);
    });
    this.single('gun', 12, 6, (g) => {
      g.fillStyle(0x9aa0aa).fillRect(0, 0, 12, 3);
      g.fillStyle(0x5c606b).fillRect(1, 3, 3, 3);
    });
    this.single('bullet', 4, 2, (g) => {
      g.fillStyle(0xfff27a).fillRect(0, 0, 4, 2);
    });

    this.anims.create({ key: 'player-run', frames: this.anims.generateFrameNumbers('player', { frames: [1, 0, 2, 0] }), frameRate: 10, repeat: -1 });
    this.anims.create({ key: 'zombie-walk', frames: this.anims.generateFrameNumbers('zombie', { start: 0, end: 1 }), frameRate: 4, repeat: -1 });
    this.anims.create({ key: 'ghost-float', frames: this.anims.generateFrameNumbers('ghost', { start: 0, end: 1 }), frameRate: 3, repeat: -1 });

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
