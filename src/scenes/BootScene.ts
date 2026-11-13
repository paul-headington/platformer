import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, RENDER_SCALE, TILE } from '../config';
import { PLAYER_HOLDING } from './GameScene';
import { createPlayerAnims, createPlayerTexture, loadSkins } from '../skins';

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
    // Every player skin; the 'player' texture is made from the chosen one in create().
    loadSkins(this.load, v);
    this.load.spritesheet('zombie', `zombie.png${v}`, { frameWidth: 20, frameHeight: 24 });
    this.load.spritesheet('vampire', `vampire.png${v}`, { frameWidth: 20, frameHeight: 24 });
    this.load.image('vampire-head', `vampire-head.png${v}`);
    this.load.image('zombie-head', `zombie-head.png${v}`);
    this.load.spritesheet('gore', `gore.png${v}`, { frameWidth: 4, frameHeight: 4 });
    this.load.image('machete', `machete.png${v}`);
    this.load.spritesheet('ghost', `ghost.png${v}`, { frameWidth: 20, frameHeight: 20 });
    this.load.spritesheet('gem', `gem.png${v}`, { frameWidth: 8, frameHeight: 8 });
    this.load.image('key', `key.png${v}`);
    this.load.image('jacket', `jacket.png${v}`);
    this.load.image('gun', `gun.png${v}`);
    this.load.image('bullet', `bullet.png${v}`);
    this.load.image('shotgun', `shotgun.png${v}`);
    this.load.image('salt', `salt.png${v}`);
    this.load.spritesheet('fire', `fire.png${v}`, { frameWidth: 20, frameHeight: 26 });
    this.load.image('ember', `ember.png${v}`);
    this.load.spritesheet('emote', `emote.png${v}`, { frameWidth: 7, frameHeight: 8 });
    for (const sheet of ['tiles', 'back', 'decor', 'candle']) {
      this.load.spritesheet(sheet, `${sheet}.png${v}`, { frameWidth: TILE, frameHeight: TILE });
    }
    // High-res versions of the tile sheets, from tools/art (npm run art). Where one exists the
    // game shows it in place of the pixel-art sheet.
    for (const sheet of ['tiles', 'back', 'decor']) {
      this.load.spritesheet(`${sheet}-hd`, `hd/${sheet}.png${v}`, { frameWidth: TILE * RENDER_SCALE, frameHeight: TILE * RENDER_SCALE });
    }
    this.load.spritesheet('door', `door.png${v}`, { frameWidth: TILE, frameHeight: TILE * 2 });
    this.load.spritesheet('lurker', `lurker.png${v}`, { frameWidth: TILE * 2, frameHeight: TILE * 2 });
    this.load.spritesheet('tentacle', `tentacle.png${v}`, { frameWidth: TILE * 1.5, frameHeight: TILE * 2 });
    this.load.spritesheet('snake', `snake.png${v}`, { frameWidth: TILE, frameHeight: 20 });
    this.load.image('sky', `sky.png${v}`);
    this.load.image('pull-book', `pull-book.png${v}`);
    this.load.image('rug', `rug.png${v}`);
    this.load.image('hatch-lid', `hatch-lid.png${v}`);
  }

  create(): void {
    // Everything loaded so far is pixel art (apart from high-res sheets in sprites/hd/):
    // keep its pixels crisp on the zoomed-in cameras. Textures made below stay smooth.
    for (const key of this.textures.getTextureKeys()) {
      const tex = this.textures.get(key);
      const src = tex.source[0]?.source as HTMLImageElement | undefined;
      if (src && 'src' in src && !src.src.includes('/hd/')) tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    this.glow('glow-warm', 48, [255, 190, 110]);
    this.glow('glow-moon', 64, [140, 160, 255]);
    this.vignette();
    this.slash();
    createPlayerTexture(this);

    // Skips frames the sheet doesn't have (an old cached sheet, say) so a missing frame can't crash the game.
    const frames = (key: string, list: number[]) => {
      const tex = this.textures.get(key);
      const have = list.filter((f) => tex.has(f as unknown as string));
      return this.anims.generateFrameNumbers(key, { frames: have.length > 0 ? have : [0] });
    };
    createPlayerAnims(this, PLAYER_HOLDING);
    this.anims.create({ key: 'zombie-walk', frames: frames('zombie', [0, 1, 2, 3]), frameRate: 5, repeat: -1 });
    this.anims.create({ key: 'zombie-climb', frames: frames('zombie', [4, 5]), frameRate: 4, repeat: -1 });
    // Head blown off by a bullet: hit, burst, stand pumping goo, sway, knees go, flat on its back.
    // A machete cut skips the hit and burst: the head flies off whole.
    this.anims.create({ key: 'zombie-headshot', frames: frames('zombie', [6, 7, 7, 8, 8, 8, 9, 9, 10, 11]), frameRate: 11 });
    this.anims.create({ key: 'zombie-headless', frames: frames('zombie', [8, 8, 8, 9, 9, 10, 11]), frameRate: 11 });
    this.anims.create({ key: 'vampire-idle', frames: frames('vampire', [0, 0, 0, 1]), frameRate: 3, repeat: -1 });
    this.anims.create({ key: 'vampire-walk', frames: frames('vampire', [2, 3, 4, 5]), frameRate: 7, repeat: -1 });
    this.anims.create({ key: 'ghost-float', frames: frames('ghost', [0, 1, 0, 1, 2, 3]), frameRate: 4, repeat: -1 });
    // A ghost burning up: roaring flames three times over, then dying down.
    const roar = [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 4, 5, 6];
    this.anims.create({ key: 'fire-burn', frames: frames('fire', roar), frameRate: 12 });
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

  /** The streak a machete leaves in the air: a pale crescent, brightest at its leading edge, facing right. */
  private slash(): void {
    const w = 16;
    const h = 28;
    const tex = this.textures.createCanvas('slash', w, h)!;
    const ctx = tex.getContext();
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(-6 + i, h / 2, 17 - i, -1.05, 1.05);
      ctx.strokeStyle = ['rgba(150,160,220,0.35)', 'rgba(200,210,255,0.6)', 'rgba(235,240,255,0.85)', 'rgba(255,255,255,1)'][i];
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
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
