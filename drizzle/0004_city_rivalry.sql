ALTER TABLE "users" ADD COLUMN "profile_visibility" text DEFAULT 'private' NOT NULL;
--> statement-breakpoint
CREATE TABLE "city_conquests" (
	"user_id" uuid NOT NULL,
	"area_id" bigint NOT NULL,
	"completed_at" timestamp with time zone NOT NULL,
	"completion_distance_meters" double precision NOT NULL,
	CONSTRAINT "city_conquests_user_id_area_id_pk" PRIMARY KEY("user_id","area_id")
);
--> statement-breakpoint
CREATE TABLE "city_invites" (
	"token" text PRIMARY KEY NOT NULL,
	"inviter_id" uuid NOT NULL,
	"area_id" bigint NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "city_rivalries" (
	"area_id" bigint NOT NULL,
	"user_low" uuid NOT NULL,
	"user_high" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "city_rivalries_area_id_user_low_user_high_pk" PRIMARY KEY("area_id","user_low","user_high")
);
--> statement-breakpoint
ALTER TABLE "city_conquests" ADD CONSTRAINT "city_conquests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "city_invites" ADD CONSTRAINT "city_invites_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "city_invites" ADD CONSTRAINT "city_invites_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "city_rivalries" ADD CONSTRAINT "city_rivalries_user_low_users_id_fk" FOREIGN KEY ("user_low") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "city_rivalries" ADD CONSTRAINT "city_rivalries_user_high_users_id_fk" FOREIGN KEY ("user_high") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "city_conquests_area_id_completed_at_index" ON "city_conquests" USING btree ("area_id","completed_at");
--> statement-breakpoint
CREATE INDEX "city_invites_inviter_id_area_id_index" ON "city_invites" USING btree ("inviter_id","area_id");
