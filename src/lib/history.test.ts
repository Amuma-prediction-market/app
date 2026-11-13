import { describe, expect, it } from "vitest";
import { cacheKey, snap, steps, worthKeeping } from "./history";

describe("history", () => {
  it("snaps a height down to the grid of 600 blocks", () => {
    expect(snap(1_234_567)).toBe(1_234_200);
    expect(snap(1_234_200)).toBe(1_234_200);
  });

  it("reads on fixed multiples of a step, so the heights already read stay the same as the end moves on", () => {
    const before = steps(1_000, 100_000, 20);
    const after = steps(1_000, 101_000, 20);
    expect(before.every((h) => h % 600 === 0 && h >= 1_000 && h <= 100_000)).toBe(true);
    expect(before.length).toBeLessThanOrEqual(21);
    expect(after.slice(0, before.length)).toEqual(before);
  });

  it("keeps readings on the grid or at or below the chart's end, never the live tail beyond it", () => {
    const end = 1_234_200;
    expect(worthKeeping(1_233_600, end)).toBe(true);
    expect(worthKeeping(1_233_917, end)).toBe(true);
    expect(worthKeeping(end, end)).toBe(true);
    expect(worthKeeping(1_234_519, end)).toBe(false);
    expect(worthKeeping(1_234_800, end)).toBe(true);
  });

  it("keys each reading by contract, question and height", () => {
    expect(cacheKey("market.example.testnet", 7, 1_234_200)).toBe("aimm:h:market.example.testnet:7:1234200");
    expect(cacheKey("a.testnet", 7, 1)).not.toBe(cacheKey("b.testnet", 7, 1));
  });
});
