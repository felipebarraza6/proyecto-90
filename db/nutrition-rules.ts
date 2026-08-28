export type NutritionFinding = { code:string; label:string; evidence:string };

export type NutritionAssessment = {
  version:string;
  calculatedAt:string;
  age:number|null;
  bmi:number|null;
  bmiCategory:string;
  bmr:number|null;
  activityFactor:number;
  activityLabel:string;
  maintenanceCalories:number|null;
  goalType:"loss"|"gain"|"maintenance"|"combined";
  goalLabel:string;
  goalAdjustmentPct:number;
  calories:number|null;
  protein:number|null;
  carbs:number|null;
  fats:number|null;
  referenceWeight:number|null;
  referenceWeightLabel:string;
  idealWeight:number|null;
  minimumWeight:number|null;
  maximumWeight:number|null;
  adjustedWeight:number|null;
  automationStatus:"automatic"|"validation"|"mandatory_review";
  automationLabel:string;
  redFlags:NutritionFinding[];
  deficientHabits:NutritionFinding[];
  clinicalReview:NutritionFinding[];
  macroChecks:NutritionFinding[];
  coverageNotes:string[];
  formulaNote:string;
};

const n=(value:unknown)=>{const parsed=Number(value);return Number.isFinite(parsed)?parsed:null};
const list=(value:unknown)=>Array.isArray(value)?value.map(String):value==null||value===""?[]:[String(value)];
const norm=(value:unknown)=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const has=(value:unknown,needle:string)=>list(value).some(item=>norm(item).includes(norm(needle)));
const any=(value:unknown,needles:string[])=>needles.some(needle=>has(value,needle));
const evidence=(value:unknown)=>list(value).join(" · ")||"Sin respuesta interpretable";
const finding=(code:string,label:string,value:unknown):NutritionFinding=>({code,label,evidence:evidence(value)});

function ageAt(birthdate:unknown,now=new Date()){
  const date=new Date(String(birthdate||"")); if(Number.isNaN(date.getTime()))return null;
  let age=now.getUTCFullYear()-date.getUTCFullYear();
  const before=now.getUTCMonth()<date.getUTCMonth()||(now.getUTCMonth()===date.getUTCMonth()&&now.getUTCDate()<date.getUTCDate());
  if(before)age--; return age>=0&&age<120?age:null;
}

