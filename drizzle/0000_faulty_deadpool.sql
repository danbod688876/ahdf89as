CREATE TYPE "public"."asset_type" AS ENUM('home', 'vehicle', 'garden');--> statement-breakpoint
CREATE TYPE "public"."calendar_provider" AS ENUM('google', 'microsoft');--> statement-breakpoint
CREATE TYPE "public"."event_source" AS ENUM('outlook', 'gmail', 'dashboard');--> statement-breakpoint
CREATE TYPE "public"."garden_action_type" AS ENUM('water', 'prune', 'fertilize', 'watch', 'other');--> statement-breakpoint
CREATE TYPE "public"."garden_task_status" AS ENUM('open', 'done');--> statement-breakpoint
CREATE TYPE "public"."garden_urgency" AS ENUM('today', 'this_week', 'someday');--> statement-breakpoint
CREATE TYPE "public"."goal_status" AS ENUM('not_started', 'in_progress', 'done');--> statement-breakpoint
CREATE TYPE "public"."reminder_category" AS ENUM('bill', 'renewal', 'general');--> statement-breakpoint
CREATE TYPE "public"."trip_purpose" AS ENUM('vacation', 'conference_plus_vacation');--> statement-breakpoint
CREATE TYPE "public"."trip_status" AS ENUM('requested', 'approved', 'booked', 'confirmed');--> statement-breakpoint
CREATE TABLE "calendar_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "calendar_provider" NOT NULL,
	"email" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"expires_at" timestamp with time zone,
	"scope" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "event_source" NOT NULL,
	"external_id" text,
	"owner_ids" uuid[] NOT NULL,
	"title" text NOT NULL,
	"start" timestamp with time zone NOT NULL,
	"end" timestamp with time zone NOT NULL,
	"attendees" jsonb DEFAULT '[]'::jsonb,
	"is_household_layer" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "garden_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plant_id" uuid,
	"raw_text" text NOT NULL,
	"action_type" "garden_action_type" DEFAULT 'other' NOT NULL,
	"urgency" "garden_urgency" DEFAULT 'someday' NOT NULL,
	"status" "garden_task_status" DEFAULT 'open' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_ids" uuid[] NOT NULL,
	"title" text NOT NULL,
	"target_date" date,
	"status" "goal_status" DEFAULT 'not_started' NOT NULL,
	"linked_event_ids" uuid[] DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hotel_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"name" text NOT NULL,
	"price" numeric(10, 2),
	"link" text,
	"notes" text,
	"selected" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_type" "asset_type" NOT NULL,
	"asset_name" text NOT NULL,
	"asset_ref_id" uuid,
	"task" text NOT NULL,
	"interval_days" integer,
	"interval_miles" integer,
	"last_done" date,
	"last_done_mileage" integer,
	"next_due" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"maintenance_item_id" uuid NOT NULL,
	"completed_at" date NOT NULL,
	"mileage_at" integer,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"common_name" text NOT NULL,
	"species" text,
	"nicknames" text[] DEFAULT '{}',
	"location_tag" text,
	"reference_photo_url" text,
	"is_real_photo" boolean DEFAULT false NOT NULL,
	"first_identified_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_ids" uuid[] NOT NULL,
	"title" text NOT NULL,
	"category" "reminder_category" DEFAULT 'general' NOT NULL,
	"due_date" date NOT NULL,
	"recurrence_rule" text,
	"amount" numeric(10, 2),
	"account" text,
	"lead_time_days" integer DEFAULT 7 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"destination" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"purpose" "trip_purpose" DEFAULT 'vacation' NOT NULL,
	"status" "trip_status" DEFAULT 'requested' NOT NULL,
	"blocks_calendar" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calendar_accounts" ADD CONSTRAINT "calendar_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garden_tasks" ADD CONSTRAINT "garden_tasks_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garden_tasks" ADD CONSTRAINT "garden_tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotel_options" ADD CONSTRAINT "hotel_options_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_log" ADD CONSTRAINT "maintenance_log_maintenance_item_id_maintenance_items_id_fk" FOREIGN KEY ("maintenance_item_id") REFERENCES "public"."maintenance_items"("id") ON DELETE cascade ON UPDATE no action;