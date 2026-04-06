PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`input` text NOT NULL,
	`output` text,
	`error` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_tasks`("id", "template_id", "status", "input", "output", "error", "created_by", "created_at", "updated_at") SELECT "id", "template_id", "status", "input", "output", "error", "created_by", "created_at", "updated_at" FROM `tasks`;--> statement-breakpoint
DROP TABLE `tasks`;--> statement-breakpoint
ALTER TABLE `__new_tasks` RENAME TO `tasks`;--> statement-breakpoint
PRAGMA foreign_keys=ON;