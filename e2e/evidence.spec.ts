import { test } from "@playwright/test";
import { pseudo } from "./helpers.js";

// Saves frames, a real-time video and frame timing from the demo page into
// test-results/. Run with TIDE_EVIDENCE=1; it asserts nothing.
test.skip(process.env.TIDE_EVIDENCE !== "1", "evidence run only");
test.use({ video: { mode: "on", size: { width: 640, height: 400 } } });

const frames = { "1-rise": 450, "2-hold-start": 900, "3-hold-middle": 1400, "4-hold-end": 1900, "5-finish": 2250, "6-almost-done": 2590 };

test("frames, video and timing", async ({ page }, info) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(300);

  // Real time, for the video and frame timing.
  const timing = await page.evaluate(async () => {
    const intervals: number[] = [];
    let last = performance.now();
    let running = true;
    const button = [...document.querySelectorAll("button")].find((b) => b.textContent === "Dark")!;
    button.click();
    const watch = (async () => {
      while (running) {
        await new Promise(requestAnimationFrame);
        const now = performance.now();
        intervals.push(now - last);
        last = now;
        running = document.documentElement.hasAttribute("data-theme-tide");
      }
    })();
    await watch;
    intervals.sort((a, b) => a - b);
    const pick = (q: number) => intervals[Math.floor(q * (intervals.length - 1))]!;
    return {
      frames: intervals.length,
      median: pick(0.5),
      p95: pick(0.95),
      max: intervals.at(-1),
      over50ms: intervals.filter((i) => i > 50).length,
    };
  });
  await info.attach("timing", { body: JSON.stringify(timing, null, 2), contentType: "application/json" });
  console.log(info.project.name, "timing", JSON.stringify(timing));

  // Paused frames, back from dark to light.
  await page.waitForTimeout(300);
  await page.evaluate(async (pseudo) => {
    [...document.querySelectorAll("button")].find((b) => b.textContent === "Light")!.click();
    for (;;) {
      const a = document.getAnimations().find((a) => (a.effect as KeyframeEffect | null)?.pseudoElement === pseudo);
      if (a) { a.pause(); break; }
      await new Promise(requestAnimationFrame);
    }
  }, pseudo);
  for (const [name, time] of Object.entries(frames)) {
    await page.evaluate(async ([time, pseudo]) => {
      const a = document.getAnimations().find((a) => (a.effect as KeyframeEffect | null)?.pseudoElement === pseudo)!;
      a.currentTime = time;
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
    }, [time, pseudo] as const);
    await page.screenshot({ path: info.outputPath(`${name}.png`) });
  }
});
