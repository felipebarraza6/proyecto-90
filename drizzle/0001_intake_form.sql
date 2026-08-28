CREATE TABLE IF NOT EXISTS `professional_profiles` (`user_id` text PRIMARY KEY NOT NULL, `specialty` text NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `intake_questions` (`id` text PRIMARY KEY NOT NULL, `key` text NOT NULL, `section` text NOT NULL, `prompt` text NOT NULL, `help_text` text, `type` text NOT NULL, `options_json` text, `audience` text NOT NULL, `required` integer NOT NULL DEFAULT 0, `active` integer NOT NULL DEFAULT 1, `position` integer NOT NULL, `condition_key` text, `condition_value` text);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_intake_questions_key` ON `intake_questions` (`key`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_intake_questions_active_position` ON `intake_questions` (`active`,`position`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `intake_responses` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `user_id` text NOT NULL, `question_id` text NOT NULL, `answer_json` text NOT NULL, `updated_at` text NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_intake_responses_user_question` ON `intake_responses` (`user_id`,`question_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_professional_profiles_specialty` ON `professional_profiles` (`specialty`);
--> statement-breakpoint
PRAGMA optimize;
