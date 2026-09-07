# Cat & Mouse

A turn-based puzzle chase built for the browser and mobile screens.

## Game concept

**The Escape** — play as the mouse. Navigate the maze, solve riddles to unlock gates, and reach the exit. After every successful movement, the cat advances exactly one tile along the shortest currently valid route.

**The Hunt** — play as the cat. Navigate a purpose-built hunt layout and catch the mouse before it reaches the exit. After every successful cat movement, the mouse takes one evasive turn. Hunt layouts are authored separately from Escape layouts so each role gets a distinct challenge rather than replaying the same maze from the opposite side.

The game currently contains three levels, with a dedicated Escape and Hunt layout for each level.

## Controls

- **Keyboard:** Arrow keys or WASD
- **Touch:** On-screen directional controls
- **Sound:** `M` toggles sound, or use the in-game sound button
- **Riddles:** Choose an answer to unlock a gate; incorrect answers leave the gate locked

Progress is stored locally in the browser for each mode. No account or server is required.

## Optional rewarded ads

The menu includes an optional **Watch an Ad · +15 🪙** reward. The reward is granted only from the H5 Games Ads `adViewed` completion callback; dismissing or unavailable ads award nothing. The ad panel is hidden during gameplay so ads never interrupt active turns.

The integration is deliberately disabled until an approved H5 Games Ads Publisher ID is supplied in `public/ads-config.js`. Keep `testMode: true` while testing the placement. Once the H5 Games Ads account/site is approved, set the real Publisher ID and switch test mode off. Google requires H5 Games Ads access to be approved and recommends the standard Ad Placement API for rewarded placements. urlH5 Games Ads setuphttps://support.google.com/adsense/answer/9959170?hl=en

## Offline / installation

The production build includes a web app manifest, app icon, service worker, and a progressive install prompt on browsers that expose the PWA install API. After the game has been opened online once, the app shell can be reused from the browser cache when the network is unavailable.

On supported mobile and desktop browsers, the game can also be installed as a standalone web app from the browser's install/add-to-home-screen control.

If the browser or platform does not expose the custom install prompt, the normal browser installation flow remains available.

## Resilience

The game includes production stale-chunk recovery for deployments and a React error boundary with a user-facing reload screen. A rendering failure therefore does not leave the player with an unresponsive blank page, and saved progression remains in the separate local profile store.

## Development

**Node.js 24 or newer is required.**

```bash
npm install
npm run dev
```

Run the complete release verification locally:

```bash
npm run test:release
```

This runs TypeScript checking, level validation, gameplay turn and solvability checks for both modes and every authored layout, progression, accessibility and PWA smoke tests, deployment-configuration checks, rewarded-ad integration checks, the production build, and production-artifact verification.

Individual checks are also available:

```bash
npm run typecheck
npm run validate:levels
npm run test:gameplay
npm run test:progression
npm run test:accessibility
npm run test:pwa
npm run test:deployment
npm run test:rewarded-ads
npm run build
npm run test:build-artifact
```

The Vite output is `dist/`, making the project suitable for Netlify with `npm run build` as the build command and `dist` as the publish directory. GitHub Actions runs the same release checks before the production build.
