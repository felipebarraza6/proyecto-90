import { env } from "cloudflare:workers";
import type { Viewer } from "./access";

export async function getBootstrap(viewer: Viewer, specialtyOverride?: "coach" | "nutrition") {
  if (viewer.role === "participant") return getParticipantBootstrap(viewer);
  const professional = viewer.role === "professional"
    ? await env.DB.prepare("SELECT specialty FROM professional_profiles WHERE user_id=?").bind(viewer.id).first<{ specialty: string }>()
    : null;
  const specialty = specialtyOverride || professional?.specialty || "coach";
  const questionSql = viewer.role === "admin"
    ? "SELECT * FROM intake_questions ORDER BY position"
    : "SELECT * FROM intake_questions WHERE active=1 AND (audience='both' OR audience=?) ORDER BY position";
  const responseSql = viewer.role === "admin"
    ? `SELECT r.* FROM intake_responses r JOIN intake_questions q ON q.id=r.question_id ORDER BY r.user_id,q.position`
    : `SELECT r.* FROM intake_responses r JOIN intake_questions q ON q.id=r.question_id WHERE q.active=1 AND (q.audience='both' OR q.audience=?) ORDER BY r.user_id,q.position`;
  const [participants, professionals, administrators, habitDaily, nutritionDaily, adherenceOutreach, programs, programGuides, exercises, workouts, workoutExercises, content, sessions, meetingRequests, intakeQuestions, intakeResponses] = await Promise.all([
    env.DB.prepare(`SELECT u.id,u.email,u.role,u.status,u.created_at,p.first_name,p.last_name,p.birthdate,p.gender,p.height,p.weight,p.city,
      o.objective,o.training_days,o.preferred_location,o.activity_level,o.dietary_restrictions,o.motivation,o.completed_at AS intake_completed_at,
      pr.id AS program_id,pr.name AS program_name,up.assigned_at,np.id AS nutrition_id,np.calories,np.protein,np.carbs,np.fats,np.pdf_key,np.notes AS nutrition_notes,np.review_date,np.review_status AS nutrition_status,
      ns.assessment_json AS nutrition_assessment,ns.red_flag_count,ns.deficient_habit_count,ns.automation_status,
      pa.training_pct,pa.macros_pct,pa.water_pct,
      (SELECT status FROM professional_approvals apr WHERE apr.user_id=u.id AND apr.area='training' LIMIT 1) AS training_approval_status,
      (SELECT approved_by FROM professional_approvals apr WHERE apr.user_id=u.id AND apr.area='training' LIMIT 1) AS training_approved_by,
      (SELECT weight FROM checkpoints cp WHERE cp.user_id=u.id AND cp.weight IS NOT NULL ORDER BY cp.day DESC,cp.completed_at DESC LIMIT 1) AS latest_weight,
      (SELECT weight FROM checkpoints cp WHERE cp.user_id=u.id AND cp.day=30 ORDER BY cp.completed_at DESC LIMIT 1) AS weight_day_30,
      (SELECT weight FROM checkpoints cp WHERE cp.user_id=u.id AND cp.day=60 ORDER BY cp.completed_at DESC LIMIT 1) AS weight_day_60,
      (SELECT weight FROM checkpoints cp WHERE cp.user_id=u.id AND cp.day=90 ORDER BY cp.completed_at DESC LIMIT 1) AS weight_day_90,
      (SELECT adherence FROM checkpoints cp WHERE cp.user_id=u.id AND cp.day=30 ORDER BY cp.completed_at DESC LIMIT 1) AS checkpoint_adherence_day_30,
      (SELECT adherence FROM checkpoints cp WHERE cp.user_id=u.id AND cp.day=60 ORDER BY cp.completed_at DESC LIMIT 1) AS checkpoint_adherence_day_60,
      (SELECT adherence FROM checkpoints cp WHERE cp.user_id=u.id AND cp.day=90 ORDER BY cp.completed_at DESC LIMIT 1) AS checkpoint_adherence_day_90,
      (SELECT adherence FROM habit_metrics hm WHERE hm.user_id=u.id ORDER BY hm.period_end DESC LIMIT 1) AS adherence
      FROM users u LEFT JOIN profiles p ON p.user_id=u.id LEFT JOIN onboarding o ON o.user_id=u.id
      LEFT JOIN user_programs up ON up.user_id=u.id AND up.active=1 LEFT JOIN programs pr ON pr.id=up.program_id
      LEFT JOIN participant_adherence pa ON pa.user_id=u.id
      LEFT JOIN nutrition_screenings ns ON ns.user_id=u.id
      LEFT JOIN nutrition_plans np ON np.id=(SELECT id FROM nutrition_plans n2 WHERE n2.user_id=u.id ORDER BY n2.updated_at DESC LIMIT 1)
      WHERE u.role='participant' ORDER BY u.created_at DESC`).all(),
    env.DB.prepare(`SELECT u.id,u.email,u.status,p.first_name,p.last_name,pp.specialty
      FROM users u LEFT JOIN profiles p ON p.user_id=u.id LEFT JOIN professional_profiles pp ON pp.user_id=u.id
      WHERE u.role='professional' ORDER BY p.first_name,p.last_name`).all(),
    viewer.role === "admin" ? env.DB.prepare(`SELECT u.id,u.email,u.status,u.created_at,p.first_name,p.last_name
      FROM users u LEFT JOIN profiles p ON p.user_id=u.id WHERE u.role='admin' ORDER BY p.first_name,p.last_name`).all() : Promise.resolve({results:[]}),
    env.DB.prepare("SELECT * FROM habit_daily ORDER BY habit_date,user_id,habit").all(),
    env.DB.prepare("SELECT * FROM nutrition_daily ORDER BY log_date,user_id").all(),
    viewer.role === "admin" || viewer.role === "reviewer" ? env.DB.prepare("SELECT * FROM adherence_outreach ORDER BY week_start DESC,user_id").all() : Promise.resolve({results:[]}),
    env.DB.prepare(`SELECT p.*, COUNT(DISTINCT w.id) workout_count, COUNT(DISTINCT up.user_id) participant_count FROM programs p
      LEFT JOIN workouts w ON w.program_id=p.id LEFT JOIN user_programs up ON up.program_id=p.id AND up.active=1 GROUP BY p.id ORDER BY p.name`).all(),
    env.DB.prepare("SELECT * FROM program_guides ORDER BY program_id").all(),
    env.DB.prepare("SELECT * FROM exercises ORDER BY name").all(),
    env.DB.prepare("SELECT * FROM workouts ORDER BY program_id,month,week,name").all(),
    env.DB.prepare(`SELECT we.*,e.name exercise_name,e.youtube_url,e.technique,e.common_errors,e.regression,e.progression
      FROM workout_exercises we JOIN exercises e ON e.id=we.exercise_id ORDER BY we.workout_id,we.position`).all(),
    env.DB.prepare("SELECT * FROM content ORDER BY position,publish_at DESC").all(),
    env.DB.prepare("SELECT * FROM sessions ORDER BY starts_at").all(),
    env.DB.prepare(`SELECT mr.*,mr.requested_start AS requested_at,mr.confirmed_start AS starts_at,u.email,p.first_name,p.last_name FROM one_on_one_meetings mr JOIN users u ON u.id=mr.user_id LEFT JOIN profiles p ON p.user_id=u.id ORDER BY mr.created_at DESC`).all(),
    viewer.role === "admin" ? env.DB.prepare(questionSql).all() : env.DB.prepare(questionSql).bind(specialty).all(),
    viewer.role === "admin" ? env.DB.prepare(responseSql).all() : env.DB.prepare(responseSql).bind(specialty).all(),
  ]);
  const participantRows=enrichAdherence(participants.results,habitDaily.results,nutritionDaily.results);
  const visibleHabitDaily=viewer.role==="admin"||specialty==="coach"?habitDaily.results:[],visibleNutritionDaily=viewer.role==="admin"||specialty==="nutrition"?nutritionDaily.results:[];
  return { viewer, professionalSpecialty: specialty, participants: participantRows, professionals: professionals.results, administrators: administrators.results, habitDaily: visibleHabitDaily, nutritionDaily: visibleNutritionDaily, adherenceOutreach: adherenceOutreach.results, programs: programs.results, programGuides: programGuides.results, exercises: filterRoutineExercises(exercises.results,programGuides.results), workouts: workouts.results, workoutExercises: workoutExercises.results, content: content.results, sessions: sessions.results, meetingRequests: meetingRequests.results, intakeQuestions: intakeQuestions.results, intakeResponses: intakeResponses.results };
}

