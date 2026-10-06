ALTER TABLE "users" ADD COLUMN "expo_push_token" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "analysis_notify_pending" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "strava_accounts" ADD COLUMN "history_sync_page" integer;
--> statement-breakpoint
ALTER TABLE "city_import_queue" ADD COLUMN "priority" integer DEFAULT 0 NOT NULL;
