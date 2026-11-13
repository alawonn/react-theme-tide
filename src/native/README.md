# src/native

The React Native version. Metro loads `index.ts` through the `react-native` export condition, and it exports the same names as the web entry.

- `engine.ts`: `themeTide()` for apps. Timing, results, going back and the one-commit guarantee. It doesn't import React Native, so the unit tests run it in Node with a fake surface.
- `root.tsx`: `ThemeTideRoot`. Takes the picture with Skia, draws the part above the water and runs the waterline with Reanimated.
- `reverse.tsx`: `ThemeTideReverse`, the wrapper for the button that goes back mid-tide.
- `use-theme-tide.ts`: the hook, same API as the web one.

Functions that run on the UI thread start with a `"worklet"` directive. Keep it: the app's Babel setup needs it to move them there.
