import { describe, expect, it } from "vitest";

import { formatHours, formatKilometers, formatPercent, formatWholeNumber } from "./format";

describe("formatters", () => {
  it("formats meters as whole kilometers with grouping", () => {
    expect(formatKilometers(1_234_567)).toBe("1,235");
  });

  it("formats seconds as whole hours", () => {
    expect(formatHours(5 * 3600 + 1200)).toBe("5");
  });

  it("rounds intermediate animation values", () => {
    expect(formatWholeNumber(41.6)).toBe("42");
  });

  it("formats shares as percentages rounded down to one decimal", () => {
    expect(formatPercent(0.12345)).toBe("12.3%");
    expect(formatPercent(0.99999)).toBe("99.9%");
    expect(formatPercent(1)).toBe("100.0%");
    expect(formatPercent(0)).toBe("0.0%");
  });
});
