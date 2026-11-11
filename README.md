# Platformer

An original retro side-scrolling platformer built with [Phaser 4](https://phaser.io) and TypeScript, bundled with Vite.

## Getting started

```bash
npm install
npm run dev        # dev server with hot reload, open the URL it prints
npm run build      # type-check and build to dist/
npm run preview    # serve the production build
npm run desktop    # build and open it as a desktop app (Electron)
```

## How to play

Find the key, then reach the exit door. Pick up the gun to shoot zombies and ghosts. Gems are worth points. Spikes, enemies and pits cost a life; you have three.

| Action | Keys |
| --- | --- |
| Move (and walk up and down stairs) | Arrow keys or A / D |
| Jump | Space or Z (hold for a higher jump). Up and W also jump when you're not at a ladder |
| Climb a ladder | Up / Down (or W / S). Down on the top of a ladder climbs down; jump to let go |
| Shoot (once you have the gun) | X or Ctrl |
| Restart after winning or game over | Enter |

On phones and tablets, on-screen buttons appear automatically (a d-pad for moving and climbing, FIRE, JUMP), and you tap anywhere to restart. Hold the device sideways.

## Platforms

**Web.** `.github/workflows/web.yml` builds every pull request, and publishes `main` to GitHub Pages. To turn publishing on once: repo **Settings → Pages → Source: GitHub Actions**. The game is then at `https://<user>.github.io/platformer/`.

**Phones and tablets.** Open the web version and add it to the home screen (Android Chrome: menu → *Install app*; iPhone Safari: Share → *Add to Home Screen*). It then launches fullscreen in landscape with its own icon, like an app. Store builds (Capacitor for Android and iOS) can come later.

**Desktop.** Electron wraps the same build in a window (`electron/main.cjs`). F11 toggles fullscreen.

```bash
npm run desktop         # run it
npm run desktop:dist    # make an installer for the current OS into release/
```

`desktop:dist` makes a Windows installer on Windows, a `.dmg` on a Mac, and an AppImage on Linux. Each OS has to build its own. Phaser is a dev dependency on purpose: Vite bundles it into `dist/`, so the desktop app doesn't ship a second copy.

## Layout

- `src/main.ts`: game config (320x200 resolution scaled up with crisp pixels, arcade physics).
- `src/config.ts`: shared constants such as tile size and player speed.
- `src/levels/level1.ts`: the level, drawn as text with one character per tile. Edit it to change the layout; the legend is at the top of the file.
- `src/scenes/BootScene.ts`: loads the sprite sheets (characters, house tiles, wallpaper, decorations, night sky) and sets up animations.
- `tools/sprites.py`: all the art (characters, pickups, house tiles, wallpaper, decorations and the night sky), drawn as text pixel maps. Edit a map, run `python3 tools/sprites.py --preview` (needs Pillow), and it rewrites `public/sprites/*.png` and `docs/sprite-preview.png`.
- `src/scenes/GameScene.ts`: builds the level and runs the player, enemies, pickups, lives and win/lose rules.
- `src/scenes/HudScene.ts`: score, lives and item bar, on-screen messages, and the touch buttons.
- `src/input/VirtualPad.ts`: touch button state, read by the game alongside the keyboard.
- `public/`: web app manifest and icons. `build/icon.png` is the desktop app icon.
- `electron/main.cjs`: the desktop wrapper.

In dev mode (`npm run dev`) the game is available as `window.game` in the browser console.

## Roadmap

1. Choose the engine: Phaser + TypeScript. Done.
2. Project skeleton and placeholder art. Done.
3. One playable level: enemies, weapon pickup, collectibles, death and respawn, exit door. Done.
4. Package for web, desktop and mobile. Done: touch controls, installable web app, GitHub Pages deploy, Electron desktop app.
5. Vertical levels: ladders, stairs and a camera that scrolls up and down. Level 1 is now three floors tall.
6. Haunted house look: moonlit tiles, wallpaper, windows, candles and cobwebs, and level 1 rebuilt as a house with an attic, two storeys and a cellar.
