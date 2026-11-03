# e2e

Browser tests for the tide, run with `npm run test:browser`. They load `demo/fixture/`, a page with flat white and black themes.

- `helpers.ts`: starts a tide, pauses its animation at exact times and reads the waterline, either from the computed mask position or from screenshot pixels.
- `tide.spec.ts`: hold level and timing, moving waves, completion, both directions, scrolled pages, repeated input, reduced motion, missing APIs, commit errors and cleanup.
- `evidence.spec.ts`: saves frames and a video from the demo page. Runs only with `TIDE_EVIDENCE=1`.
- `perf.spec.ts`: logs frame timing for idle frames, a plain cross-fade and a tide. Runs only with `TIDE_EVIDENCE=1`.

Pixel checks run only in Chromium, where Playwright screenshots include the transition layer. Firefox tests check computed styles instead. WebKit pixel capture hasn't been tried yet.
