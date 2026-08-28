import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getOrCreateViewer, requireRole } from "../../../db/access";

export const dynamic="force-dynamic";

type ExportRow={id:string;first_name:string|null;last_name:string|null;email:string;status:string;completed_at:string|null;section:string|null;audience:string|null;prompt:string|null;answer_json:string|null;updated_at:string|null};

export async function GET(request:Request){
  try{
    const auth=await getChatGPTUser();if(!auth)return Response.json({error:"Debes iniciar sesión"},{status:401});
    const viewer=await getOrCreateViewer(auth);requireRole(viewer,["admin"]);
    const participantId=new URL(request.url).searchParams.get("participantId")||"";
    const result=participantId
      ?await env.DB.prepare(exportSql("AND u.id=?")).bind(participantId).all<ExportRow>()
      :await env.DB.prepare(exportSql("")).all<ExportRow>();
    const headers=["ID participante","Nombre","Apellido","Correo","Estado","Formulario completado","Sección","Visible para","Pregunta","Respuesta","Respuesta actualizada"];
    const lines=[headers,...result.results.map(row=>[row.id,row.first_name||"",row.last_name||"",row.email,row.status,row.completed_at||"",row.section||"",row.audience||"",row.prompt||"",answer(row.answer_json),row.updated_at||""])].map(values=>values.map(csv).join(","));
    const filename=participantId?`proyecto-90-formulario-${safe(result.results[0]?.email||participantId)}.csv`:"proyecto-90-base-formularios.csv";
    return new Response(`\uFEFF${lines.join("\r\n")}`,{headers:{"content-type":"text/csv; charset=utf-8","content-disposition":`attachment; filename="${filename}"`,"cache-control":"no-store"}});
  }catch(error){if(error instanceof Response)return error;return Response.json({error:error instanceof Error?error.message:"No fue posible exportar"},{status:500})}
}

function exportSql(extra:string){return `SELECT u.id,p.first_name,p.last_name,u.email,u.status,o.completed_at,q.section,q.audience,q.prompt,r.answer_json,r.updated_at
  FROM users u LEFT JOIN profiles p ON p.user_id=u.id LEFT JOIN onboarding o ON o.user_id=u.id
  LEFT JOIN intake_responses r ON r.user_id=u.id LEFT JOIN intake_questions q ON q.id=r.question_id
  WHERE u.role='participant' ${extra} ORDER BY p.first_name,p.last_name,q.position`}
function answer(value:string|null){if(!value)return "";try{const parsed=JSON.parse(value);return Array.isArray(parsed)?parsed.join(" | "):typeof parsed==="object"?JSON.stringify(parsed):String(parsed)}catch{return value}}
function csv(value:unknown){let text=String(value??"");if(/^[=+@-]/.test(text))text=`'${text}`;return `"${text.replace(/"/g,'""')}"`}
function safe(value:string){return value.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60)||"participante"}
