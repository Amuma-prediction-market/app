import { describe, expect, it } from "vitest";
import { formatCents, formatPercent, formatUnits, parseUnits, WAD } from "./units";

describe("units", () => {
  it("parses decimal amounts exactly", () => {
    expect(parseUnits("12.5", 6)).toBe(12_500_000n);
    expect(parseUnits(".25", 6)).toBe(250_000n);
    expect(parseUnits("7", 6)).toBe(7_000_000n);
    expect(parseUnits("0.0000001", 6)).toBeNull();
    expect(parseUnits("1e3", 6)).toBeNull();
    expect(parseUnits("", 6)).toBeNull();
  });

  it("reads a comma before three digits as thousands, and any other comma as a decimal point", () => {
    expect(parseUnits("1,000", 6)).toBe(1_000_000_000n);
    expect(parseUnits("1,000.50", 6)).toBe(1_000_500_000n);
    expect(parseUnits("1,000,000", 6)).toBe(1_000_000_000_000n);
    expect(parseUnits("0,5", 6)).toBe(500_000n);
    expect(parseUnits("12,25", 6)).toBe(12_250_000n);
    expect(parseUnits("1,", 6)).toBe(1_000_000n);
    expect(parseUnits("0,1234", 6)).toBe(123_400n);
    // A comma after a lone 0 is always a decimal point, never a thousands group.
    expect(parseUnits("0,500", 6)).toBe(500_000n);
    expect(parseUnits("0,123", 6)).toBe(123_000n);
    expect(parseUnits("0,125", 6)).toBe(125_000n);
    expect(parseUnits("1234,567", 6)).toBe(1_234_567_000n); // badly grouped, so 1234.567
    // Mixed grouping and decimal commas are ambiguous, so they are rejected rather than guessed.
    expect(parseUnits("1,000,5", 6)).toBeNull();
  });

  it("formats without rounding up", () => {
    expect(formatUnits(1_234_567_891n, 6)).toBe("1,234.56");
    expect(formatUnits(-5_000_000n, 6, 0)).toBe("−5");
  });

  it("shows prices as percentages and cents", () => {
    expect(formatPercent((WAD * 41n) / 100n)).toBe("41.0%");
    expect(formatPercent(WAD / 100_000n)).toBe("<0.1%");
    expect(formatCents((WAD * 412n) / 1000n)).toBe("41.2¢");
  });
});
