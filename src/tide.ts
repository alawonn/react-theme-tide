import {
  resolveThemeTideOptions,
  totalDuration,
  type ResolvedThemeTideOptions,
  type ThemeTideOptions,
} from "./options.js";
import {
  maskDeclarations,
  drainKeyframes,
  maskKeyframes,
  rushKeyframes,
  type Viewport,
} from "./wave.js";

/** Applies the new theme to the DOM. Called exactly once per themeTide call. */
export type ThemeTideCommit = () => void | Promise<void>;

export type ThemeTideInstantReason =
  | "reduced-motion"
  | "unsupported"
  | "hidden"
  | "zero-duration"
  | "busy"
  | "interrupted"
  | "reversed";

export type ThemeTideResult =
  | { animated: true }
  | { animated: false; reason: ThemeTideInstantReason };

const attribute = "data-theme-tide";
const pseudo = "::view-transition-new(root)";
/** How long the water takes to reach the top, or drain, after a press. */
const rushDuration = 200;
/** Marks a control that takes the page back to the theme it's leaving. */
const reverseAttribute = "data-theme-tide-reverse";
/** Upper limit on how long a drained tide waits for the host's theme change. */
const reversalHoldLimit = 60000;
/** Time for a click handler that calls themeTide after an async step. */
const reversalGrace = 50;

interface Reversal {
  /** Resolves once the water has left the screen. */
  drained: Promise<void>;
  /** Theme changes the host made during the reversal. */
  accepted: Promise<unknown>[];
}

interface Active {
  transition: ViewTransition;
  reversal?: Reversal;
}

let active: Active | null = null;
// Commits run one after another, in call order, even when they are async.
let commitChain: Promise<unknown> = Promise.resolve();
const listeners = new Set<() => void>();

function setActive(next: Active | null) {
  active = next;
  for (const listener of listeners) listener();
}

/** True while a tide animation is on screen. */
export function isThemeTideRunning(): boolean {
  return active !== null;
}

