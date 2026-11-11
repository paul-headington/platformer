import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, TILE } from '../config';

/**
 * Loads the sprite sheets from public/sprites (all built by tools/sprites.py)
 * and makes the soft light textures (candle glow, window glow, vignette) in code.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.load.setPath('sprites/');
    // The build id in each URL stops a browser from mixing new code with old cached sprites.
    // Frame layouts are documented in tools/sprites.py.
    const v = `?v=${__BUILD_ID__}`;
    this.load.spritesheet('player', `player.png${v}`, { frameWidth: 20, frameHeight: 24 });
    this.load.spritesheet('zombie', `zombie.png${v}`, { frameWidth: 20, frameHeight: 24 });
    this.load.spritesheet('ghost', `ghost.png${v}`, { frameWidth: 20, frameHeight: 20 });
    this.load.spritesheet('gem', `gem.png${v}`, { frameWidth: 8, frameHeight: 8 });
    this.load.image('key', `key.png${v}`);
    this.load.image('gun', `gun.png${v}`);
    this.load.image('bullet', `bullet.png${v}`);
    this.load.spritesheet('emote', `emote.png${v}`, { frameWidth: 7, frameHeight: 8 });
    for (const sheet of ['tiles', 'back', 'decor', 'candle']) {
      this.load.spritesheet(sheet, `${sheet}.png${v}`, { frameWidth: TILE, frameHeight: TILE });
    }
    this.load.spritesheet('door', `door.png${v}`, { frameWidth: TILE, frameHeight: TILE * 2 });
    this.load.spritesheet('lurker', `lurker.png${v}`, { frameWidth: TILE * 2, frameHeight: TILE * 2 });
    this.load.spritesheet('tentacle', `tentacle.png${v}`, { frameWidth: TILE * 1.5, frameHeight: TILE * 2 });
    this.load.image('spikes', `spikes.png${v}`);
    this.load.image('sky', `sky.png${v}`);
  }

  create(): void {
    this.glow('glow-warm', 48, [255, 190, 110]);
    this.glow('glow-moon', 64, [140, 160, 255]);
    this.vignette();

    // Skips frames the sheet doesn't have (an old cached sheet, say) so a missing frame can't crash the game.
    const frames = (key: string, list: number[]) => {
      const tex = this.textures.get(key);
      const have = list.filter((f) => tex.has(f as unknown as string));
      return this.anims.generateFrameNumbers(key, { frames: have.length > 0 ? have : [0] });
    };
    this.anims.create({ key: 'player-idle', frames: frames('player', [0, 0, 0, 1]), frameRate: 3, repeat: -1 });
    this.anims.create({ key: 'player-climb', frames: frames('player', [8, 9]), frameRate: 6, repeat: -1 });
    this.anims.create({ key: 'player-run', frames: frames('player', [2, 3, 4, 5]), frameRate: 10, repeat: -1 });
    this.anims.create({ key: 'zombie-walk', frames: frames('zombie', [0, 1, 2, 3]), frameRate: 5, repeat: -1 });
    this.anims.create({ key: 'zombie-climb', frames: frames('zombie', [4, 5]), frameRate: 4, repeat: -1 });
    this.anims.create({ key: 'ghost-float', frames: frames('ghost', [0, 1, 0, 1, 2, 3]), frameRate: 4, repeat: -1 });
    this.anims.create({ key: 'gem-sparkle', frames: frames('gem', [0, 1, 2, 3]), frameRate: 6, repeat: -1 });
    this.anims.create({ key: 'candle-flicker', frames: frames('candle', [0, 1, 0, 2, 1, 2]), frameRate: 8, repeat: -1 });

    this.scene.start('Game');
  }

  /** A round, soft-edged pool of light, meant to be drawn with additive blending. */
  private glow(key: string, size: number, [r, g, b]: number[]): void {
    const tex = this.textures.createCanvas(key, size, size)!;
    const ctx = tex.getContext();
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, `rgba(${r},${g},${b},0.55)`);
    grad.addColorStop(0.4, `rgba(${r},${g},${b},0.2)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    tex.refresh();
  }

  /** Darkens the screen edges so the middle, where the player is, feels lit. */
  private vignette(): void {
    const w = GAME_WIDTH;
    const h = GAME_HEIGHT;
    const tex = this.textures.createCanvas('vignette', w, h)!;
    const ctx = tex.getContext();
    const grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.62);
    grad.addColorStop(0, 'rgba(6,4,16,0)');
    grad.addColorStop(1, 'rgba(6,4,16,0.7)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    tex.refresh();
  }
}
