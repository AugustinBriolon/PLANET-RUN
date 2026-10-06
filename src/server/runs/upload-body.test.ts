import { describe, expect, it } from "vitest";

import { runUploadBodySchema } from "./upload-body";

const validPoint = { lat: 48.9, lng: 2.25, time: 1_700_000_000_000, altitude: 40 };

describe("runUploadBodySchema", () => {
  it("accepts fractional GPS timestamps by truncating them", () => {
    const parsed = runUploadBodySchema.safeParse({
      clientRunId: "run-abcd-12",
      name: "Cityfil · Colombes",
      segments: [
        [
          { ...validPoint, time: 1_700_000_000_000.7 },
          { ...validPoint, lat: 48.901, time: 1_700_000_001_234.2, altitude: null },
        ],
      ],
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.segments[0]?.[0]?.time).toBe(1_700_000_000_000);
    expect(parsed.data.segments[0]?.[1]?.time).toBe(1_700_000_001_234);
  });

  it("turns non-finite altitude into null instead of rejecting the run", () => {
    const parsed = runUploadBodySchema.safeParse({
      clientRunId: "run-abcd-12",
      name: "Cityfil",
      segments: [
        [
          { ...validPoint, altitude: Number.NaN },
          { ...validPoint, lat: 48.901, altitude: Number.POSITIVE_INFINITY },
        ],
      ],
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.segments[0]?.[0]?.altitude).toBeNull();
    expect(parsed.data.segments[0]?.[1]?.altitude).toBeNull();
  });

  it("still rejects a body with too few points", () => {
    const parsed = runUploadBodySchema.safeParse({
      clientRunId: "run-abcd-12",
      name: "Cityfil",
      segments: [[{ ...validPoint }]],
    });
    expect(parsed.success).toBe(false);
  });
});
