import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import type { ThemeTideOptions } from "../options.js";
import type { ThemeTideCommit, ThemeTideResult } from "../tide.js";
import type { UseThemeTide } from "../use-theme-tide.js";
import {
  isThemeTideRunning,
  skipThemeTide,
  subscribeThemeTide,
  themeTide,
} from "./engine.js";

/**
 * React access to themeTide in a native app. Same as the web hook: your
 * commit callback decides the theme and where it's saved.
 */
export function useThemeTide(options?: ThemeTideOptions): UseThemeTide {
  const running = useSyncExternalStore(
    subscribeThemeTide,
    isThemeTideRunning,
    isThemeTideRunning,
  );
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });
  const run = useCallback(
    (commit: ThemeTideCommit, overrides?: ThemeTideOptions): Promise<ThemeTideResult> =>
      themeTide(commit, { ...optionsRef.current, ...overrides }),
    [],
  );
  return { run, running, skip: skipThemeTide };
}
