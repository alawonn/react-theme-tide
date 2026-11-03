import { expect, test, type Page } from "@playwright/test";
import {
  allPixels,
  computedWaterline,
  finish,
  isDark,
  isLight,
  pixelBoundary,
  seek,
  startPaused,
  waveColumns,
} from "./helpers.js";

// Screenshots only include the transition layer in Chromium.
const pixels = (browserName: string) => browserName === "chromium";
const rise = 900;
const hold = 1000;
const total = 2600;
const button = { x: 0, y: 0, width: 160, height: 60 };

async function open(page: Page, theme: "light" | "dark" = "light") {
  await page.goto("/fixture/");
  if (theme === "dark") {
    await page.evaluate(() => document.documentElement.classList.add("dark"));
  }
}

async function leftovers(page: Page) {
  return page.evaluate(() => ({
    styles: document.head.querySelectorAll("style").length,
    attribute: document.documentElement.hasAttribute("data-theme-tide"),
    animations: document.getAnimations().length,
    transition: Boolean((document as { activeViewTransition?: unknown }).activeViewTransition),
  }));
}
const clean = { styles: 1, attribute: false, animations: 0, transition: false };

test("holds at 60% filled while the waves keep moving", async ({ page, browserName }) => {
  await open(page);
  const height = page.viewportSize()!.height;
  const level = height * 0.4;
  await startPaused(page);

  const samples = [];
  for (const t of [rise, rise + 50, rise + 500, rise + hold - 50, rise + hold]) {
    await seek(page, t);
    samples.push(await computedWaterline(page));
  }
  for (const s of samples) expect(s.waterline).toBeCloseTo(level, 0);
  expect(samples[3]!.phase - samples[1]!.phase).toBeCloseTo(240 * 0.9, 0);

  if (pixels(browserName)) {
    const columns = waveColumns(page.viewportSize()!.width);
    await seek(page, rise + 100);
    const early = await pixelBoundary(page, isDark, columns);
    await seek(page, rise + 600);
    const late = await pixelBoundary(page, isDark, columns);
    for (const b of [early, late]) {
      expect(Math.abs(b.mean - level)).toBeLessThan(3);
      expect(b.max - b.min).toBeGreaterThan(20);
      expect(b.max - b.min).toBeLessThan(28);
    }
    // Same columns, different crest positions: the water is moving.
    const moved = early.columns.filter((y, i) => Math.abs(y - late.columns[i]!) > 4);
    expect(moved.length).toBeGreaterThan(columns.length / 4);
  }
  expect(await finish(page)).toEqual({ animated: true });
  expect(await leftovers(page)).toEqual(clean);
});

test("hold lasts exactly 1,000 ms", async ({ page }) => {
  await open(page);
  const level = page.viewportSize()!.height * 0.4;
  await startPaused(page);
  await seek(page, rise - 20);
  expect((await computedWaterline(page)).waterline).toBeGreaterThan(level + 0.5);
  await seek(page, rise);
  expect((await computedWaterline(page)).waterline).toBeCloseTo(level, 0);
  await seek(page, rise + hold);
  expect((await computedWaterline(page)).waterline).toBeCloseTo(level, 0);
  await seek(page, rise + hold + 20);
  expect((await computedWaterline(page)).waterline).toBeLessThan(level - 0.5);
  await finish(page);
});

test("runs in real time for the full 2,600 ms with a 1,000 ms hold", async ({ page }) => {
  await open(page);
  const level = page.viewportSize()!.height * 0.4;
  const timing = await page.evaluate(async (level) => {
    const start = performance.now();
    const holdFrames: number[] = [];
    let running = true;
    const done = window.toggleTheme().then((r) => ((running = false), r));
    while (running) {
      await new Promise(requestAnimationFrame);
      const position = getComputedStyle(
        document.documentElement,
        "::view-transition-new(root)",
      ).maskPosition;
      const y = parseFloat(position.split(",")[0]!.trim().split(/\s+/)[1]!) + 14;
      if (Math.abs(y - level) < 0.5) holdFrames.push(performance.now() - start);
    }
    return { result: await done, elapsed: performance.now() - start, holdFrames };
  }, level);
  expect(timing.result).toEqual({ animated: true });
  expect(timing.elapsed).toBeGreaterThan(total);
  expect(timing.elapsed).toBeLessThan(total + 400);
  const held = timing.holdFrames.at(-1)! - timing.holdFrames[0]!;
  expect(held).toBeGreaterThan(hold - 60);
  expect(held).toBeLessThan(hold + 60);
});

