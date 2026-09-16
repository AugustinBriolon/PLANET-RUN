import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useFormStatus } from "react-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DeleteDataDialog } from "./delete-data-dialog";

vi.mock("react-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-dom")>()),
  useFormStatus: vi.fn(),
}));

const mockFormStatus = (pending: boolean) =>
  vi.mocked(useFormStatus).mockReturnValue({ pending } as ReturnType<typeof useFormStatus>);

describe("DeleteDataDialog", () => {
  beforeEach(() => mockFormStatus(false));

  it("explains the consequences and submits the deletion form", () => {
    render(<DeleteDataDialog open onOpenChange={vi.fn()} deleteAction={vi.fn()} />);

    expect(screen.getByText(/Your activities on Strava are not affected/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete everything" })).toHaveAttribute("type", "submit");
  });

  it("lets the user back out", async () => {
    const onOpenChange = vi.fn();
    render(<DeleteDataDialog open onOpenChange={onOpenChange} deleteAction={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Keep my data" }));

    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
  });

  it("prevents double submission while deleting", () => {
    mockFormStatus(true);
    render(<DeleteDataDialog open onOpenChange={vi.fn()} deleteAction={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Deleting…" })).toBeDisabled();
  });
});
