import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { RunFeatureProperties } from "@/lib/runs/run-geojson";

import { RunDetailView } from "./run-detail-view";

vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion/react")>()),
  useReducedMotion: () => true,
}));

const run: RunFeatureProperties = {
  id: 1,
  name: "Sunday long run",
  startDate: "2026-09-16T06:30:00.000Z",
  distanceMeters: 18_400,
  movingTimeSeconds: 3600 + 20 * 60,
};

describe("RunDetailView", () => {
  it("shows the run's name, date, distance and duration", async () => {
    render(<RunDetailView run={run} onClose={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Sunday long run" })).toBeInTheDocument();
    expect(screen.getByText("Sep 16, 2026")).toBeInTheDocument();
    expect(await screen.findByText("18")).toBeInTheDocument();
    expect(await screen.findByText("1h 20")).toBeInTheDocument();
  });

  it("calls onClose when the close button is pressed", () => {
    const onClose = vi.fn();
    render(<RunDetailView run={run} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Close run details" }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
