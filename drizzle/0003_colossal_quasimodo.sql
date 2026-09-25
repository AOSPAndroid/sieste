CREATE TABLE `coros_connections` (
	`owner` text PRIMARY KEY NOT NULL,
	`revision` text NOT NULL,
	`credentials` text NOT NULL,
	`region` text NOT NULL,
	`snapshot_key` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `coros_oauth_states` (
	`state` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`payload` text NOT NULL,
	`expires` text NOT NULL
);
