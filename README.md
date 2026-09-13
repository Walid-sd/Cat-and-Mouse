# Cat & Mouse

A turn-based puzzle chase designed for browser and mobile play.

Cat & Mouse explores two complementary game experiences built around the same core idea: every successful move changes the state of the chase.

## Game modes

### The Escape
Play as the mouse. Navigate a maze, solve riddles to unlock gates, and reach the exit while the cat advances one tile after each successful movement.

### The Hunt
Play as the cat. Navigate a dedicated hunt layout and catch the mouse before the mouse reaches the exit. Hunt layouts are authored separately from Escape layouts so the two roles provide distinct challenges.

The current release contains three levels, with a dedicated Escape and Hunt layout for each level.

## Interaction design

- Keyboard controls: Arrow keys or WASD
- Touch controls: on-screen directional controls for mobile play
- Sound: in-game toggle or `M` key
- Riddle gates: answer correctly to unlock; incorrect answers keep the gate locked
- Local progression: player progress is stored locally without an account or server

## Mobile & PWA

The project is designed for desktop and mobile browser screens and can be installed as a Progressive Web App on supported browsers.

The production build includes:

- Web app manifest and app icon
- Service worker and cached app shell
- Browser installation prompt where supported
- Offline reuse of the app shell after the first online visit

## Production resilience

The game includes safeguards intended to keep the player experience recoverable in production:

- React error boundary with a user-facing recovery screen
- Stale-deployment/chunk recovery
- Separate local progression storage
- Release checks for gameplay, progression, accessibility, PWA behavior, deployment configuration, rewarded-ad integration, and production artifacts

## Optional rewarded ads

The menu contains an optional rewarded-ad placement that can grant 15 in-game coins after a confirmed ad-completion callback. Ads are never shown during active gameplay.

The integration is disabled by default until an approved publisher ID is configured. Test mode remains enabled for development.

## Tech stack

- React
- TypeScript
- Vite
- CSS
- Progressive Web App APIs
- Netlify deployment configuration
- GitHub Actions for release verification

## Development

Requirements: **Node.js 24+**

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Run the full release verification suite:

```bash
npm run test:release
```

The release suite performs type checking, level validation, gameplay and progression checks, accessibility checks, PWA checks, deployment checks, rewarded-ad checks, a production build, and production-artifact verification.

Build for production:

```bash
npm run build
```

The production output is generated in `dist/` and is configured for Netlify deployment.

## Project structure

```text
src/
├── App.tsx              # Main application and UI flow
├── game.ts              # Core game logic
├── progression.ts       # Local progression/profile state
├── styles.css           # Main responsive UI styling
├── progression.css      # Progression-related UI styling
├── audio.ts             # Game audio behavior
└── ErrorBoundary.tsx    # Runtime error recovery

public/
├── manifest.webmanifest # PWA metadata
├── sw.js                # Service worker
├── install.js           # Installation UX
└── rewarded-ads.js      # Optional rewarded-ad integration

scripts/
└── *.mjs                # Release and validation checks
```

## Status

An actively developed browser game prototype focused on interaction design, responsive play, game-flow design, and production-oriented web implementation.
