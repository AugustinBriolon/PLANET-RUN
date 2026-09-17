import { describe, expect, it } from "vitest";

import { panelMotion } from "./panel-motion";

function hiddenY(mode: "sheet" | "swap"): unknown {
  const { variants } = panelMotion(mode);
  return (variants.hidden as Record<string, unknown>).y;
}

describe("panelMotion", () => {
  it("sends a panel that owns its corner fully off-frame", () => {
    expect(hiddenY("sheet")).toBe("100%");
  });

  it("keeps a panel that shares a slot nearly in place", () => {
    // The stats panel and the run detail panel swap in the same slot on mobile. If both travelled a
    // full panel height in opposite directions they would slide through each other; the swap has to
    // stay a crossfade, so its offset must be a small pixel nudge, never a percentage of its height.
    const y = hiddenY("swap");

    expect(typeof y).toBe("number");
    expect(Math.abs(y as number)).toBeLessThan(24);
  });
});
