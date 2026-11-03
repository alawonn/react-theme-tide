import { totalDuration, type ResolvedThemeTideOptions } from "./options.js";

// All geometry is in CSS pixels of the viewport, with y measured down from
// the top edge. The waterline is the mean height of the wave; the wave phase
// only moves the crests sideways, so the level can hold while the water moves.

/** Keyframes per second. Positions between keyframes are interpolated linearly. */
const sampleRate = 60;
/** Points per wavelength in the SVG tile outline. */
const tileSegments = 32;

export interface Viewport {
  width: number;
  height: number;
}

export interface WaveTile {
  /** A CSS url() holding an SVG tile filled below one wavelength of the wave. */
  image: string;
  width: number;
  height: number;
}

/**
 * Transparent rows at the top and bottom of the tile. Chromium can wrap the
 * tile vertically when it resamples at fractional device-pixel ratios; empty
 * rows on both edges keep that from drawing a hairline above the crests.
 */
const tilePadding = 2;

function tileHeight(amplitude: number): number {
  return 2 * amplitude + 2 * tilePadding;
}

export function waveTile(amplitude: number, length: number): WaveTile {
  const height = tileHeight(amplitude);
  const middle = amplitude + tilePadding;
  const bottom = height - tilePadding;
  let d = `M0 ${bottom}`;
  for (let i = 0; i <= tileSegments; i++) {
    const x = (i * length) / tileSegments;
    const y = middle - amplitude * Math.sin((2 * Math.PI * x) / length);
    d += ` L${round(x)} ${round(y)}`;
  }
  d += ` L${length} ${bottom} Z`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${length}" height="${height}"><path d="${d}"/></svg>`;
  return {
    image: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
    width: length,
    height,
  };
}

function easeInOut(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

/** Mean waterline, in pixels from the top, at `time` ms into the tide. */
export function waterlineAt(
  time: number,
  options: ResolvedThemeTideOptions,
  viewportHeight: number,
): number {
  const { riseDuration, holdDuration, finishDuration, waveAmplitude } = options;
  // Starts with the whole tile below the bottom edge and ends with every
  // trough above the top edge. The extra 3 px at the end keep the corners
  // covered on screens with fractional device pixels.
  const start = viewportHeight + waveAmplitude + tilePadding;
  const hold = viewportHeight * (1 - options.holdLevel);
  const end = -(waveAmplitude + 3);
  if (time <= 0) return start;
  if (time < riseDuration) {
    return start + (hold - start) * easeInOut(time / riseDuration);
  }
  if (time <= riseDuration + holdDuration) return hold;
  const finishTime = time - riseDuration - holdDuration;
  if (finishTime >= finishDuration) return end;
  return hold + (end - hold) * easeInOut(finishTime / finishDuration);
}

/** Horizontal offset of the wave tile at `time` ms. Grows without wrapping. */
export function wavePhaseAt(
  time: number,
  options: ResolvedThemeTideOptions,
): number {
  return (options.waveSpeed * options.waveLength * time) / 1000;
}

/** Height of the solid layer under the wave. Taller than any viewport position needs. */
function bodyHeight(options: ResolvedThemeTideOptions, viewport: Viewport) {
  return 2 * viewport.height + 4 * options.waveAmplitude + 8;
}

function maskPosition(
  time: number,
  options: ResolvedThemeTideOptions,
  viewport: Viewport,
): string {
  return positionFor(
    waterlineAt(time, options, viewport.height),
    wavePhaseAt(time, options),
    options.waveAmplitude,
  );
}

function positionFor(line: number, phase: number, amplitude: number): string {
  // The solid layer starts one pixel above the bottom of the tile's filled
  // area and spills one pixel past each side, so no seam shows at fractional
  // device pixels.
  return `${round(phase)}px ${round(line - amplitude - tilePadding)}px, -1px ${round(line + amplitude - 1)}px`;
}

/** Static mask properties. The starting position hides the whole new page. */
export function maskDeclarations(
  options: ResolvedThemeTideOptions,
  viewport: Viewport,
): string {
  const tile = waveTile(options.waveAmplitude, options.waveLength);
  return [
    `mask-image: ${tile.image}, linear-gradient(#000, #000)`,
    "mask-repeat: repeat-x, no-repeat",
    `mask-size: ${tile.width}px ${tile.height}px, calc(100% + 2px) ${bodyHeight(options, viewport)}px`,
    `mask-position: ${maskPosition(0, options, viewport)}`,
    "mask-mode: alpha",
    "mask-clip: no-clip",
  ].join("; ");
}

export function maskKeyframes(
  options: ResolvedThemeTideOptions,
  viewport: Viewport,
): Keyframe[] {
  const duration = totalDuration(options);
  const steps = Math.max(1, Math.ceil((duration / 1000) * sampleRate));
  // Phase boundaries are sampled exactly so the hold starts and ends on time.
  const times = new Set<number>([
    options.riseDuration,
    options.riseDuration + options.holdDuration,
  ]);
  for (let i = 0; i <= steps; i++) times.add((i / steps) * duration);
  return [...times]
    .sort((a, b) => a - b)
    .map((time) => ({
      offset: duration === 0 ? 0 : time / duration,
      maskPosition: maskPosition(time, options, viewport),
    }));
}

/**
 * Keyframes that take the water from where it is at `from` ms to the end of
 * the tide in `duration` ms. The waves keep their normal speed.
 */
export function rushKeyframes(
  options: ResolvedThemeTideOptions,
  viewport: Viewport,
  from: number,
  duration: number,
): Keyframe[] {
  const start = waterlineAt(from, options, viewport.height);
  const end = waterlineAt(totalDuration(options), options, viewport.height);
  const steps = Math.max(1, Math.ceil((duration / 1000) * sampleRate));
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    return {
      offset: t,
      maskPosition: positionFor(
        start + (end - start) * easeInOut(t),
        wavePhaseAt(from + t * duration, options),
        options.waveAmplitude,
      ),
    };
  });
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
