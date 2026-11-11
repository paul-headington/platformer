import Phaser from 'phaser';
import { GAME_WIDTH, REG } from '../config';
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
}
