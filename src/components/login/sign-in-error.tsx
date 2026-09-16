import { TriangleAlert } from "lucide-react";

export type SignInErrorProps = {
  message: string;
};

export function SignInError({ message }: SignInErrorProps) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-sm text-foreground"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
      {message}
    </p>
  );
}
