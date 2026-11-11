import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, REG } from '../config';
import { pad, type PadButton } from '../input/VirtualPad';
import type { HudMessage } from './GameScene';

/** Score, lives and item bar along the top, plus centred messages. Reads everything from the registry. */
export class HudScene extends Phaser.Scene {
  private scoreText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private gunIcon!: Phaser.GameObjects.Image;
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
    this.gunIcon = this.add.image(GAME_WIDTH - 36, 5, 'gun');
    this.keyIcon = this.add.image(GAME_WIDTH - 16, 5, 'key');

    this.message = this.add
      .text(GAME_WIDTH / 2, 70, '', { ...style, align: 'center', stroke: '#000000', strokeThickness: 3, lineSpacing: 4 })
      .setOrigin(0.5, 0.5);

    this.registry.events.on('changedata', this.onChange, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.registry.events.off('changedata', this.onChange, this));
    if (this.sys.game.device.input.touch) this.createTouchControls();

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
    this.gunIcon.setAlpha(this.registry.get(REG.hasGun) ? 1 : 0.15);
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
    const y = GAME_HEIGHT - 28;
    this.touchButton('left', 26, y, (x, by) => this.add.triangle(x, by, 6, 0, 6, 12, 0, 6, 0xffffff));
    this.touchButton('right', 70, y, (x, by) => this.add.triangle(x, by, 0, 0, 0, 12, 6, 6, 0xffffff));
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
  ): void {
    const ring = this.add.circle(x, y, 17, 0xffffff, 0.12).setStrokeStyle(1, 0xffffff, 0.5);
    icon(x, y).setAlpha(0.8);
    // The touch area is larger than the drawn button so it's easy to hit without looking.
    const zone = this.add.zone(x, y, 44, 56).setInteractive();
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
