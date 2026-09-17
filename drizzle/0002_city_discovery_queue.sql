CREATE TABLE "user_cities" (
	"user_id" uuid NOT NULL,
	"osm_relation_id" bigint NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_cities_user_id_osm_relation_id_pk" PRIMARY KEY("user_id","osm_relation_id")
);
--> statement-breakpoint
CREATE TABLE "city_import_queue" (
	"osm_relation_id" bigint PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_geocode_cells" (
	"user_id" uuid NOT NULL,
	"cell_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_geocode_cells_user_id_cell_key_pk" PRIMARY KEY("user_id","cell_key")
);
--> statement-breakpoint
ALTER TABLE "user_cities" ADD CONSTRAINT "user_cities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_geocode_cells" ADD CONSTRAINT "user_geocode_cells_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "user_cities_osm_relation_id_index" ON "user_cities" USING btree ("osm_relation_id");
--> statement-breakpoint
-- Backfill: athletes who already have street matches keep those cities without re-discovering.
INSERT INTO "user_cities" ("user_id", "osm_relation_id", "name")
SELECT DISTINCT activities.user_id, areas.osm_relation_id, areas.name
FROM activity_street_segments
JOIN activities ON activities.strava_activity_id = activity_street_segments.activity_id
JOIN street_segments ON street_segments.id = activity_street_segments.segment_id
JOIN areas ON areas.osm_relation_id = street_segments.area_id
ON CONFLICT DO NOTHING;
