# Usage and options

## The basics

`run` takes the function that changes your theme. That function has to update the page before it returns, or before its promise resolves. The browser takes its picture of the new theme right after.

```tsx
const tide = useThemeTide();
tide.run(() => document.documentElement.classList.toggle("dark"));
```

You don't need React for the animation itself:

```ts
import { themeTide } from "react-theme-tide";

themeTide(() => document.documentElement.classList.toggle("dark"));
```

Your function runs exactly once per call, whatever happens: the animation plays, the browser can't animate, the user scrolls, or your function throws.

## A theme setter you already have

Pass it in unchanged. Your storage key, your script that applies the saved theme before paint and your other controls keep working.

```tsx
<button type="button" onClick={() => tide.run(() => setAppearance("light"))}>Light</button>
<button type="button" onClick={() => tide.run(() => setAppearance("dark"))}>Dark</button>
```

Each control can call `useThemeTide()` on its own. They all share one `running` value.

## Theme in React state

React applies state updates later, so the page wouldn't have changed yet when the water starts. `flushSync` applies it right away:

```tsx
import { flushSync } from "react-dom";

tide.run(() => flushSync(() => setTheme("dark")));
```

The same goes for theme libraries that keep the theme in React context.

## Next.js App Router

Use the hook in a file that starts with `"use client"`:

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

Then render it anywhere, including from a Server Component such as `app/layout.tsx`.

Keep applying the saved theme before paint the way you do now. The tide only runs when someone changes the theme, never on first load.

Only the hook is a client module. Server code can import the rest, such as `themeTideDefaults`. On the server, `supportsThemeTide()` returns `false` and `themeTide` changes the theme with no animation.

## Options

Every option is optional. Pass them to `useThemeTide(options)`, to `run(commit, options)` for a single change, or to `themeTide(commit, options)`.

| Option | Default | Range | What it does |
| --- | --- | --- | --- |
| `riseDuration` | `900` | 0 to 10000 ms | Time to rise from the bottom to the pause. |
| `holdDuration` | `1000` | 0 to 10000 ms | How long the water pauses. The waves keep moving. |
| `finishDuration` | `700` | 0 to 10000 ms | Time to rise from the pause past the top. |
| `holdLevel` | `0.6` | 0 to 1 | How full the screen is during the pause. |
| `waveAmplitude` | `12` | 0 to 80 px | How tall the waves are. `0` gives a flat line. |
| `waveLength` | `240` | 40 to 4000 px | Distance from one crest to the next. |
| `waveSpeed` | `1` | 0 to 5 | Crests passing a point each second. |
| `respectReducedMotion` | `true` | true or false | Change instantly when the user prefers reduced motion. |
| `nonce` | none | text | Nonce for the short-lived `<style>` tag, if your site has a Content Security Policy. |

If an option is out of range or the wrong type, the theme still changes, with no animation, and the promise rejects with a `RangeError` or `TypeError`. Call `resolveThemeTideOptions(options)` to check your options ahead of time.

## API

```ts
themeTide(commit, options?): Promise<ThemeTideResult>
useThemeTide(options?): { run, running, skip }
skipThemeTide(): void          // jump to the end of a running tide
isThemeTideRunning(): boolean
subscribeThemeTide(listener): () => void
supportsThemeTide(): boolean   // false on the server
resolveThemeTideOptions(options?): ResolvedThemeTideOptions
themeTideDefaults
themeTideRanges
```

The promise resolves to `{ animated: true }` when the whole tide played. Otherwise it resolves to `{ animated: false, reason }`. `reason` is one of:

- `"reduced-motion"`: the user prefers reduced motion.
- `"unsupported"`: the browser can't run it, or the code ran on the server.
- `"hidden"`: the tab was in the background.
- `"zero-duration"`: every duration is `0`.
- `"busy"`: another page transition was running.
- `"interrupted"`: the tide ended early, after a scroll, a click, a resize or another theme change.

If your function throws, the promise rejects with that error.
