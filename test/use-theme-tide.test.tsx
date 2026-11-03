// @vitest-environment jsdom
import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { useThemeTide, type UseThemeTide } from "../src/index.js";
import {
  flush,
  installFakeViewTransitions,
  setReducedMotion,
  uninstallFakeViewTransitions,
} from "./fake-view-transition.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  uninstallFakeViewTransitions();
  vi.unstubAllGlobals();
});

it("shares running state between controls and survives unmount", async () => {
  vi.stubGlobal("CSS", { supports: () => true });
  setReducedMotion(false);
  const fake = installFakeViewTransitions();
  const seen: boolean[][] = [[], []];
  let api: UseThemeTide | undefined;
  function Toggle({ index }: { index: number }) {
    const tide = useThemeTide({ holdDuration: 500 });
    useEffect(() => {
      seen[index]!.push(tide.running);
    });
    if (index === 0) api = tide;
    return null;
  }
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <>
        <Toggle index={0} />
        <Toggle index={1} />
      </>,
    );
  });
  const commit = vi.fn();
  let done: Promise<unknown> | undefined;
  await act(async () => {
    done = api!.run(commit);
  });
  expect(seen[1]!.at(-1)).toBe(true);
  expect(fake.start).toHaveBeenCalledTimes(1);
  await act(async () => root.unmount());
  await flush();
  expect(fake.animations[0]?.options.duration).toBe(2100);
  fake.transitions[0]?.finish();
  await expect(done).resolves.toEqual({ animated: true });
  expect(commit).toHaveBeenCalledTimes(1);
});
