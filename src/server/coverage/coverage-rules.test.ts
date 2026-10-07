import { describe, expect, it } from "vitest";

import { COVERAGE_RULES, softCoverageCredit } from "./coverage-rules";

describe("softCoverageCredit", () => {
  it("returns 0 below the soft floor", () => {
    expect(softCoverageCredit(0.49)).toBe(0);
    expect(softCoverageCredit(0)).toBe(0);
  });

  it("ramps linearly between soft floor and hard threshold", () => {
    const mid = (COVERAGE_RULES.softCreditFloor + COVERAGE_RULES.minCoveredShare) / 2;
    expect(softCoverageCredit(mid)).toBeCloseTo(0.5, 5);
    expect(softCoverageCredit(COVERAGE_RULES.softCreditFloor)).toBeCloseTo(0, 5);
  });

  it("returns full credit at or above the hard threshold", () => {
    expect(softCoverageCredit(0.85)).toBe(1);
    expect(softCoverageCredit(1)).toBe(1);
  });
});
