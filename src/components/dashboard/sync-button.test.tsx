import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SyncButton } from "./sync-button";

describe("SyncButton", () => {
  it("triggers a sync when clicked", async () => {
    const onSync = vi.fn();
    render(<SyncButton isSyncing={false} onSync={onSync} />);

    await userEvent.click(screen.getByRole("button", { name: "Sync runs" }));

    expect(onSync).toHaveBeenCalledOnce();
  });

  it("is disabled and announces progress while syncing", () => {
    render(<SyncButton isSyncing onSync={vi.fn()} />);

    const button = screen.getByRole("button", { name: "Syncing…" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });
});
