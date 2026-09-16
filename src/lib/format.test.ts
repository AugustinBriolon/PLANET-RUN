import { describe, expect, it } from "vitest";

import { formatHours, formatKilometers, formatWholeNumber } from "./format";

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
});
