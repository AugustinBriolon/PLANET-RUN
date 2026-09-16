import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SettingsMenu } from "./settings-menu";

describe("SettingsMenu", () => {
  it("opens the privacy policy without leaving the globe", async () => {
    render(<SettingsMenu signOutAction={vi.fn()} deleteDataAction={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Settings" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Privacy" }));

    expect(await screen.findByRole("dialog", { name: "Privacy" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Deleting your data" })).toBeInTheDocument();
  });

  it("offers sign out from the settings menu", async () => {
    render(<SettingsMenu signOutAction={vi.fn()} deleteDataAction={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Settings" }));

    expect(await screen.findByRole("menuitem", { name: "Sign out" })).toHaveAttribute("type", "submit");
  });

  it("asks for confirmation before deleting data", async () => {
    const deleteDataAction = vi.fn();
    render(<SettingsMenu signOutAction={vi.fn()} deleteDataAction={deleteDataAction} />);

    await userEvent.click(screen.getByRole("button", { name: "Settings" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Delete my data" }));

    expect(await screen.findByRole("alertdialog", { name: "Delete all your Planet Run data?" })).toBeInTheDocument();
    expect(deleteDataAction).not.toHaveBeenCalled();
  });
});
