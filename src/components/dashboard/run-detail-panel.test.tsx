import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { RunFeatureProperties } from "@/lib/runs/run-geojson";

import { RunDetailPanel } from "./run-detail-panel";

vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion/react")>()),
  useReducedMotion: () => true,
}));

const run: RunFeatureProperties = {
  id: 1,
  name: "Sunday long run",
  startDate: "2026-09-16T06:30:00.000Z",
  distanceMeters: 18_400,
  movingTimeSeconds: 4_800,
};

describe("RunDetailPanel", () => {
  it("renders nothing when no run is selected", () => {
    render(<RunDetailPanel run={null} onClose={vi.fn()} />);

    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("shows the selected run's details and closes on request", () => {
    const onClose = vi.fn();
    render(<RunDetailPanel run={run} onClose={onClose} />);

    expect(screen.getByRole("region", { name: "Sunday long run details" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close run details" }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
