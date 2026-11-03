import { themeTide, type ThemeTideOptions, type ThemeTideResult } from "react-theme-tide";

// Test hooks for e2e/. Each call toggles the root `dark` class.
declare global {
  interface Window {
    toggleTheme: (options?: ThemeTideOptions) => Promise<ThemeTideResult>;
    failTheme: () => Promise<unknown>;
    commits: number;
    clicks: number;
  }
}

window.commits = 0;
window.clicks = 0;
document.getElementById("focus-target")!.addEventListener("click", () => window.clicks++);
window.toggleTheme = (options) =>
  themeTide(() => {
    window.commits++;
    document.documentElement.classList.toggle("dark");
  }, options);
window.failTheme = () =>
  themeTide(() => {
    window.commits++;
    throw new Error("commit failed");
  }).catch((error: Error) => `rejected: ${error.message}`);
