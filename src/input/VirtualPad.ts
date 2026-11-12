/**
 * Shared state for the on-screen touch buttons. The HUD writes to it and the
 * game scene reads it alongside the keyboard, so both control schemes work at once.
 */
export type PadButton = 'left' | 'right' | 'up' | 'down' | 'jump' | 'fire' | 'switch';

class VirtualPadState {
  private held = new Set<PadButton>();
  private pressed = new Set<PadButton | 'start'>();
  private released = new Set<PadButton>();

  press(button: PadButton): void {
    if (!this.held.has(button)) this.pressed.add(button);
    this.held.add(button);
  }

  release(button: PadButton): void {
    if (this.held.delete(button)) this.released.add(button);
  }

  /** A tap anywhere that isn't a button, used to restart after winning or losing. */
  tap(): void {
    this.pressed.add('start');
  }

  isDown(button: PadButton): boolean {
    return this.held.has(button);
  }

  /** True once per press, like Phaser's JustDown. */
  justDown(button: PadButton | 'start'): boolean {
    return this.pressed.delete(button);
  }

  /** True once per release, like Phaser's JustUp. */
  justUp(button: PadButton): boolean {
    return this.released.delete(button);
  }

  /** Forget presses that haven't been read yet, but keep buttons that are still held. */
  clearPresses(): void {
    this.pressed.clear();
    this.released.clear();
  }

  reset(): void {
    this.held.clear();
    this.pressed.clear();
    this.released.clear();
  }
}

export const pad = new VirtualPadState();
