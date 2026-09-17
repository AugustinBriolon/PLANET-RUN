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
          countryCount: 7,
        }}
        cityCoverage={[
          {
            areaId: 91775,
            name: "La Garenne-Colombes",
            status: "ready",
            coveredMeters: 19_760,
            totalMeters: 32_400,
            bounds: [
              [2.23, 48.89],
              [2.26, 48.91],
            ],
          },
        ]}
        onSelectCity={vi.fn()}
        signOutAction={vi.fn()}
        deleteDataAction={vi.fn()}
      />,
    );

    const panel = screen.getByRole("region", { name: "Your running totals" });
    expect(within(panel).getByText("Runs")).toBeInTheDocument();
    expect(await within(panel).findByText("312")).toBeInTheDocument();
    expect(await within(panel).findByText("2,845")).toBeInTheDocument();
    expect(await within(panel).findByText("250")).toBeInTheDocument();
    expect(within(panel).getByText("Countries")).toBeInTheDocument();
    expect(await within(panel).findByText("7")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Settings" })).toBeInTheDocument();
    expect(within(panel).getByRole("img", { name: "Powered by Strava" })).toBeInTheDocument();
    expect(within(panel).getByText("Streets")).toBeInTheDocument();
    expect(within(panel).getByText("La Garenne-Colombes")).toBeInTheDocument();
    expect(within(panel).getByText("60.9%")).toBeInTheDocument();
  });

  it("omits the Streets section outside the coverage pilot", () => {
    render(
      <RunStatsPanel
        stats={{ runCount: 1, totalDistanceMeters: 5_000, totalMovingTimeSeconds: 1_800, countryCount: 1 }}
        cityCoverage={[]}
        onSelectCity={vi.fn()}
        signOutAction={vi.fn()}
        deleteDataAction={vi.fn()}
      />,
    );

    expect(screen.queryByText("Streets")).not.toBeInTheDocument();
  });
});
