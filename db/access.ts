import { env } from "cloudflare:workers";
import type { ChatGPTUser } from "../app/chatgpt-auth";
import { intakeSeed } from "./intake-seed";
import routineGuides from "./routine-guides.json";
import { assessNutrition } from "./nutrition-rules";

export type ViewerRole = "admin" | "professional" | "participant" | "reviewer";
export type Viewer = { id: string; role: ViewerRole; name: string; email: string; status: string };

export async function getOrCreateViewer(user: ChatGPTUser): Promise<Viewer> {
  await ensureBaseData();
  const email = user.email.trim().toLowerCase();
  const existing = await env.DB.prepare(`SELECT u.id, u.email, u.role, u.status,
    trim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')) AS name
    FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE lower(u.email) = ?`)
    .bind(email).first<{ id: string; email: string; role: ViewerRole; status: string; name: string }>();
  if (existing) return { ...existing, name: existing.name || user.fullName || email.split("@")[0] };

  const count = await env.DB.prepare("SELECT COUNT(*) AS total FROM users").first<{ total: number }>();
  const role: ViewerRole = Number(count?.total ?? 0) === 0 ? "admin" : "participant";
  const id = crypto.randomUUID();
  const names = (user.fullName ?? "").trim().split(/\s+/);
  const firstName = names[0] || email.split("@")[0];
  const lastName = names.slice(1).join(" ");
  await env.DB.batch([
    env.DB.prepare("INSERT INTO users (id, email, role, status, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(id, email, role, role === "admin" ? "active" : "onboarding", new Date().toISOString()),
    env.DB.prepare("INSERT INTO profiles (user_id, first_name, last_name) VALUES (?, ?, ?)").bind(id, firstName, lastName),
  ]);
  return { id, role, name: user.fullName || firstName, email, status: role === "admin" ? "active" : "onboarding" };
}

let baseDataPromise: Promise<void> | undefined;

export function ensureBaseData() {
  if (!baseDataPromise) {
    baseDataPromise = initializeBaseData().catch((error) => {
      baseDataPromise = undefined;
      throw error;
    });
  }
  return baseDataPromise;
}

async function initializeBaseData() {
  const db = env.DB;
  const baseVersion="2026-08-28-adherence-alerts-v1";
  try { const ready=await db.prepare("SELECT value FROM app_meta WHERE key='base_data_version'").first<{value:string}>();if(ready?.value===baseVersion)return; } catch { /* First installation: create the schema below. */ }
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, role TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS profiles (user_id TEXT PRIMARY KEY, first_name TEXT, last_name TEXT, birthdate TEXT, gender TEXT, height REAL, weight REAL, city TEXT)`,
    `CREATE TABLE IF NOT EXISTS onboarding (user_id TEXT PRIMARY KEY, objective TEXT, current_training INTEGER, training_days INTEGER, preferred_location TEXT, equipment TEXT, activity_level TEXT, macros_experience INTEGER, dietary_restrictions TEXT, preferences TEXT, motivation TEXT, health_notes TEXT, completed_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS programs (id TEXT PRIMARY KEY, name TEXT NOT NULL, level TEXT NOT NULL, location TEXT NOT NULL, active INTEGER NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS program_guides (program_id TEXT PRIMARY KEY, title TEXT NOT NULL, content_json TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS user_programs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, program_id TEXT NOT NULL, assigned_at TEXT NOT NULL, active INTEGER NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS workouts (id TEXT PRIMARY KEY, program_id TEXT NOT NULL, month INTEGER NOT NULL, week INTEGER NOT NULL, name TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS exercises (id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT, level TEXT, youtube_url TEXT, description TEXT, technique TEXT, common_errors TEXT, regression TEXT, progression TEXT)`,
    `CREATE TABLE IF NOT EXISTS workout_exercises (id INTEGER PRIMARY KEY AUTOINCREMENT, workout_id TEXT NOT NULL, exercise_id TEXT NOT NULL, position INTEGER NOT NULL, sets INTEGER, reps TEXT, rest_seconds INTEGER, notes TEXT)`,
    `CREATE TABLE IF NOT EXISTS nutrition_plans (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, calories INTEGER, protein INTEGER, carbs INTEGER, fats INTEGER, pdf_key TEXT, notes TEXT, review_date TEXT, updated_by TEXT, updated_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS nutrition_screenings (user_id TEXT PRIMARY KEY, assessment_json TEXT NOT NULL, red_flag_count INTEGER NOT NULL DEFAULT 0, deficient_habit_count INTEGER NOT NULL DEFAULT 0, automation_status TEXT NOT NULL, calculated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS participant_adherence (user_id TEXT PRIMARY KEY, training_pct REAL, macros_pct REAL, water_pct REAL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS nutrition_daily (user_id TEXT NOT NULL, log_date TEXT NOT NULL, calories REAL, protein REAL, carbs REAL, fats REAL, updated_at TEXT NOT NULL, PRIMARY KEY(user_id,log_date))`,
    `CREATE INDEX IF NOT EXISTS idx_nutrition_daily_user_date ON nutrition_daily(user_id,log_date)`,
    `CREATE TABLE IF NOT EXISTS habit_daily (user_id TEXT NOT NULL, habit TEXT NOT NULL, habit_date TEXT NOT NULL, status TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'manual', updated_at TEXT NOT NULL, PRIMARY KEY(user_id,habit,habit_date))`,
    `CREATE TABLE IF NOT EXISTS adherence_outreach (user_id TEXT NOT NULL, week_start TEXT NOT NULL, alert_type TEXT NOT NULL, contacted INTEGER NOT NULL DEFAULT 0, contacted_at TEXT, contacted_by TEXT, PRIMARY KEY(user_id,week_start,alert_type))`,
    `CREATE TABLE IF NOT EXISTS one_on_one_meetings (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, requested_start TEXT NOT NULL, confirmed_start TEXT, status TEXT NOT NULL DEFAULT 'pending', topic TEXT, admin_note TEXT, reviewed_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, meeting_link TEXT)`,
    `CREATE TABLE IF NOT EXISTS checkpoints (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, day INTEGER NOT NULL, weight REAL, adherence REAL, waist REAL, photo_key TEXT, reflection TEXT, perception INTEGER, completed_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS habit_metrics (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, period_start TEXT NOT NULL, period_end TEXT NOT NULL, adherence REAL NOT NULL, source TEXT NOT NULL DEFAULT 'firme', synced_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS content (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT, category TEXT NOT NULL, video_url TEXT, file_key TEXT, position INTEGER, publish_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, title TEXT NOT NULL, professional TEXT, starts_at TEXT NOT NULL, link TEXT, recording_url TEXT, materials_key TEXT)`,
    `CREATE TABLE IF NOT EXISTS admin_notes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, author_id TEXT NOT NULL, note TEXT NOT NULL, created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS professional_profiles (user_id TEXT PRIMARY KEY, specialty TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS professional_approvals (user_id TEXT NOT NULL, area TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', approved_by TEXT, updated_at TEXT NOT NULL, PRIMARY KEY(user_id,area))`,
    `CREATE TABLE IF NOT EXISTS intake_questions (id TEXT PRIMARY KEY, key TEXT NOT NULL UNIQUE, section TEXT NOT NULL, prompt TEXT NOT NULL, help_text TEXT, type TEXT NOT NULL, options_json TEXT, audience TEXT NOT NULL, required INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, position INTEGER NOT NULL, condition_key TEXT, condition_value TEXT)`,
    `CREATE TABLE IF NOT EXISTS intake_responses (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, question_id TEXT NOT NULL, answer_json TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_intake_responses_user_question ON intake_responses(user_id,question_id)`,
    `CREATE INDEX IF NOT EXISTS idx_intake_questions_active_position ON intake_questions(active,position)`,
    `CREATE INDEX IF NOT EXISTS idx_user_programs_user_active ON user_programs(user_id,active)`,
    `CREATE INDEX IF NOT EXISTS idx_checkpoints_user_day ON checkpoints(user_id,day)`,
    `CREATE INDEX IF NOT EXISTS idx_nutrition_plans_user_updated ON nutrition_plans(user_id,updated_at)`,
    `CREATE INDEX IF NOT EXISTS idx_meetings_user_updated ON one_on_one_meetings(user_id,updated_at)`,
    `CREATE INDEX IF NOT EXISTS idx_habit_daily_date ON habit_daily(habit_date,user_id,habit)`,
    `CREATE INDEX IF NOT EXISTS idx_adherence_outreach_week ON adherence_outreach(week_start,alert_type)`,
    `CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  ];
  await db.batch(statements.map((sql) => db.prepare(sql)));
  try { await db.prepare("ALTER TABLE participant_adherence ADD COLUMN water_pct REAL").run(); } catch { /* Existing databases already migrated. */ }
  try { await db.prepare("ALTER TABLE checkpoints ADD COLUMN adherence REAL").run(); } catch { /* Existing databases already migrated. */ }
  for (const sql of [
    "ALTER TABLE nutrition_plans ADD COLUMN objective TEXT",
    "ALTER TABLE nutrition_plans ADD COLUMN review_status TEXT DEFAULT 'pending_review'",
    "ALTER TABLE nutrition_plans ADD COLUMN review_note TEXT",
    "ALTER TABLE nutrition_plans ADD COLUMN reviewed_by TEXT",
    "ALTER TABLE nutrition_plans ADD COLUMN reviewed_at TEXT",
  ]) { try { await db.prepare(sql).run(); } catch { /* Existing databases already migrated. */ } }
  const seeds = [
    ["casa-inicial", "Casa Inicial", "Inicial", "Casa"], ["casa-intermedio", "Casa Intermedio", "Intermedio", "Casa"],
    ["gym-inicial", "Gym Inicial", "Inicial", "Gimnasio"], ["gym-intermedio", "Gym Intermedio", "Intermedio", "Gimnasio"],
  ];
  await db.batch(seeds.map(([id, name, level, location]) =>
    db.prepare("INSERT OR IGNORE INTO programs (id, name, level, location, active) VALUES (?, ?, ?, ?, 1)").bind(id, name, level, location)));

  const guideVersion = "2026-08-27-warmup-exercises-v2";
  const storedGuideVersion = await db.prepare("SELECT value FROM app_meta WHERE key='routine_guides_version'").first<{ value: string }>();
  if (storedGuideVersion?.value !== guideVersion) {
    const guideUpdatedAt = "2026-08-26T00:00:00.000Z";
    const guideStatements = routineGuides.map((guide) => db.prepare(`INSERT OR IGNORE INTO program_guides (program_id,title,content_json,updated_at) VALUES (?,?,?,?)`)
      .bind(guide.programId,guide.title,JSON.stringify(guide),guideUpdatedAt));
    const uniqueExercises = new Map<string, { name: string; level: string }>();
    for (const guide of routineGuides) {
      const names=[...guide.exerciseNames];
      for(const day of guide.days){let warmup=false;for(const node of day.nodes){if(node.type==="heading")warmup=/calentamiento/i.test(node.text||"");else if(warmup&&node.type==="paragraph"&&node.text&&!/(:$|cada ejercicio|cada uno|vueltas?|minutos? continuos)/i.test(node.text))names.push(node.text.replace(/[.]$/,"") )}}
      for (const exerciseName of names) {
        const id = guideExerciseId(exerciseName);
        if (!uniqueExercises.has(id)) uniqueExercises.set(id, { name: exerciseName, level: guide.programId.includes("intermedio") ? "Intermedio" : "Inicial" });
      }
    }
    const exerciseStatements = [...uniqueExercises].map(([id, exercise]) => db.prepare(`INSERT OR IGNORE INTO exercises (id,name,category,level,description)
      VALUES (?,?,'Rutina definitiva',?,?)`).bind(id,exercise.name,exercise.level,"Ejercicio incluido en las rutinas definitivas de Proyecto 90."));
    await runBatches(db, [...guideStatements, ...exerciseStatements]);
    await db.prepare("INSERT INTO app_meta (key,value) VALUES ('routine_guides_version',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(guideVersion).run();
  }

  const intakeVersion = "2026-08-26-v1";
  const storedIntakeVersion = await db.prepare("SELECT value FROM app_meta WHERE key='intake_seed_version'").first<{ value: string }>();
  if (storedIntakeVersion?.value !== intakeVersion) {
    const intakeStatements = intakeSeed.map((item, position) => db.prepare(`INSERT OR IGNORE INTO intake_questions
      (id,key,section,prompt,help_text,type,options_json,audience,required,active,position,condition_key,condition_value)
      VALUES (?,?,?,?,?,?,?,?,?,1,?,?,?)`)
      .bind(`intake-${item.key}`, item.key, item.section, item.prompt, item.help ?? null, item.type,
        item.options ? JSON.stringify(item.options) : null, item.audience, item.required ? 1 : 0,
        position + 1, item.conditionKey ?? null, item.conditionValue ?? null));
    await runBatches(db, intakeStatements);
    await db.prepare("INSERT INTO app_meta (key,value) VALUES ('intake_seed_version',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(intakeVersion).run();
  }

  const screeningVersion="2026-08-28-nutrition-method-v1";
  const storedScreeningVersion=await db.prepare("SELECT value FROM app_meta WHERE key='nutrition_screening_version'").first<{value:string}>();
  if(storedScreeningVersion?.value!==screeningVersion){
    const participants=await db.prepare(`SELECT u.id FROM users u JOIN onboarding o ON o.user_id=u.id WHERE u.role='participant' AND o.completed_at IS NOT NULL`).all<{id:string}>();
    for(const participant of participants.results){
      const answerRows=await db.prepare(`SELECT q.key,r.answer_json FROM intake_responses r JOIN intake_questions q ON q.id=r.question_id WHERE r.user_id=?`).bind(participant.id).all<{key:string;answer_json:string}>();
      const answers=Object.fromEntries(answerRows.results.map(row=>{try{return [row.key,JSON.parse(row.answer_json)]}catch{return [row.key,row.answer_json]}}));
      const assessment=assessNutrition(answers);
      await db.prepare(`INSERT INTO nutrition_screenings (user_id,assessment_json,red_flag_count,deficient_habit_count,automation_status,calculated_at) VALUES (?,?,?,?,?,?)
        ON CONFLICT(user_id) DO UPDATE SET assessment_json=excluded.assessment_json,red_flag_count=excluded.red_flag_count,deficient_habit_count=excluded.deficient_habit_count,automation_status=excluded.automation_status,calculated_at=excluded.calculated_at`)
        .bind(participant.id,JSON.stringify(assessment),assessment.redFlags.length,assessment.deficientHabits.length,assessment.automationStatus,assessment.calculatedAt).run();
      const plan=await db.prepare("SELECT id FROM nutrition_plans WHERE user_id=? LIMIT 1").bind(participant.id).first();
      if(!plan&&assessment.calories){
        await db.prepare(`INSERT INTO nutrition_plans (user_id,calories,protein,carbs,fats,notes,updated_by,updated_at,objective,review_status)
          VALUES (?,?,?,?,?,?,?,?,?,'pending_review')`).bind(participant.id,assessment.calories,assessment.protein,assessment.carbs,assessment.fats,"Propuesta inicial automática según pauta de la nutricionista. Requiere revisión y aprobación profesional.","system:nutrition",assessment.calculatedAt,assessment.goalLabel).run();
      }
    }
    await db.prepare("INSERT INTO app_meta (key,value) VALUES ('nutrition_screening_version',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(screeningVersion).run();
  }
  await db.prepare("INSERT INTO app_meta (key,value) VALUES ('base_data_version',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(baseVersion).run();
}

async function runBatches(db: typeof env.DB, statements: ReturnType<typeof db.prepare>[]) {
  for (let index = 0; index < statements.length; index += 50) await db.batch(statements.slice(index, index + 50));
}

function guideExerciseId(name: string) {
  const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,72);
  return `guide-${normalized}`;
}

export function requireRole(viewer: Viewer, roles: ViewerRole[]) {
  if (!roles.includes(viewer.role)) throw new Response("No autorizado", { status: 403 });
}
