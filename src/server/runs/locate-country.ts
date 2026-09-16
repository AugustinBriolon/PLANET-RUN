import "server-only";

import { iso1A2Code } from "@rapideditor/country-coder";

import type { LocateCountry } from "@/lib/runs/run-stats";

// Offline lookup: run positions never leave the server. Kept server-side to keep the ~3 MB border dataset
// out of the client bundle. The default "country" level rolls overseas regions (e.g. Réunion) up to their country.
export const locateCountry: LocateCountry = (position) => iso1A2Code(position);
