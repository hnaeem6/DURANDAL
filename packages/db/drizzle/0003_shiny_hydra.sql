CREATE TABLE `schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text NOT NULL,
	`parameters` text NOT NULL,
	`cron_expression` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`last_run` integer,
	`next_run` integer,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL
);
