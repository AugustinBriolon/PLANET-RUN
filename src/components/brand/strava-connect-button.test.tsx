import { render, screen } from "@testing-library/react";
import { useFormStatus } from "react-dom";
import { describe, expect, it, vi } from "vitest";

import { StravaConnectButton } from "./strava-connect-button";

vi.mock("react-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-dom")>()),
  useFormStatus: vi.fn(),
}));

const mockFormStatus = (pending: boolean) =>
  vi.mocked(useFormStatus).mockReturnValue({ pending } as ReturnType<typeof useFormStatus>);

describe("StravaConnectButton", () => {
  it("submits the Strava sign-in form", () => {
    mockFormStatus(false);
    render(<StravaConnectButton />);
    expect(screen.getByRole("button", { name: "Connect with Strava" })).toHaveAttribute("type", "submit");
  });

  it("prevents double submission while redirecting to Strava", () => {
    mockFormStatus(true);
    render(<StravaConnectButton />);
    expect(screen.getByRole("button", { name: "Connecting to Strava…" })).toBeDisabled();
  });
});
