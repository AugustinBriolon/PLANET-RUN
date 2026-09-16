import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RunStatsPanel } from "./run-stats-panel";

vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion/react")>()),
  useReducedMotion: () => true,
}));

describe("RunStatsPanel", () => {
  it("shows every total with its unit", async () => {
    render(
      <RunStatsPanel
        stats={{
          runCount: 312,
          totalDistanceMeters: 2_845_300,
          totalMovingTimeSeconds: 900_000,
          totalElevationGainMeters: 21_400,
        }}
      />,
    );

    const panel = screen.getByRole("region", { name: "Your running totals" });
    expect(within(panel).getByText("Runs")).toBeInTheDocument();
    expect(await within(panel).findByText("312")).toBeInTheDocument();
    expect(await within(panel).findByText("2,845")).toBeInTheDocument();
    expect(await within(panel).findByText("250")).toBeInTheDocument();
    expect(await within(panel).findByText("21,400")).toBeInTheDocument();
    expect(within(panel).getByText("Powered by Strava")).toBeInTheDocument();
  });
});