export function assessNutrition(answers:Record<string,unknown>,now=new Date()):NutritionAssessment{
  const redFlags:NutritionFinding[]=[];
  if(has(answers.food_relationship,"Relación conflictiva con mi cuerpo"))redFlags.push(finding("body_conflict","Relación conflictiva con su cuerpo",answers.food_relationship));
  if(has(answers.food_relationship,"Culpa o arrepentimiento después de comer"))redFlags.push(finding("food_guilt","Culpa frecuente al comer",answers.food_relationship));
  if(has(answers.food_relationship,"dietas muy restrictivas"))redFlags.push(finding("restrictive_diets","Historia de dietas restrictivas",answers.food_relationship));
  const eatingDisorders=list(answers.eating_disorders).filter(item=>!norm(item).includes("ninguna"));
  if(eatingDisorders.length)redFlags.push(finding("eating_disorder_history","Antecedentes actuales o previos de TCA",eatingDisorders));

  const deficientHabits:NutritionFinding[]=[];
  const addHabit=(code:string,label:string,key:string,needles:string[])=>{if(any(answers[key],needles))deficientHabits.push(finding(code,label,answers[key]))};
  addHabit("sleep","Sueño deficiente","sleep",["menos de 6 a 7 horas","no descanso bien","sueño es muy variable","00:00 a 03:00"]);
  addHabit("stress","Estrés mal regulado","stress",["muy estresado","cuesta desconectarme","comida para calmar","busco estímulos","quita el apetito"]);
  addHabit("hydration","Baja hidratación","hydration",["muy poca agua","más café o té","más bebidas o jugos","sin beber agua","no tomo agua","no me gusta el agua"]);
  addHabit("meal_structure","Desorden de horarios","meal_structure",["horarios cambian","sin una estructura","muchas horas sin comer","salto comidas","llego con mucha hambre"]);
  addHabit("planning","Baja planificación u organización","meal_planning",["improviso","cuesta decidir","da lata pensar","lo primero que encuentro","no tengo comidas base"]);
  addHabit("cooking_ideas","Sin ideas de qué comer","cooking",["no tengo ideas simples"]);
  addHabit("cooking_skills","Déficit de habilidades culinarias","cooking",["no sé cocinar","cocino muy poco"]);
  addHabit("ready_food","Dependencia de comida lista","cooking",["comida lista","delivery","ultraprocesados"]);
  addHabit("mindful_eating","Baja atención plena al comer","eating_style",["con pantallas","otras cosas","piloto automático","rápido","urgencia"]);
  addHabit("hunger_satiety","Alteración de hambre o saciedad","hunger_satiety",["confundo hambre","antojos frecuentes","cuesta parar","quedo con hambre","demasiado lleno","cuesta identificar"]);
  addHabit("night_eating","Patrón nocturno desregulado","night_eating",["otra comida","picoteo","levanto de la cama"]);
  addHabit("intake_awareness","Baja consciencia de ingesta","intake_awareness",["como poco y no bajo","no entiendo por qué","pierdo la noción","picoteo sin darme cuenta","cambian mucho","nunca he registrado"]);
  if(any(answers.alcohol_frequency,["1 vez por semana","2 a 3 veces por semana","4 o más veces por semana"])||any(answers.alcohol_amount,["3 a 4 tragos","5 o más tragos"]))deficientHabits.push(finding("alcohol","Consumo de alcohol relevante para los hábitos",`${evidence(answers.alcohol_frequency)} · ${evidence(answers.alcohol_amount)}`));
  if(has(answers.nicotine_frequency,"Consumo diariamente"))deficientHabits.push(finding("nicotine","Consumo diario de cigarro, vape o tabaco",answers.nicotine_frequency));

  const age=ageAt(answers.birthdate,now), weight=n(answers.weight), heightCm=n(answers.height), heightM=heightCm?heightCm/100:null;
  const bmi=weight&&heightM?weight/(heightM*heightM):null;
  const bmiCategory=bmi==null?"No calculable":bmi<18.5?"Bajo peso":bmi<25?"Normopeso":bmi<30?"Sobrepeso":bmi<40?"Obesidad":"Obesidad severa/extrema";
  const idealWeight=heightM?heightM*heightM*21.7:null, minimumWeight=heightM?heightM*heightM*18.5:null, maximumWeight=heightM?heightM*heightM*24.9:null;
  const adjustedWeight=weight&&idealWeight?idealWeight+(weight-idealWeight)*.5:null;
  let referenceWeight=weight,referenceWeightLabel="Peso actual";
  if(bmi!=null&&bmi>=25&&bmi<30){referenceWeight=maximumWeight;referenceWeightLabel="Peso máximo de normopeso (IMC 24,9)"}
  if(bmi!=null&&bmi>=30){referenceWeight=adjustedWeight;referenceWeightLabel="Peso ajustado al 50%"}

  const clinicalReview:NutritionFinding[]=[];
  if(age==null)clinicalReview.push(finding("age_missing","Edad no calculable",answers.birthdate));
  else if(age<18)clinicalReview.push(finding("minor","Menor de edad: no automatizar",answers.birthdate));
  const gender=norm(answers.gender),sex=gender==="hombre"?"male":gender==="mujer"?"female":null;
  if(!sex)clinicalReview.push(finding("formula_sex","La fórmula requiere revisión individual del sexo fisiológico aplicable",answers.gender));
  if(bmi!=null&&bmi<18.5)clinicalReview.push(finding("underweight","Bajo peso o sospecha de desnutrición",`IMC ${bmi.toFixed(1)}`));
  if(bmi!=null&&bmi>=40)clinicalReview.push(finding("severe_obesity","Obesidad severa/extrema",`IMC ${bmi.toFixed(1)}`));
  if(redFlags.length)clinicalReview.push(finding("red_flag_protocol","Existe una alerta roja: no priorizar una pauta centrada en calorías o peso",redFlags.map(item=>item.label)));
  const diagnoses=list(answers.diagnoses).filter(item=>!norm(item).includes("ninguna"));
  const mandatoryDiagnoses=["diabetes tipo 1","diabetes tipo 2","resistencia a la insulina","enfermedad cardiovascular","enfermedad renal","problemas de tiroides"];
  if(diagnoses.some(item=>mandatoryDiagnoses.some(d=>norm(item).includes(d))))clinicalReview.push(finding("clinical_diagnosis","Condición clínica que requiere individualización",diagnoses));
  const medicationText=norm(answers.medications);
  const medicationKeywords=["ozempic","semaglut","wegovy","mounjaro","tirzepat","metformin","cortico","predniso","antidepres","antipsicot","insulina","hipoglucem"];
  if(medicationKeywords.some(key=>medicationText.includes(key)))clinicalReview.push(finding("relevant_medication","Medicamento que puede afectar metabolismo, apetito, glicemia o peso",answers.medications));
  const surgeryText=norm(answers.surgeries);
  if(["bariatr","bypass","manga gastric","gastrect","intestinal","gastrointestinal"].some(key=>surgeryText.includes(key)))clinicalReview.push(finding("relevant_surgery","Cirugía bariátrica o gastrointestinal",answers.surgeries));
  const allergyText=norm(answers.allergies);
  if(allergyText&&!/^(no|ninguna|ninguno|no tengo|sin alergias)[ .]*$/.test(allergyText))clinicalReview.push(finding("food_allergies","Alergia o restricción alimentaria informada",answers.allergies));

  const goals=list(answers.main_goal),wantsLoss=goals.some(g=>any(g,["Bajar de peso","Disminuir porcentaje de grasa"])),wantsGain=goals.some(g=>has(g,"Aumentar masa muscular"));
  const goalType=wantsLoss&&wantsGain?"combined":wantsLoss?"loss":wantsGain?"gain":"maintenance";
  const goalLabel=goalType==="loss"?"Pérdida de grasa":goalType==="gain"?"Aumento de masa muscular":goalType==="combined"?"Objetivos simultáneos":"Mantenimiento y mejora de hábitos";
  const goalAdjustmentPct=goalType==="loss"?-15:goalType==="gain"?10:0;
  if(goalType==="combined")clinicalReview.push(finding("combined_goals","Objetivos simultáneos: validar prioridad con la nutricionista",goals));
  const moderate=any(answers.training_frequency,["3 a 4 días","5 días","6 o más días"]);
  const activityFactor=moderate?1.55:1.375,activityLabel=moderate?"Moderado (3 a 5+ días/semana)":"Liviano (1 a 3 días/semana)";
  let bmr:number|null=null;
  if(weight&&heightCm&&age!=null&&age>=18&&sex==="male")bmr=66.473+(13.7516*weight)+(5.0023*heightCm)-(6.755*age);
  if(weight&&heightCm&&age!=null&&age>=18&&sex==="female")bmr=665.095+(9.563*weight)+(1.8496*heightCm)-(4.6756*age);
  const maintenanceCalories=bmr?bmr*activityFactor:null;
  const calories=maintenanceCalories?Math.round((maintenanceCalories*(1+goalAdjustmentPct/100))/10)*10:null;
  const proteinFactor=goalType==="maintenance"?1.6:2;
  const protein=calories&&referenceWeight?Math.round(referenceWeight*proteinFactor):null;
  const fats=calories?Math.round((calories*.27)/9):null;
  const carbs=calories&&protein&&fats?Math.max(0,Math.round((calories-(protein*4)-(fats*9))/4)):null;
  const macroChecks:NutritionFinding[]=[];
  if(calories&&referenceWeight&&protein&&fats&&carbs){
    const values=[{code:"protein",label:"Proteína",grams:protein,kcal:protein*4,minKg:1.2,maxKg:2.2,minPct:10,maxPct:35},{code:"carbs",label:"Carbohidratos",grams:carbs,kcal:carbs*4,minKg:3,maxKg:7,minPct:45,maxPct:65},{code:"fats",label:"Grasas",grams:fats,kcal:fats*9,minKg:.5,maxKg:1.5,minPct:20,maxPct:35}];
    for(const item of values){const perKg=item.grams/referenceWeight,pct=item.kcal/calories*100;if(perKg<item.minKg||perKg>item.maxKg||pct<item.minPct||pct>item.maxPct)macroChecks.push({code:`${item.code}_outside_range`,label:`${item.label} fuera del rango orientativo`,evidence:`${perKg.toFixed(2)} g/kg · ${pct.toFixed(0)}% de energía`})}
  }
  let automationStatus:"automatic"|"validation"|"mandatory_review"="automatic";
  if(clinicalReview.length)automationStatus="mandatory_review"; else if((bmi!=null&&bmi>=25)||macroChecks.length)automationStatus="validation";
  const automationLabel=automationStatus==="automatic"?"Automatización + aprobación":automationStatus==="validation"?"Automatización + validación":"Revisión nutricional obligatoria";
  return {version:"proyecto-moya-2026-08-v1",calculatedAt:now.toISOString(),age,bmi:bmi==null?null:Number(bmi.toFixed(2)),bmiCategory,bmr:bmr?Math.round(bmr):null,activityFactor,activityLabel,maintenanceCalories:maintenanceCalories?Math.round(maintenanceCalories):null,goalType,goalLabel,goalAdjustmentPct,calories,protein,carbs,fats,referenceWeight:referenceWeight?Number(referenceWeight.toFixed(1)):null,referenceWeightLabel,idealWeight:idealWeight?Number(idealWeight.toFixed(1)):null,minimumWeight:minimumWeight?Number(minimumWeight.toFixed(1)):null,maximumWeight:maximumWeight?Number(maximumWeight.toFixed(1)):null,adjustedWeight:adjustedWeight?Number(adjustedWeight.toFixed(1)):null,automationStatus,automationLabel,redFlags,deficientHabits,clinicalReview,macroChecks,coverageNotes:["El formulario actual no pregunta de forma estructurada por embarazo o lactancia, enfermedad hepática, cáncer, enfermedad gastrointestinal específica ni control reciente de hipotiroidismo; estos criterios no pueden descartarse automáticamente.","La propuesta es orientativa y nunca se publica al alumno sin aprobación de la nutricionista."],formulaNote:"Harris-Benedict según la pauta entregada: TMB con peso actual, talla y edad; GET con factor liviano 1,375 o moderado 1,55. El peso de referencia se usa para calcular gramos por kilo."};
}
