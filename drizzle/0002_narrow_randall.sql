CREATE TABLE `athlete_session_labels` (
	`owner` text NOT NULL,
	`identity` text NOT NULL,
	`activity_id` text NOT NULL,
	`label` text NOT NULL,
	PRIMARY KEY(`owner`, `identity`, `activity_id`)
);
