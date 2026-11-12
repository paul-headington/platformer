import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, REG, WEAPONS, type WeaponId } from '../config';
import { pad, type PadButton } from '../input/VirtualPad';
import type { HudMessage } from './GameScene';

/** Score, lives and item bar along the top, plus centred messages. Reads everything from the registry. */
export class HudScene extends Phaser.Scene {
  private scoreText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private weaponIcons = new Map<WeaponId, Phaser.GameObjects.Image>();
  /** A box around the weapon in hand. */
  private weaponMark!: Phaser.GameObjects.Rectangle;
  private keyIcon!: Phaser.GameObjects.Image;
  private message!: Phaser.GameObjects.Text;

  constructor() {
    super('Hud');
  }

  create(): void {
    const style = { fontFamily: 'monospace', fontSize: '8px', color: '#ffffff' };
    this.add.rectangle(0, 0, GAME_WIDTH, 11, 0x000000, 0.6).setOrigin(0, 0);
    this.scoreText = this.add.text(4, 2, '', style);
    this.livesText = this.add.text(110, 2, '', style);
    // One icon per weapon, right to left before the key. Tapping or clicking them switches guns.
    this.weaponMark = this.add.rectangle(0, 5, 0, 10).setStrokeStyle(1, 0xffffff, 0.6).setVisible(false);
    let right = GAME_WIDTH - 28;
    for (const id of (Object.keys(WEAPONS) as WeaponId[]).reverse()) {
      const icon = this.add.image(right, 6, WEAPONS[id].icon).setOrigin(1, 0.5);
      right -= icon.displayWidth + 6;
      this.weaponIcons.set(id, icon);
    }
    const iconsLeft = right + 2;
    this.add
      .zone(iconsLeft, 0, GAME_WIDTH - 24 - iconsLeft, 14)
      .setOrigin(0, 0)
      .setInteractive()
      .on('pointerdown', () => {
        pad.press('switch');
        pad.release('switch');
      });
    this.keyIcon = this.add.image(GAME_WIDTH - 12, 5, 'key');

    this.message = this.add
      .text(GAME_WIDTH / 2, 70, '', { ...style, align: 'center', stroke: '#000000', strokeThickness: 3, lineSpacing: 4 })
      .setOrigin(0.5, 0.5);

    this.registry.events.on('changedata', this.onChange, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.registry.events.off('changedata', this.onChange, this));
    if (this.sys.game.device.input.touch) this.createTouchControls();

    // Faint build version in the bottom-right corner, so it's easy to tell which build is running.
    this.add
      .text(GAME_WIDTH - 2, GAME_HEIGHT - 1, __VERSION__, { fontFamily: 'monospace', fontSize: '6px', color: '#ffffff' })
      .setOrigin(1, 1)
      .setAlpha(0.35);

    this.refresh();
    const msg = this.registry.get(REG.message) as HudMessage | undefined;
    if (msg) this.showMessage(msg);
  }

  private onChange(_parent: unknown, key: string, value: unknown): void {
    if (key === REG.message) this.showMessage(value as HudMessage);
    else this.refresh();
  }

  private refresh(): void {
    const score = (this.registry.get(REG.score) as number) ?? 0;
    this.scoreText.setText(`SCORE ${String(score).padStart(6, '0')}`);
    this.livesText.setText(`LIVES ${this.registry.get(REG.lives) ?? 0}`);
    const owned = (this.registry.get(REG.weapons) as WeaponId[] | undefined) ?? [];
    const held = this.registry.get(REG.weapon) as WeaponId | null;
    for (const [id, icon] of this.weaponIcons) icon.setAlpha(id === held ? 1 : owned.includes(id) ? 0.55 : 0.15);
    const heldIcon = held && this.weaponIcons.get(held);
    this.weaponMark.setVisible(!!heldIcon && owned.length > 1);
    if (heldIcon) this.weaponMark.setPosition(heldIcon.x - heldIcon.displayWidth / 2, 6).setSize(heldIcon.displayWidth + 4, 11);
    this.keyIcon.setAlpha(this.registry.get(REG.hasKey) ? 1 : 0.15);
  }

  private showMessage(msg: HudMessage): void {
    this.tweens.killTweensOf(this.message);
    this.message.setText(msg.text).setAlpha(1);
    if (!msg.sticky) this.tweens.add({ targets: this.message, alpha: 0, delay: 2500, duration: 400 });
  }

  // ---------------------------------------------------------------- touch

  private createTouchControls(): void {
    this.input.addPointer(3); // up to four fingers at once
    // A d-pad on the left (up and down climb ladders), FIRE and JUMP on the right.
    const cx = 48;
    const cy = GAME_HEIGHT - 44;
    const tri = (x: number, y: number, ...pts: number[]) => this.add.triangle(x, y, ...pts, 0xffffff);
    this.touchButton('left', cx - 26, cy, (x, by) => tri(x, by, 6, 0, 6, 12, 0, 6), 13, { x: 18, w: 36, h: 40 });
    this.touchButton('right', cx + 26, cy, (x, by) => tri(x, by, 0, 0, 0, 12, 6, 6), 13, { x: 78, w: 36, h: 40 });
    this.touchButton('up', cx, cy - 24, (x, by) => tri(x, by, 0, 6, 12, 6, 6, 0), 13, { y: cy - 28, w: 28, h: 32 });
    this.touchButton('down', cx, cy + 24, (x, by) => tri(x, by, 0, 0, 12, 0, 6, 6), 13, { y: cy + 28, w: 28, h: 32 });
    const y = GAME_HEIGHT - 28;
    this.touchButton('fire', GAME_WIDTH - 70, y, (x, by) => this.labelFor(x, by, 'FIRE'));
    this.touchButton('jump', GAME_WIDTH - 26, y, (x, by) => this.labelFor(x, by, 'JUMP'));

    // A tap away from the buttons restarts after winning or losing.
    this.input.on('pointerdown', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length === 0) pad.tap();
    });
    // Go fullscreen on the first touch where the browser allows it (Android; iOS needs "Add to Home Screen").
    this.input.once('pointerup', () => {
      if (this.scale.fullscreen.available && !this.scale.isFullscreen) this.scale.startFullscreen();
    });
  }

  private labelFor(x: number, y: number, text: string): Phaser.GameObjects.Text {
    return this.add.text(x, y, text, { fontFamily: 'monospace', fontSize: '7px', color: '#ffffff' }).setOrigin(0.5);
  }

  private touchButton(
    button: PadButton,
    x: number,
    y: number,
    icon: (x: number, y: number) => { setAlpha(value: number): unknown },
    radius = 17,
    area: { x?: number; y?: number; w?: number; h?: number } = {},
  ): void {
    const ring = this.add.circle(x, y, radius, 0xffffff, 0.12).setStrokeStyle(1, 0xffffff, 0.5);
    icon(x, y).setAlpha(0.8);
    // The touch area is larger than the drawn button so it's easy to hit without looking.
    const zone = this.add.zone(area.x ?? x, area.y ?? y, area.w ?? 44, area.h ?? 56).setInteractive();
    const down = () => {
      pad.press(button);
      ring.setFillStyle(0xffffff, 0.35);
    };
    const up = () => {
      pad.release(button);
      ring.setFillStyle(0xffffff, 0.12);
    };
    zone.on('pointerdown', down);
    zone.on('pointerover', (p: Phaser.Input.Pointer) => p.isDown && down()); // finger slid onto it
    zone.on('pointerup', up);
    zone.on('pointerout', up);
  }
}
