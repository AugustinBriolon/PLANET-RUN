import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SettingsMenu } from "./settings-menu";

describe("SettingsMenu", () => {
  it("links to the privacy page", async () => {
    render(<SettingsMenu deleteDataAction={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Settings" }));

    expect(await screen.findByRole("menuitem", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
  });

  it("asks for confirmation before deleting data", async () => {
    const deleteDataAction = vi.fn();
    render(<SettingsMenu deleteDataAction={deleteDataAction} />);

    await userEvent.click(screen.getByRole("button", { name: "Settings" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Delete my data" }));

    expect(await screen.findByRole("alertdialog", { name: "Delete all your Planet Run data?" })).toBeInTheDocument();
    expect(deleteDataAction).not.toHaveBeenCalled();
  });
});
