export interface ThemeTideOptions {
  /** Time for the water to rise from the bottom edge to the hold level, in ms. */
  riseDuration?: number;
  /** Time the mean waterline stays at the hold level, in ms. Waves keep moving. */
  holdDuration?: number;
  /** Time for the water to rise from the hold level past the top edge, in ms. */
  finishDuration?: number;
  /** Time for the water to drain when someone goes back mid-tide, in ms. */
  reverseDuration?: number;
  /** How full the viewport is during the hold, from 0 (empty) to 1 (full). */
  holdLevel?: number;
  /** Height of a wave crest above the mean waterline, in CSS pixels. */
  waveAmplitude?: number;
  /** Distance between two crests, in CSS pixels. */
  waveLength?: number;
  /** Crests that pass a fixed point each second. */
  waveSpeed?: number;
  /** Change the theme instantly when the user prefers reduced motion. */
  respectReducedMotion?: boolean;
  /** Nonce for the temporary style element, for pages with a strict CSP. */
  nonce?: string;
}

export interface ResolvedThemeTideOptions {
  riseDuration: number;
  holdDuration: number;
  finishDuration: number;
  reverseDuration: number;
  holdLevel: number;
  waveAmplitude: number;
  waveLength: number;
  waveSpeed: number;
  respectReducedMotion: boolean;
  nonce: string | undefined;
}

type NumericKey = Exclude<
  keyof ResolvedThemeTideOptions,
  "respectReducedMotion" | "nonce"
>;

export const themeTideDefaults: Readonly<ResolvedThemeTideOptions> =
  Object.freeze({
    riseDuration: 900,
    holdDuration: 1000,
    finishDuration: 700,
    reverseDuration: 200,
    holdLevel: 0.6,
    waveAmplitude: 12,
    waveLength: 240,
    waveSpeed: 1,
    respectReducedMotion: true,
    nonce: undefined,
  });

export const themeTideRanges: Readonly<
  Record<NumericKey, readonly [min: number, max: number]>
> = Object.freeze({
  riseDuration: [0, 10000],
  holdDuration: [0, 10000],
  finishDuration: [0, 10000],
  reverseDuration: [0, 10000],
  holdLevel: [0, 1],
  waveAmplitude: [0, 80],
  waveLength: [40, 4000],
  waveSpeed: [0, 5],
});

/** Fills in defaults and throws a RangeError or TypeError for bad values. */
export function resolveThemeTideOptions(
  options: ThemeTideOptions = {},
): ResolvedThemeTideOptions {
  const resolved: ResolvedThemeTideOptions = { ...themeTideDefaults };
  for (const key of Object.keys(themeTideRanges) as NumericKey[]) {
    const value = options[key];
    if (value === undefined) continue;
    const [min, max] = themeTideRanges[key];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new TypeError(`themeTide: ${key} must be a finite number.`);
    }
    if (value < min || value > max) {
      throw new RangeError(
        `themeTide: ${key} must be between ${min} and ${max}, got ${value}.`,
      );
    }
    resolved[key] = value;
  }
  if (options.respectReducedMotion !== undefined) {
    if (typeof options.respectReducedMotion !== "boolean") {
      throw new TypeError("themeTide: respectReducedMotion must be a boolean.");
    }
    resolved.respectReducedMotion = options.respectReducedMotion;
  }
  if (options.nonce !== undefined) {
    if (typeof options.nonce !== "string") {
      throw new TypeError("themeTide: nonce must be a string.");
    }
    resolved.nonce = options.nonce;
  }
  return resolved;
}

export function totalDuration(options: ResolvedThemeTideOptions): number {
  return options.riseDuration + options.holdDuration + options.finishDuration;
}
