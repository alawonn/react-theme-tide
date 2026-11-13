import {
  resolveThemeTideOptions,
  totalDuration,
  type ResolvedThemeTideOptions,
  type ThemeTideOptions,
} from "../options.js";
import type {
  ThemeTideCommit,
  ThemeTideInstantReason,
  ThemeTideResult,
} from "../tide.js";
import { waterlineAt, type Viewport } from "../wave.js";

// The native tide is the web one turned inside out. There's no View
// Transition, so the surface takes a still picture of the app and lays it on
// top. The theme changes underneath, live, and the picture is cut away below
// the waterline. To the eye that's the same water rising from the bottom.
// This module is the timing and bookkeeping. It never imports React Native,
// so it runs in plain unit tests; ThemeTideRoot supplies the surface.

export interface TidePlan {
  /** Waterline before the rise, with the whole wave below the bottom edge. */
  start: number;
  hold: number;
  /** Waterline once every trough is above the top edge. */
  end: number;
  riseDuration: number;
  holdDuration: number;
  finishDuration: number;
  waveAmplitude: number;
  waveLength: number;
  waveSpeed: number;
}

/** What ThemeTideRoot provides. */
export interface TideSurface {
  /** Captures the app and lays the picture on top. Resolves false if it can't. */
  cover(plan: TidePlan): Promise<boolean>;
  /** Size of the root view, in points. */
  size(): Viewport;
  /** Waits until the host's theme change has had time to render. */
  settle(): Promise<void>;
  /** Plays the rise, hold and finish. Calls `done` only if it runs to the end. */
  rise(plan: TidePlan, done: () => void): void;
  /** Moves the waterline to `line` in `duration` ms. Calls `done` unless replaced. */
  travel(line: number, duration: number, done: () => void): void;
  /** Takes the picture away and stops the animation. */
  uncover(): void;
  reducedMotion(): boolean;
  hidden(): boolean;
}

type Outcome = "finished" | "interrupted" | "reversed";

/** How long the water takes to reach the top after a touch elsewhere. */
export const rushDuration = 200;
/** Time for a press handler that calls themeTide after an async step. */
const reversalGrace = 50;
/** Longest a drained tide waits for the finger to lift. */
const releaseLimit = 10000;

interface Reversal {
  drained: Promise<void>;
  markDrained: () => void;
  accepted: Promise<unknown>[];
}

interface Active {
  /** cover: picture going on; tide: rise, hold, finish; moving: rush or drain. */
  stage: "cover" | "tide" | "moving" | "done";
  plan: TidePlan;
  options: ResolvedThemeTideOptions;
  startedAt: number;
  finish: (outcome: Outcome) => void;
  /** Resolves once this tide's own commit has run. */
  committed: Promise<void>;
  reversal?: Reversal;
}

let surface: TideSurface | null = null;
let active: Active | null = null;
let commitChain: Promise<unknown> = Promise.resolve();
const listeners = new Set<() => void>();
/** Set by a reverse control's touch so the root doesn't also rush. */
let pendingReverse = false;
let fingerDown = false;
let releaseWaiters: (() => void)[] = [];

const now = () =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

function setActive(next: Active | null) {
  active = next;
  for (const listener of listeners) listener();
}

/** Connects the surface from ThemeTideRoot. Returns a disconnect function. */
export function attachSurface(next: TideSurface): () => void {
  surface = next;
  return () => {
    if (surface !== next) return;
    active?.finish("interrupted");
    surface = null;
  };
}

/** True while a tide is on screen. */
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
  active?.finish("interrupted");
}

/** True once a ThemeTideRoot is mounted. */
export function supportsThemeTide(): boolean {
  return surface !== null;
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs `commit` to change the theme and reveals the new theme with a rising
 * water fill. Needs a mounted ThemeTideRoot; without one the change is instant.
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
  const target = surface;
  if (!target) return instant(run, "unsupported");
  if (active?.reversal) {
    // The theme has to wait until the water is gone, or the wave would
    // vanish mid-drain.
    const done = active.reversal.drained.then(run);
    active.reversal.accepted.push(done.catch(() => undefined));
    return done.then(() => ({ animated: false, reason: "reversed" }));
  }
  if (active) {
    // A second change finishes the running tide, then applies instantly
    // once the first commit has run.
    const previous = active.committed;
    active.finish("interrupted");
    return previous.then(() => instant(run, "interrupted"));
  }
  if (resolved.respectReducedMotion && target.reducedMotion()) {
    return instant(run, "reduced-motion");
  }
  if (target.hidden()) return instant(run, "hidden");
  if (totalDuration(resolved) === 0) return instant(run, "zero-duration");
  return animate(target, run, resolved);
}

