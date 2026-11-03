# React Theme Tide

Change your site's theme with a water fill that rises from the bottom of the screen. It stops at 60% for one second while the waves keep moving, then fills the rest of the screen.

What shows under the water is your real page in its new theme: text, backgrounds, borders and controls. It isn't a colored overlay. The reveal uses the browser's View Transitions API and a CSS mask, so it needs no screenshot library, no copy of your DOM and no React re-render on each frame.

React Theme Tide doesn't store your theme. You keep your own theme state and storage, and the library animates around the function that applies it.

> Status: first release (0.1). The API may still change before 1.0.

## Install

It isn't on npm yet. Install the package file from the GitHub release:

```bash
npm install https://github.com/alawonn/react-theme-tide/releases/download/v0.1.0/react-theme-tide-0.1.0.tgz
```

React 18 or newer is a peer dependency. There's no stylesheet to import. While a tide runs, the library adds a small `<style>` element to `<head>` and removes it when the tide ends.

## Quick start

Pass the function that changes your theme. It must update the DOM before it returns (or before its promise resolves), because the browser captures the new page right after it.

```tsx
"use client";
import { useThemeTide } from "react-theme-tide";

export function ThemeToggle() {
  const tide = useThemeTide();
  const toggle = () =>
    tide.run(() => {
      const dark = document.documentElement.classList.toggle("dark");
      localStorage.setItem("theme", dark ? "dark" : "light");
    });
  return (
    <button type="button" onClick={toggle} aria-label="Toggle theme">
      Toggle theme
    </button>
  );
}
```

Without React, call `themeTide` directly:

```ts
import { themeTide } from "react-theme-tide";

themeTide(() => document.documentElement.classList.toggle("dark"));
```

## Wrap a theme setter you already have

If your site already has a function that applies and saves the theme, pass it in unchanged:

```tsx
"use client";
import { useThemeTide } from "react-theme-tide";
import { setAppearance } from "@/lib/appearance"; // your existing setter

export function AppearanceButtons() {
  const tide = useThemeTide();
  return (
    <>
      <button type="button" onClick={() => tide.run(() => setAppearance("light"))}>Light</button>
      <button type="button" onClick={() => tide.run(() => setAppearance("dark"))}>Dark</button>
    </>
  );
}
```

Your storage key, your pre-paint script and your other controls keep working as before. Every control can use its own `useThemeTide()`; they all see the same `running` state.

### Theme held in React state

React state updates are asynchronous, so wrap them in `flushSync`. That way the DOM has the new theme when the callback returns:

```tsx
import { flushSync } from "react-dom";

tide.run(() => flushSync(() => setTheme("dark")));
```

This applies to theme libraries that keep state in React context, too.

## Next.js App Router

Use the hook in a Client Component (a file that starts with `"use client"`). Only the hook's module is marked `"use client"`. The rest of the package doesn't touch `window` or `document` when it's imported, so Server Components can import the defaults and helpers. On the server, `supportsThemeTide()` returns `false`.

```tsx
// app/theme-toggle.tsx
"use client";
import { useThemeTide } from "react-theme-tide";

export function ThemeToggle() {
  const { run, running } = useThemeTide();
  return (
    <button
      type="button"
      disabled={running}
      onClick={() => run(() => document.documentElement.classList.toggle("dark"))}
    >
      Switch theme
    </button>
  );
}
```

```tsx
// app/layout.tsx (a Server Component)
import { ThemeToggle } from "./theme-toggle";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}
```

Apply the saved theme before paint the way you do now, for example with an inline script in `<head>`. The tide only runs when someone changes the theme, never on first load or during hydration.

## Options

