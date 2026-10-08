import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_CITY_MAP_LAYERS } from "@/lib/coverage/city-map-layers";

import { CityLayerControls } from "./city-layer-controls";

describe("CityLayerControls", () => {
  it("toggles a layer when pressed", async () => {
    const onToggle = vi.fn();
    render(<CityLayerControls layers={DEFAULT_CITY_MAP_LAYERS} onToggle={onToggle} />);

    await userEvent.click(screen.getByRole("button", { name: "Show heatmap" }));
    expect(onToggle).toHaveBeenCalledExactlyOnceWith("heatmap");
  });

  it("marks active layers as pressed", () => {
    render(
      <CityLayerControls
        layers={{ heatmap: false, remaining: true, covered: true }}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Hide remaining streets" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Show heatmap" })).toHaveAttribute("aria-pressed", "false");
  });

  it("fills icons when a layer is active", () => {
    const { container } = render(
      <CityLayerControls
        layers={{ heatmap: true, remaining: false, covered: true }}
        onToggle={vi.fn()}
      />,
    );
    const filled = container.querySelectorAll("svg.fill-current");
    expect(filled).toHaveLength(2);
  });
});
