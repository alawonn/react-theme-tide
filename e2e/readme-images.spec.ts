import { fileURLToPath } from "node:url";
import { test } from "@playwright/test";
import { pseudo } from "./helpers.js";

// Saves the README thumbnails into docs/images from the demo page, light to
// dark. Run with TIDE_README_IMAGES=1 --project=chromium; it asserts nothing.
test.skip(process.env.TIDE_README_IMAGES !== "1", "README image run only");

const frames = { "tide-1-rise": 500, "tide-2-pause": 1400, "tide-3-fill": 2250 };
const out = (name: string) =>
  fileURLToPath(new URL(`../docs/images/${name}.png`, import.meta.url));

test("README thumbnails", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForLoadState("networkidle");
  await page.evaluate(async (pseudo) => {
    [...document.querySelectorAll("button")].find((b) => b.textContent === "Dark")!.click();
    for (;;) {
      const a = document
        .getAnimations()
        .find((a) => (a.effect as KeyframeEffect | null)?.pseudoElement === pseudo);
      if (a) {
        a.pause();
        break;
      }
      await new Promise(requestAnimationFrame);
    }
  }, pseudo);
  for (const [name, time] of Object.entries(frames)) {
    await page.evaluate(
      async ([time, pseudo]) => {
        const a = document
          .getAnimations()
          .find((a) => (a.effect as KeyframeEffect | null)?.pseudoElement === pseudo)!;
        a.currentTime = time;
        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);
      },
      [time, pseudo] as const,
    );
    await page.screenshot({ path: out(name) });
  }
});
