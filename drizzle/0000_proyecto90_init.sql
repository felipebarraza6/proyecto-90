CREATE TABLE IF NOT EXISTS `users` (`id` text PRIMARY KEY NOT NULL, `email` text NOT NULL, `role` text NOT NULL, `status` text NOT NULL, `created_at` text NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `users_email_unique` ON `users` (`email`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `profiles` (`user_id` text PRIMARY KEY NOT NULL, `first_name` text, `last_name` text, `birthdate` text, `gender` text, `height` real, `weight` real, `city` text);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `onboarding` (`user_id` text PRIMARY KEY NOT NULL, `objective` text, `current_training` integer, `training_days` integer, `preferred_location` text, `equipment` text, `activity_level` text, `macros_experience` integer, `dietary_restrictions` text, `preferences` text, `motivation` text, `health_notes` text, `completed_at` text);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `programs` (`id` text PRIMARY KEY NOT NULL, `name` text NOT NULL, `level` text NOT NULL, `location` text NOT NULL, `active` integer NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `user_programs` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `user_id` text NOT NULL, `program_id` text NOT NULL, `assigned_at` text NOT NULL, `active` integer NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `workouts` (`id` text PRIMARY KEY NOT NULL, `program_id` text NOT NULL, `month` integer NOT NULL, `week` integer NOT NULL, `name` text NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `exercises` (`id` text PRIMARY KEY NOT NULL, `name` text NOT NULL, `category` text, `level` text, `youtube_url` text, `description` text, `technique` text, `common_errors` text, `regression` text, `progression` text);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `workout_exercises` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `workout_id` text NOT NULL, `exercise_id` text NOT NULL, `position` integer NOT NULL, `sets` integer, `reps` text, `rest_seconds` integer, `notes` text);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `nutrition_plans` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `user_id` text NOT NULL, `calories` integer, `protein` integer, `carbs` integer, `fats` integer, `pdf_key` text, `notes` text, `review_date` text, `updated_by` text, `updated_at` text);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `checkpoints` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `user_id` text NOT NULL, `day` integer NOT NULL, `weight` real, `waist` real, `photo_key` text, `reflection` text, `perception` integer, `completed_at` text);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `habit_metrics` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `user_id` text NOT NULL, `period_start` text NOT NULL, `period_end` text NOT NULL, `adherence` real NOT NULL, `source` text DEFAULT 'firme' NOT NULL, `synced_at` text NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `content` (`id` text PRIMARY KEY NOT NULL, `title` text NOT NULL, `description` text, `category` text NOT NULL, `video_url` text, `file_key` text, `position` integer, `publish_at` text);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `sessions` (`id` text PRIMARY KEY NOT NULL, `title` text NOT NULL, `professional` text, `starts_at` text NOT NULL, `link` text, `recording_url` text, `materials_key` text);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `admin_notes` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `user_id` text NOT NULL, `author_id` text NOT NULL, `note` text NOT NULL, `created_at` text NOT NULL);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_users_role_status` ON `users` (`role`,`status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_user_programs_user_active` ON `user_programs` (`user_id`,`active`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_workouts_program_month_week` ON `workouts` (`program_id`,`month`,`week`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_nutrition_plans_user` ON `nutrition_plans` (`user_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_checkpoints_user_day` ON `checkpoints` (`user_id`,`day`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_habit_metrics_user_period` ON `habit_metrics` (`user_id`,`period_end`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_admin_notes_user` ON `admin_notes` (`user_id`);
--> statement-breakpoint
PRAGMA optimize;
