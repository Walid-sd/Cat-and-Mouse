# Cat & Mouse

A turn-based puzzle chase built for the browser and mobile screens.

## Game concept

**The Escape** — play as the mouse. Navigate the maze, solve riddles to unlock gates, and reach the exit. After every successful movement, the cat advances exactly one tile along the shortest currently valid route.

**The Hunt** — play as the cat. Navigate the same maze and catch the mouse before it reaches the exit. After every successful cat movement, the mouse takes one evasive turn.

## Controls

- **Keyboard:** Arrow keys or WASD
- **Touch:** On-screen directional controls
- **Sound:** `M` toggles sound, or use the in-game sound button
- **Riddles:** Choose an answer to unlock a gate; incorrect answers leave the gate locked

Progress is stored locally in the browser for each mode. No account or server is required.

## Offline / installation

The production build includes a web app manifest, app icon, and service worker. After the game has been opened online once, the app shell can be reused from the browser cache when the network is unavailable.

On supported mobile and desktop browsers, the game can also be installed as a standalone web app from the browser's install/add-to-home-screen control.

## Development

```bash
npm install
npm run dev
```

Run the complete release verification locally:

```bash
npm run test:release
```

This runs TypeScript checking, level validation, gameplay solvability checks for both modes, accessibility and PWA smoke tests, deployment-configuration checks, and the production build.

Individual checks are also available:

```bash
npm run typecheck
npm run validate:levels
npm run test:gameplay
npm run test:accessibility
npm run test:pwa
npm run test:deployment
npm run build
```

The Vite output is `dist/`, making the project suitable for Netlify with `npm run build` as the build command and `dist` as the publish directory. GitHub Actions runs the same release checks before the production build.
