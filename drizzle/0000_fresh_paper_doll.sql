CREATE TABLE `task_statuses` (
	`task_id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'not-started' NOT NULL,
	`manual_override` integer DEFAULT true NOT NULL,
	`updated_at` integer NOT NULL
);
