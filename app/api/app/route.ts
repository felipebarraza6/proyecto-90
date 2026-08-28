import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getOrCreateViewer, requireRole } from "../../../db/access";
import { getBootstrap } from "../../../db/queries";
import { assessNutrition } from "../../../db/nutrition-rules";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await getChatGPTUser();
  if (!auth) return Response.json({ error: "Debes iniciar sesión" }, { status: 401 });
  const viewer = await getOrCreateViewer(auth);
  const url = new URL(request.url);
  const viewAs = url.searchParams.get("viewAs");
  if (viewAs) {
    if (viewer.role !== "admin") return Response.json({ error: "Solo el administrador puede usar Ver como" }, { status: 403 });
    if (viewAs === "coach" || viewAs === "nutrition") {
      const previewViewer = { ...viewer, role: "professional" as const, name: viewAs === "coach" ? "Vista Coach" : "Vista Nutricionista" };
      return Response.json({ ...(await getBootstrap(previewViewer, viewAs)), preview: { role: viewAs, label: viewAs === "coach" ? "Coach" : "Nutricionista" } });
    }
    if (viewAs === "participant") {
      const participantId = url.searchParams.get("participantId") || "";
      const participant = await env.DB.prepare(`SELECT u.id,u.email,u.role,u.status,trim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')) AS name
        FROM users u LEFT JOIN profiles p ON p.user_id=u.id WHERE u.id=? AND u.role='participant'`).bind(participantId)
        .first<{ id:string; email:string; role:"participant"; status:string; name:string }>();
      if (!participant) return Response.json({ error: "Alumno no encontrado" }, { status: 404 });
      const previewViewer = { ...participant, name: participant.name || participant.email };
      return Response.json({ ...(await getBootstrap(previewViewer)), preview: { role: "participant", label: previewViewer.name, targetId: previewViewer.id } });
    }
    return Response.json({ error: "Vista no válida" }, { status: 400 });
  }
  return Response.json(await getBootstrap(viewer));
}

