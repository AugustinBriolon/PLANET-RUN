import type { CityDetectionService } from "@/server/services/city-detection-service";

/** Stub city detection for tests: always returns 0 (no new cities detected). */
export function createInMemoryCityDetectionService(): CityDetectionService {
  return {
    async detectAndImportCitiesForUser() {
      return 0;
    },
  };
}
