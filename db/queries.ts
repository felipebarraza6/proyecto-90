import { env } from "cloudflare:workers";
import type { Viewer } from "./access";

export async function getBootstrap(viewer: Viewer) {
  if (viewer.role === "participant") return getParticipantBootstrap(viewer);
  const [participants, professionals, programs, exercises, workouts, workoutBlocks, workoutExercises, content, sessions, settings, questions, participantResponses, workoutOverrides, messages, meetings, checkpoints, metrics] = await Promise.all([
    env.DB.prepare(`SELECT u.id,u.email,u.role,u.status,u.created_at,p.first_name,p.last_name,p.birthdate,p.gender,p.height,p.weight AS initial_weight,p.city,
      o.objective,o.training_days,o.preferred_location,o.activity_level,o.dietary_restrictions,o.motivation,o.completed_at,
      pr.id AS program_id,pr.name AS program_name,np.id AS nutrition_id,np.calories,np.protein,np.carbs,np.fats,np.objective AS nutrition_objective,np.pdf_key,np.notes AS nutrition_notes,np.review_date,np.updated_at AS nutrition_updated_at,np.review_status,np.review_note,np.reviewed_at,
      MIN(90,MAX(1,CAST(julianday('now')-julianday(u.created_at) AS INTEGER)+1)) AS program_day,
      CASE WHEN julianday('now')-julianday(u.created_at)>=89 THEN 1 ELSE 0 END AS graduated,
      (SELECT adherence FROM habit_metrics hm WHERE hm.user_id=u.id ORDER BY hm.period_end DESC,hm.id DESC LIMIT 1) AS adherence,
      (SELECT weight FROM checkpoints cp WHERE cp.user_id=u.id AND cp.weight IS NOT NULL ORDER BY cp.completed_at DESC,cp.id DESC LIMIT 1) AS latest_weight,
      (SELECT completed_at FROM checkpoints cp WHERE cp.user_id=u.id AND cp.weight IS NOT NULL ORDER BY cp.completed_at DESC,cp.id DESC LIMIT 1) AS latest_weight_at
      FROM users u LEFT JOIN profiles p ON p.user_id=u.id LEFT JOIN onboarding o ON o.user_id=u.id
      LEFT JOIN user_programs up ON up.user_id=u.id AND up.active=1 LEFT JOIN programs pr ON pr.id=up.program_id
      LEFT JOIN nutrition_plans np ON np.id=(SELECT id FROM nutrition_plans n2 WHERE n2.user_id=u.id ORDER BY n2.updated_at DESC LIMIT 1)
      WHERE u.role='participant' ORDER BY u.created_at DESC`).all(),
    env.DB.prepare(`SELECT u.id,u.email,u.status,u.created_at,p.first_name,p.last_name,p.city,p.professional_type
      FROM users u LEFT JOIN profiles p ON p.user_id=u.id WHERE u.role='professional' ORDER BY p.first_name,p.last_name,u.email`).all(),
    env.DB.prepare(`SELECT p.*, COUNT(DISTINCT w.id) workout_count, COUNT(DISTINCT up.user_id) participant_count FROM programs p
      LEFT JOIN workouts w ON w.program_id=p.id LEFT JOIN user_programs up ON up.program_id=p.id AND up.active=1 GROUP BY p.id ORDER BY p.name`).all(),
    env.DB.prepare("SELECT * FROM exercises ORDER BY name").all(),
    env.DB.prepare(`SELECT w.*,wp.progression FROM workouts w LEFT JOIN workout_progressions wp ON wp.workout_id=w.id ORDER BY w.program_id,w.month,w.week,w.name`).all(),
    env.DB.prepare("SELECT * FROM workout_blocks ORDER BY workout_id,position,name").all(),
    env.DB.prepare(`SELECT we.*,e.name exercise_name,e.youtube_url,e.technique,e.common_errors,e.regression,e.progression
      FROM workout_exercises we JOIN exercises e ON e.id=we.exercise_id ORDER BY we.workout_id,we.position`).all(),
    env.DB.prepare("SELECT c.*,CASE WHEN rc.content_id IS NULL THEN 0 ELSE 1 END is_required FROM content c LEFT JOIN required_content rc ON rc.content_id=c.id ORDER BY c.position,c.publish_at DESC").all(),
    env.DB.prepare("SELECT * FROM sessions ORDER BY datetime(starts_at)").all(),
    env.DB.prepare("SELECT key,value FROM app_settings ORDER BY key").all(),
    env.DB.prepare("SELECT * FROM onboarding_questions ORDER BY position,label").all(),
    env.DB.prepare(`SELECT r.user_id,r.question_id,r.answer,r.updated_at,q.label,q.audience,q.position
      FROM onboarding_responses r JOIN onboarding_questions q ON q.id=r.question_id ORDER BY r.user_id,q.position`).all(),
    env.DB.prepare("SELECT * FROM user_workout_overrides ORDER BY user_id,workout_exercise_id").all(),
    env.DB.prepare(`SELECT m.*,u.email,p.first_name,p.last_name FROM contact_messages m JOIN users u ON u.id=m.user_id
      LEFT JOIN profiles p ON p.user_id=u.id ORDER BY m.created_at DESC`).all(),
    env.DB.prepare(`SELECT m.*,u.email,p.first_name,p.last_name FROM one_on_one_meetings m JOIN users u ON u.id=m.user_id
      LEFT JOIN profiles p ON p.user_id=u.id ORDER BY CASE m.status WHEN 'pending' THEN 0 WHEN 'confirmed' THEN 1 WHEN 'rescheduled' THEN 1 ELSE 2 END,
      datetime(COALESCE(m.confirmed_start,m.requested_start))`).all(),
    env.DB.prepare("SELECT * FROM checkpoints ORDER BY user_id,completed_at DESC,id DESC").all(),
    env.DB.prepare("SELECT * FROM habit_metrics ORDER BY user_id,period_end DESC,id DESC").all(),
  ]);
  const isReviewer = viewer.role === "reviewer";
  const audience = viewer.role === "admin" || isReviewer ? "all" : (viewer.professionalType || "both");
  const visibleQuestions = audience === "all" || audience === "both" ? questions.results : questions.results.filter((row:Record<string,unknown>) => row.audience === "both" || row.audience === audience);
  const visibleResponses = audience === "all" || audience === "both" ? participantResponses.results : participantResponses.results.filter((row:Record<string,unknown>) => row.audience === "both" || row.audience === audience);
  const isAdmin = viewer.role === "admin" || isReviewer;
  const canTrain = isAdmin || ["training","both"].includes(viewer.professionalType || "");
  const canNutrition = isAdmin || ["nutrition","both"].includes(viewer.professionalType || "");
  const visibleParticipants = canNutrition ? participants.results : participants.results.map((row:Record<string,unknown>) => {
    const { nutrition_id,nutrition_objective,calories,protein,carbs,fats,pdf_key,nutrition_notes,review_date,nutrition_updated_at,review_status,review_note,reviewed_at,...safe } = row;
    void nutrition_id; void nutrition_objective; void calories; void protein; void carbs; void fats; void pdf_key; void nutrition_notes; void review_date; void nutrition_updated_at; void review_status; void review_note; void reviewed_at;
    return safe;
  });
  return { viewer, participants: visibleParticipants, professionals: isAdmin ? professionals.results : [], programs: canTrain ? programs.results : [], exercises: canTrain ? exercises.results : [], workouts: canTrain ? workouts.results : [], workoutBlocks: canTrain ? workoutBlocks.results : [], workoutExercises: canTrain ? workoutExercises.results : [], userWorkoutOverrides: canTrain ? workoutOverrides.results : [], participantResponses: visibleResponses, content: isAdmin ? content.results : [], sessions: isAdmin ? sessions.results : [], settings: isAdmin ? settings.results : [], questions: visibleQuestions, messages: isAdmin ? messages.results : [], meetings: isAdmin ? meetings.results : [], reviewCheckpoints: isReviewer ? checkpoints.results : [], reviewMetrics: isReviewer ? metrics.results : [] };
}

