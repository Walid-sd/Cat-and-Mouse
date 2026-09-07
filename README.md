# Cat & Mouse

A turn-based puzzle chase built for the browser.

## Game concept

**The Escape** — play as the mouse. Navigate the maze, solve riddles to unlock gates, and reach the exit. After every successful movement, the cat advances exactly one tile along the shortest currently valid route.

**The Hunt** — play as the cat. Navigate the same maze and catch the mouse before it reaches the exit.

## Development

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

The Vite output is `dist/`, making the project suitable for Netlify with `npm run build` as the build command and `dist` as the publish directory.
