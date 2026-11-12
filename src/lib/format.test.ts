import { describe, expect, it } from "vitest";
import { cityBySlug, cityOf, cityOfTitle, splitTitle, timeLeft } from "./format";

describe("format", () => {
  it("reads the city and strips the replay note", () => {
    expect(cityOf("Highest temperature in NYC on November 7?")).toBe("NYC");
    expect(splitTitle("Highest temperature in London on November 2? (replay of Polymarket, with an arbitrage bot)")).toEqual({
      title: "Highest temperature in London on November 2?",
      date: "November 2",
      replay: true,
    });
    expect(splitTitle("Highest temperature in NYC on November 11?")).toEqual({
      title: "Highest temperature in New York on November 11?",
      date: "November 11",
      replay: false,
    });
    expect(splitTitle("Highest 1-hour PM2.5 in Singapore (testnet demo)").date).toBeNull();
  });
  it("puts each question on its own city's page", () => {
    expect(cityOfTitle("Highest temperature in NYC on November 11?")?.slug).toBe("new-york");
    expect(cityOfTitle("Highest temperature in London on November 2? (replay of Polymarket, with an arbitrage bot)")?.slug).toBe("london");
    expect(cityOfTitle("Highest 1-hour PM2.5 in Singapore (testnet demo)")).toBeNull();
    expect(cityBySlug("london")?.name).toBe("London");
    expect(cityBySlug("paris")).toBeNull();
  });
  it("counts down", () => {
    expect(timeLeft(90 * 60_000)).toBe("1h 30m");
    expect(timeLeft(26 * 3_600_000)).toBe("1d 2h");
    expect(timeLeft(-1)).toBe("now");
  });
});
