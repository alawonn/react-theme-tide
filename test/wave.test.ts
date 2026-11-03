import { describe, expect, it } from "vitest";
import { resolveThemeTideOptions, themeTideDefaults } from "../src/options.js";
import { maskKeyframes, rushKeyframes, waterlineAt, wavePhaseAt } from "../src/wave.js";

const options = resolveThemeTideOptions();
const height = 800;

function positions(frame: Keyframe) {
  const [tile, body] = String(frame.maskPosition).split(",");
  const [x, y] = (tile ?? "").trim().split(" ").map(parseFloat);
  const bodyY = parseFloat((body ?? "").trim().split(" ")[1] ?? "");
  return { x: x ?? NaN, y: y ?? NaN, bodyY };
}

describe("options", () => {
  it("uses the agreed defaults", () => {
    expect(themeTideDefaults).toMatchObject({
      riseDuration: 900,
      holdDuration: 1000,
      finishDuration: 700,
      holdLevel: 0.6,
      waveAmplitude: 12,
      waveSpeed: 1,
    });
  });

  it("rejects values outside their range", () => {
    expect(() => resolveThemeTideOptions({ holdDuration: -1 })).toThrow(RangeError);
    expect(() => resolveThemeTideOptions({ waveAmplitude: 81 })).toThrow(RangeError);
    expect(() => resolveThemeTideOptions({ waveSpeed: Number.NaN })).toThrow(TypeError);
    expect(() =>
      resolveThemeTideOptions({ holdLevel: "0.5" as unknown as number }),
    ).toThrow(TypeError);
  });
});

describe("waterline", () => {
  it("starts below the bottom edge and ends above the top edge", () => {
    expect(waterlineAt(0, options, height)).toBe(height + 14);
    expect(waterlineAt(2600, options, height)).toBe(-15);
  });

  it("holds at 60% filled for exactly the hold duration", () => {
    const hold = height * 0.4;
    for (const t of [900, 1200, 1500, 1900]) {
      expect(waterlineAt(t, options, height)).toBe(hold);
    }
    expect(waterlineAt(899, options, height)).toBeGreaterThan(hold);
    expect(waterlineAt(1901, options, height)).toBeLessThan(hold);
  });

  it("only ever rises", () => {
    let previous = Infinity;
    for (let t = 0; t <= 2600; t += 10) {
      const line = waterlineAt(t, options, height);
      expect(line).toBeLessThanOrEqual(previous);
      previous = line;
    }
  });

  it("keeps the waves moving at the configured speed", () => {
    expect(wavePhaseAt(1000, options) - wavePhaseAt(0, options)).toBe(240);
  });
});

describe("mask keyframes", () => {
  const frames = maskKeyframes(options, { width: 1200, height });

  it("samples the boundaries of the hold", () => {
    const offsets = frames.map((f) => f.offset);
    expect(offsets).toContain(900 / 2600);
    expect(offsets).toContain(1900 / 2600);
    expect(offsets[0]).toBe(0);
    expect(offsets.at(-1)).toBe(1);
  });

  it("hides the new page at the start and covers it at the end", () => {
    const first = positions(frames[0]!);
    const last = positions(frames.at(-1)!);
    expect(first.y).toBeGreaterThanOrEqual(height);
    expect(last.y + 28).toBeLessThanOrEqual(0);
    expect(last.bodyY).toBeLessThanOrEqual(0);
  });

  it("moves the wave sideways while the level holds", () => {
    const hold = frames
      .filter((f) => f.offset! >= 900 / 2600 && f.offset! <= 1900 / 2600)
      .map(positions);
    expect(new Set(hold.map((p) => p.y)).size).toBe(1);
    expect(hold.at(-1)!.x - hold[0]!.x).toBeCloseTo(240, 0);
  });

  it("overlaps the solid layer with the filled part of the tile", () => {
    for (const frame of frames) {
      const p = positions(frame);
      // The tile's fill ends 2 px above its bottom edge.
      expect(p.bodyY).toBeLessThan(p.y + 26);
    }
  });
});

describe("rush keyframes", () => {
  const frames = rushKeyframes(options, { width: 1200, height }, 1400, 200).map(positions);

  it("starts where the water is and ends with the page covered", () => {
    expect(frames[0]!.y).toBeCloseTo(waterlineAt(1400, options, height) - 14, 1);
    expect(frames.at(-1)!.y + 28).toBeLessThanOrEqual(0);
    expect(frames.at(-1)!.bodyY).toBeLessThanOrEqual(0);
  });

  it("keeps the waves at their normal speed", () => {
    expect(frames.at(-1)!.x - frames[0]!.x).toBeCloseTo(240 * 0.2, 1);
  });
});
