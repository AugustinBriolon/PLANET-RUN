# 4. Render the globe with vendored mapcn components

Date: 2026-09-16

## Status

Accepted

## Context

The core screen of Planet Run is a 3D globe showing every run trace. The UI is built with shadcn/ui and Tailwind,
and the product owner wants a modern, polished look with micro-animations. The initial plan was raw MapLibre GL
with MapTiler vector tiles, which requires an API key and hand-written React bindings. The product owner then
asked to use mapcn, a shadcn registry of map components built on MapLibre GL.

## Decision

We will use mapcn's `map` component, installed with `shadcn add @mapcn/map` into `src/components/ui/map.tsx`,
with MapLibre GL 6 in `globe` projection and CARTO Dark Matter basemap tiles.

- Planet Run-specific layers (`RunTracesLayer`, `GlobeAutoRotate`, `FlyToBounds`, `FitGlobeToContainer`) are
  separate components composed as children of `<Map>` through mapcn's `useMap` hook, so the vendored file stays
  untouched and can be refreshed from the registry.
- Map colors are hex constants in `globe-palette.ts` because WebGL paint properties cannot read CSS variables.
- `src/components/ui/map.tsx` is excluded from ESLint: it triggers 13 `react-hooks/refs` and
  `react-hooks/set-state-in-effect` errors from the React Compiler rules. Fixing them would fork the vendored
  code and block registry updates.

## Options considered

### Option A — mapcn on MapLibre GL (chosen)

- Pros: shadcn-native styling and theming; globe projection, arcs, markers and GeoJSON layers ready to use; free
  CARTO tiles with no API key; code is copied into the repo, so there is no runtime lock-in.
- Cons: vendored file does not satisfy our lint rules; relies on CARTO's free basemap terms and on unpkg for the
  MapLibre worker script.

### Option B — Raw MapLibre GL with MapTiler tiles

- Pros: full control, no vendored code.
- Cons: requires a MapTiler API key and quota; React lifecycle bindings, theming and controls to write and test
  ourselves.

### Option C — Mapbox GL JS

- Pros: excellent globe rendering and atmosphere.
- Cons: proprietary license, mandatory token, usage-based billing.

### Option D — Three.js / react-globe.gl

- Pros: highly stylized globes.
- Cons: no street-level zoom; the coverage milestone needs a real slippy map down to street level.

## Consequences

### Positive

- No map API key is needed to run the project.
- The same map stack scales from the whole planet down to individual streets for the coverage milestone.
- Updating mapcn is a single `shadcn add @mapcn/map --overwrite`.

### Negative

- Lint does not cover `map.tsx`; regressions in it are only caught by E2E tests.
- The MapLibre worker is loaded from unpkg at runtime; a strict Content Security Policy will need to allow it or
  the worker must be self-hosted.
- CARTO basemaps are free for limited use; a commercial launch will need a tile provider agreement.

### Neutral

- The app is dark-only: mapcn picks the dark style from the `dark` class on `<html>`.

## References

- https://www.mapcn.dev/docs
- https://maplibre.org/maplibre-gl-js/docs/
- https://carto.com/basemaps
