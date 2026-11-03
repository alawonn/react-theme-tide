// @vitest-environment node
import { expect, it, vi } from "vitest";

it("imports and falls back without browser globals", async () => {
  expect(typeof globalThis.document).toBe("undefined");
  const library = await import("../src/index.js");
  expect(library.supportsThemeTide()).toBe(false);
  const commit = vi.fn();
  await expect(library.themeTide(commit)).resolves.toEqual({
    animated: false,
    reason: "unsupported",
  });
  expect(commit).toHaveBeenCalledTimes(1);
});
