CREATE TABLE `athlete_analyses` (
	`owner` text NOT NULL,
	`identity` text NOT NULL,
	`activity_id` text NOT NULL,
	`signature` text NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`owner`, `identity`, `activity_id`)
);
