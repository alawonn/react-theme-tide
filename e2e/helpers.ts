import type { Page } from "@playwright/test";
import { PNG } from "pngjs";
import type { ThemeTideOptions } from "../src/index.js";

export const pseudo = "::view-transition-new(root)";

/** Starts a tide on the fixture page and pauses its animation at time 0. */
export async function startPaused(page: Page, options: ThemeTideOptions = {}) {
  await page.evaluate(
    async ([options, pseudo]) => {
      const w = window as unknown as { tidePromise: Promise<unknown> };
      w.tidePromise = window.toggleTheme(options);
      for (let i = 0; i < 200; i++) {
        const animation = document
          .getAnimations()
          .find((a) => (a.effect as KeyframeEffect | null)?.pseudoElement === pseudo);
        if (animation) {
          animation.pause();
          animation.currentTime = 0;
          return;
        }
        await new Promise(requestAnimationFrame);
      }
      throw new Error("No tide animation started");
    },
    [options, pseudo] as const,
  );
}

/** Moves the paused animation to `time` ms and waits for it to paint. */
export async function seek(page: Page, time: number) {
  await page.evaluate(
    async ([time, pseudo]) => {
      const animation = document
        .getAnimations()
        .find((a) => (a.effect as KeyframeEffect | null)?.pseudoElement === pseudo)!;
      animation.currentTime = time;
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
    },
    [time, pseudo] as const,
  );
}

/** Lets a paused tide play out and returns its result. */
export async function finish(page: Page) {
  return page.evaluate(async (pseudo) => {
    document
      .getAnimations()
      .find((a) => (a.effect as KeyframeEffect | null)?.pseudoElement === pseudo)
      ?.finish();
    return (window as unknown as { tidePromise: Promise<unknown> }).tidePromise;
  }, pseudo);
}

/** Mean waterline from the computed mask position: tile top + amplitude + 2. */
export async function computedWaterline(page: Page, amplitude = 12) {
  const position = await page.evaluate(
    (pseudo) => getComputedStyle(document.documentElement, pseudo).maskPosition,
    pseudo,
  );
  const [tile] = position.split(",");
  const [x, y] = (tile ?? "").trim().split(/\s+/).map(parseFloat);
  return { phase: x!, waterline: y! + amplitude + 2 };
}

export interface Boundary {
  /** Top of the new-theme region in each sampled column, from the bottom up. */
  columns: number[];
  mean: number;
  min: number;
  max: number;
}

/**
 * Finds the top of the contiguous new-theme region rising from the bottom edge
 * in each column. `isNew` tells new-theme pixels from old ones.
 */
export async function pixelBoundary(
  page: Page,
  isNew: (luma: number) => boolean,
  columns: number[],
): Promise<Boundary> {
  const png = PNG.sync.read(await page.screenshot());
  const scale = png.width / (page.viewportSize()?.width ?? png.width);
  const tops = columns.map((cssX) => {
    const x = Math.round(cssX * scale);
    let y = png.height - 1;
    while (y >= 0 && isNew(luma(png, x, y))) y--;
    return (y + 1) / scale;
  });
  return {
    columns: tops,
    mean: tops.reduce((a, b) => a + b, 0) / tops.length,
    min: Math.min(...tops),
    max: Math.max(...tops),
  };
}

/** Device-pixel positions outside `skip` that don't match `isNew`. */
export async function allPixels(
  page: Page,
  isNew: (luma: number) => boolean,
  skip: { x: number; y: number; width: number; height: number },
) {
  const png = PNG.sync.read(await page.screenshot());
  const scale = png.width / (page.viewportSize()?.width ?? png.width);
  const wrong: string[] = [];
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const cx = x / scale;
      const cy = y / scale;
      if (cx >= skip.x && cx < skip.x + skip.width && cy >= skip.y && cy < skip.y + skip.height) continue;
      if (!isNew(luma(png, x, y))) wrong.push(`${x},${y}`);
    }
  }
  return wrong;
}

function luma(png: PNG, x: number, y: number) {
  const i = (png.width * y + x) * 4;
  return 0.2126 * png.data[i]! + 0.7152 * png.data[i + 1]! + 0.0722 * png.data[i + 2]!;
}

export const isDark = (l: number) => l < 128;
export const isLight = (l: number) => l >= 128;

/** Columns covering whole wavelengths of 240 px, or the full width when narrower. */
export function waveColumns(width: number) {
  const span = Math.floor(width / 240) * 240 || width;
  const start = Math.floor((width - span) / 2);
  return Array.from({ length: span / 4 }, (_, i) => start + i * 4);
}
