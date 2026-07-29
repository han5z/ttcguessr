# ttcguessr

A GeoGuessr-style game for Toronto's rapid transit network (Lines 1, 2, 4, 5, 6). You're given a station name and have to click its location on an unlabelled schematic map. Wrong guesses unlock hints (line, then region) before revealing the answer.

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Outputs a static site to `dist/`. Deploy to Cloudflare Pages with build command `npm run build` and output directory `dist` — no other configuration needed.
