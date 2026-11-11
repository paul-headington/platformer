# Platformer

An original retro side-scrolling platformer built with [Phaser 4](https://phaser.io) and TypeScript, bundled with Vite.

## Getting started

```bash
npm install
npm run dev        # dev server with hot reload, open the URL it prints
npm run build      # type-check and build to dist/
npm run preview    # serve the production build
```

Controls: arrow keys to move, Up / Space / Z to jump.

## Layout

- `src/main.ts`: game config (320x200 resolution scaled up with crisp pixels, arcade physics).
- `src/config.ts`: shared constants such as tile size and player speed.
- `src/scenes/BootScene.ts`: generates placeholder art in code, so no image files are needed yet.
- `src/scenes/GameScene.ts`: a test room that proves movement, collision and camera scrolling.

## Roadmap

1. Choose the engine: Phaser + TypeScript. Done.
2. Project skeleton and placeholder art. This commit.
3. One playable level: Tiled map, enemies, weapon pickup, collectibles, death and respawn, exit door.
4. Package for web, desktop and mobile.
