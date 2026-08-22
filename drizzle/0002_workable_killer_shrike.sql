CREATE TABLE `workout_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`workout_id` text NOT NULL,
	`position` integer NOT NULL,
	`name` text NOT NULL,
	`rounds` integer DEFAULT 1 NOT NULL,
	`work_seconds` integer,
	`rest_seconds` integer,
	`notes` text
);
--> statement-breakpoint
ALTER TABLE `workout_exercises` ADD `block_id` text;
--> statement-breakpoint
INSERT OR IGNORE INTO `workout_blocks` (`id`,`workout_id`,`position`,`name`,`rounds`,`work_seconds`,`rest_seconds`,`notes`) VALUES
('cb1-warmup','cb-dia-1',1,'Calentamiento',2,NULL,NULL,'Completa todos los ejercicios en orden y repite el bloque dos veces.'),
('cb1-circuit','cb-dia-1',2,'Circuito principal',3,30,20,'Trabaja 30 segundos por ejercicio y descansa 20 segundos antes de continuar.'),
('cb1-finisher','cb-dia-1',3,'Finisher',3,NULL,20,'Completa ambos ejercicios y repite el bloque tres veces.'),
('cb2-warmup','cb-dia-2',1,'Calentamiento',1,NULL,NULL,'Prepara caderas y rodillas antes de comenzar.'),
('cb2-circuit','cb-dia-2',2,'Circuito de piernas',4,NULL,30,'Completa todos los ejercicios en orden y repite el bloque cuatro veces.'),
('cb2-core','cb-dia-2',3,'Abdomen',3,NULL,20,'Completa los tres ejercicios y repite el bloque tres veces.'),
('cb3-warmup','cb-dia-3',1,'Calentamiento',1,NULL,NULL,'Prepara hombros y eleva gradualmente la temperatura corporal.'),
('cb3-circuit','cb-dia-3',2,'Circuito de tren superior',3,NULL,30,'Completa todos los ejercicios en orden y repite el bloque tres veces.'),
('cb3-extra','cb-dia-3',3,'Extra opcional',3,NULL,20,'Realízalo solo si mantienes buena técnica y energía.'),
('cb4-hiit','cb-dia-4',1,'Circuito HIIT',4,40,20,'Trabaja 40 segundos y descansa 20 segundos en cada ejercicio.'),
('cb4-cooldown','cb-dia-4',2,'Vuelta a la calma',1,NULL,NULL,'Finaliza con estiramientos suaves.'),
('ci1-main','ci-dia-1',1,'Circuito principal',4,NULL,30,'Completa los ejercicios en orden.'),
('ci1-finisher','ci-dia-1',2,'Finisher',3,NULL,20,'Cierre de core.'),
('ci2-main','ci-dia-2',1,'Circuito principal',4,NULL,30,'Completa los ejercicios en orden.'),
('ci2-finisher','ci-dia-2',2,'Finisher',3,NULL,20,'Cierre de abdomen.'),
('ci3-main','ci-dia-3',1,'Circuito principal',4,NULL,35,'Completa los ejercicios en orden.'),
('ci4-hiit','ci-dia-4',1,'Circuito HIIT',5,40,20,'Trabaja 40 segundos y descansa 20 segundos.'),
('ci4-cooldown','ci-dia-4',2,'Vuelta a la calma',1,NULL,NULL,'Movilidad y respiración.'),
('gb1-main','gb-dia-1',1,'Bloque principal',4,NULL,75,'Comienza con los movimientos de fuerza.'),
('gb1-accessory','gb-dia-1',2,'Accesorios y core',3,NULL,45,'Controla cada repetición.'),
('gb2-main','gb-dia-2',1,'Bloque principal',4,NULL,75,'Comienza con los movimientos de espalda.'),
('gb2-accessory','gb-dia-2',2,'Accesorios y core',3,NULL,45,'Controla cada repetición.'),
('gb3-main','gb-dia-3',1,'Bloque principal',4,NULL,75,'Comienza con los movimientos de piernas.'),
('gb3-accessory','gb-dia-3',2,'Accesorios y core',3,NULL,45,'Controla cada repetición.'),
('gb4-main','gb-dia-4',1,'Full body',3,NULL,60,'Completa los ejercicios de fuerza en orden.'),
('gb4-cardio','gb-dia-4',2,'Cardio final',1,NULL,NULL,'Mantén un ritmo moderado.'),
('gi1-strength','gi-dia-1',1,'Fuerza',4,NULL,120,'Prioriza técnica y descansos completos.'),
('gi1-volume','gi-dia-1',2,'Hipertrofia y accesorios',3,NULL,60,'Controla la fase de descenso.'),
('gi2-strength','gi-dia-2',1,'Fuerza',4,NULL,120,'Prioriza técnica y descansos completos.'),
('gi2-volume','gi-dia-2',2,'Unilateral, accesorios y core',3,NULL,60,'Mantén ejecución controlada.'),
('gi3-volume','gi-dia-3',1,'Hipertrofia',4,NULL,90,'Completa los movimientos principales.'),
('gi3-accessory','gi-dia-3',2,'Accesorios y core',3,NULL,45,'Cierre de la sesión.'),
('gi4-strength','gi-dia-4',1,'Fuerza y piernas',3,NULL,90,'Completa los movimientos principales.'),
('gi4-condition','gi-dia-4',2,'Acondicionamiento',4,NULL,45,'Finaliza con trabajo funcional y bicicleta.');
--> statement-breakpoint
UPDATE `workout_exercises` SET `block_id`=CASE
WHEN `workout_id`='cb-dia-1' AND `notes` LIKE 'Calentamiento%' THEN 'cb1-warmup' WHEN `workout_id`='cb-dia-1' AND `notes` LIKE 'Circuito%' THEN 'cb1-circuit' WHEN `workout_id`='cb-dia-1' THEN 'cb1-finisher'
WHEN `workout_id`='cb-dia-2' AND `notes`='Calentamiento' THEN 'cb2-warmup' WHEN `workout_id`='cb-dia-2' AND `notes` LIKE 'Circuito%' THEN 'cb2-circuit' WHEN `workout_id`='cb-dia-2' THEN 'cb2-core'
WHEN `workout_id`='cb-dia-3' AND `notes`='Calentamiento' THEN 'cb3-warmup' WHEN `workout_id`='cb-dia-3' AND `notes` LIKE 'Circuito%' THEN 'cb3-circuit' WHEN `workout_id`='cb-dia-3' THEN 'cb3-extra'
WHEN `workout_id`='cb-dia-4' AND `notes` LIKE 'Circuito%' THEN 'cb4-hiit' WHEN `workout_id`='cb-dia-4' THEN 'cb4-cooldown'
WHEN `workout_id`='ci-dia-1' AND `notes`='Finisher' THEN 'ci1-finisher' WHEN `workout_id`='ci-dia-1' THEN 'ci1-main'
WHEN `workout_id`='ci-dia-2' AND `notes`='Finisher' THEN 'ci2-finisher' WHEN `workout_id`='ci-dia-2' THEN 'ci2-main'
WHEN `workout_id`='ci-dia-3' THEN 'ci3-main'
WHEN `workout_id`='ci-dia-4' AND `notes` LIKE 'HIIT%' THEN 'ci4-hiit' WHEN `workout_id`='ci-dia-4' THEN 'ci4-cooldown'
WHEN `workout_id`='gb-dia-1' AND `position`<=3 THEN 'gb1-main' WHEN `workout_id`='gb-dia-1' THEN 'gb1-accessory'
WHEN `workout_id`='gb-dia-2' AND `position`<=3 THEN 'gb2-main' WHEN `workout_id`='gb-dia-2' THEN 'gb2-accessory'
WHEN `workout_id`='gb-dia-3' AND `position`<=3 THEN 'gb3-main' WHEN `workout_id`='gb-dia-3' THEN 'gb3-accessory'
WHEN `workout_id`='gb-dia-4' AND `position`<=5 THEN 'gb4-main' WHEN `workout_id`='gb-dia-4' THEN 'gb4-cardio'
WHEN `workout_id`='gi-dia-1' AND `position`<=2 THEN 'gi1-strength' WHEN `workout_id`='gi-dia-1' THEN 'gi1-volume'
WHEN `workout_id`='gi-dia-2' AND `position`<=2 THEN 'gi2-strength' WHEN `workout_id`='gi-dia-2' THEN 'gi2-volume'
WHEN `workout_id`='gi-dia-3' AND `position`<=4 THEN 'gi3-volume' WHEN `workout_id`='gi-dia-3' THEN 'gi3-accessory'
WHEN `workout_id`='gi-dia-4' AND `position`<=4 THEN 'gi4-strength' WHEN `workout_id`='gi-dia-4' THEN 'gi4-condition'
ELSE `block_id` END
WHERE `workout_id` IN ('cb-dia-1','cb-dia-2','cb-dia-3','cb-dia-4','ci-dia-1','ci-dia-2','ci-dia-3','ci-dia-4','gb-dia-1','gb-dia-2','gb-dia-3','gb-dia-4','gi-dia-1','gi-dia-2','gi-dia-3','gi-dia-4');
--> statement-breakpoint
UPDATE `workout_exercises` SET `position`=9 WHERE `workout_id`='cb-dia-1' AND `exercise_id`='shoulder-tap-plank';
--> statement-breakpoint
UPDATE `workout_exercises` SET `position`=`position`+2 WHERE `workout_id`='cb-dia-1' AND `block_id`='cb1-finisher';
--> statement-breakpoint
INSERT INTO `workout_exercises` (`workout_id`,`exercise_id`,`block_id`,`position`,`sets`,`reps`,`rest_seconds`,`notes`)
SELECT 'cb-dia-1','push-up','cb1-circuit',8,1,'30 segundos',0,''
WHERE NOT EXISTS (SELECT 1 FROM `workout_exercises` WHERE `workout_id`='cb-dia-1' AND `exercise_id`='push-up' AND `block_id`='cb1-circuit');
--> statement-breakpoint
INSERT INTO `workout_exercises` (`workout_id`,`exercise_id`,`block_id`,`position`,`sets`,`reps`,`rest_seconds`,`notes`)
SELECT 'cb-dia-1','rope-jumps','cb1-circuit',10,1,'30 segundos',0,''
WHERE NOT EXISTS (SELECT 1 FROM `workout_exercises` WHERE `workout_id`='cb-dia-1' AND `exercise_id`='rope-jumps' AND `block_id`='cb1-circuit');
--> statement-breakpoint
UPDATE `workout_exercises` SET `sets`=1 WHERE `workout_id` IN ('cb-dia-1','cb-dia-2','cb-dia-3','cb-dia-4','ci-dia-1','ci-dia-2','ci-dia-3','ci-dia-4');
