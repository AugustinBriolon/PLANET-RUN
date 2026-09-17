import { describe, expect, it } from "vitest";

import { overlayRelativeToMap, paddingForOverlay } from "./fit-padding";

describe("paddingForOverlay", () => {
  it("pads the bottom when the panel spans most of the width (mobile)", () => {
    expect(paddingForOverlay({ width: 390, height: 844 }, { top: 520, left: 16, right: 374, bottom: 804 })).toEqual({
      top: 72,
      right: 24,
      bottom: 844 - 520 + 24,
      left: 24,
    });
  });

  it("pads bottom and left when the panel sits in the corner (desktop)", () => {
    expect(paddingForOverlay({ width: 1280, height: 800 }, { top: 480, left: 24, right: 360, bottom: 760 })).toEqual({
      top: 72,
      right: 24,
      bottom: 800 - 480 + 24,
      left: 360 + 24,
    });
  });
});

describe("overlayRelativeToMap", () => {
  it("converts viewport rects into map-local coordinates", () => {
    const map = { top: 0, left: 0, right: 400, bottom: 800, width: 400, height: 800 } as DOMRect;
    const overlay = { top: 500, left: 16, right: 384, bottom: 760, width: 368, height: 260 } as DOMRect;
    expect(overlayRelativeToMap(map, overlay)).toEqual({ top: 500, left: 16, right: 384, bottom: 760 });
  });
});
