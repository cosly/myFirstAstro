CREATE TABLE `quote_activities` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_id` text NOT NULL,
	`session_id` text NOT NULL,
	`event_type` text NOT NULL,
	`event_data` text,
	`device_type` text,
	`browser_name` text,
	`os_name` text,
	`ip_address` text,
	`user_agent` text,
	`country` text,
	`city` text,
	`page_load_time` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `quote_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_id` text NOT NULL,
	`session_id` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`device_type` text,
	`browser_name` text,
	`os_name` text,
	`country` text,
	`city` text,
	`started_at` integer NOT NULL,
	`last_active_at` integer NOT NULL,
	`ended_at` integer,
	`total_time_seconds` integer DEFAULT 0,
	`max_scroll_depth` integer DEFAULT 0,
	`sections_viewed` text,
	`options_toggled` integer DEFAULT 0,
	`is_active` integer DEFAULT true,
	FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quote_sessions_session_id_unique` ON `quote_sessions` (`session_id`);--> statement-breakpoint
DROP INDEX `email_templates_type_unique`;--> statement-breakpoint
ALTER TABLE `email_templates` ADD `locale` text DEFAULT 'nl' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `email_templates_type_locale_idx` ON `email_templates` (`type`,`locale`);--> statement-breakpoint
ALTER TABLE `customers` ADD `locale` text DEFAULT 'nl';--> statement-breakpoint
ALTER TABLE `team_members` ADD `locale` text DEFAULT 'nl';