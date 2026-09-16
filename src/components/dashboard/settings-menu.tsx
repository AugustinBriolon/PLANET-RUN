"use client";

import { Settings, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { DeleteDataDialog } from "./delete-data-dialog";

export type SettingsMenuProps = {
  deleteDataAction: () => Promise<void>;
};

export function SettingsMenu({ deleteDataAction }: SettingsMenuProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Settings"
          className="group -m-1.5 flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 ease-out outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-accent data-popup-open:text-foreground"
        >
          <Settings
            className="size-4 transition-transform duration-300 ease-out group-hover:rotate-45 group-data-popup-open:rotate-90"
            aria-hidden="true"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" className="w-48">
          <DropdownMenuItem render={<Link href="/privacy" />}>
            <ShieldCheck aria-hidden="true" />
            Privacy
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setIsDeleteDialogOpen(true)}>
            <Trash2 aria-hidden="true" />
            Delete my data
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteDataDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        deleteAction={deleteDataAction}
      />
    </>
  );
}
