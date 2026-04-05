CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`timestamp` integer NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`resource` text NOT NULL,
	`details` text
);
--> statement-breakpoint
CREATE TABLE `credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`service` text NOT NULL,
	`encrypted_value` text NOT NULL,
	`iv` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`input` text NOT NULL,
	`output` text,
	`error` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);