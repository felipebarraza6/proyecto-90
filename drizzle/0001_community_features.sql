CREATE TABLE IF NOT EXISTS `app_settings` (`key` text PRIMARY KEY NOT NULL, `value` text NOT NULL, `updated_at` text NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `required_content` (`content_id` text PRIMARY KEY NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `onboarding_questions` (`id` text PRIMARY KEY NOT NULL, `label` text NOT NULL, `field_type` text NOT NULL, `options` text, `position` integer NOT NULL, `required` integer DEFAULT true NOT NULL, `active` integer DEFAULT true NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `onboarding_responses` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `user_id` text NOT NULL, `question_id` text NOT NULL, `answer` text, `updated_at` text NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `onboarding_responses_user_question_idx` ON `onboarding_responses` (`user_id`,`question_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `contact_messages` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `user_id` text NOT NULL, `subject` text NOT NULL, `message` text NOT NULL, `status` text DEFAULT 'new' NOT NULL, `created_at` text NOT NULL);
