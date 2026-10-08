import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { CityCoverage } from "@/lib/coverage/street-coverage";

import { CityCoverageList } from "./city-coverage-list";

const cities: CityCoverage[] = [
  {
    areaId: 91775,
    name: "La Garenne-Colombes",
    status: "ready",
    coveredMeters: 19_760,
    strictCoveredMeters: 19_760,
    totalMeters: 32_400,
    bounds: [
      [2.23, 48.89],
      [2.26, 48.91],
    ],
  },
];

describe("CityCoverageList", () => {
  it("flies to a city when its name is clicked", async () => {
    const onSelectCity = vi.fn();
    render(<CityCoverageList cities={cities} selectedCityId={null} onSelectCity={onSelectCity} />);

    await userEvent.click(screen.getByRole("button", { name: "Open details for La Garenne-Colombes" }));

    expect(onSelectCity).toHaveBeenCalledExactlyOnceWith(91775);
  });

  it("shows pending import cities without a coverage percentage", () => {
    render(
      <CityCoverageList
        cities={[
          {
            areaId: 1,
            name: "Nanterre",
            status: "pending",
            coveredMeters: 0,
            strictCoveredMeters: 0,
            totalMeters: 0,
            bounds: null,
          },
        ]}
        selectedCityId={null}
        onSelectCity={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Nanterre (importing streets)" })).toBeDisabled();
    expect(screen.getByLabelText("Importing streets")).toHaveTextContent("Importing…");
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it("shows matching lag distinctly from pending import", () => {
    render(
      <CityCoverageList
        cities={[
          {
            areaId: 2,
            name: "Colombes",
            status: "matching",
            coveredMeters: 0,
            strictCoveredMeters: 0,
            totalMeters: 100_000,
            bounds: [
              [2.2, 48.9],
              [2.3, 48.95],
            ],
          },
        ]}
        selectedCityId={null}
        onSelectCity={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Colombes (matching runs)" })).toBeDisabled();
    expect(screen.getByLabelText("Matching runs")).toHaveTextContent("Matching…");
  });

  it("truncates a long city name instead of pushing the percentage off the row", () => {
    const longName = "Saint-Rémy-lès-Chevreuse-sur-Loire-en-Forêt";
    render(
      <CityCoverageList
        cities={[
          {
            areaId: 1,
            name: longName,
            status: "ready",
            coveredMeters: 500,
            strictCoveredMeters: 500,
            totalMeters: 1_000,
            bounds: [
              [2.2, 48.8],
              [2.3, 48.9],
            ],
          },
        ]}
        selectedCityId={null}
        onSelectCity={vi.fn()}
      />,
    );

    const name = screen.getByText(longName);
    expect(name).toHaveClass("truncate", "min-w-0");
    expect(name).toHaveAttribute("title", longName);
    expect(name.closest("button")).toHaveClass("min-w-0");
    // The percentage stays a fixed width so a long name can never crowd it out.
    expect(screen.getByText("50.0%").parentElement).toHaveClass("shrink-0");
  });
});
