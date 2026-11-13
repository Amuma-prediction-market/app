import { describe, expect, it } from "vitest";
import { checkMeta } from "./token";

describe("checkMeta", () => {
  it("takes a token's symbol and decimals as they are", () => {
    expect(checkMeta("tusd.testnet", { spec: "ft-1.0.0", name: "Test USD", symbol: "tUSD", decimals: 6 })).toEqual({ symbol: "tUSD", decimals: 6 });
    expect(checkMeta("t", { symbol: "X", decimals: 0 })).toEqual({ symbol: "X", decimals: 0 });
    expect(checkMeta("t", { symbol: "wNEAR", decimals: 24 })).toEqual({ symbol: "wNEAR", decimals: 24 });
  });

  it("refuses decimals that are not a whole number from 0 to 24", () => {
    for (const decimals of [-1, 25, 6.5, "6", null, undefined, Number.NaN, 1e9]) {
      expect(() => checkMeta("t", { symbol: "X", decimals })).toThrow(/decimals/);
    }
  });

  it("refuses a symbol that is not short text", () => {
    for (const symbol of ["", "A".repeat(17), 7, null, undefined, ["tUSD"]]) {
      expect(() => checkMeta("t", { symbol, decimals: 6 })).toThrow(/symbol/);
    }
    expect(() => checkMeta("t", null)).toThrow();
  });
});
