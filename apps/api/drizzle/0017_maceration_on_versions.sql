ALTER TABLE `formula_versions` ADD `maceration_started_at` text;
--> statement-breakpoint
ALTER TABLE `formula_versions` ADD `maceration_target_at` text;
--> statement-breakpoint
ALTER TABLE `formula_versions` ADD `maceration_notes` text;
--> statement-breakpoint
UPDATE `formula_versions`
SET
  `maceration_started_at` = (
    SELECT `maceration_started_at` FROM `product_variants`
    WHERE `product_variants`.`id` = `formula_versions`.`variant_id`
  ),
  `maceration_target_at` = (
    SELECT `maceration_target_at` FROM `product_variants`
    WHERE `product_variants`.`id` = `formula_versions`.`variant_id`
  ),
  `maceration_notes` = (
    SELECT `maceration_notes` FROM `product_variants`
    WHERE `product_variants`.`id` = `formula_versions`.`variant_id`
  )
WHERE `is_current` = 1;
--> statement-breakpoint
UPDATE `formula_versions`
SET
  `maceration_started_at` = NULL,
  `maceration_target_at` = NULL,
  `maceration_notes` = NULL
WHERE `product_id` IN (SELECT `id` FROM `products` WHERE `type` != 'perfume');
--> statement-breakpoint
ALTER TABLE `product_variants` DROP COLUMN `maceration_started_at`;
--> statement-breakpoint
ALTER TABLE `product_variants` DROP COLUMN `maceration_target_at`;
--> statement-breakpoint
ALTER TABLE `product_variants` DROP COLUMN `maceration_notes`;
