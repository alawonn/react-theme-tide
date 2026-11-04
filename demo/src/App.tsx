import { useState, useSyncExternalStore } from "react";
import {
  themeTideDefaults,
  themeTideRanges,
  useThemeTide,
  type ThemeTideOptions,
  type ThemeTideResult,
} from "react-theme-tide";
import { currentTheme, setTheme, subscribeTheme, type Theme } from "./theme.ts";

type Settings = Required<Omit<ThemeTideOptions, "nonce">>;

const defaults: Settings = {
  riseDuration: themeTideDefaults.riseDuration,
  holdDuration: themeTideDefaults.holdDuration,
  finishDuration: themeTideDefaults.finishDuration,
  holdLevel: themeTideDefaults.holdLevel,
  waveAmplitude: themeTideDefaults.waveAmplitude,
  waveLength: themeTideDefaults.waveLength,
  waveSpeed: themeTideDefaults.waveSpeed,
  respectReducedMotion: themeTideDefaults.respectReducedMotion,
};

const sliders: { key: keyof typeof themeTideRanges; label: string; unit: string; step: number }[] = [
  { key: "riseDuration", label: "Rise", unit: "ms", step: 50 },
  { key: "holdDuration", label: "Hold", unit: "ms", step: 50 },
  { key: "finishDuration", label: "Finish", unit: "ms", step: 50 },
  { key: "holdLevel", label: "Hold level", unit: "%", step: 0.05 },
  { key: "waveAmplitude", label: "Wave height", unit: "px", step: 1 },
  { key: "waveLength", label: "Wavelength", unit: "px", step: 10 },
  { key: "waveSpeed", label: "Wave speed", unit: "per second", step: 0.1 },
];

function useTheme(): Theme {
  return useSyncExternalStore(subscribeTheme, currentTheme, () => "light");
}

function describe(result: ThemeTideResult | string | null) {
  if (result === null) return "No change yet.";
  if (typeof result === "string") return result;
  if (result.animated) return "Last change animated.";
  const reasons = {
    "reduced-motion": "Changed instantly because reduced motion is on.",
    unsupported: "Changed instantly. This browser can't run the animation.",
    hidden: "Changed instantly because the tab was hidden.",
    "zero-duration": "Changed instantly because every duration is 0.",
    busy: "Changed instantly because another page transition was running.",
    interrupted: "Finished early.",
  } as const;
  return reasons[result.reason];
}

export function App() {
  const theme = useTheme();
  const [settings, setSettings] = useState<Settings>(defaults);
  const [result, setResult] = useState<ThemeTideResult | string | null>(null);
  const tide = useThemeTide(settings);

  const choose = (next: Theme) => {
    if (next === currentTheme()) return;
    tide
      .run(() => setTheme(next))
      .then(setResult, (error: Error) => setResult(`Error: ${error.message}`));
  };
  const flip = () => choose(theme === "dark" ? "light" : "dark");

  return (
    <>
      <header className="bar">
        <a className="brand" href="#top">React Theme Tide</a>
        <div className="segmented" role="group" aria-label="Theme">
          {(["light", "dark"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={theme === value}
              onClick={() => choose(value)}
            >
              {value === "light" ? "Light" : "Dark"}
            </button>
          ))}
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <p className="eyebrow">Theme transitions for React</p>
          <p className="byline">
            <a href="https://alawonn.com">
              an <span className="wordmark" role="img" aria-label="alawonn" /> project
            </a>
          </p>
          <h1>Change themes with a rising tide.</h1>
          <p className="lead">
            The new theme fills the page from the bottom edge, pauses partway up while the
            waves keep moving, then rises to the top. What you see under the water is the real
            page in its new theme: text, borders and controls included.
          </p>
          <div className="actions">
            <button type="button" className="primary" onClick={flip}>
              Switch to {theme === "dark" ? "light" : "dark"}
            </button>
            <button type="button" className="quiet" onClick={tide.skip} disabled={!tide.running}>
              Skip to the end
            </button>
          </div>
          <p className="status" role="status">{describe(result)}</p>
        </section>

        <section className="panel" aria-labelledby="settings-title">
          <div className="panel-head">
            <h2 id="settings-title">Settings</h2>
            <button type="button" className="quiet" onClick={() => setSettings(defaults)}>
              Reset
            </button>
          </div>
          <div className="sliders">
            {sliders.map(({ key, label, unit, step }) => {
              const [min, max] = themeTideRanges[key];
              const value = settings[key];
              const shown = key === "holdLevel" ? Math.round(value * 100) : value;
              return (
                <label key={key} className="slider">
                  <span>
                    {label} <output>{shown} {unit}</output>
                  </span>
                  <input
                    type="range"
                    min={min}
                    max={key.endsWith("Duration") ? 4000 : max}
                    step={step}
                    value={value}
                    onChange={(e) => setSettings({ ...settings, [key]: Number(e.target.value) })}
                  />
                </label>
              );
            })}
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={settings.respectReducedMotion}
              onChange={(e) => setSettings({ ...settings, respectReducedMotion: e.target.checked })}
            />
            Change instantly when the system asks for reduced motion
          </label>
        </section>

        <section className="cards" aria-label="Sample content">
          {[
            ["Text", "Paragraphs, links and headings change color under the water line."],
            ["Borders", "Edges and dividers use the new theme as soon as the water reaches them."],
            ["Controls", "Buttons, checkboxes and sliders keep their focus and value."],
            ["Fixed parts", "The header and the badge in the corner stay where they are."],
          ].map(([title, body]) => (
            <article key={title} className="card">
              <h3>{title}</h3>
              <p>{body}</p>
              <a href="#top">Back to top</a>
            </article>
          ))}
        </section>

        {Array.from({ length: 8 }, (_, i) => (
          <section key={i} className="long">
            <h2>Section {i + 1}</h2>
            <p>
              Scroll down and switch themes from here. The water always rises from the bottom of
              the screen, wherever you are on the page, and your scroll position stays put.
            </p>
            <p>
              Scroll while the water is moving and it hurries to the top, so the page is ready
              where you land.
            </p>
          </section>
        ))}
      </main>

      <footer className="foot">
        <a href="https://github.com/alawonn/react-theme-tide">GitHub</a>
        <a href="https://www.npmjs.com/package/react-theme-tide">npm</a>
        <span>MIT license</span>
      </footer>

      <aside className="badge" aria-live="polite">
        {theme === "dark" ? "Dark" : "Light"} theme{tide.running ? ", changing" : ""}
      </aside>
    </>
  );
}
