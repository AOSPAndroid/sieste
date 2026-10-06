CREATE TABLE `background_sync` (
	`owner` text PRIMARY KEY NOT NULL,
	`enabled` real DEFAULT 0 NOT NULL,
	`time_zone` text NOT NULL,
	`interval_minutes` real DEFAULT 30 NOT NULL,
	`next_run` real NOT NULL,
	`lease` text,
	`lease_until` real DEFAULT 0 NOT NULL,
	`last_completed` text,
	`last_status` text,
	`last_error` text,
	`last_fingerprint` text
);
--> statement-breakpoint
CREATE TABLE `sync_notification_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`subscription_id` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` real NOT NULL,
	`attempts` real DEFAULT 0 NOT NULL,
	`claim` text,
	`lease_until` real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_push_subscriptions` (
	`owner` text NOT NULL,
	`id` text NOT NULL,
	`subscription` text NOT NULL,
	PRIMARY KEY(`owner`, `id`)
);
--> statement-breakpoint
CREATE TABLE `sync_worker_health` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` real NOT NULL
);
