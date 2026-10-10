ALTER TABLE `formula_versions` ADD `is_final` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE `formula_versions`
SET `is_final` = 1
WHERE `id` IN (
  SELECT `fv`.`id`
  FROM `formula_versions` AS `fv`
  INNER JOIN `product_variants` AS `pv` ON `pv`.`id` = `fv`.`variant_id`
  WHERE `pv`.`is_selected_final` = 1 AND `fv`.`is_current` = 1
);
