import { env } from "cloudflare:workers";
import type { ChatGPTUser } from "../app/chatgpt-auth";
import { seedRoutines } from "./routine-seeds";

export type ViewerRole = "admin" | "professional" | "participant" | "reviewer";
export type Viewer = { id: string; role: ViewerRole; name: string; email: string; status: string; professionalType?: string | null };

const REVIEWER_ACCOUNTS = [{ email: "felipe.barraza.vega@gmail.com", firstName: "Felipe", lastName: "Barraza Vega" }];

export async function getOrCreateViewer(user: ChatGPTUser): Promise<Viewer> {
  await ensureReviewerAccounts();
  const email = user.email.trim().toLowerCase();
  const existing = await env.DB.prepare(`SELECT u.id, u.email, u.role, u.status,
    trim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')) AS name,p.professional_type AS professionalType
    FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE lower(u.email) = ?`)
    .bind(email).first<{ id: string; email: string; role: ViewerRole; status: string; name: string; professionalType: string | null }>();
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

async function ensureReviewerAccounts() {
  for (const account of REVIEWER_ACCOUNTS) {
    const existing = await env.DB.prepare("SELECT id,role FROM users WHERE lower(email)=?").bind(account.email).first<{id:string;role:string}>();
    if (existing) {
      if (existing.role !== "reviewer") await env.DB.prepare("UPDATE users SET role='reviewer',status='active' WHERE id=?").bind(existing.id).run();
      continue;
    }
    const id = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO users (id,email,role,status,created_at) VALUES (?,?,'reviewer','active',?)").bind(id,account.email,new Date().toISOString()),
      env.DB.prepare("INSERT INTO profiles (user_id,first_name,last_name) VALUES (?,?,?)").bind(id,account.firstName,account.lastName),
    ]);
  }
}

