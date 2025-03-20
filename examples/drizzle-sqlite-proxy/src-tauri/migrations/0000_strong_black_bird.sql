CREATE TABLE `users` (
	`id` integer PRIMARY KEY NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`name` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_id_unique` ON `users` (`id`);