# Platformer

An original retro side-scrolling platformer built with [Phaser 4](https://phaser.io) and TypeScript, bundled with Vite.

## Getting started

```bash
npm install
npm run dev        # dev server with hot reload, open the URL it prints
npm run build      # type-check and build to dist/
npm run preview    # serve the production build
```

## How to play

Find the key, then reach the exit door. Pick up the gun to shoot zombies and ghosts. Gems are worth points. Spikes, enemies and pits cost a life; you have three.

| Action | Keys |
| --- | --- |
| Move | Arrow keys or A / D |
| Jump | Space, Up, W or Z (hold for a higher jump) |
| Shoot (once you have the gun) | X or Ctrl |
| Restart after winning or game over | Enter |

## Layout

- `src/main.ts`: game config (320x200 resolution scaled up with crisp pixels, arcade physics).
- `src/config.ts`: shared constants such as tile size and player speed.
- `src/levels/level1.ts`: the level, drawn as text with one character per tile. Edit it to change the layout; the legend is at the top of the file.
- `src/scenes/BootScene.ts`: generates placeholder art in code, so no image files are needed yet.
- `src/scenes/GameScene.ts`: builds the level and runs the player, enemies, pickups, lives and win/lose rules.
- `src/scenes/HudScene.ts`: score, lives and item bar, plus on-screen messages.

In dev mode (`npm run dev`) the game is available as `window.game` in the browser console.

## Roadmap

1. Choose the engine: Phaser + TypeScript. Done.
2. Project skeleton and placeholder art. Done.
3. One playable level: enemies, weapon pickup, collectibles, death and respawn, exit door. Done.
4. Package for web, desktop and mobile.
