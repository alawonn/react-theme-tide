# Contributing

Thanks for helping. This file covers everything you need to work on React Theme Tide.

## Setup

You need Node.js 20 or newer and npm.

```bash
npm install
npx playwright install chromium firefox
```

## Layout

- `src/`: the published library. See `src/README.md`.
- `test/`: unit tests (Vitest, jsdom).
- `e2e/`: browser tests (Playwright) against the fixture page. See `e2e/README.md`.
- `demo/`: the demo site and the test fixture. Neither is in the npm package. Every push to `main` publishes the demo to https://alawonn.github.io/react-theme-tide/ (see `.github/workflows/pages.yml`, which can also be run by hand from the Actions tab).
- `native-demo/`: an Expo app for trying the React Native version. Not in the npm package. See `native-demo/README.md`.
- `docs/`: the usage and how-it-works guides linked from the README.

## Checks

Run what relates to your change:

```bash
npm run typecheck
npm run lint
npx vitest run test/tide.test.ts          # one unit test file
npx playwright test --project=chromium    # browser tests in one engine
npm run build && npm pack --dry-run       # what the package would contain
```

WebKit tests need extra system libraries. Install them with `sudo npx playwright install-deps webkit`, then run with `TIDE_WEBKIT=1`.

To save frames, a video and frame timing from the demo page, run `TIDE_EVIDENCE=1 npx playwright test e2e/evidence.spec.ts e2e/perf.spec.ts --project=chromium`. Output goes to `test-results/`.

For the React Native version, run the engine tests with `npx vitest run test/native-engine.test.ts`, then try it in the demo app on a device (see `native-demo/README.md`).

## Guidelines

- Keep modules small and keep geometry in `src/wave.ts` free of DOM access.
- Don't read `window` or `document` at import time. The package must import cleanly on a server.
- The host owns theme state and storage. Don't add a theme provider or a storage key.
- Add a runtime dependency only with a clear reason. There are none today.
- Every code path must call the host's commit exactly once and remove everything it added.
- Add or update tests for any behavior you change.
- Describe browser support only from what you've tested, and name the browser and version.

## Commits and branches

Work on a `feature/...` or `fix/...` branch from `develop` and open a pull request against `develop`. Use Conventional Commit messages, such as `fix(tide): finish on resize`.

Versions follow SemVer. Development builds on `develop` are prereleases of the next version, such as `0.2.0-alpha.1`. Keep `package.json` and `package-lock.json` versions in step.
