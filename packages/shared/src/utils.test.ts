import { describe, expect, it, vi } from "vitest";
import {
  clamp,
  formatDuration,
  generateRequestId,
  parseIntSafe,
} from "./utils";

describe("generateRequestId", () => {
  it("returns a string with a hyphen separator", () => {
    const id = generateRequestId();
    expect(id).toMatch(/^[a-z0-9]+-[a-z0-9]+$/);
  });

  it("generates unique IDs", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateRequestId());
    }
    expect(ids.size).toBe(100);
  });
});

describe("parseIntSafe", () => {
  it("returns undefined for undefined input", () => {
    expect(parseIntSafe(undefined)).toBeUndefined();
  });

  it("returns undefined for non-numeric strings", () => {
    expect(parseIntSafe("abc")).toBeUndefined();
    expect(parseIntSafe("")).toBeUndefined();
    expect(parseIntSafe("12.5abc")).toBe(12); // parseInt behavior
  });

  it("parses valid integers", () => {
    expect(parseIntSafe("42")).toBe(42);
    expect(parseIntSafe("0")).toBe(0);
    expect(parseIntSafe("-10")).toBe(-10);
  });

  it("parses floats as integers (truncates)", () => {
    expect(parseIntSafe("12.9")).toBe(12);
    expect(parseIntSafe("0.5")).toBe(0);
  });
});

describe("clamp", () => {
  it("returns value when within range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("returns min when value is below range", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it("returns max when value is above range", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it("handles edge cases", () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });
});

describe("formatDuration", () => {
  it("formats milliseconds", () => {
    expect(formatDuration(500)).toBe("500ms");
    expect(formatDuration(0)).toBe("0ms");
    expect(formatDuration(999)).toBe("999ms");
  });

  it("formats seconds", () => {
    expect(formatDuration(1000)).toBe("1.0s");
    expect(formatDuration(1500)).toBe("1.5s");
    expect(formatDuration(59999)).toBe("60.0s");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(60000)).toBe("1m 0s");
    expect(formatDuration(90000)).toBe("1m 30s");
    expect(formatDuration(125000)).toBe("2m 5s");
  });
});