test("covers the whole viewport at completion", async ({ page, browserName }) => {
  await open(page);
  await startPaused(page);
  await seek(page, total - 1);
  const { waterline } = await computedWaterline(page);
  expect(waterline).toBeLessThan(0);
  if (pixels(browserName)) {
    // Known limitation: on fractional device-pixel ratios, Chromium sometimes
    // leaves the top-right corner device pixel uncovered in the last frames.
    const dpr = await page.evaluate(() => devicePixelRatio);
    const corner = `${Math.round(page.viewportSize()!.width * dpr) - 1},0`;
    const wrong = await allPixels(page, isDark, button);
    expect(Number.isInteger(dpr) ? wrong : wrong.filter((p) => p !== corner)).toEqual([]);
  }
  expect(await finish(page)).toEqual({ animated: true });
  expect(await page.evaluate(() => document.documentElement.className)).toBe("dark");
  expect(await leftovers(page)).toEqual(clean);
});

test("starts with none of the new theme showing", async ({ page, browserName }) => {
  test.skip(!pixels(browserName), "needs screenshot pixels");
  await open(page);
  await startPaused(page);
  await seek(page, 0);
  expect(await allPixels(page, isLight, button)).toEqual([]);
  await finish(page);
});

test("fills upward from dark to light too", async ({ page, browserName }) => {
  await open(page, "dark");
  const level = page.viewportSize()!.height * 0.4;
  await startPaused(page);
  await seek(page, rise + 400);
  expect((await computedWaterline(page)).waterline).toBeCloseTo(level, 0);
  if (pixels(browserName)) {
    const b = await pixelBoundary(page, isLight, waveColumns(page.viewportSize()!.width));
    expect(Math.abs(b.mean - level)).toBeLessThan(3);
  }
  await finish(page);
  expect(await page.evaluate(() => document.documentElement.className)).toBe("");
});

test("stays anchored to the viewport on a scrolled page", async ({ page, browserName }) => {
  await open(page);
  await page.evaluate(() => window.scrollTo(0, 2000));
  const level = page.viewportSize()!.height * 0.4;
  await startPaused(page);
  await seek(page, rise + 400);
  expect((await computedWaterline(page)).waterline).toBeCloseTo(level, 0);
  if (pixels(browserName)) {
    const b = await pixelBoundary(page, isDark, waveColumns(page.viewportSize()!.width));
    expect(Math.abs(b.mean - level)).toBeLessThan(3);
  }
  expect(await finish(page)).toEqual({ animated: true });
  expect(await page.evaluate(() => window.scrollY)).toBe(2000);
});

test("keeps focus on the focused control", async ({ page }) => {
  await open(page);
  await page.focus("#focus-target");
  await startPaused(page);
  await finish(page);
  expect(await page.evaluate(() => document.activeElement?.id)).toBe("focus-target");
});

test("a pointer press finishes the tide", async ({ page, browserName }) => {
  await open(page);
  await startPaused(page);
  await seek(page, rise + 400);
  await page.mouse.click(30, 20);
  expect(await page.evaluate(() => (window as unknown as { tidePromise: Promise<unknown> }).tidePromise)).toEqual({
    animated: false,
    reason: "interrupted",
  });
  // Chromium targets the root element during a transition; Firefox passes
  // the click through to the control underneath.
  expect(await page.evaluate(() => window.clicks)).toBe(browserName === "chromium" ? 0 : 1);
  await page.mouse.click(30, 20);
  expect(await page.evaluate(() => window.clicks)).toBe(browserName === "chromium" ? 1 : 2);
  expect(await leftovers(page)).toEqual(clean);
});

