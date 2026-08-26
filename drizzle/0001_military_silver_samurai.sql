CREATE TABLE `task_overrides` (
	`task_id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`due` text NOT NULL,
	`due_time` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`updated_at` integer NOT NULL
);