function planFor(options: ResolvedThemeTideOptions, viewport: Viewport): TidePlan {
  return {
    start: waterlineAt(0, options, viewport.height),
    hold: viewport.height * (1 - options.holdLevel),
    end: waterlineAt(totalDuration(options), options, viewport.height),
    riseDuration: options.riseDuration,
    holdDuration: options.holdDuration,
    finishDuration: options.finishDuration,
    waveAmplitude: options.waveAmplitude,
    waveLength: options.waveLength,
    waveSpeed: options.waveSpeed,
  };
}

async function animate(
  target: TideSurface,
  run: () => Promise<void>,
  options: ResolvedThemeTideOptions,
): Promise<ThemeTideResult> {
  let resolveEnded!: (outcome: Outcome) => void;
  const ended = new Promise<Outcome>((resolve) => (resolveEnded = resolve));
  let markCommitted!: () => void;
  const current: Active = {
    stage: "cover",
    plan: planFor(options, target.size()),
    options,
    startedAt: 0,
    finish: (outcome) => {
      if (current.stage === "done") return;
      current.stage = "done";
      // Theme changes queued behind a drain must still run.
      current.reversal?.markDrained();
      resolveEnded(outcome);
    },
    committed: new Promise<void>((resolve) => (markCommitted = resolve)),
  };
  setActive(current);

  const covered = await target.cover(current.plan).catch(() => false);
  if (!covered) {
    target.uncover();
    setActive(null);
    markCommitted();
    return instant(run, "unsupported");
  }

  let failure: { error: unknown } | undefined;
  try {
    await run();
  } catch (error) {
    failure = { error };
  }
  markCommitted();
  if (failure) current.finish("interrupted");
  // The host's state change needs a frame or two to reach the screen.
  if (current.stage === "cover") await target.settle();
  if (current.stage === "cover") {
    current.stage = "tide";
    current.startedAt = now();
    target.rise(current.plan, () => {
      if (current.stage === "tide") current.finish("finished");
    });
  }

  const outcome = await ended;
  target.uncover();
  setActive(null);
  if (failure) throw failure.error;
  if (outcome === "finished") return { animated: true };
  return { animated: false, reason: outcome };
}

function rush(current: Active, target: TideSurface) {
  current.stage = "moving";
  target.travel(current.plan.end, rushDuration, () => current.finish("interrupted"));
}

/** A touch anywhere on the root. The picture can't scroll, so the water rushes up. */
export function rootTouched(): void {
  fingerDown = true;
  if (pendingReverse) {
    pendingReverse = false;
    return;
  }
  const current = active;
  const target = surface;
  if (!current || !target || current.stage !== "tide") return;
  const elapsed = now() - current.startedAt;
  if (totalDuration(current.options) - elapsed <= rushDuration) return;
  rush(current, target);
}

/** Every finger has left the root. */
export function rootReleased(): void {
  fingerDown = false;
  const waiters = releaseWaiters;
  releaseWaiters = [];
  for (const waiter of waiters) waiter();
}

function released(): Promise<void> {
  if (!fingerDown) return Promise.resolve();
  return Promise.race([
    new Promise<void>((resolve) => releaseWaiters.push(resolve)),
    delay(releaseLimit),
  ]);
}

/**
 * A touch on a ThemeTideReverse control. The water drains, then the control's
 * own press handler changes the theme back while the picture covers the app.
 */
export function reverseTouched(): void {
  pendingReverse = true;
  // Cleared on the next tick in case the control sits outside the root.
  setTimeout(() => (pendingReverse = false), 0);
  fingerDown = true;
  const current = active;
  const target = surface;
  if (!current || !target || current.stage !== "tide") return;
  current.stage = "moving";
  let markDrained!: () => void;
  const reversal: Reversal = {
    drained: new Promise<void>((resolve) => (markDrained = resolve)),
    markDrained: () => markDrained(),
    accepted: [],
  };
  current.reversal = reversal;
  target.travel(current.plan.start, current.options.reverseDuration, () => {
    void (async () => {
      markDrained();
      await released();
      if (reversal.accepted.length === 0) await delay(reversalGrace);
      if (current.stage === "done") return;
      if (reversal.accepted.length === 0) {
        // The press never became a theme change, so the new theme is still
        // underneath. Let the water rise the rest of the way.
        current.reversal = undefined;
        rush(current, target);
        return;
      }
      await Promise.all(reversal.accepted);
      await target.settle();
      current.finish("reversed");
    })();
  });
}

/** The root view changed size. The picture no longer fits, so end the tide. */
export function rootResized(): void {
  active?.finish("interrupted");
}
