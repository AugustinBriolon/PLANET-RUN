import { describe, expect, it } from "vitest";

import { panelMotion } from "./panel-motion";

function hiddenTransform(mode: "sheet" | "swap"): string {
  const { variants } = panelMotion(mode);
  return (variants.hidden as { transform: string }).transform;
}

describe("panelMotion", () => {
  it("sends a panel that owns its corner fully off-frame", () => {
    expect(hiddenTransform("sheet")).toContain("translateY(100%)");
  });

  it("keeps a panel that shares a slot nearly in place", () => {
    // The stats panel and the run detail panel swap in the same slot on mobile. If both travelled a
    // full panel height in opposite directions they would slide through each other; the swap has to
    // stay a crossfade, so its offset must be a small pixel nudge, never a percentage of its height.
    const transform = hiddenTransform("swap");

    expect(transform).toMatch(/translateY\((\d+(?:\.\d+)?)px\)/);
    const match = transform.match(/translateY\((\d+(?:\.\d+)?)px\)/);
    expect(Number(match![1])).toBeLessThan(24);
  });
});
