CREATE TABLE `garmin_account_state` (
	`owner` text PRIMARY KEY NOT NULL,
	`generation` text NOT NULL,
	`intent` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `garmin_connections` (
	`owner` text PRIMARY KEY NOT NULL,
	`revision` text NOT NULL,
	`user_id` text NOT NULL,
	`credentials` text NOT NULL,
	`permissions` text NOT NULL,
	`updated_at` text NOT NULL,
	`refresh_lock` real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `garmin_connections_user_id_unique` ON `garmin_connections` (`user_id`);
--> statement-breakpoint
CREATE TABLE `garmin_oauth_states` (
	`state` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`payload` text NOT NULL,
	`expires` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `garmin_oauth_operations` (
  `id` text PRIMARY KEY NOT NULL,
  `lease_token` text NOT NULL,
  `expires` real NOT NULL
);
