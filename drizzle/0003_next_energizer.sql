ALTER TABLE `nutrition_plans` ADD `objective` text;
--> statement-breakpoint
UPDATE `profiles` SET `weight`=(
  SELECT CAST(`answer` AS REAL) FROM `onboarding_responses`
  WHERE `user_id`=`profiles`.`user_id` AND `question_id`='weight'
) WHERE `weight` IS NULL AND EXISTS (
  SELECT 1 FROM `onboarding_responses`
  WHERE `user_id`=`profiles`.`user_id` AND `question_id`='weight' AND TRIM(`answer`)<>''
);
--> statement-breakpoint
UPDATE `profiles` SET `height`=(
  SELECT CAST(`answer` AS REAL) FROM `onboarding_responses`
  WHERE `user_id`=`profiles`.`user_id` AND `question_id`='height'
) WHERE `height` IS NULL AND EXISTS (
  SELECT 1 FROM `onboarding_responses`
  WHERE `user_id`=`profiles`.`user_id` AND `question_id`='height' AND TRIM(`answer`)<>''
);
--> statement-breakpoint
UPDATE `nutrition_plans` SET `objective`=(
  SELECT `objective` FROM `onboarding` WHERE `user_id`=`nutrition_plans`.`user_id`
) WHERE `objective` IS NULL;