async function getParticipantBootstrap(viewer: Viewer) {
  const [profile, programs, programGuides, exercises, workouts, workoutExercises, nutrition, checkpoints, metrics, adherence, habitDaily, nutritionDaily, content, sessions, meetingRequests, intakeQuestions, intakeResponses] = await Promise.all([
    env.DB.prepare(`SELECT u.id,u.email,u.status,u.created_at,p.*,o.* FROM users u LEFT JOIN profiles p ON p.user_id=u.id LEFT JOIN onboarding o ON o.user_id=u.id WHERE u.id=?`).bind(viewer.id).first(),
    env.DB.prepare(`SELECT p.*,up.assigned_at FROM user_programs up JOIN programs p ON p.id=up.program_id WHERE up.user_id=? AND up.active=1`).bind(viewer.id).all(),
    env.DB.prepare(`SELECT pg.* FROM program_guides pg JOIN user_programs up ON up.program_id=pg.program_id WHERE up.user_id=? AND up.active=1`).bind(viewer.id).all(),
    env.DB.prepare("SELECT * FROM exercises ORDER BY name").all(),
    env.DB.prepare(`SELECT w.* FROM workouts w JOIN user_programs up ON up.program_id=w.program_id WHERE up.user_id=? AND up.active=1 ORDER BY w.month,w.week,w.name`).bind(viewer.id).all(),
    env.DB.prepare(`SELECT we.*,e.name exercise_name,e.youtube_url,e.description,e.technique,e.common_errors,e.regression,e.progression
      FROM workout_exercises we JOIN exercises e ON e.id=we.exercise_id JOIN workouts w ON w.id=we.workout_id
      JOIN user_programs up ON up.program_id=w.program_id WHERE up.user_id=? AND up.active=1 ORDER BY we.workout_id,we.position`).bind(viewer.id).all(),
    env.DB.prepare("SELECT * FROM nutrition_plans WHERE user_id=? AND review_status='approved' ORDER BY updated_at DESC LIMIT 1").bind(viewer.id).first(),
    env.DB.prepare("SELECT * FROM checkpoints WHERE user_id=? ORDER BY day").bind(viewer.id).all(),
    env.DB.prepare("SELECT * FROM habit_metrics WHERE user_id=? ORDER BY period_end DESC LIMIT 12").bind(viewer.id).all(),
    env.DB.prepare("SELECT * FROM participant_adherence WHERE user_id=?").bind(viewer.id).first(),
    env.DB.prepare("SELECT * FROM habit_daily WHERE user_id=? ORDER BY habit_date,habit").bind(viewer.id).all(),
    env.DB.prepare("SELECT * FROM nutrition_daily WHERE user_id=? ORDER BY log_date").bind(viewer.id).all(),
    env.DB.prepare("SELECT * FROM content WHERE publish_at IS NULL OR publish_at<=? ORDER BY position,publish_at DESC").bind(new Date().toISOString()).all(),
    env.DB.prepare("SELECT * FROM sessions ORDER BY starts_at").all(),
    env.DB.prepare("SELECT *,requested_start AS requested_at,confirmed_start AS starts_at FROM one_on_one_meetings WHERE user_id=? ORDER BY created_at DESC").bind(viewer.id).all(),
    env.DB.prepare("SELECT * FROM intake_questions WHERE active=1 ORDER BY position").all(),
    env.DB.prepare("SELECT * FROM intake_responses WHERE user_id=?").bind(viewer.id).all(),
  ]);
  const liveAdherence=enrichAdherence([{...(profile||{}),assigned_at:programs.results[0]?.assigned_at,calories:nutrition?.calories,protein:nutrition?.protein}],habitDaily.results,nutritionDaily.results)[0];
  for(const checkpoint of checkpoints.results){const day=Number(checkpoint.day);if([30,60,90].includes(day)&&checkpoint.adherence!=null)liveAdherence[`adherence_day_${day}`]=checkpoint.adherence}
  return { viewer, profile, programs: programs.results, programGuides: programGuides.results, exercises: filterRoutineExercises(exercises.results,programGuides.results), workouts: workouts.results, workoutExercises: workoutExercises.results, nutrition, checkpoints: checkpoints.results, metrics: metrics.results, adherence:liveAdherence||adherence, habitDaily:habitDaily.results, nutritionDaily:nutritionDaily.results, content: content.results, sessions: sessions.results, meetingRequests: meetingRequests.results, intakeQuestions: intakeQuestions.results, intakeResponses: intakeResponses.results };
}

