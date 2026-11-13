import { describe, expect, it } from "vitest";
import { isTrusted } from "./aimm";

describe("isTrusted", () => {
  const collateral = "tusd.aimm-weather.testnet";
  const resolvers = ["aimm-weather-oracle.testnet", "council.testnet"];
  const demo = { collateral, resolver: "aimm-weather-oracle.testnet", fallbackResolver: "aimm-weather-oracle.testnet" };

  it("takes a question paid in the collateral with both resolvers trusted", () => {
    expect(isTrusted(demo, collateral, resolvers)).toBe(true);
    expect(isTrusted({ ...demo, fallbackResolver: "council.testnet" }, collateral, resolvers)).toBe(true);
  });

  it("refuses another token, or a resolver or fallback resolver outside the list", () => {
    expect(isTrusted({ ...demo, collateral: "fake-usd.testnet" }, collateral, resolvers)).toBe(false);
    expect(isTrusted({ ...demo, resolver: "someone.testnet" }, collateral, resolvers)).toBe(false);
    expect(isTrusted({ ...demo, fallbackResolver: "someone.testnet" }, collateral, resolvers)).toBe(false);
    expect(isTrusted(demo, collateral, [])).toBe(false);
  });
});
