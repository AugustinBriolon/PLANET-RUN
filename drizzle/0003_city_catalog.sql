CREATE TABLE "city_catalog" (
	"osm_relation_id" bigint PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"admin_level" smallint NOT NULL,
	"boundary" geometry(MultiPolygon, 4326) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "city_catalog_boundary_index" ON "city_catalog" USING gist ("boundary");
