import { cn } from "@/lib/utils";

export type PlanetRunLogoProps = {
  className?: string;
};

export function PlanetRunLogo({ className }: PlanetRunLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 font-semibold tracking-tight", className)}>
      <svg viewBox="0 0 32 32" aria-hidden="true" className="size-7">
        <circle cx="16" cy="16" r="9" className="fill-foreground/10 stroke-foreground" strokeWidth="1.5" />
        <ellipse
          cx="16"
          cy="16"
          rx="14.5"
          ry="5.5"
          transform="rotate(-24 16 16)"
          className="fill-none stroke-ember"
          strokeWidth="1.5"
        />
        <circle cx="28.4" cy="10.6" r="2.2" className="fill-ember" />
      </svg>
      <span>Planet Run</span>
    </span>
  );
}
