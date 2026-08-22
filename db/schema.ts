import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(), email: text("email").notNull().unique(),
  role: text("role", { enum: ["admin", "professional", "participant", "reviewer"] }).notNull(),
  status: text("status").notNull(), createdAt: text("created_at").notNull(),
});
export const profiles = sqliteTable("profiles", {
  userId: text("user_id").primaryKey(), firstName: text("first_name"), lastName: text("last_name"),
  birthdate: text("birthdate"), gender: text("gender"), height: real("height"), weight: real("weight"), city: text("city"), professionalType: text("professional_type"),
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
export const userPrograms = sqliteTable("user_programs", {
  id: integer("id").primaryKey({ autoIncrement: true }), userId: text("user_id").notNull(), programId: text("program_id").notNull(),
  assignedAt: text("assigned_at").notNull(), active: integer("active", { mode: "boolean" }).notNull(),
});
export const workouts = sqliteTable("workouts", {
  id: text("id").primaryKey(), programId: text("program_id").notNull(), month: integer("month").notNull(), week: integer("week").notNull(), name: text("name").notNull(),
});
export const workoutProgressions = sqliteTable("workout_progressions", {
  workoutId: text("workout_id").primaryKey(), progression: text("progression"),
});
export const workoutBlocks = sqliteTable("workout_blocks", {
  id: text("id").primaryKey(), workoutId: text("workout_id").notNull(), position: integer("position").notNull(),
  name: text("name").notNull(), rounds: integer("rounds").notNull().default(1), workSeconds: integer("work_seconds"),
  restSeconds: integer("rest_seconds"), notes: text("notes"),
});
export const exercises = sqliteTable("exercises", {
  id: text("id").primaryKey(), name: text("name").notNull(), category: text("category"), level: text("level"), youtubeUrl: text("youtube_url"),
  description: text("description"), technique: text("technique"), commonErrors: text("common_errors"), regression: text("regression"), progression: text("progression"),
});
export const workoutExercises = sqliteTable("workout_exercises", {
  id: integer("id").primaryKey({ autoIncrement: true }), workoutId: text("workout_id").notNull(), exerciseId: text("exercise_id").notNull(),
  blockId: text("block_id"), position: integer("position").notNull(), sets: integer("sets"), reps: text("reps"), restSeconds: integer("rest_seconds"), notes: text("notes"),
});
export const nutritionPlans = sqliteTable("nutrition_plans", {
  id: integer("id").primaryKey({ autoIncrement: true }), userId: text("user_id").notNull(), calories: integer("calories"), protein: integer("protein"),
  carbs: integer("carbs"), fats: integer("fats"), objective: text("objective"), pdfKey: text("pdf_key"), notes: text("notes"), reviewDate: text("review_date"), updatedBy: text("updated_by"), updatedAt: text("updated_at"),
  reviewStatus: text("review_status").notNull().default("pending_review"), reviewNote: text("review_note"), reviewedBy: text("reviewed_by"), reviewedAt: text("reviewed_at"),
});
export const checkpoints = sqliteTable("checkpoints", {
  id: integer("id").primaryKey({ autoIncrement: true }), userId: text("user_id").notNull(), day: integer("day").notNull(),
  weight: real("weight"), waist: real("waist"), photoKey: text("photo_key"), reflection: text("reflection"), perception: integer("perception"), completedAt: text("completed_at"),
});
export const habitMetrics = sqliteTable("habit_metrics", {
  id: integer("id").primaryKey({ autoIncrement: true }), userId: text("user_id").notNull(), periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(), adherence: real("adherence").notNull(), source: text("source").notNull().default("firme"), syncedAt: text("synced_at").notNull(),
});
export const content = sqliteTable("content", {
  id: text("id").primaryKey(), title: text("title").notNull(), description: text("description"), category: text("category").notNull(),
  videoUrl: text("video_url"), fileKey: text("file_key"), position: integer("position"), publishAt: text("publish_at"),
});
export const requiredContent = sqliteTable("required_content", { contentId: text("content_id").primaryKey() });
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), title: text("title").notNull(), professional: text("professional"), startsAt: text("starts_at").notNull(),
  link: text("link"), recordingUrl: text("recording_url"), materialsKey: text("materials_key"),
});
export const adminNotes = sqliteTable("admin_notes", {
  id: integer("id").primaryKey({ autoIncrement: true }), userId: text("user_id").notNull(), authorId: text("author_id").notNull(),
  note: text("note").notNull(), createdAt: text("created_at").notNull(),
});
export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(), value: text("value").notNull(), updatedAt: text("updated_at").notNull(),
});
export const onboardingQuestions = sqliteTable("onboarding_questions", {
  id: text("id").primaryKey(), label: text("label").notNull(), fieldType: text("field_type").notNull(),
  options: text("options"), position: integer("position").notNull(), required: integer("required", { mode: "boolean" }).notNull().default(true),
  active: integer("active", { mode: "boolean" }).notNull().default(true), audience: text("audience").notNull().default("both"),
});
export const onboardingResponses = sqliteTable("onboarding_responses", {
  id: integer("id").primaryKey({ autoIncrement: true }), userId: text("user_id").notNull(),
  questionId: text("question_id").notNull(), answer: text("answer"), updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("onboarding_responses_user_question_idx").on(table.userId, table.questionId)]);
export const contactMessages = sqliteTable("contact_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }), userId: text("user_id").notNull(),
  subject: text("subject").notNull(), message: text("message").notNull(), status: text("status").notNull().default("new"),
  createdAt: text("created_at").notNull(),
});
export const oneOnOneMeetings = sqliteTable("one_on_one_meetings", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(), requestedStart: text("requested_start").notNull(),
  confirmedStart: text("confirmed_start"), status: text("status").notNull().default("pending"), topic: text("topic").notNull(),
  meetingLink: text("meeting_link"), adminNote: text("admin_note"), reviewedBy: text("reviewed_by"), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("one_on_one_meetings_user_idx").on(table.userId)]);

export const userWorkoutOverrides = sqliteTable("user_workout_overrides", {
  id: integer("id").primaryKey({ autoIncrement: true }), userId: text("user_id").notNull(), workoutExerciseId: integer("workout_exercise_id").notNull(),
  sets: integer("sets"), reps: text("reps"), restSeconds: integer("rest_seconds"), notes: text("notes"), updatedBy: text("updated_by").notNull(), updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("user_workout_overrides_user_exercise_idx").on(table.userId, table.workoutExerciseId)]);
