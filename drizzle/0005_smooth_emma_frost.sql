CREATE TABLE `coros_fit_usage` (
	`owner` text NOT NULL,
	`day` text NOT NULL,
	`count` real DEFAULT 0 NOT NULL,
	PRIMARY KEY(`owner`, `day`)
);
