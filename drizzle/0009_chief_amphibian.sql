CREATE TABLE `activity_record_sets` (
	`owner` text NOT NULL,
	`snapshot_key` text NOT NULL,
	PRIMARY KEY(`owner`, `snapshot_key`)
);
--> statement-breakpoint
CREATE TABLE `activity_records` (
	`owner` text NOT NULL,
	`snapshot_key` text NOT NULL,
	`activity_id` text NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`owner`, `snapshot_key`, `activity_id`)
);
--> statement-breakpoint
CREATE TABLE `athena_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`thread` text NOT NULL,
	`message` text NOT NULL,
	`created` real NOT NULL,
	`status` text NOT NULL,
	`claim` text,
	`answer` text,
	`context` text,
	`model` text,
	`scope` text
);
--> statement-breakpoint
CREATE INDEX `athena_jobs_owner_created` ON `athena_jobs` (`owner`,`created`);--> statement-breakpoint
CREATE INDEX `athena_jobs_status_created` ON `athena_jobs` (`status`,`created`);--> statement-breakpoint
CREATE INDEX `athena_jobs_created` ON `athena_jobs` (`created`);--> statement-breakpoint
CREATE INDEX `athena_jobs_thread_history` ON `athena_jobs` (`owner`,`thread`,`status`,`created`);--> statement-breakpoint
CREATE TABLE `athena_queue_state` (
	`id` text PRIMARY KEY NOT NULL,
	`heartbeat` real DEFAULT 0 NOT NULL,
	`model` text,
	`legacy_migrated` real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `coros_backfill_jobs` (
	`owner` text PRIMARY KEY NOT NULL,
	`revision` text NOT NULL,
	`time_zone` text NOT NULL,
	`next_run` real NOT NULL,
	`lease` text,
	`lease_until` real DEFAULT 0 NOT NULL,
	`attempts` real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `coros_backfill_due` ON `coros_backfill_jobs` (`next_run`,`lease_until`);--> statement-breakpoint
CREATE TABLE `dashboard_revisions` (
	`owner` text PRIMARY KEY NOT NULL,
	`version` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workout_exclusion_migrations` (
	`owner` text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workout_exclusions` (
	`owner` text NOT NULL,
	`activity_id` text NOT NULL,
	`date` text NOT NULL,
	PRIMARY KEY(`owner`, `activity_id`)
);
--> statement-breakpoint
CREATE INDEX `background_sync_due` ON `background_sync` (`enabled`,`next_run`);--> statement-breakpoint
CREATE INDEX `garmin_oauth_states_owner` ON `garmin_oauth_states` (`owner`);--> statement-breakpoint
CREATE INDEX `garmin_oauth_states_expires` ON `garmin_oauth_states` (`expires`);--> statement-breakpoint
CREATE INDEX `sync_notification_jobs_due` ON `sync_notification_jobs` (`lease_until`,`created_at`);