CREATE TYPE "public"."care_plan_action_type" AS ENUM('recurring', 'one_off');--> statement-breakpoint
CREATE TYPE "public"."season" AS ENUM('winter', 'spring', 'summer', 'fall');--> statement-breakpoint
CREATE TABLE "plant_care_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plant_id" uuid NOT NULL,
	"season" "season" NOT NULL,
	"care_key" text NOT NULL,
	"action" text NOT NULL,
	"type" "care_plan_action_type" NOT NULL,
	"interval_days" integer,
	"is_watering" boolean DEFAULT false NOT NULL,
	"last_surfaced_year" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "maintenance_items" ADD COLUMN "care_key" text;--> statement-breakpoint
ALTER TABLE "maintenance_items" ADD COLUMN "is_watering" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "maintenance_items" ADD COLUMN "weather_note" text;--> statement-breakpoint
ALTER TABLE "plant_care_plan" ADD CONSTRAINT "plant_care_plan_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE cascade ON UPDATE no action;