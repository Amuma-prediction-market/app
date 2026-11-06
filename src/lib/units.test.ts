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
