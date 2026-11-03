"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import type { ThemeTideOptions } from "./options.js";
import {
  isThemeTideRunning,
  skipThemeTide,
  subscribeThemeTide,
  themeTide,
  type ThemeTideCommit,
  type ThemeTideResult,
} from "./tide.js";

export interface UseThemeTide {
  /** Runs a tide around `commit`. Per-call options override the hook's options. */
  run: (
    commit: ThemeTideCommit,
    options?: ThemeTideOptions,
  ) => Promise<ThemeTideResult>;
  /** True while any tide on the page is animating. */
  running: boolean;
  /** Jumps a running tide to its end. */
  skip: () => void;
}

const serverRunning = () => false;

/**
 * React access to themeTide. The hook keeps no theme state of its own: your
 * commit callback decides the theme and where it's saved. Unmounting doesn't
 * stop a tide that's already running, since the transition belongs to the page.
 */
export function useThemeTide(options?: ThemeTideOptions): UseThemeTide {
  const running = useSyncExternalStore(
    subscribeThemeTide,
    isThemeTideRunning,
    serverRunning,
  );
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });
  const run = useCallback(
    (commit: ThemeTideCommit, overrides?: ThemeTideOptions) =>
      themeTide(commit, { ...optionsRef.current, ...overrides }),
    [],
  );
  return { run, running, skip: skipThemeTide };
}
