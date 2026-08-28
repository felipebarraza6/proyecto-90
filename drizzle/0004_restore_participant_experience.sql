CREATE TABLE IF NOT EXISTS `participant_adherence` (
  `user_id` text PRIMARY KEY NOT NULL,
  `training_pct` real,
  `macros_pct` real,
  `updated_at` text NOT NULL,
  `updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `one_on_one_meetings` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `requested_start` text NOT NULL,
  `confirmed_start` text,
  `status` text NOT NULL DEFAULT 'pending',
  `topic` text,
  `admin_note` text,
  `reviewed_by` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `meeting_link` text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_one_on_one_meetings_user` ON `one_on_one_meetings` (`user_id`,`created_at`);