All options are optional. Pass them to `useThemeTide(options)`, to `run(commit, options)` (which overrides the hook's options) or to `themeTide(commit, options)`.

| Option | Default | Range | What it does |
| --- | --- | --- | --- |
| `riseDuration` | `900` | 0 to 10000 ms | Time to rise from the bottom edge to the hold level. |
| `holdDuration` | `1000` | 0 to 10000 ms | Time the water stays at the hold level. The waves keep moving. |
| `finishDuration` | `700` | 0 to 10000 ms | Time to rise from the hold level past the top edge. |
| `holdLevel` | `0.6` | 0 to 1 | How full the screen is during the hold. `0.6` puts the mean waterline 40% down from the top. |
| `waveAmplitude` | `12` | 0 to 80 px | Height of a crest above the mean waterline. `0` gives a flat line. |
| `waveLength` | `240` | 40 to 4000 px | Distance between crests. |
| `waveSpeed` | `1` | 0 to 5 | Crests that pass a fixed point each second. |
| `respectReducedMotion` | `true` | boolean | Change the theme instantly when the user's system asks for reduced motion. |
| `nonce` | none | string | Nonce for the temporary `<style>` element, for pages with a Content Security Policy. |

A value outside its range, or of the wrong type, makes the call reject with a `RangeError` or `TypeError`. The theme still changes, instantly, so a bad option never breaks the toggle. To check options ahead of time, call `resolveThemeTideOptions(options)`, which throws the same errors.

## How it behaves

- **Coordinates.** The water is measured against the visible screen, not the document. It always starts at the bottom edge of the screen, however long the page is or however far it's scrolled. Scroll position and focus stay as they were.
- **Both directions.** Light to dark and dark to light both fill upward.
- **Completion.** At the end, the troughs pass above the top edge and the fill reaches past both sides, so none of the old theme is left showing.
- **Your commit runs once.** Every call runs your function exactly once, whether the tide animates, falls back, finishes early or fails.
- **Another change during a tide.** The running tide jumps to its end, then the new theme applies instantly. Changes always apply in the order they were made.
- **Scrolling or resizing during a tide.** The tide finishes right away. Otherwise you'd be looking at a still snapshot of the page.
- **Input.** Keyboard input reaches the focused control during a tide. A mouse or touch press finishes the tide right away. In Firefox the press also reaches the control under it. In Chromium it doesn't, because the browser sends pointer events to the root element during any View Transition, so the next press works as usual.
- **Instant fallback.** The theme changes with no animation when the browser lacks View Transitions or CSS masks, when reduced motion applies, when the tab is hidden, when every duration is `0`, or when another View Transition is already running (in browsers that report `document.activeViewTransition`).
- **Errors.** If your function throws or rejects, the returned promise rejects with that error. The animation and its temporary style are removed either way.
- **Unmounting.** Unmounting a component that started a tide doesn't stop the tide. Nothing stays behind once it ends.

The returned promise resolves to `{ animated: true }`, or to `{ animated: false, reason }`, where `reason` is one of `"reduced-motion"`, `"unsupported"`, `"hidden"`, `"zero-duration"`, `"busy"` or `"interrupted"`.

## API

```ts
themeTide(commit: () => void | Promise<void>, options?: ThemeTideOptions): Promise<ThemeTideResult>
useThemeTide(options?: ThemeTideOptions): { run, running, skip }
skipThemeTide(): void              // jump a running tide to its end
isThemeTideRunning(): boolean
subscribeThemeTide(listener: () => void): () => void
supportsThemeTide(): boolean       // false on the server
resolveThemeTideOptions(options?): ResolvedThemeTideOptions
themeTideDefaults, themeTideRanges
```

## Working with other View Transitions

The tide animates the page's root snapshot (`::view-transition-new(root)`). If your page gives other elements their own `view-transition-name`, those elements cross-fade on their own during a tide and aren't covered by the water. Starting another View Transition while a tide runs ends the tide early; the theme still changes.

## Browser support

The animation needs `document.startViewTransition`, `Element.animate` and CSS `mask-image`. Other browsers get the instant fallback.

Tested so far, through Playwright automation on Linux:

- **Chromium 156:** animation checked frame by frame from screenshots, at 1280 × 800 and in Pixel 7 emulation (412 × 839, device pixel ratio 2.625).
- **Firefox 157:** animation timing and mask geometry checked through computed styles, at 1280 × 800 and 390 × 844. Firefox screenshots taken through Playwright don't include the transition layer, so frames haven't been checked by eye in automation yet.
- **Safari and WebKit:** not tested yet.

Known limitation: on screens with a fractional device pixel ratio, Chromium sometimes leaves the top-right corner device pixel in the old theme during the last frames.

## Demo

```bash
npm install
npm run demo
```

Then open http://localhost:5179. The demo has light and dark controls, sliders for every option, long scrolling content and fixed elements.

## License

MIT
