CREATE TABLE `suppliers` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`website` text,
	`notes` text,
	`contact_email` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `ingredients` ADD `supplier_id` text REFERENCES `suppliers`(`id`) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE `ingredients` ADD `supplier_product_url` text;
