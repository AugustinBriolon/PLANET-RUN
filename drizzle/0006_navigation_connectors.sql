ALTER TABLE "street_segments" ADD COLUMN "counts_for_coverage" boolean DEFAULT true NOT NULL;--> statement-breakpoint
UPDATE "street_segments" SET "counts_for_coverage" = false WHERE "highway" IN ('footway', 'path', 'steps');
