// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isThemeTideRunning,
  skipThemeTide,
  subscribeThemeTide,
  supportsThemeTide,
  themeTide,
} from "../src/index.js";
import {
  flush,
  installFakeViewTransitions,
  setReducedMotion,
  uninstallFakeViewTransitions,
} from "./fake-view-transition.js";

const root = () => document.documentElement;
const leftovers = () => ({
  styles: document.head.querySelectorAll("style").length,
  attribute: root().hasAttribute("data-theme-tide"),
  running: isThemeTideRunning(),
});
const clean = { styles: 0, attribute: false, running: false };

beforeEach(() => {
  vi.stubGlobal("CSS", { supports: () => true });
  setReducedMotion(false);
});

afterEach(() => {
  uninstallFakeViewTransitions();
  vi.unstubAllGlobals();
  root().className = "";
});

describe("themeTide", () => {
  it("animates, commits once and cleans up", async () => {
    const fake = installFakeViewTransitions();
    const commit = vi.fn(() => root().classList.add("dark"));
    const done = themeTide(commit);
    expect(isThemeTideRunning()).toBe(true);
    expect(document.head.querySelector("style")?.textContent).toContain(
      "::view-transition-new(root)",
    );
    await flush();
    expect(commit).toHaveBeenCalledTimes(1);
    const [animation] = fake.animations;
    expect(animation?.options.pseudoElement).toBe("::view-transition-new(root)");
    expect(animation?.options.duration).toBe(2600);
    fake.transitions[0]?.finish();
    await expect(done).resolves.toEqual({ animated: true });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(root().classList.contains("dark")).toBe(true);
    expect(leftovers()).toEqual(clean);
    expect(animation?.playState).toBe("idle");
  });

  it("changes the theme instantly without View Transitions", async () => {
    const commit = vi.fn();
    expect(supportsThemeTide()).toBe(false);
    await expect(themeTide(commit)).resolves.toEqual({
      animated: false,
      reason: "unsupported",
    });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(leftovers()).toEqual(clean);
  });

  it("changes the theme instantly under reduced motion", async () => {
    const fake = installFakeViewTransitions();
    setReducedMotion(true);
    const commit = vi.fn();
    await expect(themeTide(commit)).resolves.toEqual({
      animated: false,
      reason: "reduced-motion",
    });
    expect(fake.start).not.toHaveBeenCalled();
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("can ignore reduced motion when asked", async () => {
    const fake = installFakeViewTransitions();
    setReducedMotion(true);
    const done = themeTide(vi.fn(), { respectReducedMotion: false });
    await flush();
    fake.transitions[0]?.finish();
    await expect(done).resolves.toEqual({ animated: true });
  });

  it("changes the theme instantly when every duration is zero", async () => {
    installFakeViewTransitions();
    const commit = vi.fn();
    await expect(
      themeTide(commit, { riseDuration: 0, holdDuration: 0, finishDuration: 0 }),
    ).resolves.toEqual({ animated: false, reason: "zero-duration" });
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("still commits once when options are invalid, then rejects", async () => {
    const fake = installFakeViewTransitions();
    const commit = vi.fn();
    await expect(themeTide(commit, { holdLevel: 2 })).rejects.toThrow(RangeError);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(fake.start).not.toHaveBeenCalled();
  });

  it("rejects with the commit error and cleans up", async () => {
    installFakeViewTransitions();
    const error = new Error("storage failed");
    const commit = vi.fn(() => {
      throw error;
    });
    await expect(themeTide(commit)).rejects.toBe(error);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(leftovers()).toEqual(clean);
  });

  it("rejects with the commit error on the fallback path", async () => {
    const error = new Error("nope");
    const commit = vi.fn(() => Promise.reject(error));
    await expect(themeTide(commit)).rejects.toBe(error);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("finishes a running tide when a second change arrives, in order", async () => {
    const fake = installFakeViewTransitions();
    const order: string[] = [];
    const first = themeTide(() => void order.push("dark"));
    // The second click lands before the first commit has even run.
    const second = themeTide(() => void order.push("light"));
    const third = themeTide(() => void order.push("dark again"));
    await expect(second).resolves.toEqual({
      animated: false,
      reason: "interrupted",
    });
    await expect(third).resolves.toEqual({
      animated: false,
      reason: "interrupted",
    });
    await expect(first).resolves.toEqual({
      animated: false,
      reason: "interrupted",
    });
    expect(order).toEqual(["dark", "light", "dark again"]);
    expect(fake.start).toHaveBeenCalledTimes(1);
    expect(fake.transitions[0]?.skipped).toBe(true);
    expect(leftovers()).toEqual(clean);
  });

  it("skipThemeTide jumps to the end without a second commit", async () => {
    installFakeViewTransitions();
    const commit = vi.fn();
    const done = themeTide(commit);
    await flush();
    skipThemeTide();
    await expect(done).resolves.toEqual({
      animated: false,
      reason: "interrupted",
    });
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("rushes the water to the top when the page scrolls", async () => {
    const fake = installFakeViewTransitions();
    const done = themeTide(vi.fn());
    await flush();
    window.dispatchEvent(new Event("scroll"));
    window.dispatchEvent(new Event("scroll"));
    expect(fake.animations).toHaveLength(2);
    expect(fake.animations[0]?.playState).toBe("idle");
    expect(fake.animations[1]?.options.duration).toBe(200);
    expect(fake.transitions[0]?.skipped).toBe(false);
    fake.transitions[0]?.finish();
    await expect(done).resolves.toEqual({
      animated: false,
      reason: "interrupted",
    });
    expect(leftovers()).toEqual(clean);
  });

  it("ends the tide right away when the window resizes", async () => {
    const fake = installFakeViewTransitions();
    const done = themeTide(vi.fn());
    await flush();
    window.dispatchEvent(new Event("resize"));
    await expect(done).resolves.toEqual({
      animated: false,
      reason: "interrupted",
    });
    expect(fake.transitions[0]?.skipped).toBe(true);
  });

  describe("reversing", () => {
    function marked() {
      const button = document.createElement("button");
      button.setAttribute("data-theme-tide-reverse", "");
      button.getBoundingClientRect = () =>
        ({ left: 10, right: 50, top: 10, bottom: 50, width: 40, height: 40 }) as DOMRect;
      document.body.appendChild(button);
      return button;
    }
    const press = (x: number, y: number) =>
      window.dispatchEvent(new MouseEvent("pointerdown", { clientX: x, clientY: y, button: 0 }));
    const drainOf = (fake: ReturnType<typeof installFakeViewTransitions>) =>
      fake.animations.find((a) => a.options.duration === 200);

    afterEach(() => {
      document.body.replaceChildren();
    });

    it("drains, then lets the control change the theme under cover", async () => {
      const fake = installFakeViewTransitions();
      const order: string[] = [];
      const button = marked();
      let second: Promise<unknown> | undefined;
      button.addEventListener("click", () => {
        second = themeTide(() => void order.push("back"));
      });
      const first = themeTide(() => void order.push("forward"));
      await flush();

      press(20, 20);
      const hold = fake.animations.find((a) => a.options.duration === 60000);
      expect(drainOf(fake)).toBeDefined();
      expect(hold?.playState).toBe("running");
      await flush();
      expect(order).toEqual(["forward"]);

      drainOf(fake)?.complete();
      await flush();
      expect(order).toEqual(["forward", "back"]);
      expect(hold?.playState).toBe("idle");

      fake.transitions[0]?.finish();
      const reversed = { animated: false, reason: "reversed" };
      await expect(first).resolves.toEqual(reversed);
      await expect(second).resolves.toEqual(reversed);
      expect(leftovers()).toEqual(clean);
    });

    it("rushes when the press misses the marked control", async () => {
      const fake = installFakeViewTransitions();
      marked();
      const done = themeTide(vi.fn());
      await flush();
      press(200, 200);
      expect(fake.animations.some((a) => a.options.duration === 60000)).toBe(false);
      fake.transitions[0]?.finish();
      await expect(done).resolves.toEqual({ animated: false, reason: "interrupted" });
    });

    it("ignores a disabled control", async () => {
      const fake = installFakeViewTransitions();
      marked().disabled = true;
      const done = themeTide(vi.fn());
      await flush();
      press(20, 20);
      expect(fake.animations.some((a) => a.options.duration === 60000)).toBe(false);
      fake.transitions[0]?.finish();
      await done;
    });

    it("lets go if the control's handler never changes the theme", async () => {
      const fake = installFakeViewTransitions();
      marked();
      const done = themeTide(vi.fn());
      await flush();
      press(20, 20);
      drainOf(fake)?.complete();
      await new Promise((resolve) => setTimeout(resolve, 80));
      expect(fake.animations.find((a) => a.options.duration === 60000)?.playState).toBe("idle");
      fake.transitions[0]?.finish();
      await expect(done).resolves.toEqual({ animated: false, reason: "reversed" });
      expect(leftovers()).toEqual(clean);
    });

    it("still changes the theme back if the transition is skipped mid-drain", async () => {
      const fake = installFakeViewTransitions();
      const button = marked();
      const back = vi.fn();
      button.addEventListener("click", () => void themeTide(back));
      const done = themeTide(vi.fn());
      await flush();
      press(20, 20);
      fake.transitions[0]?.finish();
      await expect(done).resolves.toEqual({ animated: false, reason: "reversed" });
      expect(back).toHaveBeenCalledTimes(1);
      expect(leftovers()).toEqual(clean);
    });
  });

  it("leaves another page transition alone", async () => {
    const fake = installFakeViewTransitions();
    Object.defineProperty(document, "activeViewTransition", {
      configurable: true,
      value: {},
    });
    const commit = vi.fn();
    await expect(themeTide(commit)).resolves.toEqual({
      animated: false,
      reason: "busy",
    });
    expect(fake.start).not.toHaveBeenCalled();
    // @ts-expect-error removing the stub
    delete document.activeViewTransition;
  });

  it("tells subscribers when a tide starts and ends", async () => {
    const fake = installFakeViewTransitions();
    const states: boolean[] = [];
    const unsubscribe = subscribeThemeTide(() => states.push(isThemeTideRunning()));
    const done = themeTide(vi.fn());
    await flush();
    fake.transitions[0]?.finish();
    await done;
    unsubscribe();
    expect(states).toEqual([true, false]);
  });

  it("uses the nonce for the temporary style", async () => {
    const fake = installFakeViewTransitions();
    const done = themeTide(vi.fn(), { nonce: "abc" });
    expect(document.head.querySelector("style")?.nonce).toBe("abc");
    await flush();
    fake.transitions[0]?.finish();
    await done;
  });
});
