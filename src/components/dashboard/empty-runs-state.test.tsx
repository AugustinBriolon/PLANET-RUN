import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { RunSyncFailure } from "@/lib/runs/run-sync-result";

import { EmptyRunsState, type EmptyRunsStateProps } from "./empty-runs-state";

function renderState(props: Partial<EmptyRunsStateProps>) {
  const handlers = { onRetry: vi.fn(), reconnectAction: vi.fn(), deleteDataAction: vi.fn() };
  render(<EmptyRunsState status="idle" failure={null} {...handlers} {...props} />);
  return handlers;
}

const missingPermission: RunSyncFailure = { reason: "missing-permission", message: "Reconnect please." };
const unknownFailure: RunSyncFailure = { reason: "unknown", message: "Syncing with Strava failed." };

describe("EmptyRunsState", () => {
  it("shows progress while runs are being imported", () => {
    renderState({ status: "syncing" });
    expect(screen.getByRole("heading", { name: "Pulling your runs from Strava…" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Try again|Reconnect/ })).not.toBeInTheDocument();
  });

  it("invites the user to record a run when history is empty", () => {
    renderState({ status: "idle" });
    expect(screen.getByRole("heading", { name: "No outdoor runs yet" })).toBeInTheDocument();
  });

  it("keeps settings reachable before any run is imported", () => {
    renderState({ status: "idle" });
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
  });

  it("stops loading and offers a retry when the import fails", async () => {
    const { onRetry } = renderState({ status: "failed", failure: unknownFailure });

    expect(screen.getByRole("heading", { name: "Your runs couldn't be imported" })).toBeInTheDocument();
    expect(screen.getByText("Syncing with Strava failed.")).toBeInTheDocument();
    expect(screen.queryByText("Pulling your runs from Strava…")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("asks to reconnect Strava instead of retrying when activity access is missing", () => {
    renderState({ status: "failed", failure: missingPermission });

    expect(screen.getByRole("button", { name: "Connect with Strava" })).toHaveAttribute("type", "submit");
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });
});
