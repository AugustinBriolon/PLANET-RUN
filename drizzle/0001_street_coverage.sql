-- PostGIS provides the geometry type and spatial functions used by street coverage (ADR 0008).
CREATE EXTENSION IF NOT EXISTS postgis;--> statement-breakpoint
CREATE TABLE "activity_street_segments" (
	"activity_id" bigint NOT NULL,
	"segment_id" bigint NOT NULL,
	CONSTRAINT "activity_street_segments_activity_id_segment_id_pk" PRIMARY KEY("activity_id","segment_id")
);
--> statement-breakpoint
CREATE TABLE "areas" (
	"osm_relation_id" bigint PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"admin_level" smallint NOT NULL,
	"boundary" geometry(MultiPolygon, 4326) NOT NULL,
	"street_length_meters" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "street_segments" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"area_id" bigint NOT NULL,
	"osm_way_id" bigint NOT NULL,
	"name" text,
	"highway" text NOT NULL,
	"path" geometry(LineString, 4326) NOT NULL,
	"length_meters" double precision NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "coverage_matched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "activity_street_segments" ADD CONSTRAINT "activity_street_segments_activity_id_activities_strava_activity_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("strava_activity_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_street_segments" ADD CONSTRAINT "activity_street_segments_segment_id_street_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."street_segments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "street_segments" ADD CONSTRAINT "street_segments_area_id_areas_osm_relation_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("osm_relation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_street_segments_segment_id_index" ON "activity_street_segments" USING btree ("segment_id");--> statement-breakpoint
CREATE INDEX "areas_boundary_index" ON "areas" USING gist ("boundary");--> statement-breakpoint
CREATE INDEX "street_segments_path_index" ON "street_segments" USING gist ("path");--> statement-breakpoint
CREATE INDEX "street_segments_area_id_index" ON "street_segments" USING btree ("area_id");