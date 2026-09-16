import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import { UserBadge } from "./user-badge";

function renderBadge(avatarUrl: string | null = null) {
  return render(
    <TooltipProvider>
      <UserBadge displayName="Ada Lovelace" avatarUrl={avatarUrl} signOutAction={vi.fn()} />
    </TooltipProvider>,
  );
}

describe("UserBadge", () => {
  it("shows the athlete name with initials as avatar fallback", () => {
    renderBadge();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("AL")).toBeInTheDocument();
  });

  it("offers an accessible sign-out button", () => {
    renderBadge();
    expect(screen.getByRole("button", { name: "Sign out" })).toHaveAttribute("type", "submit");
  });
});