async function getParticipantBootstrap(viewer: Viewer) {
  const [profile, programs, workouts, workoutBlocks, workoutExercises, workoutOverrides, nutrition, checkpoints, metrics, content, sessions, settings, questions, responses, assignment, meeting] = await Promise.all([
    env.DB.prepare(`SELECT u.id,u.email,u.status,u.created_at,p.*,o.*,
      MIN(90,MAX(1,CAST(julianday('now')-julianday(u.created_at) AS INTEGER)+1)) AS program_day,
      CASE WHEN julianday('now')-julianday(u.created_at)>=89 THEN 1 ELSE 0 END AS graduated
      FROM users u LEFT JOIN profiles p ON p.user_id=u.id LEFT JOIN onboarding o ON o.user_id=u.id WHERE u.id=?`).bind(viewer.id).first(),
    env.DB.prepare("SELECT * FROM programs WHERE active=1 ORDER BY CASE id WHEN 'casa-inicial' THEN 1 WHEN 'casa-intermedio' THEN 2 WHEN 'gym-inicial' THEN 3 ELSE 4 END,name").all(),
    env.DB.prepare(`SELECT w.*,wp.progression FROM workouts w LEFT JOIN workout_progressions wp ON wp.workout_id=w.id ORDER BY w.program_id,w.month,w.week,w.name`).all(),
    env.DB.prepare("SELECT * FROM workout_blocks ORDER BY workout_id,position,name").all(),
    env.DB.prepare(`SELECT we.*,w.program_id,e.name exercise_name,e.youtube_url,e.description,e.technique,e.common_errors,e.regression,e.progression
      FROM workout_exercises we JOIN exercises e ON e.id=we.exercise_id JOIN workouts w ON w.id=we.workout_id
      ORDER BY we.workout_id,we.position`).all(),
    env.DB.prepare("SELECT * FROM user_workout_overrides WHERE user_id=? ORDER BY workout_exercise_id").bind(viewer.id).all(),
    env.DB.prepare("SELECT * FROM nutrition_plans WHERE user_id=? AND review_status='approved' ORDER BY updated_at DESC LIMIT 1").bind(viewer.id).first(),
    env.DB.prepare("SELECT * FROM checkpoints WHERE user_id=? ORDER BY completed_at DESC,id DESC").bind(viewer.id).all(),
    env.DB.prepare("SELECT * FROM habit_metrics WHERE user_id=? ORDER BY period_end DESC LIMIT 12").bind(viewer.id).all(),
    env.DB.prepare(`SELECT c.*,CASE WHEN rc.content_id IS NULL THEN 0 ELSE 1 END is_required FROM content c
      LEFT JOIN required_content rc ON rc.content_id=c.id WHERE rc.content_id IS NOT NULL OR c.publish_at IS NULL OR c.publish_at<=?
      ORDER BY is_required DESC,c.position,c.publish_at DESC`).bind(new Date().toISOString()).all(),
    env.DB.prepare("SELECT * FROM sessions WHERE datetime(starts_at)>=datetime('now') ORDER BY datetime(starts_at)").all(),
    env.DB.prepare("SELECT key,value FROM app_settings ORDER BY key").all(),
    env.DB.prepare("SELECT * FROM onboarding_questions WHERE active=1 ORDER BY position,label").all(),
    env.DB.prepare("SELECT question_id,answer FROM onboarding_responses WHERE user_id=?").bind(viewer.id).all(),
    env.DB.prepare("SELECT program_id,assigned_at FROM user_programs WHERE user_id=? AND active=1 ORDER BY assigned_at DESC LIMIT 1").bind(viewer.id).first(),
    env.DB.prepare("SELECT * FROM one_on_one_meetings WHERE user_id=? LIMIT 1").bind(viewer.id).first(),
  ]);
  return { viewer, profile, programs: programs.results, workouts: workouts.results, workoutBlocks: workoutBlocks.results, workoutExercises: workoutExercises.results, userWorkoutOverrides: workoutOverrides.results, nutrition, checkpoints: checkpoints.results, metrics: metrics.results, content: content.results, sessions: sessions.results, settings: settings.results, questions: questions.results, responses: responses.results, assignedProgramId: assignment?.program_id ?? null, meeting: meeting ?? null };
}
