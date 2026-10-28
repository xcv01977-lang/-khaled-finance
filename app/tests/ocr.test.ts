import { describe, expect, it } from "vitest";
import { preprocess } from "@/lib/ocr";

const px = (...grey: number[]) => new Uint8ClampedArray(grey.flatMap((g) => [g, g, g, 255]));

describe("preprocess", () => {
  it("stretches a flat, low-contrast photo to the full range", () => {
    const data = px(...Array.from({ length: 100 }, (_, i) => 100 + Math.round(i / 5))); // 100..119
    preprocess(data);
    const reds = Array.from({ length: 100 }, (_, i) => data[i * 4]);
    expect(Math.min(...reds)).toBe(0);
    expect(Math.max(...reds)).toBe(255);
    expect(reds).toEqual([...reds].sort((a, b) => a - b)); // order is preserved
  });
  it("turns colour into grey and makes every pixel opaque", () => {
    const d = new Uint8ClampedArray([255, 0, 0, 10, 0, 255, 0, 10, 0, 0, 255, 10, 255, 255, 255, 10]);
    preprocess(d);
    for (let i = 0; i < d.length; i += 4) {
      expect(d[i]).toBe(d[i + 1]);
      expect(d[i]).toBe(d[i + 2]);
      expect(d[i + 3]).toBe(255);
    }
  });
  it("does not divide by zero on a blank page", () => {
    const d = px(...Array(50).fill(200));
    expect(() => preprocess(d)).not.toThrow();
    expect(d[0]).toBeGreaterThanOrEqual(0);
  });
});
