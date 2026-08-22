import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getOrCreateViewer, requireRole } from "../../../db/access";
import { getBootstrap } from "../../../db/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getChatGPTUser();
  if (!auth) return Response.json({ error: "Debes iniciar sesión" }, { status: 401 });
  const viewer = await getOrCreateViewer(auth);
  return Response.json(await getBootstrap(viewer));
}

export async function POST(request: Request) {
  try {
    const auth = await getChatGPTUser();
    if (!auth) return Response.json({ error: "Debes iniciar sesión" }, { status: 401 });
    const viewer = await getOrCreateViewer(auth);
    const body = await request.json() as Record<string, unknown>;
    const action = text(body.action);
    if (viewer.role === "reviewer") return Response.json({ error: "Perfil Revisor: acceso de solo lectura" }, { status: 403 });

    if (action === "participant.create") {
      requireRole(viewer, ["admin"]);
      const email = text(body.email).trim().toLowerCase();
      const firstName = text(body.firstName).trim();
      if (!email.includes("@") || !firstName) return bad("Nombre y correo son obligatorios");
      if (!text(body.programId)) return bad("Debes asignar una de las cuatro rutinas");
      const id = crypto.randomUUID();
      await env.DB.batch([
        env.DB.prepare("INSERT INTO users (id,email,role,status,created_at) VALUES (?,?,'participant','invited',?)").bind(id,email,new Date().toISOString()),
        env.DB.prepare("INSERT INTO profiles (user_id,first_name,last_name,city) VALUES (?,?,?,?)").bind(id,firstName,text(body.lastName),text(body.city)),
        env.DB.prepare(`INSERT INTO onboarding (user_id,objective,training_days,preferred_location,activity_level,dietary_restrictions,motivation)
          VALUES (?,?,?,?,?,?,?)`).bind(id,text(body.objective),number(body.trainingDays),text(body.location),text(body.activityLevel),text(body.restrictions),text(body.motivation)),
      ]);
      await assignProgram(id, text(body.programId));
      return ok("Participante creado", { id });
    }

    if (action === "professional.create") {
      requireRole(viewer, ["admin"]);
      const email = text(body.email).trim().toLowerCase();
      const firstName = text(body.firstName).trim();
      const professionalType = text(body.professionalType);
      if (!email.includes("@") || !firstName) return bad("Nombre y correo son obligatorios");
      if (!["nutrition","training","both"].includes(professionalType)) return bad("Selecciona el tipo de profesional");
      const duplicate = await env.DB.prepare("SELECT 1 FROM users WHERE lower(email)=?").bind(email).first();
      if (duplicate) return bad("Ya existe un usuario con ese correo");
      const id = crypto.randomUUID();
      await env.DB.batch([
        env.DB.prepare("INSERT INTO users (id,email,role,status,created_at) VALUES (?,?,'professional','active',?)").bind(id,email,new Date().toISOString()),
        env.DB.prepare("INSERT INTO profiles (user_id,first_name,last_name,city,professional_type) VALUES (?,?,?,?,?)").bind(id,firstName,text(body.lastName),text(body.city),professionalType),
      ]);
      return ok("Profesional creado. Puede ingresar sin realizar un pago.", { id });
    }

    if (action === "participant.update") {
      requireRole(viewer, ["admin"]);
      const id = text(body.id);
      await env.DB.batch([
        env.DB.prepare("UPDATE users SET status=? WHERE id=? AND role='participant'").bind(text(body.status) || "active", id),
        env.DB.prepare("UPDATE profiles SET first_name=?,last_name=?,city=? WHERE user_id=?").bind(text(body.firstName),text(body.lastName),text(body.city),id),
        env.DB.prepare(`INSERT INTO onboarding (user_id,objective,training_days,preferred_location,activity_level,dietary_restrictions,motivation)
          VALUES (?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET objective=excluded.objective,training_days=excluded.training_days,
          preferred_location=excluded.preferred_location,activity_level=excluded.activity_level,dietary_restrictions=excluded.dietary_restrictions,motivation=excluded.motivation`)
          .bind(id,text(body.objective),number(body.trainingDays),text(body.location),text(body.activityLevel),text(body.restrictions),text(body.motivation)),
      ]);
      return ok("Participante actualizado");
    }

    if (action === "program.assign") {
      requireArea(viewer, "training");
      const ids = Array.isArray(body.userIds) ? body.userIds.map(text) : [text(body.userId)];
      for (const id of ids.filter(Boolean)) await assignProgram(id, text(body.programId));
      return ok(ids.length === 1 ? "Programa asignado" : `Programa asignado a ${ids.length} participantes`);
    }

    if (action === "adherence.save") {
      requireRole(viewer, ["admin"]);
      const userId = text(body.userId);
      const adherence = number(body.adherence);
      if (!userId || adherence == null || adherence < 0 || adherence > 100) return bad("La adherencia debe estar entre 0 y 100%");
      const date = text(body.date) || new Date().toISOString().slice(0,10);
      await env.DB.prepare("INSERT INTO habit_metrics (user_id,period_start,period_end,adherence,source,synced_at) VALUES (?,?,?,?,?,?)")
        .bind(userId,date,date,adherence,"firme-manual",new Date().toISOString()).run();
      return ok("Adherencia de Firme actualizada");
    }

    if (action === "settings.save") {
      requireRole(viewer, ["admin"]);
      const allowed = ["gpt_macros_url","gpt_training_url","firme_url","whatsapp_url","payment_monthly_url","payment_full_url","contact_email"];
      const now = new Date().toISOString();
      for (const key of allowed) {
        const value = text(body[key]);
        if (key.endsWith("_url") && value && !isHttpUrl(value)) return bad(`El enlace de ${key} no es válido`);
        if (key === "contact_email" && !value.includes("@")) return bad("El correo de contacto no es válido");
        await env.DB.prepare("INSERT INTO app_settings (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at")
          .bind(key,value,now).run();
      }
      return ok("Herramientas y comunidad actualizadas");
    }

    if (action === "question.save") {
      requireRole(viewer, ["admin"]);
      const id = text(body.id) || crypto.randomUUID();
      const label = text(body.label).trim();
      if (!label) return bad("La pregunta es obligatoria");
      const audience = ["nutrition","training","both"].includes(text(body.audience)) ? text(body.audience) : "both";
      await env.DB.prepare(`INSERT INTO onboarding_questions (id,label,field_type,options,position,required,active,audience) VALUES (?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET label=excluded.label,field_type=excluded.field_type,options=excluded.options,position=excluded.position,required=excluded.required,active=excluded.active,audience=excluded.audience`)
        .bind(id,label,text(body.fieldType)||"text",text(body.options),number(body.position)||1,truthy(body.required)?1:0,truthy(body.active)?1:0,audience).run();
      return ok("Pregunta guardada");
    }

    if (action === "onboarding.submit") {
      requireRole(viewer, ["participant"]);
      const questions = await env.DB.prepare("SELECT id,required FROM onboarding_questions WHERE active=1 ORDER BY position").all<{id:string;required:number}>();
      const now = new Date().toISOString();
      const writes = [];
      for (const question of questions.results) {
        const answer = text(body[`q_${question.id}`]).trim();
        if (question.required && !answer) return bad("Completa todas las preguntas obligatorias");
        writes.push(env.DB.prepare(`INSERT INTO onboarding_responses (user_id,question_id,answer,updated_at) VALUES (?,?,?,?)
          ON CONFLICT(user_id,question_id) DO UPDATE SET answer=excluded.answer,updated_at=excluded.updated_at`)
          .bind(viewer.id,question.id,answer,now));
      }
      writes.push(
        env.DB.prepare(`INSERT INTO onboarding (user_id,completed_at) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET completed_at=excluded.completed_at`).bind(viewer.id,now),
        env.DB.prepare(`UPDATE profiles SET
          weight=COALESCE(weight,(SELECT CAST(answer AS REAL) FROM onboarding_responses WHERE user_id=? AND question_id='weight')),
          height=COALESCE(height,(SELECT CAST(answer AS REAL) FROM onboarding_responses WHERE user_id=? AND question_id='height'))
          WHERE user_id=?`).bind(viewer.id,viewer.id,viewer.id),
        env.DB.prepare("UPDATE users SET status='active' WHERE id=? AND role='participant'").bind(viewer.id),
      );
      await env.DB.batch(writes);
      return ok("Formulario inicial completado");
    }

    if (action === "contact.send") {
      requireRole(viewer, ["participant"]);
      const subject = text(body.subject).trim();
      const message = text(body.message).trim();
      if (!subject || !message) return bad("Asunto y mensaje son obligatorios");
      await env.DB.prepare("INSERT INTO contact_messages (user_id,subject,message,status,created_at) VALUES (?,?,?,'new',?)")
        .bind(viewer.id,subject,message,new Date().toISOString()).run();
      const setting = await env.DB.prepare("SELECT value FROM app_settings WHERE key='contact_email'").first<{value:string}>();
      const email = setting?.value || "tuamiguelmoya@gmail.com";
      const mailto = `mailto:${email}?subject=${encodeURIComponent(`[Proyecto 90] ${subject}`)}&body=${encodeURIComponent(message)}`;
      return ok("Mensaje guardado. Se abrirá tu correo para enviarlo al Moya.", { mailto });
    }

    if (action === "meeting.request") {
      requireRole(viewer, ["participant"]);
      const requestedStart = text(body.requestedStart);
      const topic = text(body.topic).trim();
      const startMs = Date.parse(requestedStart);
      if (!topic || !Number.isFinite(startMs)) return bad("Elige un horario y cuéntale al Moya qué te gustaría conversar");
      if (startMs < Date.now() + 48 * 60 * 60 * 1000) return bad("La reunión debe solicitarse con al menos 48 horas de anticipación");
      const existing = await env.DB.prepare("SELECT id,status FROM one_on_one_meetings WHERE user_id=?").bind(viewer.id).first<{id:string;status:string}>();
      if (existing && ["pending","confirmed","rescheduled"].includes(existing.status)) return bad(existing.status === "pending" ? "Ya tienes una solicitud pendiente" : "Tu reunión 1:1 ya fue asignada");
      const now = new Date().toISOString();
      if (existing) {
        await env.DB.prepare(`UPDATE one_on_one_meetings SET requested_start=?,confirmed_start=NULL,meeting_link=NULL,status='pending',topic=?,admin_note=NULL,reviewed_by=NULL,updated_at=? WHERE id=?`)
          .bind(requestedStart,topic,now,existing.id).run();
      } else {
        await env.DB.prepare(`INSERT INTO one_on_one_meetings (id,user_id,requested_start,status,topic,created_at,updated_at) VALUES (?,? ,?,'pending',?,?,?)`)
          .bind(crypto.randomUUID(),viewer.id,requestedStart,topic,now,now).run();
      }
      return ok("Solicitud enviada al Moya. Te notificaremos a la brevedad cuando confirme el horario.");
    }

    if (action === "meeting.review") {
      requireRole(viewer, ["admin"]);
      const id = text(body.id);
      const decision = text(body.decision);
      const adminNote = text(body.adminNote).trim();
      const meetingLink = text(body.meetingLink).trim();
      const meeting = await env.DB.prepare("SELECT requested_start FROM one_on_one_meetings WHERE id=?").bind(id).first<{requested_start:string}>();
      if (!meeting) return bad("La solicitud no existe");
      let status = "confirmed";
      let confirmedStart = text(body.confirmedStart) || meeting.requested_start;
      if (decision === "reject") {
        if (!adminNote) return bad("Indica brevemente el motivo del rechazo");
        status = "rejected";
        confirmedStart = "";
      } else if (decision === "reschedule") {
        confirmedStart = text(body.confirmedStart);
        const confirmedMs = Date.parse(confirmedStart);
        if (!Number.isFinite(confirmedMs) || confirmedMs <= Date.now()) return bad("El nuevo horario debe ser una fecha futura");
        status = "rescheduled";
      } else if (decision !== "approve") return bad("Selecciona aprobar, rechazar o reprogramar");
      if (status !== "rejected") {
        const confirmedMs = Date.parse(confirmedStart);
        if (!Number.isFinite(confirmedMs) || confirmedMs <= Date.now()) return bad("El horario definitivo debe ser una fecha futura");
        if (!isHttpUrl(meetingLink)) return bad("Pega un enlace válido de Google Meet, Zoom u otra videollamada");
      }
      await env.DB.prepare("UPDATE one_on_one_meetings SET status=?,confirmed_start=?,meeting_link=?,admin_note=?,reviewed_by=?,updated_at=? WHERE id=?")
        .bind(status,confirmedStart||null,status==="rejected"?null:meetingLink,adminNote,viewer.id,new Date().toISOString(),id).run();
      return ok(status === "rejected" ? "Solicitud rechazada" : status === "rescheduled" ? "Reunión reprogramada y confirmada" : "Reunión confirmada");
    }

    if (action === "program.create") {
      requireRole(viewer, ["admin"]);
      const id = crypto.randomUUID();
      if (!text(body.name)) return bad("El nombre es obligatorio");
      await env.DB.prepare("INSERT INTO programs (id,name,level,location,active) VALUES (?,?,?,?,1)")
        .bind(id,text(body.name),text(body.level)||"Inicial",text(body.location)||"Casa").run();
      return ok("Programa creado", { id });
    }

    if (action === "workout.create") {
      requireRole(viewer, ["admin"]);
      if (!text(body.programId) || !text(body.name)) return bad("Programa y nombre son obligatorios");
      const id = crypto.randomUUID();
      await env.DB.batch([
        env.DB.prepare("INSERT INTO workouts (id,program_id,month,week,name) VALUES (?,?,?,?,?)")
          .bind(id,text(body.programId),number(body.month)||1,number(body.week)||1,text(body.name)),
        env.DB.prepare("INSERT INTO workout_progressions (workout_id,progression) VALUES (?,?)")
          .bind(id,text(body.progression)),
      ]);
      return ok("Rutina agregada", { id });
    }

    if (action === "workout.update") {
      requireRole(viewer, ["admin"]);
      const id = text(body.id);
      const name = text(body.name).trim();
      const month = number(body.month);
      const week = number(body.week);
      if (!id || !name || !month || !week || month < 1 || week < 1) return bad("Nombre, mes y semana son obligatorios");
      const result = await env.DB.prepare("UPDATE workouts SET name=?,month=?,week=? WHERE id=?")
        .bind(name,month,week,id).run();
      if (!result.meta.changes) return bad("La rutina no existe");
      await env.DB.prepare(`INSERT INTO workout_progressions (workout_id,progression) VALUES (?,?)
        ON CONFLICT(workout_id) DO UPDATE SET progression=excluded.progression`).bind(id,text(body.progression)).run();
      return ok("Rutina actualizada");
    }

    if (action === "workout.block.create") {
      requireRole(viewer, ["admin"]);
      const workoutId = text(body.workoutId);
      const name = text(body.name).trim();
      if (!workoutId || !name) return bad("Rutina y nombre del bloque son obligatorios");
      const current = await env.DB.prepare("SELECT COALESCE(MAX(position),0)+1 AS next FROM workout_blocks WHERE workout_id=?").bind(workoutId).first<{ next: number }>();
      const id = crypto.randomUUID();
      await env.DB.prepare("INSERT INTO workout_blocks (id,workout_id,position,name,rounds,work_seconds,rest_seconds,notes) VALUES (?,?,?,?,?,?,?,?)")
        .bind(id,workoutId,current?.next??1,name,number(body.rounds)||1,number(body.workSeconds)||null,number(body.restSeconds)||null,text(body.notes)).run();
      return ok("Bloque agregado", { id });
    }

    if (action === "workout.block.update") {
      requireRole(viewer, ["admin"]);
      const id = text(body.id);
      const name = text(body.name).trim();
      if (!id || !name) return bad("El nombre del bloque es obligatorio");
      const result = await env.DB.prepare("UPDATE workout_blocks SET name=?,rounds=?,work_seconds=?,rest_seconds=?,notes=? WHERE id=?")
        .bind(name,number(body.rounds)||1,number(body.workSeconds)||null,number(body.restSeconds)||null,text(body.notes),id).run();
      if (!result.meta.changes) return bad("El bloque no existe");
      return ok("Bloque actualizado");
    }

    if (action === "exercise.create") {
      requireRole(viewer, ["admin"]);
      if (!text(body.name)) return bad("El nombre es obligatorio");
      const youtube = text(body.youtubeUrl);
      if (!youtube) return bad("Cada ejercicio debe tener un video de técnica en YouTube");
      if (!isYouTube(youtube)) return bad("Usa un enlace válido de YouTube");
      const id = crypto.randomUUID();
      await env.DB.prepare(`INSERT INTO exercises (id,name,category,level,youtube_url,description,technique,common_errors,regression,progression)
        VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(id,text(body.name),text(body.category),text(body.level),youtube,text(body.description),text(body.technique),text(body.commonErrors),text(body.regression),text(body.progression)).run();
      return ok("Ejercicio agregado a la biblioteca", { id });
    }

    if (action === "exercise.update") {
      requireRole(viewer, ["admin"]);
      const id = text(body.id);
      const name = text(body.name).trim();
      const youtube = text(body.youtubeUrl);
      if (!id || !name) return bad("El nombre es obligatorio");
      if (!youtube) return bad("Cada ejercicio debe tener un video de técnica en YouTube");
      if (!isYouTube(youtube)) return bad("Usa un enlace válido de YouTube");
      const result = await env.DB.prepare(`UPDATE exercises SET name=?,category=?,level=?,youtube_url=?,description=?,technique=?,common_errors=?,regression=?,progression=? WHERE id=?`)
        .bind(name,text(body.category),text(body.level),youtube,text(body.description),text(body.technique),text(body.commonErrors),text(body.regression),text(body.progression),id).run();
      if (!result.meta.changes) return bad("El ejercicio no existe");
      return ok("Ejercicio actualizado");
    }

    if (action === "workout.exercise.add") {
      requireRole(viewer, ["admin"]);
      const exerciseId = text(body.exerciseId);
      const exercise = await env.DB.prepare("SELECT youtube_url FROM exercises WHERE id=?").bind(exerciseId).first<{ youtube_url: string | null }>();
      if (!exercise) return bad("El ejercicio no existe");
      if (!exercise.youtube_url) return bad("Agrega primero el video de técnica del ejercicio");
      const current = await env.DB.prepare("SELECT COALESCE(MAX(position),0)+1 AS next FROM workout_exercises WHERE workout_id=?").bind(text(body.workoutId)).first<{ next: number }>();
      await env.DB.prepare("INSERT INTO workout_exercises (workout_id,exercise_id,block_id,position,sets,reps,rest_seconds,notes) VALUES (?,?,?,?,?,?,?,?)")
        .bind(text(body.workoutId),exerciseId,text(body.blockId)||null,current?.next??1,number(body.sets)||1,text(body.reps)||"10",number(body.restSeconds)||0,text(body.notes)).run();
      return ok("Ejercicio añadido a la rutina");
    }

    if (action === "workout.exercise.update") {
      requireRole(viewer, ["admin"]);
      const id = number(body.id);
      const sets = number(body.sets);
      const restSeconds = number(body.restSeconds);
      const reps = text(body.reps).trim();
      if (!id || !sets || !reps || restSeconds == null || sets < 1 || restSeconds < 0) return bad("Series, repeticiones y descanso son obligatorios");
      const result = await env.DB.prepare("UPDATE workout_exercises SET block_id=?,sets=?,reps=?,rest_seconds=?,notes=? WHERE id=?")
        .bind(text(body.blockId)||null,sets,reps,restSeconds,text(body.notes),id).run();
      if (!result.meta.changes) return bad("El ejercicio adjuntado no existe");
      return ok("Ejercicio de la rutina actualizado");
    }

    if (action === "workout.exercise.remove") {
      requireRole(viewer, ["admin"]);
      await env.DB.prepare("DELETE FROM workout_exercises WHERE id=?").bind(number(body.id)).run();
      return ok("Ejercicio retirado de la rutina");
    }

    if (action === "nutrition.save") {
      requireArea(viewer, "nutrition");
      const userId = text(body.userId);
      const objective = text(body.nutritionObjective).trim();
      const calories=number(body.calories),protein=number(body.protein),carbs=number(body.carbs),fats=number(body.fats);
      if (!userId || !objective || calories == null || protein == null || carbs == null || fats == null || calories<=0 || protein<0 || carbs<0 || fats<0) return bad("Completa el objetivo, las calorías y los macros");
      await env.DB.prepare(`INSERT INTO nutrition_plans (user_id,calories,protein,carbs,fats,objective,pdf_key,notes,review_date,updated_by,updated_at,review_status)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,'pending_review')`).bind(userId,calories,protein,carbs,fats,objective,text(body.pdfKey)||null,text(body.notes),text(body.reviewDate),viewer.id,new Date().toISOString()).run();
      await env.DB.prepare("UPDATE users SET status=CASE WHEN status IN ('invited','onboarding') THEN status ELSE 'active' END WHERE id=?").bind(userId).run();
      return ok(viewer.role === "admin" ? "Macros enviados a revisión de la nutricionista" : "Plan actualizado y listo para revisión");
    }

    if (action === "nutrition.review") {
      requireArea(viewer, "nutrition");
      if (viewer.role !== "professional") return bad("La aprobación final corresponde a la nutricionista");
      const id = number(body.id); const decision = text(body.decision); const note = text(body.note).trim();
      if (!id || !["approved","rejected"].includes(decision)) return bad("Selecciona aprobar o rechazar");
      const result = await env.DB.prepare("UPDATE nutrition_plans SET review_status=?,review_note=?,reviewed_by=?,reviewed_at=? WHERE id=?")
        .bind(decision,note,viewer.id,new Date().toISOString(),id).run();
      if (!result.meta.changes) return bad("El plan no existe");
      return ok(decision === "approved" ? "Plan aprobado y publicado para el alumno" : "Plan rechazado para corrección");
    }

    if (action === "workout.override.save") {
      requireArea(viewer, "training");
      const userId=text(body.userId), workoutExerciseId=number(body.workoutExerciseId), sets=number(body.sets), restSeconds=number(body.restSeconds), reps=text(body.reps).trim();
      if(!userId||!workoutExerciseId||!sets||!reps||restSeconds==null||sets<1||restSeconds<0) return bad("Completa series, repeticiones y descanso");
      await env.DB.prepare(`INSERT INTO user_workout_overrides (user_id,workout_exercise_id,sets,reps,rest_seconds,notes,updated_by,updated_at) VALUES (?,?,?,?,?,?,?,?)
        ON CONFLICT(user_id,workout_exercise_id) DO UPDATE SET sets=excluded.sets,reps=excluded.reps,rest_seconds=excluded.rest_seconds,notes=excluded.notes,updated_by=excluded.updated_by,updated_at=excluded.updated_at`)
        .bind(userId,workoutExerciseId,sets,reps,restSeconds,text(body.notes),viewer.id,new Date().toISOString()).run();
      return ok("Ajuste individual guardado para el alumno");
    }

    if (action === "weight.save") {
      requireRole(viewer, ["participant"]);
      const weight=number(body.weight);
      if (weight == null || weight<30 || weight>300) return bad("Ingresa un peso válido entre 30 y 300 kg");
      const profile=await env.DB.prepare("SELECT created_at FROM users WHERE id=?").bind(viewer.id).first<{created_at:string}>();
      const start=profile?.created_at ? new Date(profile.created_at).getTime() : Date.now();
      const day=Math.min(90,Math.max(1,Math.floor((Date.now()-start)/86400000)+1));
      const now=new Date().toISOString();
      await env.DB.batch([
        env.DB.prepare("INSERT INTO checkpoints (user_id,day,weight,completed_at) VALUES (?,?,?,?)").bind(viewer.id,day,weight,now),
        env.DB.prepare("UPDATE profiles SET weight=COALESCE(weight,?) WHERE user_id=?").bind(weight,viewer.id),
      ]);
      return ok("Peso actualizado");
    }

    if (action === "content.create") {
      requireRole(viewer, ["admin", "professional"]);
      const video = text(body.videoUrl); if (video && !isYouTube(video)) return bad("Usa un enlace válido de YouTube");
      const id = crypto.randomUUID();
      await env.DB.prepare("INSERT INTO content (id,title,description,category,video_url,position,publish_at) VALUES (?,?,?,?,?,?,?)")
        .bind(id,text(body.title),text(body.description),text(body.category)||"Hábitos",video,number(body.position),text(body.publishAt)||new Date().toISOString()).run();
      if (truthy(body.isRequired)) await env.DB.prepare("INSERT INTO required_content (content_id) VALUES (?)").bind(id).run();
      return ok("Contenido publicado");
    }

    if (action === "session.create") {
      requireRole(viewer, ["admin", "professional"]);
      const title=text(body.title).trim(),startsAt=text(body.startsAt),link=text(body.link),recording=text(body.recordingUrl);
      if (!title || !startsAt) return bad("Nombre, fecha y hora son obligatorios");
      if ((link&&!isHttpUrl(link))||(recording&&!isHttpUrl(recording))) return bad("Usa enlaces válidos");
      await env.DB.prepare("INSERT INTO sessions (id,title,professional,starts_at,link,recording_url) VALUES (?,?,?,?,?,?)")
        .bind(crypto.randomUUID(),title,text(body.professional),startsAt,link,recording).run();
      return ok("Sesión creada");
    }

    if (action === "session.update") {
      requireRole(viewer, ["admin", "professional"]);
      const id=text(body.id),title=text(body.title).trim(),startsAt=text(body.startsAt),link=text(body.link),recording=text(body.recordingUrl);
      if (!id || !title || !startsAt) return bad("Nombre, fecha y hora son obligatorios");
      if ((link&&!isHttpUrl(link))||(recording&&!isHttpUrl(recording))) return bad("Usa enlaces válidos");
      const result=await env.DB.prepare("UPDATE sessions SET title=?,professional=?,starts_at=?,link=?,recording_url=? WHERE id=?")
        .bind(title,text(body.professional),startsAt,link,recording,id).run();
      if (!result.meta.changes) return bad("La sesión no existe");
      return ok("Sesión actualizada");
    }

    if (action === "session.delete") {
      requireRole(viewer, ["admin", "professional"]);
      const id=text(body.id);
      if (!id) return bad("Falta la sesión");
      const result=await env.DB.prepare("DELETE FROM sessions WHERE id=?").bind(id).run();
      if (!result.meta.changes) return bad("La sesión no existe");
      return ok("Sesión eliminada");
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
  ]);
}
function text(value: unknown) { return typeof value === "string" ? value : value == null ? "" : String(value); }
function number(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function isYouTube(value: string) { try { const host = new URL(value).hostname.replace(/^www\./,""); return host === "youtube.com" || host === "youtu.be"; } catch { return false; } }
function isHttpUrl(value: string) { try { return ["http:","https:"].includes(new URL(value).protocol); } catch { return false; } }
function truthy(value: unknown) { return value === true || value === "true" || value === "1" || value === "on"; }
function ok(message: string, extra: Record<string, unknown> = {}) { return Response.json({ ok: true, message, ...extra }); }
function bad(error: string) { return Response.json({ error }, { status: 400 }); }
function requireArea(viewer: {role:string;professionalType?:string|null}, area: "nutrition"|"training") {
  if (viewer.role === "admin") return;
  if (viewer.role === "professional" && [area,"both"].includes(viewer.professionalType || "both")) return;
  throw new Response("No autorizado para este módulo", { status: 403 });
}
