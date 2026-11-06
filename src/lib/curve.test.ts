import { describe, expect, it } from "vitest";
import { costOf, tokensFor } from "./curve";

describe("curve estimates", () => {
  it("prices a small buy at about the price", () => {
    expect(costOf(1, 0.4, 1_000, true)).toBeCloseTo(0.4, 3);
    expect(costOf(1, 0.4, 1_000, false)).toBeCloseTo(0.6, 3);
  });

  it("turns money into tokens and back", () => {
    for (const [p, yes] of [[0.41, true], [0.41, false], [0.0095, true], [0.97, false]] as const) {
      const t = tokensFor(250, p, 710, yes);
      expect(costOf(t, p, 710, yes)).toBeCloseTo(250, 6);
    }
  });

  it("gets more than one token a dollar only below a price of 1", () => {
    expect(tokensFor(100, 0.5, 710, true)).toBeGreaterThan(100);
    expect(tokensFor(100, 0.5, 710, true)).toBeLessThan(200);
  });
});
