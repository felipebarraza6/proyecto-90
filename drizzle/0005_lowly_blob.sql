CREATE TABLE `user_workout_overrides` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`workout_exercise_id` integer NOT NULL,
	`sets` integer,
	`reps` text,
	`rest_seconds` integer,
	`notes` text,
	`updated_by` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_workout_overrides_user_exercise_idx` ON `user_workout_overrides` (`user_id`,`workout_exercise_id`);--> statement-breakpoint
ALTER TABLE `nutrition_plans` ADD `review_status` text DEFAULT 'pending_review' NOT NULL;--> statement-breakpoint
ALTER TABLE `nutrition_plans` ADD `review_note` text;--> statement-breakpoint
ALTER TABLE `nutrition_plans` ADD `reviewed_by` text;--> statement-breakpoint
ALTER TABLE `nutrition_plans` ADD `reviewed_at` text;--> statement-breakpoint
ALTER TABLE `onboarding_questions` ADD `audience` text DEFAULT 'both' NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `professional_type` text;
--> statement-breakpoint
UPDATE `nutrition_plans` SET `review_status`='approved';
