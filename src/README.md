# src

The published library. Nothing here touches `window` or `document` at import time.

- `options.ts`: option types, defaults, ranges and validation.
- `wave.ts`: pure geometry. Waterline height over time, wave phase, the SVG wave tile and mask keyframes.
- `tide.ts`: `themeTide()`. Feature checks, the View Transition, the temporary style rule, cleanup and the one-commit guarantee.
- `use-theme-tide.ts`: the React hook, the only module marked `"use client"`.
- `components.ts`: web versions of `ThemeTideRoot` and `ThemeTideReverse`, so code shared with an app imports the same names.
- `native/`: the React Native version. See `native/README.md`.
- `index.ts`: the public exports. Anything not exported here is internal.
