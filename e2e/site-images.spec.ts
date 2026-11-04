import { fileURLToPath } from "node:url";
import { test } from "@playwright/test";
import { pseudo } from "./helpers.js";

// Saves one screenshot per site in the README's "Sites using it" table into
// docs/images, paused in the middle of each site's own hold. The browser
// prefers light; `button` switches away from the theme the site starts in.
// It loads the live sites, so it needs a network connection. Run with
// TIDE_SITE_IMAGES=1 --project=chromium; it asserts nothing.
test.skip(process.env.TIDE_SITE_IMAGES !== "1", "README site image run only");

// `pause` is each site's rise plus half its hold, in milliseconds.
const sites = [
  { file: "site-vertexx", url: "https://vertexx.fit/", button: "Light appearance", pause: 1400 },
  { file: "site-meau-me", url: "https://rameau.me/", button: "Dark", pause: 1700 },
  { file: "site-alawonn", url: "https://alawonn.com/", button: "Dark", pause: 1200 },
];

const out = (name: string) =>
  fileURLToPath(new URL(`../docs/images/${name}.png`, import.meta.url));

for (const site of sites) {
  test(`README site image: ${site.file}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(site.url);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.evaluate(
      async ([label, pseudo]) => {
        const button = [...document.querySelectorAll("button")].find(
          (b) => b.getAttribute("aria-label") === label && b.offsetParent !== null,
        );
        if (!button) throw new Error(`No visible button labeled ${label}`);
        button.click();
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
      },
      [site.button, pseudo] as const,
    );
    await page.evaluate(
      async ([time, pseudo]) => {
        const a = document
          .getAnimations()
          .find((a) => (a.effect as KeyframeEffect | null)?.pseudoElement === pseudo)!;
        a.currentTime = time;
        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);
      },
      [site.pause, pseudo] as const,
    );
    await page.screenshot({ path: out(site.file) });
  });
}
