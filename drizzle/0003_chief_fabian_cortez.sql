CREATE TYPE "public"."household_task_asset_type" AS ENUM('home', 'vehicle');--> statement-breakpoint
CREATE TYPE "public"."household_task_status" AS ENUM('open', 'done');--> statement-breakpoint
CREATE TABLE "household_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_type" "household_task_asset_type" NOT NULL,
	"asset_reference" text,
	"action" text NOT NULL,
	"due_hint" text,
	"raw_text" text NOT NULL,
	"status" "household_task_status" DEFAULT 'open' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "household_tasks" ADD CONSTRAINT "household_tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;