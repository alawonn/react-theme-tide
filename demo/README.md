# demo

A small site for trying the tide by hand. It isn't part of the published package.

- `index.html` and `src/`: the demo page. It keeps its own theme in `localStorage` and passes its theme setter to `useThemeTide`.
- `fixture/`: a plain page with flat colors, used by the browser tests in `e2e/` to measure the waterline.

Run it with `npm run demo` and open http://localhost:5179.
