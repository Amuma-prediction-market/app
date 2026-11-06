import { describe, expect, it } from "vitest";
import { cityOf, splitTitle, timeLeft } from "./format";

describe("format", () => {
  it("reads the city and strips the replay note", () => {
    expect(cityOf("Highest temperature in NYC on November 7?")).toBe("NYC");
    expect(splitTitle("Highest temperature in London on November 2? (replay of Polymarket, with an arbitrageur)")).toEqual({
      title: "Highest temperature in London on November 2?",
      replay: true,
    });
  });
  it("counts down", () => {
    expect(timeLeft(90 * 60_000)).toBe("1h 30m");
    expect(timeLeft(26 * 3_600_000)).toBe("1d 2h");
    expect(timeLeft(-1)).toBe("now");
  });
});