function enrichAdherence(people:Record<string,unknown>[],habitRows:Record<string,unknown>[],nutritionRows:Record<string,unknown>[]){
  const today=new Date().toISOString().slice(0,10);
  return people.map(person=>{
    const userId=String(person.id||person.user_id||"");
    const start=String(person.assigned_at||person.created_at||today).slice(0,10);
    const actualElapsed=Math.max(1,Math.min(90,Math.floor((Date.parse(`${today}T12:00:00Z`)-Date.parse(`${start}T12:00:00Z`))/86400000)+1));
    const calculate=(elapsed:number)=>{
      const end=new Date(Date.parse(`${start}T12:00:00Z`)+(elapsed-1)*86400000).toISOString().slice(0,10);
      const ownHabits=habitRows.filter(row=>String(row.user_id)===userId&&String(row.habit_date)>=start&&String(row.habit_date)<=end);
      const trainingMet=ownHabits.filter(row=>row.habit==="training"&&row.status==="met").length;
      const waterMet=ownHabits.filter(row=>row.habit==="water"&&row.status==="met").length;
      const targetCalories=Number(person.calories||0),targetProtein=Number(person.protein||0);
      const macrosMet=targetCalories&&targetProtein?nutritionRows.filter(row=>String(row.user_id)===userId&&String(row.log_date)>=start&&String(row.log_date)<=end&&Number(row.calories||0)<=targetCalories*1.1&&Number(row.protein||0)>=targetProtein*.9).length:0;
      const trainingPct=Math.min(100,Math.round(trainingMet/elapsed*100));
      const macrosPct=Math.min(100,Math.round(macrosMet/elapsed*100));
      const waterPct=Math.min(100,Math.round(waterMet/elapsed*100));
      return {trainingPct,macrosPct,waterPct,total:Math.round(trainingPct*.4+macrosPct*.4+waterPct*.2)};
    };
    const current=calculate(actualElapsed);
    return {...person,training_pct:current.trainingPct,macros_pct:current.macrosPct,water_pct:current.waterPct,adherence:current.total,adherence_elapsed_days:actualElapsed,
      adherence_day_0:0,adherence_day_30:actualElapsed>=30?(person.checkpoint_adherence_day_30??calculate(30).total):null,adherence_day_60:actualElapsed>=60?(person.checkpoint_adherence_day_60??calculate(60).total):null,adherence_day_90:actualElapsed>=90?(person.checkpoint_adherence_day_90??calculate(90).total):null};
  });
}

function filterRoutineExercises(exercises:Record<string,unknown>[],guides:Record<string,unknown>[]){
  const used=new Set<string>();
  for(const row of guides){try{const guide=JSON.parse(String(row.content_json||"{}")) as {exerciseNames?:string[];days?:Array<{nodes?:Array<{type?:string;text?:string;name?:string;rows?:Array<{exerciseName?:string}>}>}>};for(const name of guide.exerciseNames||[])used.add(normalize(name));for(const day of guide.days||[]){let warmup=false;for(const node of day.nodes||[]){if(node.type==="heading")warmup=/calentamiento/i.test(node.text||"");if(warmup&&node.type==="paragraph"&&node.text&&!/(:$|cada ejercicio|cada uno|vueltas?|minutos? continuos)/i.test(node.text))used.add(normalize(node.text.replace(/[.]$/,"") ));if(node.type==="exercise"&&node.name)used.add(normalize(node.name));for(const tableRow of node.rows||[])if(tableRow.exerciseName)used.add(normalize(tableRow.exerciseName))}}}catch{/* Ignore malformed guide rows without exposing unrelated exercises. */}}
  return exercises.filter(item=>used.has(normalize(String(item.name||""))));
}
function normalize(value:string){return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim()}
