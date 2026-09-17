"use client";

import { Info } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const ATTRIBUTIONS = [
  { label: "OpenStreetMap contributors", href: "https://www.openstreetmap.org/copyright" },
  { label: "CARTO", href: "https://carto.com/about-carto/" },
];

/**
 * Map data attribution as a plain icon (same treatment as the Settings gear) instead of MapLibre's
 * own attribution widget, which docks to a map corner and fights the stats panel for room.
 */
export function AttributionInfo() {
  return (
    <Popover>
      <PopoverTrigger
        aria-label="Map data attribution"
        className="group -m-1.5 flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 ease-out outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-accent data-popup-open:text-foreground"
      >
        <Info className="size-4" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-auto">
        <p className="text-xs text-muted-foreground">
          {ATTRIBUTIONS.map((attribution, index) => (
            <span key={attribution.href}>
              {index > 0 && ", "}©{" "}
              <a
                href={attribution.href}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                {attribution.label}
              </a>
            </span>
          ))}
        </p>
      </PopoverContent>
    </Popover>
  );
}