export async function POST(request: Request) {
  try {
    const auth = await getChatGPTUser();
    if (!auth) return Response.json({ error: "Debes iniciar sesión" }, { status: 401 });
    const viewer = await getOrCreateViewer(auth);
    const body = await request.json() as Record<string, unknown>;
    const action = text(body.action);
    if (action === "participant.delete") {
      requireRole(viewer, ["admin"]);
      const id=text(body.id);
      const participant=await env.DB.prepare("SELECT id FROM users WHERE id=? AND role='participant'").bind(id).first();
      if(!participant)return bad("Participante no encontrado");
      await env.DB.batch([
        env.DB.prepare("DELETE FROM intake_responses WHERE user_id=?").bind(id),
        env.DB.prepare("DELETE FROM nutrition_plans WHERE user_id=?").bind(id),
        env.DB.prepare("DELETE FROM nutrition_screenings WHERE user_id=?").bind(id),
        env.DB.prepare("DELETE FROM participant_adherence WHERE user_id=?").bind(id),
        env.DB.prepare("DELETE FROM habit_daily WHERE user_id=?").bind(id),
        env.DB.prepare("DELETE FROM one_on_one_meetings WHERE user_id=?").bind(id),
        env.DB.prepare("DELETE FROM checkpoints WHERE user_id=?").bind(id),
        env.DB.prepare("DELETE FROM habit_metrics WHERE user_id=?").bind(id),
        env.DB.prepare("DELETE FROM professional_approvals WHERE user_id=?").bind(id),
        env.DB.prepare("DELETE FROM admin_notes WHERE user_id=?").bind(id),
        env.DB.prepare("DELETE FROM user_programs WHERE user_id=?").bind(id),
        env.DB.prepare("DELETE FROM onboarding WHERE user_id=?").bind(id),
        env.DB.prepare("DELETE FROM profiles WHERE user_id=?").bind(id),
        env.DB.prepare("DELETE FROM users WHERE id=?").bind(id),
      ]);
      return ok("Participante eliminado");
    }
    if (action === "participant.create") {
      requireRole(viewer, ["admin"]);
      const email = text(body.email).trim().toLowerCase();
      const firstName = text(body.firstName).trim();
      if (!email.includes("@") || !firstName) return bad("Nombre y correo son obligatorios");
      const id = crypto.randomUUID();
      await env.DB.batch([
        env.DB.prepare("INSERT INTO users (id,email,role,status,created_at) VALUES (?,?,'participant','invited',?)").bind(id,email,new Date().toISOString()),
        env.DB.prepare("INSERT INTO profiles (user_id,first_name,last_name,city) VALUES (?,?,?,?)").bind(id,firstName,text(body.lastName),text(body.city)),
        env.DB.prepare(`INSERT INTO onboarding (user_id,objective,training_days,preferred_location,activity_level,dietary_restrictions,motivation)
          VALUES (?,?,?,?,?,?,?)`).bind(id,text(body.objective),number(body.trainingDays),text(body.location),text(body.activityLevel),text(body.restrictions),text(body.motivation)),
      ]);
      if (text(body.programId)) await assignProgram(id, text(body.programId));
      return ok("Participante creado", { id });
    }

    if (action === "professional.create") {
      requireRole(viewer, ["admin"]);
      const email = text(body.email).trim().toLowerCase();
      const firstName = text(body.firstName).trim();
      const specialty = text(body.specialty) === "nutrition" ? "nutrition" : "coach";
      if (!email.includes("@") || !firstName) return bad("Nombre y correo son obligatorios");
      const id = crypto.randomUUID();
      await env.DB.batch([
        env.DB.prepare("INSERT INTO users (id,email,role,status,created_at) VALUES (?,?,'professional','active',?)").bind(id,email,new Date().toISOString()),
        env.DB.prepare("INSERT INTO profiles (user_id,first_name,last_name) VALUES (?,?,?)").bind(id,firstName,text(body.lastName)),
        env.DB.prepare("INSERT INTO professional_profiles (user_id,specialty) VALUES (?,?)").bind(id,specialty),
      ]);
      return ok("Profesional creado. Ya puede ingresar con ese correo", { id });
    }

    if (action === "admin.create") {
      requireRole(viewer, ["admin"]);
      const email = text(body.email).trim().toLowerCase(); const firstName = text(body.firstName).trim();
      if (!email.includes("@") || !firstName) return bad("Nombre y correo son obligatorios");
      const id = crypto.randomUUID();
      await env.DB.batch([
        env.DB.prepare("INSERT INTO users (id,email,role,status,created_at) VALUES (?,?,'admin','active',?)").bind(id,email,new Date().toISOString()),
        env.DB.prepare("INSERT INTO profiles (user_id,first_name,last_name) VALUES (?,?,?)").bind(id,firstName,text(body.lastName)),
      ]);
      return ok("Administrador creado. Ya puede ingresar con el correo autorizado", { id });
    }

    if (action === "professional.update") {
      requireRole(viewer, ["admin"]); const id=text(body.id); const email=text(body.email).trim().toLowerCase();
      if (!id || !email.includes("@") || !text(body.firstName).trim()) return bad("Nombre y correo son obligatorios");
      await env.DB.batch([
        env.DB.prepare("UPDATE users SET email=?,status=? WHERE id=? AND role='professional'").bind(email,text(body.status)||"active",id),
        env.DB.prepare("UPDATE profiles SET first_name=?,last_name=? WHERE user_id=?").bind(text(body.firstName),text(body.lastName),id),
        env.DB.prepare("UPDATE professional_profiles SET specialty=? WHERE user_id=?").bind(text(body.specialty)==="nutrition"?"nutrition":"coach",id),
      ]);
      return ok("Perfil profesional actualizado");
    }

    if (action === "professional.delete") {
      requireRole(viewer, ["admin"]); const id=text(body.id);
      await env.DB.batch([
        env.DB.prepare("DELETE FROM professional_profiles WHERE user_id=?").bind(id),
        env.DB.prepare("DELETE FROM profiles WHERE user_id=?").bind(id),
        env.DB.prepare("DELETE FROM users WHERE id=? AND role='professional'").bind(id),
      ]);
      return ok("Profesional eliminado");
    }

    if (action === "admin.update") {
      requireRole(viewer, ["admin"]); const id=text(body.id); const email=text(body.email).trim().toLowerCase();
      if (!id || !email.includes("@") || !text(body.firstName).trim()) return bad("Nombre y correo son obligatorios");
      await env.DB.batch([
        env.DB.prepare("UPDATE users SET email=?,status=? WHERE id=? AND role='admin'").bind(email,text(body.status)||"active",id),
        env.DB.prepare("UPDATE profiles SET first_name=?,last_name=? WHERE user_id=?").bind(text(body.firstName),text(body.lastName),id),
      ]);
      return ok("Administrador actualizado");
    }

    if (action === "admin.delete") {
      requireRole(viewer, ["admin"]); const id=text(body.id);
      if (id===viewer.id) return bad("No puedes eliminar tu propio perfil administrador");
      await env.DB.batch([
        env.DB.prepare("DELETE FROM profiles WHERE user_id=?").bind(id),
        env.DB.prepare("DELETE FROM users WHERE id=? AND role='admin'").bind(id),
      ]);
      return ok("Administrador eliminado");
    }

    if (action === "participant.update") {
      requireRole(viewer, ["admin", "professional"]);
      const id = text(body.id);
      await env.DB.batch([
        env.DB.prepare("UPDATE users SET status=? WHERE id=? AND role='participant'").bind(text(body.status) || "active", id),
        env.DB.prepare("UPDATE profiles SET first_name=?,last_name=?,city=? WHERE user_id=?").bind(text(body.firstName),text(body.lastName),text(body.city),id),
        env.DB.prepare(`INSERT INTO onboarding (user_id,objective,training_days,preferred_location,activity_level,dietary_restrictions,motivation)
          VALUES (?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET objective=excluded.objective,training_days=excluded.training_days,
          preferred_location=excluded.preferred_location,activity_level=excluded.activity_level,dietary_restrictions=excluded.dietary_restrictions,motivation=excluded.motivation`)
          .bind(id,text(body.objective),number(body.trainingDays),text(body.location),text(body.activityLevel),text(body.restrictions),text(body.motivation)),
        env.DB.prepare(`INSERT INTO participant_adherence (user_id,training_pct,macros_pct,water_pct,updated_at,updated_by) VALUES (?,?,?,?,?,?)
          ON CONFLICT(user_id) DO UPDATE SET training_pct=excluded.training_pct,macros_pct=excluded.macros_pct,water_pct=excluded.water_pct,updated_at=excluded.updated_at,updated_by=excluded.updated_by`)
          .bind(id,number(body.trainingPct),number(body.macrosPct),number(body.waterPct),new Date().toISOString(),viewer.id),
      ]);
      return ok("Participante actualizado");
    }

    if (action === "adherence.set") {
      requireRole(viewer, ["admin"]);
      const userId=text(body.userId), habit=text(body.habit), date=text(body.date), status=text(body.status);
      if (!userId || !["training","macros","water"].includes(habit) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return bad("Registro de adherencia inválido");
      if (!status) { await env.DB.prepare("DELETE FROM habit_daily WHERE user_id=? AND habit=? AND habit_date=?").bind(userId,habit,date).run(); return ok("Registro limpiado"); }
      if (!["met","missed"].includes(status)) return bad("Estado inválido");
      await env.DB.prepare(`INSERT INTO habit_daily (user_id,habit,habit_date,status,source,updated_at) VALUES (?,?,?,?,?,?)
        ON CONFLICT(user_id,habit,habit_date) DO UPDATE SET status=excluded.status,source=excluded.source,updated_at=excluded.updated_at`)
        .bind(userId,habit,date,status,"manual",new Date().toISOString()).run();
      return ok(status==="met"?"Hábito marcado como cumplido":"Hábito marcado como no cumplido");
    }

    if (action === "adherence.contact.set") {
      requireRole(viewer, ["admin"]);
      const userId=text(body.userId),weekStart=text(body.weekStart),alertType=text(body.alertType),contacted=bool(body.contacted);
      if(!userId||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(weekStart)||!["risk","missing"].includes(alertType))return bad("Seguimiento de contacto inválido");
      const now=new Date().toISOString();
      await env.DB.prepare(`INSERT INTO adherence_outreach (user_id,week_start,alert_type,contacted,contacted_at,contacted_by) VALUES (?,?,?,?,?,?)
        ON CONFLICT(user_id,week_start,alert_type) DO UPDATE SET contacted=excluded.contacted,contacted_at=excluded.contacted_at,contacted_by=excluded.contacted_by`)
        .bind(userId,weekStart,alertType,contacted?1:0,contacted?now:null,viewer.id).run();
      return ok(contacted?"Alumno marcado como contactado":"Contacto marcado como pendiente");
    }

    if (action === "nutrition.daily.save") {
      requireRole(viewer,["participant"]);
      const entries=Array.isArray(body.entries)?body.entries as Array<Record<string,unknown>>:[];if(!entries.length)return bad("Completa al menos un día de la semana");
      const statements=[];for(const entry of entries){const date=text(entry.date);await requireParticipantDate(viewer.id,date);const calories=number(entry.calories),protein=number(entry.protein),carbs=number(entry.carbs),fats=number(entry.fats);if([calories,protein,carbs,fats].some(value=>value==null||Number(value)<0))return bad("Completa los cuatro valores de cada día registrado");statements.push(env.DB.prepare(`INSERT INTO nutrition_daily (user_id,log_date,calories,protein,carbs,fats,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(user_id,log_date) DO UPDATE SET calories=excluded.calories,protein=excluded.protein,carbs=excluded.carbs,fats=excluded.fats,updated_at=excluded.updated_at`).bind(viewer.id,date,calories,protein,carbs,fats,new Date().toISOString()))}
      await env.DB.batch(statements);return ok(`${entries.length} ${entries.length===1?"día guardado":"días guardados"}`);
    }

    if (action === "habit.self.set") {
      requireRole(viewer,["participant"]);
      const habit=text(body.habit),date=text(body.date),status=text(body.status);await requireParticipantDate(viewer.id,date);
      if(!["training","water"].includes(habit))return bad("Hábito no válido");
      if(!status){await env.DB.prepare("DELETE FROM habit_daily WHERE user_id=? AND habit=? AND habit_date=?").bind(viewer.id,habit,date).run();return ok("Registro limpiado")}
      if(!["met","missed"].includes(status))return bad("Estado no válido");
      await env.DB.prepare(`INSERT INTO habit_daily (user_id,habit,habit_date,status,source,updated_at) VALUES (?,?,?,?,?,?)
        ON CONFLICT(user_id,habit,habit_date) DO UPDATE SET status=excluded.status,source=excluded.source,updated_at=excluded.updated_at`)
        .bind(viewer.id,habit,date,status,"participant",new Date().toISOString()).run();
      return ok(status==="met"?"Día marcado como cumplido":"Día marcado como no cumplido");
    }

    if (action === "checkpoint.self.save") {
      requireRole(viewer,["participant"]);
      const day=Number(body.day),weight=Number(body.weight);
      if(![30,60,90].includes(day))return bad("Hito de progreso no válido");
      if(!Number.isFinite(weight)||weight<30||weight>300)return bad("Ingresa un peso válido entre 30 y 300 kg");
      const assignment=await env.DB.prepare("SELECT assigned_at FROM user_programs WHERE user_id=? AND active=1 ORDER BY assigned_at DESC LIMIT 1").bind(viewer.id).first<{assigned_at:string}>();
      const start=assignment?.assigned_at?new Date(assignment.assigned_at).getTime():Date.now();
      const currentDay=Math.max(1,Math.min(90,Math.floor((Date.now()-start)/86400000)+1));
      if(currentDay<day)return bad(`Podrás registrar este peso al llegar al día ${day}`);
      const now=new Date().toISOString();
      const adherence=await adherenceAt(viewer.id,day,assignment?.assigned_at);
      await env.DB.batch([
        env.DB.prepare("DELETE FROM checkpoints WHERE user_id=? AND day=?").bind(viewer.id,day),
        env.DB.prepare("INSERT INTO checkpoints (user_id,day,weight,adherence,completed_at) VALUES (?,?,?,?,?)").bind(viewer.id,day,weight,adherence,now),
      ]);
      return ok(`Peso del día ${day} guardado`);
    }

    if (action === "intake.submit") {
      requireRole(viewer, ["participant"]);
      const submitted = body.responses && typeof body.responses === "object" && !Array.isArray(body.responses)
        ? body.responses as Record<string, unknown> : {};
      const questions = await env.DB.prepare("SELECT id,key,required,condition_key,condition_value FROM intake_questions WHERE active=1 ORDER BY position").all<Record<string, unknown>>();
      const answerByKey = Object.fromEntries(questions.results.map((question) => [text(question.key), submitted[text(question.id)]]));
      const missing = questions.results.filter((question) => {
        if (!question.required) return false;
        if (question.condition_key && answerByKey[text(question.condition_key)] !== question.condition_value) return false;
        const value = submitted[text(question.id)];
        return value == null || value === "" || (Array.isArray(value) && value.length === 0);
      });
      if (missing.length) return bad(`Faltan ${missing.length} respuestas obligatorias`);
      const now = new Date().toISOString();
      const statements = questions.results.flatMap((question) => {
        const value = submitted[text(question.id)];
        if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) return [];
        return [env.DB.prepare(`INSERT INTO intake_responses (user_id,question_id,answer_json,updated_at) VALUES (?,?,?,?)
          ON CONFLICT(user_id,question_id) DO UPDATE SET answer_json=excluded.answer_json,updated_at=excluded.updated_at`)
          .bind(viewer.id,text(question.id),JSON.stringify(value),now)];
      });
      if (statements.length) await env.DB.batch(statements);
      const byKey = answerByKey;
      const assessment = assessNutrition(byKey, new Date(now));
      await env.DB.batch([
        env.DB.prepare(`INSERT INTO profiles (user_id,birthdate,gender,height,weight,city) VALUES (?,?,?,?,?,?)
          ON CONFLICT(user_id) DO UPDATE SET birthdate=excluded.birthdate,gender=excluded.gender,height=excluded.height,weight=excluded.weight,city=excluded.city`)
          .bind(viewer.id,text(byKey.birthdate),text(byKey.gender),number(byKey.height),number(byKey.weight),text(byKey.city)),
        env.DB.prepare(`INSERT INTO onboarding (user_id,objective,preferred_location,motivation,completed_at) VALUES (?,?,?,?,?)
          ON CONFLICT(user_id) DO UPDATE SET objective=excluded.objective,preferred_location=excluded.preferred_location,motivation=excluded.motivation,completed_at=excluded.completed_at`)
          .bind(viewer.id,answerText(byKey.main_goal),text(byKey.training_location),text(byKey.motivation),now),
        env.DB.prepare("UPDATE users SET status='review' WHERE id=?").bind(viewer.id),
        env.DB.prepare(`INSERT INTO nutrition_screenings (user_id,assessment_json,red_flag_count,deficient_habit_count,automation_status,calculated_at) VALUES (?,?,?,?,?,?)
          ON CONFLICT(user_id) DO UPDATE SET assessment_json=excluded.assessment_json,red_flag_count=excluded.red_flag_count,deficient_habit_count=excluded.deficient_habit_count,automation_status=excluded.automation_status,calculated_at=excluded.calculated_at`)
          .bind(viewer.id,JSON.stringify(assessment),assessment.redFlags.length,assessment.deficientHabits.length,assessment.automationStatus,assessment.calculatedAt),
      ]);
      if(assessment.calories) await env.DB.prepare(`INSERT INTO nutrition_plans (user_id,calories,protein,carbs,fats,notes,updated_by,updated_at,objective,review_status)
        VALUES (?,?,?,?,?,?,?,?,?,'pending_review')`).bind(viewer.id,assessment.calories,assessment.protein,assessment.carbs,assessment.fats,"Propuesta inicial automática según pauta de la nutricionista. Requiere revisión y aprobación profesional.","system:nutrition",now,assessment.goalLabel).run();
      return ok("Formulario enviado. Tu equipo ya puede revisar tus respuestas");
    }

    if (action === "intake.question.update") {
      requireRole(viewer, ["admin"]);
      const id = text(body.id);
      if (!id || !text(body.prompt).trim()) return bad("La pregunta necesita un texto");
      const allowedTypes = ["text","textarea","number","date","single","multi","yesno","scale","consent"];
      const allowedAudiences = ["both","coach","nutrition"];
      const type = allowedTypes.includes(text(body.type)) ? text(body.type) : "text";
      const audience = allowedAudiences.includes(text(body.audience)) ? text(body.audience) : "both";
      const options = Array.isArray(body.options) ? body.options.map(text).filter(Boolean) : text(body.options).split("\n").map((item)=>item.trim()).filter(Boolean);
      await env.DB.prepare(`UPDATE intake_questions SET prompt=?,section=?,help_text=?,type=?,options_json=?,audience=?,required=?,active=?,position=? WHERE id=?`)
        .bind(text(body.prompt).trim(),text(body.section).trim()||"General",text(body.helpText),type,options.length?JSON.stringify(options):null,audience,bool(body.required),bool(body.active),number(body.position)||1,id).run();
      return ok("Pregunta actualizada");
    }

    if (action === "intake.question.delete") {
      requireRole(viewer,["admin"]);
      const id=text(body.id);const question=await env.DB.prepare("SELECT prompt FROM intake_questions WHERE id=?").bind(id).first();
      if(!question)return bad("Pregunta no encontrada");
      await env.DB.batch([env.DB.prepare("DELETE FROM intake_responses WHERE question_id=?").bind(id),env.DB.prepare("DELETE FROM intake_questions WHERE id=?").bind(id)]);
      return ok("Pregunta eliminada del formulario");
    }

    if (action === "program.assign") {
      requireRole(viewer, ["admin", "professional"]);
      if(viewer.role==="professional")await requireSpecialty(viewer.id,"coach");
      const ids = Array.isArray(body.userIds) ? body.userIds.map(text) : [text(body.userId)];
      for (const id of ids.filter(Boolean)) await assignProgram(id, text(body.programId));
      return ok(ids.length === 1 ? "Programa asignado" : `Programa asignado a ${ids.length} participantes`);
    }

    if (action === "program.create") {
      requireRole(viewer, ["admin","professional"]);
      if(viewer.role==="professional")await requireSpecialty(viewer.id,"coach");
      const id = crypto.randomUUID();
      if (!text(body.name)) return bad("El nombre es obligatorio");
      await env.DB.prepare("INSERT INTO programs (id,name,level,location,active) VALUES (?,?,?,?,1)")
        .bind(id,text(body.name),text(body.level)||"Inicial",text(body.location)||"Casa").run();
      return ok("Programa creado", { id });
    }

    if (action.startsWith("program.guide.exercise.")) {
      requireRole(viewer,["admin","professional"]);
      if(viewer.role==="professional")await requireSpecialty(viewer.id,"coach");
      const programId=text(body.programId),dayIndex=number(body.dayIndex);
      const row=await env.DB.prepare("SELECT content_json FROM program_guides WHERE program_id=?").bind(programId).first<{content_json:string}>();
      if(!row||dayIndex==null)return bad("Rutina o día no encontrado");
      const guide=JSON.parse(row.content_json) as {days?:Array<{nodes?:Array<Record<string,unknown>>}>;exerciseNames?:string[]};
      const day=guide.days?.[dayIndex];if(!day)return bad("Día no encontrado");
      day.nodes=day.nodes||[];
      if(action==="program.guide.exercise.add"){
        const exercise=await env.DB.prepare("SELECT name FROM exercises WHERE id=?").bind(text(body.exerciseId)).first<{name:string}>();
        if(!exercise)return bad("Selecciona un ejercicio de la biblioteca");
        day.nodes.push({type:"exercise",name:exercise.name,prescription:text(body.prescription)||"3 × 10 · 60 s descanso"});
        guide.exerciseNames=Array.from(new Set([...(guide.exerciseNames||[]),exercise.name]));
      }else{
        const locator=text(body.locator).split(":");const nodeIndex=Number(locator[1]);const node=day.nodes[nodeIndex];if(!node)return bad("Ejercicio no encontrado");
        if(locator[0]==="row"){
          const rows=Array.isArray(node.rows)?node.rows as Array<{exerciseName?:string;cells?:string[]}>:[];const rowIndex=Number(locator[2]);const item=rows[rowIndex];if(!item)return bad("Ejercicio no encontrado");
          if(action.endsWith("remove"))rows.splice(rowIndex,1);else{const name=text(body.name).trim();if(!name)return bad("El ejercicio necesita un nombre");item.exerciseName=name;const cells=item.cells||[];cells[0]=`${rowIndex+1}. ${name}`;cells[1]=text(body.prescription);item.cells=cells;}
        }else{
          if(action.endsWith("remove"))day.nodes.splice(nodeIndex,1);else{const name=text(body.name).trim();if(!name)return bad("El ejercicio necesita un nombre");day.nodes[nodeIndex]={type:"exercise",name,prescription:text(body.prescription)};}
        }
      }
      const now=new Date().toISOString();
      await env.DB.batch([
        env.DB.prepare("UPDATE program_guides SET content_json=?,updated_at=? WHERE program_id=?").bind(JSON.stringify(guide),now,programId),
        env.DB.prepare(`UPDATE professional_approvals SET status='pending',approved_by=NULL,updated_at=? WHERE area='training' AND user_id IN (SELECT user_id FROM user_programs WHERE program_id=? AND active=1)`).bind(now,programId),
      ]);
      return ok(action.endsWith("add")?"Ejercicio agregado":action.endsWith("remove")?"Ejercicio retirado":"Ejercicio actualizado");
    }

    if (action === "workout.create") {
      requireRole(viewer, ["admin", "professional"]);
      if(viewer.role==="professional")await requireSpecialty(viewer.id,"coach");
      if (!text(body.programId) || !text(body.name)) return bad("Programa y nombre son obligatorios");
      const id = crypto.randomUUID();
      await env.DB.prepare("INSERT INTO workouts (id,program_id,month,week,name) VALUES (?,?,?,?,?)")
        .bind(id,text(body.programId),number(body.month)||1,number(body.week)||1,text(body.name)).run();
      return ok("Rutina agregada", { id });
    }

    if (action === "workout.update") {
      requireRole(viewer, ["admin", "professional"]);
      if(viewer.role==="professional")await requireSpecialty(viewer.id,"coach");
      if (!text(body.id) || !text(body.name)) return bad("La rutina necesita un nombre");
      await env.DB.prepare("UPDATE workouts SET name=?, month=?, week=? WHERE id=?")
        .bind(text(body.name), number(body.month) || 1, number(body.week) || 1, text(body.id)).run();
      return ok("Rutina actualizada");
    }

    if (action === "exercise.create") {
      requireRole(viewer, ["admin", "professional"]);
      if(viewer.role==="professional")await requireSpecialty(viewer.id,"coach");
      if (!text(body.name)) return bad("El nombre es obligatorio");
      const youtube = text(body.youtubeUrl);
      if (youtube && !isYouTube(youtube)) return bad("Usa un enlace válido de YouTube");
      const id = crypto.randomUUID();
      await env.DB.prepare(`INSERT INTO exercises (id,name,category,level,youtube_url,description,technique,common_errors,regression,progression)
        VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(id,text(body.name),text(body.category),text(body.level),youtube,text(body.description),text(body.technique),text(body.commonErrors),text(body.regression),text(body.progression)).run();
      return ok("Ejercicio agregado a la biblioteca", { id });
    }

    if (action === "exercise.update") {
      requireRole(viewer, ["admin", "professional"]);
      if(viewer.role==="professional")await requireSpecialty(viewer.id,"coach");
      if (!text(body.id) || !text(body.name)) return bad("El ejercicio necesita un nombre");
      const youtube = text(body.youtubeUrl);
      if (youtube && !isYouTube(youtube)) return bad("Usa un enlace válido de YouTube");
      await env.DB.prepare(`UPDATE exercises SET name=?,category=?,level=?,youtube_url=?,description=?,technique=?,common_errors=?,regression=?,progression=? WHERE id=?`)
        .bind(text(body.name),text(body.category),text(body.level),youtube,text(body.description),text(body.technique),text(body.commonErrors),text(body.regression),text(body.progression),text(body.id)).run();
      return ok("Ejercicio actualizado");
    }

    if (action === "workout.exercise.add") {
      requireRole(viewer, ["admin", "professional"]);
      if(viewer.role==="professional")await requireSpecialty(viewer.id,"coach");
      const current = await env.DB.prepare("SELECT COALESCE(MAX(position),0)+1 AS next FROM workout_exercises WHERE workout_id=?").bind(text(body.workoutId)).first<{ next: number }>();
      await env.DB.prepare("INSERT INTO workout_exercises (workout_id,exercise_id,position,sets,reps,rest_seconds,notes) VALUES (?,?,?,?,?,?,?)")
        .bind(text(body.workoutId),text(body.exerciseId),current?.next??1,number(body.sets)||3,text(body.reps)||"10",number(body.restSeconds)||60,text(body.notes)).run();
      return ok("Ejercicio añadido a la rutina");
    }

    if (action === "workout.exercise.update") {
      requireRole(viewer, ["admin", "professional"]);
      if(viewer.role==="professional")await requireSpecialty(viewer.id,"coach");
      await env.DB.prepare("UPDATE workout_exercises SET sets=?,reps=?,rest_seconds=?,notes=? WHERE id=?")
        .bind(number(body.sets)||3,text(body.reps)||"10",number(body.restSeconds)||60,text(body.notes),number(body.id)).run();
      return ok("Series y repeticiones actualizadas");
    }

    if (action === "workout.exercise.remove") {
      requireRole(viewer, ["admin", "professional"]);
      if(viewer.role==="professional")await requireSpecialty(viewer.id,"coach");
      await env.DB.prepare("DELETE FROM workout_exercises WHERE id=?").bind(number(body.id)).run();
      return ok("Ejercicio retirado de la rutina");
    }

    if (action === "nutrition.save") {
      requireRole(viewer, ["admin", "professional"]);
      if(viewer.role==="professional")await requireSpecialty(viewer.id,"nutrition");
      const userId = text(body.userId);
      const requestedStatus = ["pending_review","approved","rejected"].includes(text(body.status)) ? text(body.status) : "pending_review";
      const status = requestedStatus;
      const now = new Date().toISOString();
      await env.DB.prepare(`INSERT INTO nutrition_plans (user_id,calories,protein,carbs,fats,pdf_key,notes,review_date,updated_by,updated_at,objective,review_status,review_note,reviewed_by,reviewed_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(userId,number(body.calories),number(body.protein),number(body.carbs),number(body.fats),text(body.pdfKey)||null,text(body.notes),text(body.reviewDate),viewer.id,now,text(body.objective),status,text(body.reviewNote)||null,status==="approved"?viewer.id:null,status==="approved"?now:null).run();
      await env.DB.prepare("UPDATE users SET status=CASE WHEN status IN ('invited','onboarding') THEN status ELSE 'active' END WHERE id=?").bind(userId).run();
      return ok(status === "approved" ? "Plan aprobado y publicado" : status === "rejected" ? "Plan devuelto para corrección" : "Plan enviado a revisión");
    }

    if (action === "nutrition.review") {
      requireRole(viewer, ["admin","professional"]);
      if(viewer.role==="professional") await requireSpecialty(viewer.id, "nutrition");
      const userId = text(body.userId);
      const latest = await env.DB.prepare("SELECT id FROM nutrition_plans WHERE user_id=? ORDER BY updated_at DESC LIMIT 1").bind(userId).first<{ id:number }>();
      if (!latest) return bad("Este alumno todavía no tiene un plan nutricional para aprobar");
      const now = new Date().toISOString();
      await env.DB.prepare("UPDATE nutrition_plans SET review_status='approved',reviewed_by=?,reviewed_at=?,updated_at=? WHERE id=?")
        .bind(viewer.id,now,now,latest.id).run();
      return ok("Plan nutricional aprobado y publicado al alumno");
    }

    if (action === "training.review") {
      requireRole(viewer, ["admin","professional"]);
      if(viewer.role==="professional") await requireSpecialty(viewer.id, "coach");
      const userId = text(body.userId);
      const assignment = await env.DB.prepare("SELECT id FROM user_programs WHERE user_id=? AND active=1 LIMIT 1").bind(userId).first();
      if (!assignment) return bad("Este alumno todavía no tiene una rutina asignada para aprobar");
      await env.DB.prepare(`INSERT INTO professional_approvals (user_id,area,status,approved_by,updated_at) VALUES (?,'training','approved',?,?)
        ON CONFLICT(user_id,area) DO UPDATE SET status='approved',approved_by=excluded.approved_by,updated_at=excluded.updated_at`)
        .bind(userId,viewer.id,new Date().toISOString()).run();
      return ok("Rutina aprobada por el coach");
    }

    if (action === "content.create") {
      requireRole(viewer, ["admin", "professional"]);
      const video = text(body.videoUrl); if (video && !isYouTube(video)) return bad("Usa un enlace válido de YouTube");
      await env.DB.prepare("INSERT INTO content (id,title,description,category,video_url,position,publish_at) VALUES (?,?,?,?,?,?,?)")
        .bind(crypto.randomUUID(),text(body.title),text(body.description),text(body.category)||"Hábitos",video,number(body.position),text(body.publishAt)||new Date().toISOString()).run();
      return ok("Contenido publicado");
    }

    if (action === "session.create") {
      requireRole(viewer, ["admin", "professional"]);
      await env.DB.prepare("INSERT INTO sessions (id,title,professional,starts_at,link,recording_url) VALUES (?,?,?,?,?,?)")
        .bind(crypto.randomUUID(),text(body.title),text(body.professional),text(body.startsAt),text(body.link),text(body.recordingUrl)).run();
      return ok("Sesión creada");
    }

    if (action === "session.update") {
      requireRole(viewer, ["admin", "professional"]);
      await env.DB.prepare("UPDATE sessions SET title=?,professional=?,starts_at=?,link=?,recording_url=? WHERE id=?")
        .bind(text(body.title),text(body.professional),text(body.startsAt),text(body.link),text(body.recordingUrl),text(body.id)).run();
      return ok("Sesión actualizada");
    }

    if (action === "session.delete") {
      requireRole(viewer, ["admin"]);
      await env.DB.prepare("DELETE FROM sessions WHERE id=?").bind(text(body.id)).run();
      return ok("Sesión eliminada");
    }

    if (action === "meeting.request") {
      requireRole(viewer, ["participant"]);
      const requestedAt = text(body.requestedAt);
      if (!requestedAt) return bad("Selecciona una fecha y hora");
      if (new Date(requestedAt).getTime() < Date.now() + 48 * 60 * 60 * 1000) return bad("La reunión debe solicitarse con al menos 48 horas de anticipación");
      const now = new Date().toISOString();
      await env.DB.prepare("INSERT INTO one_on_one_meetings (id,user_id,requested_start,status,topic,created_at,updated_at) VALUES (?,?,?,'pending',?,?,?)")
        .bind(crypto.randomUUID(),viewer.id,requestedAt,text(body.topic)||"Mi proceso",now,now).run();
      return ok("Solicitud enviada. Quedó pendiente de confirmación");
    }

    if (action === "meeting.review") {
      requireRole(viewer, ["admin"]);
      const status = ["confirmed","rejected","rescheduled"].includes(text(body.status)) ? text(body.status) : "confirmed";
      if ((status === "confirmed" || status === "rescheduled") && (!text(body.startsAt) || !text(body.meetingLink))) return bad("Indica el horario definitivo y el enlace de la reunión");
      await env.DB.prepare("UPDATE one_on_one_meetings SET status=?,confirmed_start=?,meeting_link=?,admin_note=?,reviewed_by=?,updated_at=? WHERE id=?")
        .bind(status,text(body.startsAt)||null,text(body.meetingLink)||null,text(body.adminNote),viewer.id,new Date().toISOString(),text(body.id)).run();
      return ok(status === "rejected" ? "Solicitud rechazada" : "Reunión confirmada");
    }

    return bad("Acción no reconocida");
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "No fue posible guardar";
    if (message.includes("UNIQUE")) return bad("Ese correo ya está registrado");
    return Response.json({ error: message }, { status: 500 });
  }
}

async function assignProgram(userId: string, programId: string) {
  await env.DB.batch([
    env.DB.prepare("UPDATE user_programs SET active=0 WHERE user_id=? AND active=1").bind(userId),
    env.DB.prepare("INSERT INTO user_programs (user_id,program_id,assigned_at,active) VALUES (?,?,?,1)").bind(userId,programId,new Date().toISOString()),
    env.DB.prepare(`INSERT INTO professional_approvals (user_id,area,status,approved_by,updated_at) VALUES (?,'training','pending',NULL,?)
      ON CONFLICT(user_id,area) DO UPDATE SET status='pending',approved_by=NULL,updated_at=excluded.updated_at`).bind(userId,new Date().toISOString()),
  ]);
}

async function adherenceAt(userId:string,day:number,assignedAt?:string){
  const start=String(assignedAt||new Date().toISOString()).slice(0,10);
  const end=new Date(Date.parse(`${start}T12:00:00Z`)+(day-1)*86400000).toISOString().slice(0,10);
  const [habits,plan,nutrition]=await Promise.all([
    env.DB.prepare(`SELECT habit,COUNT(*) AS total FROM habit_daily WHERE user_id=? AND status='met' AND habit_date>=? AND habit_date<=? GROUP BY habit`).bind(userId,start,end).all<{habit:string;total:number}>(),
    env.DB.prepare("SELECT calories,protein FROM nutrition_plans WHERE user_id=? AND review_status='approved' ORDER BY updated_at DESC LIMIT 1").bind(userId).first<{calories:number;protein:number}>(),
    env.DB.prepare("SELECT calories,protein FROM nutrition_daily WHERE user_id=? AND log_date>=? AND log_date<=?").bind(userId,start,end).all<{calories:number;protein:number}>(),
  ]);
  const count=(habit:string)=>Number(habits.results.find(row=>row.habit===habit)?.total||0);
  const macrosMet=plan?.calories&&plan?.protein?nutrition.results.filter(row=>Number(row.calories)<=Number(plan.calories)*1.1&&Number(row.protein)>=Number(plan.protein)*.9).length:0;
  const trainingPct=Math.round(count("training")/day*100),macrosPct=Math.round(macrosMet/day*100),waterPct=Math.round(count("water")/day*100);
  return Math.round(trainingPct*.4+macrosPct*.4+waterPct*.2);
}
async function requireSpecialty(userId:string, specialty:"coach"|"nutrition") {
  const row = await env.DB.prepare("SELECT specialty FROM professional_profiles WHERE user_id=?").bind(userId).first<{ specialty:string }>();
  if (row?.specialty !== specialty) throw new Response("No autorizado para esta aprobación", { status:403 });
}
async function requireParticipantDate(userId:string,date:string){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Response.json({error:"Fecha no válida"},{status:400});
  const row=await env.DB.prepare("SELECT created_at FROM users WHERE id=? AND role='participant'").bind(userId).first<{created_at:string}>();
  if(!row)throw Response.json({error:"Participante no encontrado"},{status:404});
  const start=row.created_at.slice(0,10),end=new Date(`${start}T12:00:00Z`);end.setUTCDate(end.getUTCDate()+89);
  const today=new Date().toISOString().slice(0,10);if(date<start||date>end.toISOString().slice(0,10)||date>today)throw Response.json({error:"Solo puedes registrar días transcurridos dentro de tu desafío"},{status:400});
}
function text(value: unknown) { return typeof value === "string" ? value : value == null ? "" : String(value); }
function number(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function bool(value: unknown) { return value === true || value === 1 || value === "1" || value === "true" || value === "on" ? 1 : 0; }
function answerText(value: unknown) { return Array.isArray(value) ? value.join(", ") : text(value); }
function isYouTube(value: string) { try { const host = new URL(value).hostname.replace(/^www\./,""); return host === "youtube.com" || host === "youtu.be"; } catch { return false; } }
function ok(message: string, extra: Record<string, unknown> = {}) { return Response.json({ ok: true, message, ...extra }); }
function bad(error: string) { return Response.json({ error }, { status: 400 }); }