export async function ensureBaseData() {
  const db = env.DB;
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, role TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS profiles (user_id TEXT PRIMARY KEY, first_name TEXT, last_name TEXT, birthdate TEXT, gender TEXT, height REAL, weight REAL, city TEXT, professional_type TEXT)`,
    `CREATE TABLE IF NOT EXISTS onboarding (user_id TEXT PRIMARY KEY, objective TEXT, current_training INTEGER, training_days INTEGER, preferred_location TEXT, equipment TEXT, activity_level TEXT, macros_experience INTEGER, dietary_restrictions TEXT, preferences TEXT, motivation TEXT, health_notes TEXT, completed_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS programs (id TEXT PRIMARY KEY, name TEXT NOT NULL, level TEXT NOT NULL, location TEXT NOT NULL, active INTEGER NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS user_programs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, program_id TEXT NOT NULL, assigned_at TEXT NOT NULL, active INTEGER NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS workouts (id TEXT PRIMARY KEY, program_id TEXT NOT NULL, month INTEGER NOT NULL, week INTEGER NOT NULL, name TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS workout_progressions (workout_id TEXT PRIMARY KEY, progression TEXT)`,
    `CREATE TABLE IF NOT EXISTS workout_blocks (id TEXT PRIMARY KEY, workout_id TEXT NOT NULL, position INTEGER NOT NULL, name TEXT NOT NULL, rounds INTEGER NOT NULL DEFAULT 1, work_seconds INTEGER, rest_seconds INTEGER, notes TEXT)`,
    `CREATE TABLE IF NOT EXISTS exercises (id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT, level TEXT, youtube_url TEXT, description TEXT, technique TEXT, common_errors TEXT, regression TEXT, progression TEXT)`,
    `CREATE TABLE IF NOT EXISTS workout_exercises (id INTEGER PRIMARY KEY AUTOINCREMENT, workout_id TEXT NOT NULL, exercise_id TEXT NOT NULL, position INTEGER NOT NULL, sets INTEGER, reps TEXT, rest_seconds INTEGER, notes TEXT)`,
    `CREATE TABLE IF NOT EXISTS nutrition_plans (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, calories INTEGER, protein INTEGER, carbs INTEGER, fats INTEGER, objective TEXT, pdf_key TEXT, notes TEXT, review_date TEXT, updated_by TEXT, updated_at TEXT, review_status TEXT NOT NULL DEFAULT 'pending_review', review_note TEXT, reviewed_by TEXT, reviewed_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS checkpoints (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, day INTEGER NOT NULL, weight REAL, waist REAL, photo_key TEXT, reflection TEXT, perception INTEGER, completed_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS habit_metrics (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, period_start TEXT NOT NULL, period_end TEXT NOT NULL, adherence REAL NOT NULL, source TEXT NOT NULL DEFAULT 'firme', synced_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS content (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT, category TEXT NOT NULL, video_url TEXT, file_key TEXT, position INTEGER, publish_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS required_content (content_id TEXT PRIMARY KEY)`,
    `CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, title TEXT NOT NULL, professional TEXT, starts_at TEXT NOT NULL, link TEXT, recording_url TEXT, materials_key TEXT)`,
    `CREATE TABLE IF NOT EXISTS admin_notes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, author_id TEXT NOT NULL, note TEXT NOT NULL, created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS onboarding_questions (id TEXT PRIMARY KEY, label TEXT NOT NULL, field_type TEXT NOT NULL, options TEXT, position INTEGER NOT NULL, required INTEGER NOT NULL DEFAULT 1, active INTEGER NOT NULL DEFAULT 1, audience TEXT NOT NULL DEFAULT 'both')`,
    `CREATE TABLE IF NOT EXISTS onboarding_responses (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, question_id TEXT NOT NULL, answer TEXT, updated_at TEXT NOT NULL, UNIQUE(user_id,question_id))`,
    `CREATE TABLE IF NOT EXISTS contact_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, subject TEXT NOT NULL, message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new', created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS user_workout_overrides (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, workout_exercise_id INTEGER NOT NULL, sets INTEGER, reps TEXT, rest_seconds INTEGER, notes TEXT, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(user_id,workout_exercise_id))`,
  ];
  for (const sql of statements) await db.prepare(sql).run();
  const seeds = [
    ["casa-inicial", "Casa Inicial", "Inicial", "Casa"], ["casa-intermedio", "Casa Intermedio", "Intermedio", "Casa"],
    ["gym-inicial", "Gym Inicial", "Inicial", "Gimnasio"], ["gym-intermedio", "Gym Intermedio", "Intermedio", "Gimnasio"],
  ];
  for (const [id, name, level, location] of seeds) {
    await db.prepare("INSERT OR IGNORE INTO programs (id, name, level, location, active) VALUES (?, ?, ?, ?, 1)").bind(id, name, level, location).run();
  }
  await db.batch([
    db.prepare("UPDATE programs SET name='Casa Básica' WHERE id='casa-inicial'"),
    db.prepare("UPDATE programs SET name='Casa Intermedia' WHERE id='casa-intermedio'"),
    db.prepare("UPDATE programs SET name='Gym Básico' WHERE id='gym-inicial'"),
    db.prepare("UPDATE programs SET name='Gym Intermedio' WHERE id='gym-intermedio'"),
  ]);
  const now = new Date().toISOString();
  const settings = [
    ["gpt_macros_url", ""], ["gpt_training_url", ""], ["firme_url", "https://habitofirme.app/"],
    ["whatsapp_url", ""], ["payment_monthly_url", ""], ["payment_full_url", ""], ["contact_email", "tuamiguelmoya@gmail.com"],
  ];
  for (const [key, value] of settings) {
    await db.prepare("INSERT OR IGNORE INTO app_settings (key,value,updated_at) VALUES (?,?,?)").bind(key,value,now).run();
  }
  const questions = [
    ["age", "¿Cuál es tu edad?", "number", "", 1],
    ["weight", "¿Cuál es tu peso actual en kilos?", "number", "", 2],
    ["height", "¿Cuál es tu estatura en centímetros?", "number", "", 3],
    ["activity", "¿Cuál es tu nivel de actividad física actual?", "select", "Sedentario|Poco activo|Activo|Muy activo", 4],
    ["training_place", "¿Prefieres entrenar en casa o en gimnasio?", "select", "Casa|Gimnasio|Ambos", 5],
    ["training_health", "¿Tienes alguna enfermedad, lesión o limitación relevante para entrenar?", "textarea", "", 6],
    ["nutrition_health", "¿Tienes alguna enfermedad, alergia o condición relevante para tu alimentación?", "textarea", "", 7],
  ];
  for (const [id, label, fieldType, options, position] of questions) {
    await db.prepare("INSERT OR IGNORE INTO onboarding_questions (id,label,field_type,options,position,required,active) VALUES (?,?,?,?,?,1,1)")
      .bind(id,label,fieldType,options,position).run();
  }
  await db.batch([
    db.prepare("UPDATE onboarding_questions SET audience='training' WHERE id='training_health'"),
    db.prepare("UPDATE onboarding_questions SET audience='nutrition' WHERE id='nutrition_health'"),
  ]);
  await seedRoutines(db);
}

export function requireRole(viewer: Viewer, roles: ViewerRole[]) {
  if (!roles.includes(viewer.role)) throw new Response("No autorizado", { status: 403 });
}
