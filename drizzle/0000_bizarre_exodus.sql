CREATE TABLE `athlete_connections` (
	`owner` text PRIMARY KEY NOT NULL,
	`revision` text NOT NULL,
	`token_ciphertext` text NOT NULL,
	`snapshot_key` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `athlete_profiles` (
	`owner` text PRIMARY KEY NOT NULL,
	`weight` real,
	`height` real,
	`saved_at` text NOT NULL
);
