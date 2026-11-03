import { test } from "@playwright/test";

// Frame timing on the demo page: idle, a plain cross-fade and a tide.
// Run with TIDE_EVIDENCE=1; it asserts nothing.
test.skip(process.env.TIDE_EVIDENCE !== "1", "evidence run only");

test("frame timing", async ({ page }, info) => {
  await page.goto("/");
  await page.evaluate(() => window.scrollTo(0, 400));
  const result = await page.evaluate(async () => {
    const measure = async (start: () => Promise<unknown> | void, ms?: number) => {
      const intervals: number[] = [];
      let done = false;
      const t0 = performance.now();
      const p = Promise.resolve(start()).then(() => (done = true));
      let last = performance.now();
      while (!done && (ms === undefined || performance.now() - t0 < ms)) {
        await new Promise(requestAnimationFrame);
        const now = performance.now();
        intervals.push(now - last);
        last = now;
      }
      if (ms === undefined) await p;
      intervals.sort((a, b) => a - b);
      const q = (v: number) => Math.round(intervals[Math.floor(v * (intervals.length - 1))]! * 10) / 10;
      return { frames: intervals.length, median: q(0.5), p95: q(0.95), over50ms: intervals.filter((i) => i > 50).length };
    };
    const idle = await measure(() => new Promise((r) => setTimeout(r, 2600)));
    const crossfade = await measure(async () => {
      const t = document.startViewTransition(() => document.documentElement.classList.toggle("dark"));
      await t.ready;
      for (const a of document.getAnimations()) a.effect?.updateTiming({ duration: 2600 });
      await t.finished;
    });
    const tide = await measure(async () => {
      const root = document.documentElement;
      [...document.querySelectorAll("button")]
        .find((b) => b.textContent === (root.classList.contains("dark") ? "Light" : "Dark"))!
        .click();
      while (root.hasAttribute("data-theme-tide")) await new Promise(requestAnimationFrame);
    });
    return { idle, crossfade, tide };
  });
  console.log(info.project.name, JSON.stringify(result));
});
