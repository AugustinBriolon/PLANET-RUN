-- Soft / partial street coverage credit (ADR 0013).
-- Stores the raw touched share per matched segment so city % can ramp between
-- softCreditFloor and minCoveredShare instead of a binary cliff at 85%.
ALTER TABLE "activity_street_segments" ADD COLUMN "covered_share" double precision DEFAULT 1 NOT NULL;
--> statement-breakpoint
-- Rematch every run so existing rows get a real touched share (legacy default was 1).
UPDATE "activities" SET "coverage_matched_at" = NULL;
