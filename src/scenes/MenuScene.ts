import Phaser from 'phaser';
import { GAME_TITLE, HUD_HEIGHT, HUD_SCALE, HUD_WIDTH, RENDER_SCALE, SKINS, TEXT_RES, TILE } from '../config';
import { applySkin, currentSkin, playerAnim, skinIds } from '../skins';
import { pad } from '../input/VirtualPad';

/** The room is drawn with tiles this big (HUD units). */
const MENU_TILE = 20;
/** Where the floor starts. */
const FLOOR_Y = 168;
/** Frames used from the sheets (see BACK, DECOR and the tile ids in GameScene): mauve upstairs wallpaper. */
const MENU_BACK = { paper: 1, rail: 2, panel: 3 };
const MENU_FLOOR = 6;
const MENU_WINDOW = 0;

type ItemId = 'start' | 'skin' | 'exit';

interface MenuItem {
  id: ItemId;
  text: Phaser.GameObjects.Text;
}

/** The desktop app's bridge (electron/preload.cjs). Missing on the web. */
const desktop = typeof window !== 'undefined' ? window.desktop : undefined;

/**
 * The title screen: start a new game, choose a character (skin) and, in the desktop app,
 * quit. Laid out on the HUD's 320x200 grid. Works with the keyboard (arrows or WASD to
 * move, left and right to change character, Enter / Space / Z to choose) and with a mouse
 * or touch (tap an item; tap the character or the arrows beside their name to change).
 */
export class MenuScene extends Phaser.Scene {
  private items: MenuItem[] = [];
  private selected = 0;
  private marker!: Phaser.GameObjects.Text;
  private preview!: Phaser.GameObjects.Sprite;
  private skinName!: Phaser.GameObjects.Text;
  private leaving = false;

  constructor() {
    super('Menu');
  }

  create(): void {
    this.items = [];
    this.selected = 0;
    this.leaving = false;
    pad.reset();
    const cam = this.cameras.main.setOrigin(0, 0).setZoom(HUD_SCALE);
    cam.fadeIn(400, 6, 4, 16);

    this.backdrop();
    this.title();
    this.characterStage();
    this.menu();
    this.controls();

    this.add
      .text(HUD_WIDTH - 2, HUD_HEIGHT - 1, __VERSION__, { ...TEXT_RES, fontFamily: 'monospace', fontSize: '6px', color: '#ffffff' })
      .setOrigin(1, 1)
      .setAlpha(0.35);

    this.select(0);
    this.showSkin(false);
  }

  // ---------------------------------------------------------------- layout

