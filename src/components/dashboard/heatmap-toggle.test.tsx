import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { HeatmapToggle } from "./heatmap-toggle";

describe("HeatmapToggle", () => {
  it("toggles the heatmap when clicked", async () => {
    const onToggle = vi.fn();
    render(<HeatmapToggle active={false} onToggle={onToggle} />);

    await userEvent.click(screen.getByRole("button", { name: "Show heatmap" }));

    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("announces the pressed state when the heatmap is on", () => {
    render(<HeatmapToggle active onToggle={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Hide heatmap" })).toHaveAttribute("aria-pressed", "true");
  });
});
