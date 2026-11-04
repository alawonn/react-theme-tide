# e2e

Browser tests for the tide, run with `npm run test:browser`. They load `demo/fixture/`, a page with flat white and black themes.

- `helpers.ts`: starts a tide, pauses its animation at exact times and reads the waterline, either from the computed mask position or from screenshot pixels.
- `tide.spec.ts`: hold level and timing, moving waves, completion, both directions, scrolled pages, repeated input, reduced motion, missing APIs, commit errors and cleanup.
- `evidence.spec.ts`: saves frames and a video from the demo page. Runs only with `TIDE_EVIDENCE=1`.
- `perf.spec.ts`: logs frame timing for idle frames, a plain cross-fade and a tide. Runs only with `TIDE_EVIDENCE=1`.
- `readme-images.spec.ts`: retakes the three README thumbnails in `docs/images/` from the demo. Runs only with `TIDE_README_IMAGES=1 npx playwright test e2e/readme-images.spec.ts --project=chromium`.
- `site-images.spec.ts`: retakes the "Sites using it" screenshots in `docs/images/` from the live sites, paused halfway through each site's own hold. Needs a network connection. Runs only with `TIDE_SITE_IMAGES=1 npx playwright test e2e/site-images.spec.ts --project=chromium`.

Pixel checks run only in Chromium, where Playwright screenshots include the transition layer. Firefox tests check computed styles instead. WebKit pixel capture hasn't been tried yet.