  /**
   * A room of the house: mauve damask wallpaper over dark panelling, a floorboard floor and a
   * tall gothic window with the moon in it, all from the game's own high-res tile sheets.
   */
  private backdrop(): void {
    const t = MENU_TILE;
    const scale = t / (TILE * RENDER_SCALE);
    const tile = (sheet: string, frame: number, x: number, y: number) =>
      this.add.image(x, y, `${sheet}-hd`, frame).setOrigin(0, 0).setScale(scale);
    for (let x = 0; x < HUD_WIDTH; x += t) {
      for (let y = FLOOR_Y - 3 * t; y > -t; y -= t) tile('back', MENU_BACK.paper, x, y);
      tile('back', MENU_BACK.rail, x, FLOOR_Y - 2 * t);
      tile('back', MENU_BACK.panel, x, FLOOR_Y - t);
      tile('tiles', MENU_FLOOR, x, FLOOR_Y);
    }
    // The window behind the character (the decor sheet's arched window is 2x2 tiles), lit by the moon.
    const win = { x: 248 - 2 * t, y: 8, size: 2 * t };
    this.add.image(win.x + 2 * t, win.y + 1.6 * t, 'glow-moon').setScale(3.2).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.55);
    [0, 1, 2, 3].forEach((f) =>
      this.add
        .image(win.x + (f % 2) * win.size, win.y + Math.floor(f / 2) * win.size, 'decor-hd', MENU_WINDOW + f)
        .setOrigin(0, 0)
        .setScale((win.size / (TILE * RENDER_SCALE))),
    );
    // Darker on the left, so the menu reads clearly over the wallpaper.
    const shade = this.add.graphics();
    shade.fillGradientStyle(0x06040f, 0x06040f, 0x06040f, 0x06040f, 0.8, 0, 0.8, 0);
    shade.fillRect(0, 0, 230, FLOOR_Y);
    shade.fillStyle(0x06040f, 0.55).fillRect(0, FLOOR_Y + t, HUD_WIDTH, HUD_HEIGHT);
    this.add.image(0, 0, 'vignette').setOrigin(0, 0).setDisplaySize(HUD_WIDTH, HUD_HEIGHT);
  }

  private title(): void {
    const style = {
      ...TEXT_RES,
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontStyle: 'bold',
      fontSize: '22px',
      color: '#e9dcc0',
      stroke: '#120a1c',
      strokeThickness: 4,
    };
    const title = this.add.text(18, 18, GAME_TITLE, style).setShadow(0, 0, '#8fa0ff', 8, false, true);
    this.tweens.add({ targets: title, alpha: 0.82, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.add.text(20, 46, 'Enter if you dare', { ...TEXT_RES, fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '8px', color: '#9a8fb5' });
  }

  /** The chosen character on a rug between two candles, with their name and arrows below. */
  private characterStage(): void {
    const cx = 248;
    this.add.image(cx, FLOOR_Y + 1, 'rug').setScale(0.42).setOrigin(0.5, 0.6);
    // Candle sconces on the wall either side of the window.
    for (const x of [cx - 58, cx + 58]) {
      this.add.image(x, 108, 'glow-warm').setScale(1.6).setBlendMode(Phaser.BlendModes.ADD);
      this.add.sprite(x, 122, 'candle').setOrigin(0.5, 1).setScale(0.3).play('candle-flicker');
    }
    // The 'player' texture always wears the chosen skin, so the preview is the real thing.
    this.preview = this.add.sprite(cx, FLOOR_Y + 2, 'player', 0).setOrigin(0.5, 1).setScale(0.78);
    this.preview.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.changeSkin(1));

    const style = { ...TEXT_RES, fontFamily: 'monospace', fontSize: '8px', color: '#ffffff', stroke: '#000000', strokeThickness: 3 };
    this.skinName = this.add.text(cx, 184, '', style).setOrigin(0.5, 0.5);
    const arrow = (x: number, text: string, step: number) =>
      this.add
        .text(x, 184, text, { ...style, fontSize: '10px', color: '#ffd27a' })
        .setOrigin(0.5, 0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.changeSkin(step));
    arrow(cx - 56, '<', -1);
    arrow(cx + 56, '>', 1);
  }

  private menu(): void {
    const entries: [ItemId, string][] = [
      ['start', 'NEW GAME'],
      ['skin', 'CHARACTER'],
    ];
    // Only the desktop app can close itself; a browser tab can't, so there is no EXIT on the web.
    if (desktop) entries.push(['exit', 'EXIT']);
    const style = { ...TEXT_RES, fontFamily: 'Georgia, "Times New Roman", serif', fontStyle: 'bold', fontSize: '12px', color: '#c9bfdc', stroke: '#06040f', strokeThickness: 3 };
    entries.forEach(([id, label], i) => {
      const text = this.add
        .text(40, 86 + i * 22, label, style)
        .setOrigin(0, 0.5)
        .setInteractive({ useHandCursor: true });
      // A wider hit area, so it is easy to tap on a phone.
      text.input!.hitArea.setTo(-14, -6, text.width + 28, text.height + 12);
      text.on('pointerover', () => this.select(i));
      text.on('pointerdown', () => {
        this.select(i);
        this.activate();
      });
      this.items.push({ id, text });
    });
    this.marker = this.add.text(26, 0, '>', { ...style, color: '#ffd27a' }).setOrigin(0, 0.5);
    this.tweens.add({ targets: this.marker, x: 29, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const touch = this.sys.game.device.input.touch;
    const help = touch ? 'Tap to choose' : 'Arrows to move   Enter to choose\nLeft / Right to change character';
    this.add.text(26, 162, help, { ...TEXT_RES, fontFamily: 'monospace', fontSize: '6px', color: '#8c82a6', lineSpacing: 2 }).setOrigin(0, 1);
  }

  private controls(): void {
    const kb = this.input.keyboard;
    if (kb) {
      const on = (keys: string[], fn: () => void) => keys.forEach((k) => kb.on(`keydown-${k}`, fn));
      on(['UP', 'W'], () => this.select(this.selected - 1));
      on(['DOWN', 'S'], () => this.select(this.selected + 1));
      on(['LEFT', 'A'], () => this.changeSkin(-1));
      on(['RIGHT', 'D', 'K'], () => this.changeSkin(1));
      on(['ENTER', 'SPACE', 'Z'], () => this.activate());
    }
    // Go fullscreen on the first touch where the browser allows it, as the game does.
    if (this.sys.game.device.input.touch) {
      this.input.once('pointerup', () => {
        if (this.scale.fullscreen.available && !this.scale.isFullscreen) this.scale.startFullscreen();
      });
    }
  }

  // ---------------------------------------------------------------- actions

  private select(index: number): void {
    const n = this.items.length;
    this.selected = ((index % n) + n) % n;
    this.items.forEach((item, i) => item.text.setColor(i === this.selected ? '#ffd27a' : '#c9bfdc'));
    this.marker.setY(this.items[this.selected].text.y);
  }

  private activate(): void {
    if (this.leaving) return;
    switch (this.items[this.selected].id) {
      case 'start':
        this.leaving = true;
        this.cameras.main.fadeOut(350, 6, 4, 16);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Game'));
        break;
      case 'skin':
        this.changeSkin(1);
        break;
      case 'exit':
        this.leaving = true;
        this.cameras.main.fadeOut(250, 0, 0, 0);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => desktop?.quit());
        break;
    }
  }

  private changeSkin(step: number): void {
    if (this.leaving) return;
    const i = skinIds.indexOf(currentSkin(this));
    applySkin(this, skinIds[(i + step + skinIds.length) % skinIds.length]);
    this.showSkin(true);
  }

  /** Shows the worn skin's name and plays its idle animation (its own clip if it has one). */
  private showSkin(pop: boolean): void {
    this.skinName.setText(SKINS[currentSkin(this)].name);
    this.preview.play(playerAnim(this, 'player-idle'));
    if (pop) {
      this.tweens.killTweensOf(this.preview);
      this.preview.setScale(0.78 * 0.9).setAlpha(0.4);
      this.tweens.add({ targets: this.preview, scale: 0.78, alpha: 1, duration: 220, ease: 'Back.easeOut' });
    }
  }
}

/** Leaves the game for the title screen, from the game scene or the HUD. */
export function goToMenu(scene: Phaser.Scene): void {
  pad.reset();
  for (const key of ['Game', 'Hud']) if (key !== scene.scene.key) scene.scene.stop(key);
  scene.scene.start('Menu');
}
