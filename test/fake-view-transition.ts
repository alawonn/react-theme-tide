import { vi } from "vitest";

// A small stand-in for document.startViewTransition and Element.animate that
// follows the spec's ordering: the update callback runs after a task, ready
// resolves after the callback, and finished resolves after the animation or a
// skip. The callback always runs, even when the transition is skipped.

export interface FakeTransition {
  skipped: boolean;
  finish: () => void;
}

export interface FakeAnimation {
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  playState: AnimationPlayState;
  cancel: () => void;
}

export function installFakeViewTransitions() {
  const transitions: FakeTransition[] = [];
  const animations: FakeAnimation[] = [];

  const animate = vi.fn(function (
    this: Element,
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions,
  ) {
    const animation: FakeAnimation = {
      keyframes,
      options,
      playState: "running",
      cancel() {
        animation.playState = "idle";
      },
    };
    animations.push(animation);
    return animation as unknown as Animation;
  });
  Element.prototype.animate = animate as unknown as Element["animate"];

  const start = vi.fn((update: () => unknown) => {
    let resolveFinished!: () => void;
    const finished = new Promise<void>((r) => (resolveFinished = r));
    const fake: FakeTransition = {
      skipped: false,
      finish: () => {
        for (const a of animations) if (a.playState === "running") a.playState = "finished";
        resolveFinished();
      },
    };
    transitions.push(fake);
    const updateCallbackDone = new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        Promise.resolve()
          .then(update)
          .then(() => resolve(), reject);
      }, 0);
    });
    const ready = updateCallbackDone.then(() => {
      if (fake.skipped) throw new DOMException("Skipped", "AbortError");
    });
    updateCallbackDone.catch(() => resolveFinished());
    ready.catch(() => undefined);
    return {
      updateCallbackDone,
      ready,
      finished,
      types: new Set(),
      skipTransition() {
        fake.skipped = true;
        updateCallbackDone.then(resolveFinished, resolveFinished);
      },
    } as unknown as ViewTransition;
  });
  document.startViewTransition =
    start as unknown as Document["startViewTransition"];

  return { start, animate, transitions, animations };
}

export function uninstallFakeViewTransitions() {
  // @ts-expect-error removing the fake
  delete document.startViewTransition;
  // @ts-expect-error removing the fake
  delete Element.prototype.animate;
}

export function setReducedMotion(reduce: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes("reduce"),
    media: query,
  })) as unknown as typeof window.matchMedia;
}

export const tick = () => new Promise((r) => setTimeout(r, 0));
export async function flush(times = 5) {
  for (let i = 0; i < times; i++) await tick();
}
