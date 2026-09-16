"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export type DeleteDataDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deleteAction: () => Promise<void>;
};

function ConfirmDeletionButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={pending} aria-busy={pending} className="w-full">
      {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
      {pending ? "Deleting…" : "Delete everything"}
    </Button>
  );
}

export function DeleteDataDialog({ open, onOpenChange, deleteAction }: DeleteDataDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete all your Planet Run data?</AlertDialogTitle>
          <AlertDialogDescription>
            Your imported runs and profile are permanently erased and Planet Run loses access to your Strava account.
            Your activities on Strava are not affected. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep my data</AlertDialogCancel>
          <form action={deleteAction}>
            <ConfirmDeletionButton />
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
