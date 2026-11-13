import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  attachSurface,
  isThemeTideRunning,
  reverseTouched,
  rootReleased,
  rootResized,
  rootTouched,
  rushDuration,
  skipThemeTide,
  supportsThemeTide,
  themeTide,
  type TidePlan,
  type TideSurface,
} from "../src/native/engine.js";

interface Move {
  line: number;
  duration: number;
  done: () => void;
}

class FakeSurface implements TideSurface {
  covered = false;
  canCover = true;
  reduced = false;
  background = false;
  rises: { plan: TidePlan; done: () => void }[] = [];
  moves: Move[] = [];
  uncovers = 0;
  size = () => ({ width: 400, height: 800 });
  async cover() {
    if (!this.canCover) return false;
    this.covered = true;
    return true;
  }
  settle = () => Promise.resolve();
  rise(plan: TidePlan, done: () => void) {
    this.rises.push({ plan, done });
  }
  travel(line: number, duration: number, done: () => void) {
    this.moves.push({ line, duration, done });
  }
  uncover() {
    this.covered = false;
    this.uncovers++;
  }
  reducedMotion = () => this.reduced;
  hidden = () => this.background;
}

const wait = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

let surface: FakeSurface;
let detach: () => void;

beforeEach(() => {
  surface = new FakeSurface();
  detach = attachSurface(surface);
});

afterEach(async () => {
  skipThemeTide();
  await wait(70);
  rootReleased();
  detach();
});

describe("native themeTide", () => {
  it("covers, commits once, rises and uncovers", async () => {
    const commit = vi.fn();
    const done = themeTide(commit);
    expect(isThemeTideRunning()).toBe(true);
    await wait();
    expect(surface.covered).toBe(true);
    expect(commit).toHaveBeenCalledTimes(1);
    const [rise] = surface.rises;
    expect(rise?.plan).toMatchObject({ hold: 320, end: -15, start: 814 });
    rise?.done();
    await expect(done).resolves.toEqual({ animated: true });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(surface.covered).toBe(false);
    expect(isThemeTideRunning()).toBe(false);
  });

  it("changes instantly without a ThemeTideRoot", async () => {
    detach();
    expect(supportsThemeTide()).toBe(false);
    const commit = vi.fn();
    await expect(themeTide(commit)).resolves.toEqual({
      animated: false,
      reason: "unsupported",
    });
    expect(commit).toHaveBeenCalledTimes(1);
    detach = attachSurface(surface);
  });

  it("changes instantly when the picture can't be taken", async () => {
    surface.canCover = false;
    const commit = vi.fn();
    await expect(themeTide(commit)).resolves.toEqual({
      animated: false,
      reason: "unsupported",
    });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(isThemeTideRunning()).toBe(false);
  });

  it("respects reduced motion, background and zero durations", async () => {
    surface.reduced = true;
    await expect(themeTide(() => {})).resolves.toMatchObject({ reason: "reduced-motion" });
    const animated = themeTide(() => {}, { respectReducedMotion: false });
    await wait();
    expect(surface.rises).toHaveLength(1);
    skipThemeTide();
    await expect(animated).resolves.toMatchObject({ reason: "interrupted" });
    surface.rises = [];
    surface.reduced = false;
    surface.background = true;
    await expect(themeTide(() => {})).resolves.toMatchObject({ reason: "hidden" });
    surface.background = false;
    await expect(
      themeTide(() => {}, { riseDuration: 0, holdDuration: 0, finishDuration: 0 }),
    ).resolves.toMatchObject({ reason: "zero-duration" });
    expect(surface.rises).toHaveLength(0);
  });

  it("commits once and rejects on a bad option", async () => {
    const commit = vi.fn();
    await expect(themeTide(commit, { holdLevel: 2 })).rejects.toThrow(RangeError);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("uncovers and rethrows when the commit throws", async () => {
    const done = themeTide(() => {
      throw new Error("boom");
    });
    await expect(done).rejects.toThrow("boom");
    expect(surface.covered).toBe(false);
    expect(isThemeTideRunning()).toBe(false);
  });

  it("finishes the running tide when another change starts", async () => {
    const first = vi.fn();
    const second = vi.fn();
    const one = themeTide(first);
    await wait();
    const two = themeTide(second);
    await expect(one).resolves.toEqual({ animated: false, reason: "interrupted" });
    await expect(two).resolves.toEqual({ animated: false, reason: "interrupted" });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(first.mock.invocationCallOrder[0]).toBeLessThan(second.mock.invocationCallOrder[0]!);
  });

  it("runs the commit even when skipped while covering", async () => {
    const commit = vi.fn();
    const done = themeTide(commit);
    skipThemeTide();
    await expect(done).resolves.toEqual({ animated: false, reason: "interrupted" });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(surface.rises).toHaveLength(0);
  });

  it("rushes to the top on a touch", async () => {
    const done = themeTide(() => {});
    await wait();
    rootTouched();
    const [move] = surface.moves;
    expect(move).toMatchObject({ line: -15, duration: rushDuration });
    move?.done();
    await expect(done).resolves.toEqual({ animated: false, reason: "interrupted" });
  });

  it("ends at once on a resize", async () => {
    const done = themeTide(() => {});
    await wait();
    rootResized();
    await expect(done).resolves.toEqual({ animated: false, reason: "interrupted" });
    expect(surface.covered).toBe(false);
  });

  describe("going back", () => {
    it("drains, then applies the control's own change under cover", async () => {
      const forward = vi.fn();
      const back = vi.fn();
      const tide = themeTide(forward, { reverseDuration: 300 });
      await wait();
      reverseTouched();
      rootTouched();
      expect(surface.moves).toHaveLength(1);
      const [drain] = surface.moves;
      expect(drain).toMatchObject({ line: 814, duration: 300 });
      // The control's onPress fires when the finger lifts.
      const backResult = themeTide(back);
      await wait();
      expect(back).not.toHaveBeenCalled();
      drain?.done();
      rootReleased();
      await expect(backResult).resolves.toEqual({ animated: false, reason: "reversed" });
      await expect(tide).resolves.toEqual({ animated: false, reason: "reversed" });
      expect(forward).toHaveBeenCalledTimes(1);
      expect(back).toHaveBeenCalledTimes(1);
      expect(surface.covered).toBe(false);
    });

    it("rises the rest of the way when the press doesn't change the theme", async () => {
      const tide = themeTide(() => {});
      await wait();
      reverseTouched();
      rootTouched();
      surface.moves[0]?.done();
      rootReleased();
      await wait(80);
      const rush = surface.moves[1];
      expect(rush).toMatchObject({ line: -15, duration: rushDuration });
      rush?.done();
      await expect(tide).resolves.toEqual({ animated: false, reason: "interrupted" });
    });

    it("still runs a queued change when skipped mid-drain", async () => {
      const back = vi.fn();
      const tide = themeTide(() => {});
      await wait();
      reverseTouched();
      const backResult = themeTide(back);
      skipThemeTide();
      await expect(tide).resolves.toEqual({ animated: false, reason: "interrupted" });
      await expect(backResult).resolves.toMatchObject({ reason: "reversed" });
      expect(back).toHaveBeenCalledTimes(1);
    });

    it("does nothing outside a tide", () => {
      reverseTouched();
      expect(surface.moves).toHaveLength(0);
    });
  });
});
