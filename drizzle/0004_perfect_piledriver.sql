CREATE TABLE `one_on_one_meetings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`requested_start` text NOT NULL,
	`confirmed_start` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`topic` text NOT NULL,
	`admin_note` text,
	`reviewed_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_on_one_meetings_user_idx` ON `one_on_one_meetings` (`user_id`);