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
    render(<CityCoverageList cities={cities} onSelectCity={onSelectCity} />);

    await userEvent.click(screen.getByRole("button", { name: "Fly to La Garenne-Colombes" }));

    expect(onSelectCity).toHaveBeenCalledExactlyOnceWith(91775);
  });

  it("shows pending cities without a coverage percentage", () => {
    render(
      <CityCoverageList
        cities={[
          {
            areaId: 1,
            name: "Nanterre",
            status: "pending",
            coveredMeters: 0,
            totalMeters: 0,
            bounds: null,
          },
        ]}
        onSelectCity={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Nanterre (analyzing streets)" })).toBeDisabled();
    expect(screen.getByLabelText("Street analysis pending")).toHaveTextContent("…");
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });
});
