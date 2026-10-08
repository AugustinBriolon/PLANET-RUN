import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CityDetailPanel } from "./city-detail-panel";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("CityDetailPanel", () => {
  it("shows coverage and closes", async () => {
    const onClose = vi.fn();
    render(
      <CityDetailPanel
        city={{
          areaId: 1,
          name: "Colombes",
          status: "ready",
          coveredMeters: 5_000,
          strictCoveredMeters: 5_000,
          totalMeters: 10_000,
          bounds: [
            [2.2, 48.9],
            [2.3, 48.95],
          ],
        }}
        onClose={onClose}
      />,
    );

    expect(screen.getByRole("heading", { name: "Colombes" })).toBeInTheDocument();
    expect(screen.getByText(/50\.0%/)).toBeInTheDocument();
    expect(screen.getByText(/5 km left/)).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Map layers" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close city" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
