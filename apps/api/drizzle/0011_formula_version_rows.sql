CREATE TABLE `formula_rows_versioned` (
  `id` text NOT NULL,
  `version_id` text NOT NULL REFERENCES `formula_versions`(`id`),
  `inci` text NOT NULL,
  `cas` text,
  `trade_name` text,
  `function` text NOT NULL,
  `phase` text NOT NULL,
  `percent` real NOT NULL,
  `notes` text,
  `locked` integer DEFAULT false NOT NULL,
  `sort_order` integer NOT NULL,
  PRIMARY KEY (`version_id`, `id`)
);
--> statement-breakpoint
INSERT INTO `formula_rows_versioned`
  SELECT `id`, `version_id`, `inci`, `cas`, `trade_name`, `function`, `phase`, `percent`, `notes`, `locked`, `sort_order`
  FROM `formula_rows`;
--> statement-breakpoint
DROP TABLE `formula_rows`;
--> statement-breakpoint
ALTER TABLE `formula_rows_versioned` RENAME TO `formula_rows`;
--> statement-breakpoint
ALTER TABLE `formula_patches` ADD `base_version_id` text REFERENCES `formula_versions`(`id`);
