# How it works

When you change the theme, the browser takes a picture of the page as it is. Your code switches the theme. Then the new page is revealed through a mask shaped like water, rising from the bottom edge of the screen.

What you see under the water is your real page in the new theme. Text, borders and buttons all change as the water passes them.

On the web, this uses the browser's View Transitions API and a CSS mask. There's no copy of your page, no screenshot library and no React re-render on every frame. A small `<style>` tag is added while the water moves and removed when it's done.

## The timing

With the default options:

1. The water rises from the bottom to 60% of the screen in 0.9 s.
2. It stays there for 1 s. The waves keep moving.
3. It rises past the top in 0.7 s.

Both directions work the same way: light to dark and dark to light both fill upward.

The water is measured against the screen, not the page. It always starts at the bottom of what you can see, however long the page is or however far down you've scrolled. Your scroll position and focus stay where they were.

At the end, the waves go past the top and both sides, so none of the old theme is left on screen.

## What happens if the user does something mid-tide

- **Scrolls:** the water rushes to the top in about 0.2 s, and the page ends up where they scrolled. The old theme is only a picture, so it can't scroll with the page.
- **Clicks or taps:** same as scrolling. In Firefox the click also reaches whatever is under it. Chrome and other Chromium browsers send clicks to the page root during any View Transition, so the click only speeds up the water. The next click works as usual.
- **Types:** keys reach the focused control as normal.
- **Resizes the window:** the tide ends right away, because the picture no longer fits.
- **Presses the button for the theme they just left:** the water drains back down, in 0.2 s unless you set `reverseDuration`, then the page is back on that theme. This needs the `data-theme-tide-reverse` attribute on that button ([see usage](usage.md#going-back-mid-tide)). It works with a click, a tap or the keyboard.
- **Changes the theme some other way:** the current tide jumps to its end, then the new theme applies instantly. Changes always apply in the order they were made.

If the component that started a tide unmounts, the tide keeps going. Nothing is left behind once it ends.

## When the theme changes instantly

There's no animation when:

- the user prefers reduced motion (unless you set `respectReducedMotion: false`)
- the browser doesn't have View Transitions or CSS masks
- the tab is in the background
- every duration is `0`
- another View Transition is already running, in browsers that report it with `document.activeViewTransition`

## Other View Transitions on your page

The water covers the page's root snapshot. If some elements on your page have their own `view-transition-name`, they fade on their own during a tide instead of sitting under the water. Starting another View Transition during a tide ends the tide early. The theme still changes.

## In React Native

Apps don't have View Transitions, so the tide works the other way around. It takes a picture of everything inside `ThemeTideRoot` with Skia and lays it on top. Your function changes the theme underneath, and the picture is cut away below a wavy line that rises up the screen. It looks the same as on the web, and what's under the water is your real app in the new theme.

The cut-out is drawn on the UI thread with Reanimated, so a busy JavaScript thread doesn't slow the water down.

Mid-tide it behaves like the web, with one difference: touches reach your app. A tap or a scroll makes the water rush to the top, and the tap still lands on whatever is under the finger. Pressing a button inside `ThemeTideReverse` drains the water instead. Rotating the device or sending the app to the background ends the tide at once.

The picture only covers `ThemeTideRoot`. The status bar, the navigation bar and anything in its own window, such as a React Native `Modal`, switch to the new theme straight away. Video, maps and camera previews might come out blank in the picture.

## What it needs

On the web, the animation needs `document.startViewTransition`, `Element.animate` and CSS `mask-image`. Other browsers get the instant change. In apps, it needs Skia and Reanimated.

## Known issue

On screens with a fractional pixel ratio, Chromium sometimes leaves the very top-right pixel in the old theme for the last few frames.
