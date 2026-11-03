// The demo's own theme store. It stands in for whatever a host site already
// has: themeTide only calls `setTheme` and never reads or saves the theme.

export type Theme = "light" | "dark";

const key = "tide-demo-theme";
const event = "tide-demo-theme-change";

export function currentTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function setTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(key, theme);
  } catch {
    // The page still changes without saved storage.
  }
  window.dispatchEvent(new Event(event));
}

export function subscribeTheme(listener: () => void) {
  window.addEventListener(event, listener);
  return () => window.removeEventListener(event, listener);
}
