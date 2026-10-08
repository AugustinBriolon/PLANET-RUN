import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_CITY_MAP_LAYERS } from "@/lib/coverage/city-map-layers";

import { CityLayerControls } from "./city-layer-controls";

describe("CityLayerControls", () => {
  it("toggles a layer when pressed", async () => {
    const onToggle = vi.fn();
    render(<CityLayerControls layers={DEFAULT_CITY_MAP_LAYERS} onToggle={onToggle} />);

    await userEvent.click(screen.getByRole("button", { name: "Heatmap" }));
    expect(onToggle).toHaveBeenCalledExactlyOnceWith("heatmap");
  });

  it("marks active layers as pressed", () => {
    render(<CityLayerControls layers={DEFAULT_CITY_MAP_LAYERS} onToggle={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Remaining" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Heatmap" })).toHaveAttribute("aria-pressed", "false");
  });
});
