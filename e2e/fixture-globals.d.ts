import type { ThemeTideOptions, ThemeTideResult } from "../src/index.js";

// Test hooks that demo/fixture/fixture.ts puts on window.
declare global {
  interface Window {
    toggleTheme: (options?: ThemeTideOptions) => Promise<ThemeTideResult>;
    failTheme: () => Promise<unknown>;
    commits: number;
    clicks: number;
    reverseClicks: number;
    reverseResult?: Promise<ThemeTideResult>;
  }
}