test("keyboard input reaches the focused control during a tide", async ({ page }) => {
  await open(page);
  await page.focus("#focus-target");
  await startPaused(page);
  await seek(page, rise + 400);
  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => window.clicks)).toBe(1);
  await finish(page);
});

test("a second change finishes the first and applies in order", async ({ page }) => {
  await open(page);
  const results = await page.evaluate(() =>
    Promise.all([window.toggleTheme(), window.toggleTheme(), window.toggleTheme()]),
  );
  expect(results).toEqual([
    { animated: false, reason: "interrupted" },
    { animated: false, reason: "interrupted" },
    { animated: false, reason: "interrupted" },
  ]);
  expect(await page.evaluate(() => [window.commits, document.documentElement.className])).toEqual([
    3,
    "dark",
  ]);
  expect(await leftovers(page)).toEqual(clean);
});

test("a click during the hold finishes the tide", async ({ page }) => {
  await open(page);
  const result = await page.evaluate(async () => {
    const first = window.toggleTheme();
    await new Promise((r) => setTimeout(r, 1200));
    const second = await window.toggleTheme();
    return [await first, second, window.commits, document.documentElement.className];
  });
  expect(result).toEqual([
    { animated: false, reason: "interrupted" },
    { animated: false, reason: "interrupted" },
    2,
    "",
  ]);
  expect(await leftovers(page)).toEqual(clean);
});

test("scrolling during a tide rushes the water to the top", async ({ page, browserName }) => {
  await open(page);
  const level = page.viewportSize()!.height * 0.4;
  const run = await page.evaluate(async () => {
    const done = window.toggleTheme();
    await new Promise((r) => setTimeout(r, 1300));
    const start = performance.now();
    window.scrollBy(0, 300);
    const lines: number[] = [];
    let finished = false;
    void done.then(() => (finished = true));
    while (!finished) {
      const p = getComputedStyle(document.documentElement, "::view-transition-new(root)").maskPosition;
      const y = parseFloat(p.split(",")[0]!.trim().split(/\s+/)[1]!);
      if (!Number.isNaN(y)) lines.push(y + 14);
      await new Promise(requestAnimationFrame);
    }
    return { result: await done, elapsed: performance.now() - start, lines, scrollY: scrollY };
  });
  expect(run.result).toEqual({ animated: false, reason: "interrupted" });
  // The water keeps animating: it leaves the hold level and rises past the top.
  expect(run.elapsed).toBeGreaterThan(150);
  expect(run.elapsed).toBeLessThan(500);
  expect(run.lines[0]).toBeCloseTo(level, 0);
  expect(run.lines.some((y) => y > 0 && y < level - 20)).toBe(true);
  expect(Math.min(...run.lines)).toBeLessThan(0);
  expect(run.scrollY).toBe(300);
  if (browserName === "chromium") {
    expect(await allPixels(page, isDark, button)).toEqual([]);
  }
  expect(await leftovers(page)).toEqual(clean);
});

test("changes instantly under reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  const result = await page.evaluate(async () => {
    const start = performance.now();
    const r = await window.toggleTheme();
    return { r, elapsed: performance.now() - start, className: document.documentElement.className };
  });
  expect(result.r).toEqual({ animated: false, reason: "reduced-motion" });
  expect(result.elapsed).toBeLessThan(100);
  expect(result.className).toBe("dark");
  expect(await leftovers(page)).toEqual(clean);
});

test("changes instantly without View Transitions", async ({ page }) => {
  await page.addInitScript(() => {
    // @ts-expect-error simulate an older browser
    delete Document.prototype.startViewTransition;
  });
  await open(page);
  expect(await page.evaluate(() => window.toggleTheme())).toEqual({
    animated: false,
    reason: "unsupported",
  });
  expect(await page.evaluate(() => [window.commits, document.documentElement.className])).toEqual([
    1,
    "dark",
  ]);
});

test("a failing commit rejects once and leaves nothing behind", async ({ page }) => {
  await open(page);
  expect(await page.evaluate(() => window.failTheme())).toBe("rejected: commit failed");
  expect(await page.evaluate(() => window.commits)).toBe(1);
  expect(await leftovers(page)).toEqual(clean);
});
