import { describe, expect, it } from "vitest";
import { slugFor } from "./polymarket";

describe("slugFor", () => {
  const close = Date.UTC(2026, 10, 8, 5);
  it("builds Polymarket's slug from the title", () => {
    expect(slugFor("Highest temperature in NYC on November 7?", close)).toBe("highest-temperature-in-nyc-on-november-7-2026");
    expect(slugFor("Highest temperature in London on November 2? (replay of Polymarket, with an arbitrage bot)", close)).toBe(
      "highest-temperature-in-london-on-november-2-2026",
    );
  });
  it("ignores other questions", () => {
    expect(slugFor("Highest 1-hour PM2.5 in Singapore", close)).toBeNull();
  });
});
