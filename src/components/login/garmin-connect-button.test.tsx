import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GarminConnectButton } from "./garmin-connect-button";

describe("GarminConnectButton", () => {
  it("is visible but disabled until Garmin is supported", () => {
    render(<GarminConnectButton />);
    const button = screen.getByRole("button", { name: /Connect with Garmin/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription("Coming soon");
  });
});