/** Calls `listener` when a tide starts or ends. Returns an unsubscribe function. */
export function subscribeThemeTide(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Jumps a running tide to its end. The theme commit still happens once. */
export function skipThemeTide(): void {
  active?.transition.skipTransition();
}

/** True when this browser can animate a tide. Always false on the server. */
export function supportsThemeTide(): boolean {
  return (
    typeof document !== "undefined" &&
    typeof document.startViewTransition === "function" &&
    typeof Element.prototype.animate === "function" &&
    typeof CSS !== "undefined" &&
    CSS.supports("mask-image", "linear-gradient(#000, #000)")
  );
}

function prefersReducedMotion(): boolean {
  return (
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function once(commit: ThemeTideCommit): () => Promise<void> {
  let result: Promise<void> | undefined;
  return () => {
    if (!result) {
      const run = commitChain.then(() => commit());
      commitChain = run.catch(() => undefined);
      result = run;
    }
    return result;
  };
}

function instant(
  commit: () => Promise<void>,
  reason: ThemeTideInstantReason,
): Promise<ThemeTideResult> {
  return commit().then(() => ({ animated: false, reason }));
}

/**
 * Runs `commit` to change the theme and reveals the new theme with a rising
 * water fill. Falls back to an instant change when the browser can't animate
 * it, the user prefers reduced motion, or another tide is running.
 *
 * `commit` must update the DOM before it returns or before its promise
 * resolves. With React state, wrap the update in `flushSync`.
 */
export function themeTide(
  commit: ThemeTideCommit,
  options?: ThemeTideOptions,
): Promise<ThemeTideResult> {
  const run = once(commit);
  let resolved: ResolvedThemeTideOptions;
  try {
    resolved = resolveThemeTideOptions(options);
  } catch (error) {
    // A bad option never blocks the theme change.
    return run().then(() => Promise.reject(error));
  }
  if (!supportsThemeTide()) return instant(run, "unsupported");
  if (active?.reversal) {
    // What's under the water is live, so the theme has to wait until the
    // water is gone or the wave would vanish mid-drain.
    const done = active.reversal.drained.then(run);
    active.reversal.accepted.push(done.catch(() => undefined));
    return done.then(() => ({ animated: false, reason: "reversed" }));
  }
  if (active) {
    // A second change during a tide finishes the first one, then applies
    // the new theme without animation once the first commit has run.
    const previous = active.transition.updateCallbackDone.catch(() => undefined);
    skipThemeTide();
    return previous.then(() => instant(run, "interrupted"));
  }
  if (document.activeViewTransition) return instant(run, "busy");
  if (resolved.respectReducedMotion && prefersReducedMotion()) {
    return instant(run, "reduced-motion");
  }
  if (document.visibilityState === "hidden") return instant(run, "hidden");
  if (totalDuration(resolved) === 0) return instant(run, "zero-duration");
  return animate(run, resolved);
}

function viewportSize(): Viewport {
  return { width: window.innerWidth, height: window.innerHeight };
}

/** Size of the new-page snapshot, which can differ from innerHeight on mobile. */
function snapshotSize(fallback: Viewport): Viewport {
  const style = getComputedStyle(document.documentElement, pseudo);
  const width = parseFloat(style.width);
  const height = parseFloat(style.height);
  return width > 0 && height > 0 ? { width, height } : fallback;
}

function isUsableControl(element: Element): element is HTMLElement {
  return element instanceof HTMLElement && !element.matches(":disabled");
}

/**
 * Finds a marked control under the pointer. Chromium hit-tests to the root
 * element during a transition, so this compares against the live layout.
 */
function reverseControlAt(x: number, y: number): HTMLElement | null {
  for (const element of document.querySelectorAll(`[${reverseAttribute}]`)) {
    const box = element.getBoundingClientRect();
    if (
      isUsableControl(element) &&
      box.width > 0 &&
      box.height > 0 &&
      x >= box.left &&
      x <= box.right &&
      y >= box.top &&
      y <= box.bottom
    ) {
      return element;
    }
  }
  return null;
}

/** Drops the click that follows a press, since the tide clicks the control itself. */
function swallowNextClick() {
  const stop = () => {
    window.removeEventListener("click", eat, { capture: true });
    window.removeEventListener("pointerdown", stop, { capture: true });
    window.removeEventListener("pointercancel", stop, { capture: true });
    window.removeEventListener("keydown", stop, { capture: true });
  };
  const eat = (event: MouseEvent) => {
    if (!event.isTrusted) return;
    event.stopPropagation();
    event.preventDefault();
    stop();
  };
  window.addEventListener("click", eat, { capture: true });
  window.addEventListener("pointerdown", stop, { capture: true });
  window.addEventListener("pointercancel", stop, { capture: true });
  window.addEventListener("keydown", stop, { capture: true });
}

function rules(options: ResolvedThemeTideOptions, viewport: Viewport): string {
  const root = `:root[${attribute}]`;
  return [
    `${root}::view-transition { pointer-events: none; }`,
    `${root}::view-transition-old(root), ${root}${pseudo} { animation: none; mix-blend-mode: normal; }`,
    `${root}${pseudo} { ${maskDeclarations(options, viewport)}; }`,
  ].join("\n");
}

async function animate(
  run: () => Promise<void>,
  options: ResolvedThemeTideOptions,
): Promise<ThemeTideResult> {
  const root = document.documentElement;
  const style = document.createElement("style");
  if (options.nonce) style.nonce = options.nonce;
  style.textContent = rules(options, viewportSize());
  document.head.appendChild(style);
  root.setAttribute(attribute, "");

  let transition: ViewTransition;
  try {
    transition = document.startViewTransition(run);
  } catch {
    style.remove();
    root.removeAttribute(attribute);
    return instant(run, "unsupported");
  }
  const current: Active = { transition };
  setActive(current);

  let animation: Animation | undefined;
  let viewport = viewportSize();
  let interrupted = false;
  const interrupt = () => {
    interrupted = true;
    transition.skipTransition();
  };
  // The old page is a still snapshot, so it can't scroll. On a scroll or a
  // pointer press the water rushes to the top in rushDuration instead.
  // Chromium sends pointer events to the root element during a transition,
  // so controls can't receive them until the tide ends.
  const rush = () => {
    if (interrupted || !animation) return;
    const from = Number(animation.currentTime ?? 0);
    if (totalDuration(options) - from <= rushDuration) return;
    interrupted = true;
    const next = root.animate(rushKeyframes(options, viewport, from, rushDuration), {
      duration: rushDuration,
      easing: "linear",
      fill: "forwards",
      pseudoElement: pseudo,
    });
    animation.cancel();
    animation = next;
  };

  // A press on a marked control drains the water, then clicks that control so
  // the host's own handler changes the theme while the old page covers it.
  let reversalDone: Promise<void> | undefined;
  const reverse = (control: HTMLElement): boolean => {
    if (interrupted || !animation) return false;
    interrupted = true;
    const from = Number(animation.currentTime ?? 0);
    // Keeps the transition open after the drain until the theme has changed.
    const hold = root.animate(
      { opacity: [1, 1] },
      { duration: reversalHoldLimit, pseudoElement: pseudo },
    );
    const drain = root.animate(drainKeyframes(options, viewport, from, rushDuration), {
      duration: rushDuration,
      easing: "linear",
      fill: "forwards",
      pseudoElement: pseudo,
    });
    animation.cancel();
    animation = drain;
    let markDrained!: () => void;
    const reversal: Reversal = {
      drained: new Promise<void>((resolve) => (markDrained = resolve)),
      accepted: [],
    };
    current.reversal = reversal;
    reversalDone = (async () => {
      await Promise.race([
        drain.finished.catch(() => undefined),
        transition.finished.catch(() => undefined),
      ]);
      markDrained();
      control.click();
      if (reversal.accepted.length === 0) {
        await new Promise((resolve) => setTimeout(resolve, reversalGrace));
      }
      await Promise.all(reversal.accepted);
      hold.cancel();
    })();
    return true;
  };

  const press = (event: PointerEvent) => {
    const control =
      event.button === 0 ? reverseControlAt(event.clientX, event.clientY) : null;
    if (control && reverse(control)) swallowNextClick();
    else rush();
  };

  // Keyboard presses do reach the control, as a click with no pointer detail.
  const keyboardClick = (event: MouseEvent) => {
    if (!event.isTrusted || event.detail !== 0) return;
    const control = (event.target as Element).closest?.(`[${reverseAttribute}]`);
    if (!control || !isUsableControl(control) || !reverse(control)) return;
    event.stopPropagation();
    event.preventDefault();
  };

  const ready = transition.ready.then(
    () => {
      viewport = snapshotSize(viewport);
      animation = root.animate(maskKeyframes(options, viewport), {
        duration: totalDuration(options),
        easing: "linear",
        fill: "forwards",
        pseudoElement: pseudo,
      });
      window.addEventListener("scroll", rush, { passive: true });
      window.addEventListener("pointerdown", press, { capture: true });
      window.addEventListener("click", keyboardClick, { capture: true });
      // A resize changes the snapshot's size, so end the tide right away.
      window.addEventListener("resize", interrupt);
    },
    () => undefined,
  );

  let failure: { error: unknown } | undefined;
  try {
    await transition.updateCallbackDone;
  } catch (error) {
    failure = { error };
  }
  await ready;
  await transition.finished.catch(() => undefined);
  await reversalDone;
  // A skipped transition still calls its update callback; `run` keeps this
  // safe if a browser ever doesn't.
  if (!failure) await run().catch((error: unknown) => (failure = { error }));

  const completed = !interrupted && animation?.playState === "finished";
  window.removeEventListener("scroll", rush);
  window.removeEventListener("pointerdown", press, { capture: true });
  window.removeEventListener("click", keyboardClick, { capture: true });
  window.removeEventListener("resize", interrupt);
  animation?.cancel();
  style.remove();
  root.removeAttribute(attribute);
  setActive(null);

  if (failure) throw failure.error;
  if (reversalDone) return { animated: false, reason: "reversed" };
  return completed ? { animated: true } : { animated: false, reason: "interrupted" };
}
