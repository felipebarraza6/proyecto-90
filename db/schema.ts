import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const appMeta = sqliteTable("app_meta", {
  key: text("key").primaryKey(), value: text("value").notNull(),
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey(), email: text("email").notNull().unique(),
  role: text("role", { enum: ["admin", "professional", "participant", "reviewer"] }).notNull(),
  status: text("status").notNull(), createdAt: text("created_at").notNull(),
});
export const profiles = sqliteTable("profiles", {
  userId: text("user_id").primaryKey(), firstName: text("first_name"), lastName: text("last_name"),
  birthdate: text("birthdate"), gender: text("gender"), height: real("height"), weight: real("weight"), city: text("city"),
});
export const onboarding = sqliteTable("onboarding", {
  userId: text("user_id").primaryKey(), objective: text("objective"), currentTraining: integer("current_training", { mode: "boolean" }),
  trainingDays: integer("training_days"), preferredLocation: text("preferred_location"), equipment: text("equipment"),
  activityLevel: text("activity_level"), macrosExperience: integer("macros_experience", { mode: "boolean" }),
  dietaryRestrictions: text("dietary_restrictions"), preferences: text("preferences"), motivation: text("motivation"),
  healthNotes: text("health_notes"), completedAt: text("completed_at"),
});
export const programs = sqliteTable("programs", {
  id: text("id").primaryKey(), name: text("name").notNull(), level: text("level").notNull(), location: text("location").notNull(), active: integer("active", { mode: "boolean" }).notNull(),
});
export const programGuides = sqliteTable("program_guides", {
  programId: text("program_id").primaryKey(), title: text("title").notNull(),
  contentJson: text("content_json").notNull(), updatedAt: text("updated_at").notNull(),
});
export const userPrograms = sqliteTable("user_programs", {
  id: integer("id").primaryKey({ autoIncrement: true }), userId: text("user_id").notNull(), programId: text("program_id").notNull(),
  assignedAt: text("assigned_at").notNull(), active: integer("active", { mode: "boolean" }).notNull(),
});
export const workouts = sqliteTable("workouts", {
  id: text("id").primaryKey(), programId: text("program_id").notNull(), month: integer("month").notNull(), week: integer("week").notNull(), name: text("name").notNull(),
});
export const exercises = sqliteTable("exercises", {
  id: text("id").primaryKey(), name: text("name").notNull(), category: text("category"), level: text("level"), youtubeUrl: text("youtube_url"),
  description: text("description"), technique: text("technique"), commonErrors: text("common_errors"), regression: text("regression"), progression: text("progression"),
});
export const workoutExercises = sqliteTable("workout_exercises", {
  id: integer("id").primaryKey({ autoIncrement: true }), workoutId: text("workout_id").notNull(), exerciseId: text("exercise_id").notNull(),
  position: integer("position").notNull(), sets: integer("sets"), reps: text("reps"), restSeconds: integer("rest_seconds"), notes: text("notes"),
});
export const nutritionPlans = sqliteTable("nutrition_plans", {
  id: integer("id").primaryKey({ autoIncrement: true }), userId: text("user_id").notNull(), calories: integer("calories"), protein: integer("protein"),
  carbs: integer("carbs"), fats: integer("fats"), pdfKey: text("pdf_key"), notes: text("notes"), reviewDate: text("review_date"), updatedBy: text("updated_by"), updatedAt: text("updated_at"),
  objective: text("objective"), reviewStatus: text("review_status"), reviewNote: text("review_note"), reviewedBy: text("reviewed_by"), reviewedAt: text("reviewed_at"),
});
export const participantAdherence = sqliteTable("participant_adherence", {
  userId: text("user_id").primaryKey(), trainingPct: real("training_pct"), macrosPct: real("macros_pct"), waterPct: real("water_pct"), updatedAt: text("updated_at").notNull(), updatedBy: text("updated_by").notNull(),
});
export const nutritionDaily = sqliteTable("nutrition_daily", {
  userId: text("user_id").notNull(), logDate: text("log_date").notNull(), calories: real("calories"),
  protein: real("protein"), carbs: real("carbs"), fats: real("fats"), updatedAt: text("updated_at").notNull(),
});
export const habitDaily = sqliteTable("habit_daily", {
  userId: text("user_id").notNull(), habit: text("habit").notNull(), habitDate: text("habit_date").notNull(), status: text("status").notNull(), source: text("source").notNull().default("manual"), updatedAt: text("updated_at").notNull(),
});
export const adherenceOutreach = sqliteTable("adherence_outreach", {
  userId: text("user_id").notNull(), weekStart: text("week_start").notNull(), alertType: text("alert_type").notNull(),
  contacted: integer("contacted", { mode: "boolean" }).notNull().default(false), contactedAt: text("contacted_at"), contactedBy: text("contacted_by"),
});
export const oneOnOneMeetings = sqliteTable("one_on_one_meetings", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(), requestedStart: text("requested_start").notNull(), confirmedStart: text("confirmed_start"),
  status: text("status").notNull().default("pending"), topic: text("topic"), meetingLink: text("meeting_link"), adminNote: text("admin_note"), reviewedBy: text("reviewed_by"), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
});
export const checkpoints = sqliteTable("checkpoints", {
  id: integer("id").primaryKey({ autoIncrement: true }), userId: text("user_id").notNull(), day: integer("day").notNull(),
  weight: real("weight"), adherence: real("adherence"), waist: real("waist"), photoKey: text("photo_key"), reflection: text("reflection"), perception: integer("perception"), completedAt: text("completed_at"),
});
export const habitMetrics = sqliteTable("habit_metrics", {
  id: integer("id").primaryKey({ autoIncrement: true }), userId: text("user_id").notNull(), periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(), adherence: real("adherence").notNull(), source: text("source").notNull().default("firme"), syncedAt: text("synced_at").notNull(),
});
export const content = sqliteTable("content", {
  id: text("id").primaryKey(), title: text("title").notNull(), description: text("description"), category: text("category").notNull(),
  videoUrl: text("video_url"), fileKey: text("file_key"), position: integer("position"), publishAt: text("publish_at"),
});
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), title: text("title").notNull(), professional: text("professional"), startsAt: text("starts_at").notNull(),
  link: text("link"), recordingUrl: text("recording_url"), materialsKey: text("materials_key"),
});
export const adminNotes = sqliteTable("admin_notes", {
  id: integer("id").primaryKey({ autoIncrement: true }), userId: text("user_id").notNull(), authorId: text("author_id").notNull(),
  note: text("note").notNull(), createdAt: text("created_at").notNull(),
});
export const professionalProfiles = sqliteTable("professional_profiles", {
  userId: text("user_id").primaryKey(), specialty: text("specialty", { enum: ["coach", "nutrition"] }).notNull(),
});
export const intakeQuestions = sqliteTable("intake_questions", {
  id: text("id").primaryKey(), key: text("key").notNull().unique(), section: text("section").notNull(),
  prompt: text("prompt").notNull(), helpText: text("help_text"), type: text("type").notNull(), optionsJson: text("options_json"),
  audience: text("audience", { enum: ["both", "coach", "nutrition"] }).notNull(), required: integer("required", { mode: "boolean" }).notNull(),
  active: integer("active", { mode: "boolean" }).notNull(), position: integer("position").notNull(),
  conditionKey: text("condition_key"), conditionValue: text("condition_value"),
});
export const intakeResponses = sqliteTable("intake_responses", {
  id: integer("id").primaryKey({ autoIncrement: true }), userId: text("user_id").notNull(), questionId: text("question_id").notNull(),
  answerJson: text("answer_json").notNull(), updatedAt: text("updated_at").notNull(),
});
