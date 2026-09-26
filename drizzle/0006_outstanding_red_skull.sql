CREATE TABLE `activity_merge_members` (
	`owner` text NOT NULL,
	`activity_id` text NOT NULL,
	`merge_id` text NOT NULL,
	`time_zone` text NOT NULL,
	PRIMARY KEY(`owner`, `activity_id`)
);
