require("dotenv").config();
const path=require("node:path"),express=require("express"),helmet=require("helmet"),cookieParser=require("cookie-parser"),rateLimit=require("express-rate-limit"),bcrypt=require("bcryptjs"),jwt=require("jsonwebtoken"),speakeasy=require("speakeasy"),{PrismaClient}=require("@prisma/client"),{z}=require("zod");
const app=express(),prisma=new PrismaClient(),PORT=process.env.PORT||3000,SECRET=process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 32) {
  throw new Error("Configure JWT_SECRET com ao menos 32 caracteres.");
}
app.disable("x-powered-by");app.set("trust proxy",1);
app.use((req,res,next)=>{if(process.env.NODE_ENV==="production"&&req.get("x-forwarded-proto")!=="https")return res.redirect(308,"https://"+req.get("host")+req.originalUrl);next()});
app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'","https://unpkg.com"],styleSrc:["'self'","'unsafe-inline'","https://unpkg.com"],imgSrc:["'self'","data:","https://*.tile.openstreetmap.org"],connectSrc:["'self'","https://nominatim.openstreetmap.org"],fontSrc:["'self'"],objectSrc:["'none'"],frameAncestors:["'none'"]}}}));app.use(express.json({limit:"6mb"}));app.use(cookieParser());app.use(rateLimit({windowMs:900000,limit:120,standardHeaders:"draft-8",legacyHeaders:false}));
const loginLimiter=rateLimit({windowMs:900000,limit:8,standardHeaders:"draft-8",legacyHeaders:false,message:{error:"Muitas tentativas de login. Aguarde 15 minutos."}});
const registerLimiter=rateLimit({windowMs:3600000,limit:5,standardHeaders:"draft-8",legacyHeaders:false,message:{error:"Muitas tentativas de cadastro. Tente novamente mais tarde."}});app.use(express.static(path.join(__dirname,"../../public")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../../index.html"));
});
const {cpfOk,cpfMask,susMask}=require("./validation");
const safe=u=>({id:u.id,name:u.name,email:u.email,role:u.role,cpf:cpfMask(u.cpf),susCard:susMask(u.susCard),phone:u.phone,twoFactorOn:u.twoFactorOn});
const token=u=>jwt.sign({sub:u.id},SECRET,{expiresIn:"8h",issuer:"saude",audience:"portal"});
const auth=()=>async(req,res,next)=>{try{const t=req.cookies.saude_session||(req.headers.authorization||"").replace(/^Bearer /i,"");if(!t)return res.status(401).json({error:"Faça login para continuar."});const p=jwt.verify(t,SECRET,{issuer:"saude",audience:"portal"});const u=await prisma.user.findUnique({where:{id:p.sub}});if(!u||!u.active)return res.status(401).json({error:"Sessão inválida."});req.user=u;next()}catch{return res.status(401).json({error:"Sessão expirada ou inválida."})}};
const roles=(...r)=>(req,res,next)=>{
 if(req.user.role==="ADMIN"&&!req.user.twoFactorOn&&!req.path.includes("/2fa/"))return res.status(403).json({error:"Configure a autenticação em duas etapas da conta administradora antes de continuar."});
 return r.includes(req.user.role)?next():res.status(403).json({error:"Acesso não autorizado."});
};
const log=(actorId,action,entity,entityId)=>prisma.auditEvent.create({data:{actorId,action,entity,entityId}}).catch(()=>{});
const cpfSchema=z.string().transform(v=>v.replace(/\D/g,"")).refine(cpfOk,"CPF inválido");
app.get("/api/health",(q,s)=>s.json({status:"ok"}));
app.post("/api/auth/register",registerLimiter,async(req,res)=>{try{const d=z.object({name:z.string().trim().min(3).max(100),email:z.string().email().max(160),password:z.string().min(10).max(72),cpf:cpfSchema,phone:z.string().min(10).max(20),susCard:z.string().optional(),privacyNoticeAccepted:z.literal(true)}).parse(req.body);const email=d.email.toLowerCase();if(await prisma.user.findFirst({where:{OR:[{email},{cpf:d.cpf}]}}))return res.status(409).json({error:"Já existe cadastro com este e-mail ou CPF."});const u=await prisma.user.create({data:{name:d.name,email,cpf:d.cpf,phone:d.phone,susCard:d.susCard?d.susCard.replace(/\D/g,""):null,privacyNoticeAcceptedAt:new Date(),passwordHash:await bcrypt.hash(d.password,12),role:"PATIENT"}});await log(u.id,"PATIENT_REGISTERED","User",u.id);res.status(201).json({message:"Cadastro realizado. Faça login para continuar.",user:safe(u)})}catch(e){res.status(400).json({error:e.errors?.[0]?.message||"Não foi possível realizar o cadastro."})}});
app.post("/api/auth/login",loginLimiter,async(req,res)=>{try{const d=z.object({email:z.string().email(),password:z.string().min(1),otp:z.string().optional()}).parse(req.body);const u=await prisma.user.findUnique({where:{email:d.email.toLowerCase()}});if(!u||!u.active||!await bcrypt.compare(d.password,u.passwordHash))return res.status(401).json({error:"E-mail ou senha incorretos."});const requires2FA=u.role==="DOCTOR"||u.role==="NURSE"||(u.role==="ADMIN"&&u.twoFactorOn);if(requires2FA&&(!u.twoFactorOn||!u.twoFactorSecret))return res.status(409).json({error:"A autenticação em duas etapas desta conta está marcada como ativa, mas a chave não está configurada. É necessária uma recuperação segura do 2FA."});if(requires2FA&&!d.otp)return res.json({requiresTwoFactor:true,message:"Senha confirmada. Informe o código de 6 dígitos do aplicativo autenticador e entre novamente."});if(requires2FA&&!speakeasy.totp.verify({secret:u.twoFactorSecret,encoding:"base32",token:d.otp,window:1}))return res.status(401).json({error:"Código de autenticação em duas etapas inválido. Confira o código atual do aplicativo autenticador."});res.cookie("saude_session",token(u),{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",maxAge:28800000,path:"/"});await log(u.id,"LOGIN","User",u.id);res.json({user:safe(u)})}catch(e){res.status(400).json({error:e.errors?.[0]?.message||"Dados de acesso inválidos."})}});
app.post("/api/auth/logout",(q,s)=>s.clearCookie("saude_session",{httpOnly:true,sameSite:"strict",secure:process.env.NODE_ENV==="production",path:"/"}).json({message:"Sessão encerrada."}));
app.get("/api/auth/me",auth(),(q,s)=>s.json({user:safe(q.user)}));
// Provisionamento de 2FA: somente administrador pode iniciar; o profissional confirma o código no app autenticador.
app.post("/api/admin/staff/:id/2fa/setup",auth(),roles("ADMIN"),async(req,res)=>{
 const staff=await prisma.user.findUnique({where:{id:req.params.id}});
 if(!staff||staff.role==="PATIENT")return res.status(404).json({error:"Profissional não encontrado."});
 const secret=speakeasy.generateSecret({name:"Saúde Perto ("+staff.email+")"});
 await prisma.user.update({where:{id:staff.id},data:{twoFactorSecret:secret.base32,twoFactorOn:false}});
 res.json({otpauthUrl:secret.otpauth_url,manualKey:secret.base32,instructions:"Cadastre a chave em um aplicativo autenticador e confirme o código para ativar."});
});
app.post("/api/admin/staff/:id/2fa/confirm",auth(),roles("ADMIN"),async(req,res)=>{
 const {otp}=z.object({otp:z.string().length(6)}).parse(req.body);
 const staff=await prisma.user.findUnique({where:{id:req.params.id}});
 if(!staff||!staff.twoFactorSecret)return res.status(404).json({error:"Configuração não iniciada."});
 if(!speakeasy.totp.verify({secret:staff.twoFactorSecret,encoding:"base32",token:otp,window:1}))return res.status(400).json({error:"Código inválido."});
 await prisma.user.update({where:{id:staff.id},data:{twoFactorOn:true}});
 await log(req.user.id,"STAFF_2FA_ENABLED","User",staff.id);
 res.json({message:"Autenticação em duas etapas ativada."});
});
app.get("/api/staff/doctors",async(q,s)=>{const now=new Date();const doctors=await prisma.user.findMany({where:{role:"DOCTOR",active:true,twoFactorOn:true,twoFactorSecret:{not:null},healthUnitAssignments:{some:{healthUnit:{is:{active:true}}}},OR:[{availableSlots:{some:{isOpen:true,startsAt:{gt:now},healthUnit:{is:{active:true}}}}},{doctorPeriodSchedules:{some:{active:true,date:{gte:new Date(new Date().toISOString().slice(0,10)+"T00:00:00.000Z")},healthUnit:{is:{active:true}},appointments:{none:{status:"SCHEDULED"}}}}}]},select:{id:true,name:true}});s.json({doctors})});
app.get("/api/units",async(q,s)=>{try{const units=await prisma.healthUnit.findMany({where:{active:true},select:{id:true,name:true,municipality:true,address:true,latitude:true,longitude:true},orderBy:[{municipality:"asc"},{name:"asc"}]});s.json({units});}catch(e){s.status(500).json({error:"Não foi possível carregar as unidades disponíveis."});}});
app.get("/api/staff/slots",async(req,res)=>{
 const doctorId=String(req.query.doctorId||"");
 if(!doctorId)return res.status(400).json({error:"Informe o profissional."});
 const slots=await prisma.scheduleSlot.findMany({where:{doctorId,isOpen:true,startsAt:{gt:new Date()},healthUnitId:{not:null},healthUnit:{is:{active:true,doctors:{some:{doctorId}}}},doctor:{is:{active:true,twoFactorOn:true,twoFactorSecret:{not:null}}}},orderBy:{startsAt:"asc"},take:100,select:{id:true,startsAt:true,specialty:true,unit:true,healthUnitId:true}});
 res.json({slots});
});

const periodSchema=z.enum(["MORNING","AFTERNOON","EVENING"]);
const imageSchema=z.string().max(5_000_000).optional().nullable().refine(v=>!v||/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v),"Envie uma imagem PNG, JPG ou WebP válida.");
async function materializeRecurringPeriods(unitId, horizonDays=30){
 const today=new Date();today.setUTCHours(0,0,0,0);
 const until=new Date(today);until.setUTCDate(until.getUTCDate()+horizonDays);
 const rules=await prisma.doctorRecurringPeriod.findMany({where:{healthUnitId:unitId,active:true,validFrom:{lte:until},OR:[{validUntil:null},{validUntil:{gte:today}}],doctor:{is:{active:true,twoFactorOn:true,twoFactorSecret:{not:null}}},healthUnit:{is:{active:true}}}});
 for(const rule of rules){
  const from=new Date(Math.max(today.getTime(),rule.validFrom.getTime()));from.setUTCHours(0,0,0,0);
  const last=rule.validUntil&&rule.validUntil<until?rule.validUntil:until;
  for(let day=new Date(from);day<=last;day.setUTCDate(day.getUTCDate()+1)){
   if(!rule.weekdays.includes(day.getUTCDay()))continue;
   const [sh,sm]=rule.startsAtTime.split(":").map(Number),[eh,em]=rule.endsAtTime.split(":").map(Number);
   const startsAt=new Date(Date.UTC(day.getUTCFullYear(),day.getUTCMonth(),day.getUTCDate(),sh,sm));
   const endsAt=new Date(Date.UTC(day.getUTCFullYear(),day.getUTCMonth(),day.getUTCDate(),eh,em));
   if(startsAt<=new Date())continue;
   await prisma.doctorPeriodSchedule.createMany({data:[{doctorId:rule.doctorId,healthUnitId:rule.healthUnitId,date:new Date(day),period:rule.period,startsAt,endsAt,specialty:rule.specialty,capacity:rule.capacity,active:true}],skipDuplicates:true});
  }
 }
}
app.get("/api/period-schedules",async(req,res)=>{
 try{
  const unitId=String(req.query.unitId||"");
  const specialty=String(req.query.specialty||"");
  const date=String(req.query.date||"");
  if(!unitId)return res.status(400).json({error:"Selecione a unidade."});
  await materializeRecurringPeriods(unitId);
  const where={healthUnitId:unitId,active:true,date:{gte:new Date(new Date().toISOString().slice(0,10)+"T00:00:00.000Z")},startsAt:{gt:new Date()},doctor:{is:{active:true,twoFactorOn:true,twoFactorSecret:{not:null}}},healthUnit:{is:{active:true}},...(specialty?{specialty}:{})};
  if(date)where.date=new Date(date+"T00:00:00.000Z");
  const schedules=await prisma.doctorPeriodSchedule.findMany({where,include:{doctor:{select:{id:true,name:true}},appointments:{where:{status:"SCHEDULED"},select:{id:true}}},orderBy:[{date:"asc"},{startsAt:"asc"},{doctor:{name:"asc"}}]});
  res.json({schedules:schedules.filter(x=>x.appointments.length<x.capacity).map(x=>({id:x.id,date:x.date,period:x.period,startsAt:x.startsAt,endsAt:x.endsAt,specialty:x.specialty,unitId:x.healthUnitId,unit:x.healthUnitId,doctor:x.doctor,capacity:x.capacity,remaining:x.capacity-x.appointments.length}))});
 }catch(e){res.status(500).json({error:"Não foi possível carregar os períodos disponíveis."})}
});
app.get("/api/admin/recurring-periods",auth(),roles("ADMIN"),async(req,res)=>{
 const schedules=await prisma.doctorRecurringPeriod.findMany({include:{doctor:{select:{id:true,name:true}},healthUnit:{select:{id:true,name:true}}},orderBy:{createdAt:"desc"},take:100});
 res.json({schedules});
});
app.patch("/api/admin/recurring-periods/:id",auth(),roles("ADMIN"),async(req,res)=>{
 try{const {active}=z.object({active:z.boolean()}).parse(req.body);const rule=await prisma.doctorRecurringPeriod.update({where:{id:req.params.id},data:{active}});await log(req.user.id,active?"RECURRING_PERIOD_ACTIVATED":"RECURRING_PERIOD_DEACTIVATED","DoctorRecurringPeriod",rule.id);res.json({schedule:rule,message:active?"Repetição reativada.":"Repetição desativada. Os períodos já publicados e agendamentos existentes foram preservados."})}catch(e){res.status(e.code==="P2025"?404:400).json({error:"Não foi possível alterar a repetição."})}
});
app.get("/api/admin/period-schedules",auth(),roles("ADMIN"),async(req,res)=>{
 const schedules=await prisma.doctorPeriodSchedule.findMany({include:{doctor:{select:{id:true,name:true}},healthUnit:{select:{id:true,name:true}},_count:{select:{appointments:true}}},orderBy:[{date:"desc"},{startsAt:"asc"}],take:150});
 const rows=await Promise.all(schedules.map(async x=>({...x,booked:await prisma.appointment.count({where:{periodScheduleId:x.id,status:"SCHEDULED"}})})));
 res.json({schedules:rows});
});
app.patch("/api/admin/period-schedules/:id",auth(),roles("ADMIN"),async(req,res)=>{
 try{const {active}=z.object({active:z.boolean()}).parse(req.body);const item=await prisma.doctorPeriodSchedule.update({where:{id:req.params.id},data:{active}});await log(req.user.id,active?"DOCTOR_PERIOD_ACTIVATED":"DOCTOR_PERIOD_DEACTIVATED","DoctorPeriodSchedule",item.id);res.json({schedule:item,message:active?"Período reativado.":"Período desativado para novas reservas."})}catch(e){res.status(e.code==="P2025"?404:400).json({error:"Não foi possível alterar o período."})}
});
app.post("/api/admin/recurring-periods",auth(),roles("ADMIN"),async(req,res)=>{
 try{
  const d=z.object({doctorId:z.string().uuid(),healthUnitId:z.string().uuid(),validFrom:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),validUntil:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),weekdays:z.array(z.number().int().min(0).max(6)).min(1).max(7),period:periodSchema,startsAtTime:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),endsAtTime:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),specialty:z.string().trim().min(2).max(80),capacity:z.number().int().min(1).max(200)}).parse(req.body);
  const from=new Date(d.validFrom+"T00:00:00.000Z"),to=d.validUntil?new Date(d.validUntil+"T00:00:00.000Z"):null;
  if(to&&to<from)return res.status(400).json({error:"A data final deve ser igual ou posterior à data inicial."});
  if(d.endsAtTime<=d.startsAtTime)return res.status(400).json({error:"O fim do atendimento deve ser depois do início."});
  if(from<new Date(new Date().toISOString().slice(0,10)+"T00:00:00.000Z"))return res.status(400).json({error:"A repetição deve começar hoje ou em uma data futura."});
  const [doctor,unit,assignment,specialtyAssignment]=await Promise.all([prisma.user.findFirst({where:{id:d.doctorId,role:"DOCTOR",active:true,twoFactorOn:true,twoFactorSecret:{not:null}}}),prisma.healthUnit.findFirst({where:{id:d.healthUnitId,active:true}}),prisma.healthUnitDoctor.findUnique({where:{healthUnitId_doctorId:{healthUnitId:d.healthUnitId,doctorId:d.doctorId}}}),prisma.doctorSpecialty.findFirst({where:{doctorId:d.doctorId,name:d.specialty}})]);
  if(!doctor||!unit||!assignment)return res.status(409).json({error:"Confira se o médico está ativo, com 2FA e vinculado à unidade ativa."});
  if(!specialtyAssignment)return res.status(409).json({error:"Esta especialidade não está cadastrada no perfil do médico."});
  const rule=await prisma.doctorRecurringPeriod.create({data:{...d,weekdays:[...new Set(d.weekdays)],validFrom:from,validUntil:to}});
  await materializeRecurringPeriods(unit.id);
  await log(req.user.id,"DOCTOR_RECURRING_PERIOD_CREATED","DoctorRecurringPeriod",rule.id);
  res.status(201).json({schedule:rule,message:"Repetição semanal cadastrada. Os próximos 30 dias serão disponibilizados automaticamente conforme os dias selecionados."});
 }catch(e){res.status(400).json({error:e.errors?.[0]?.message||"Não foi possível cadastrar a repetição semanal."})}
});
app.post("/api/admin/period-schedules",auth(),roles("ADMIN"),async(req,res)=>{
 try{
  const d=z.object({doctorId:z.string().uuid(),healthUnitId:z.string().uuid(),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),period:periodSchema,startsAt:z.string().datetime(),endsAt:z.string().datetime(),specialty:z.string().trim().min(2).max(80),capacity:z.number().int().min(1).max(200)}).parse(req.body);
  const start=new Date(d.startsAt),end=new Date(d.endsAt),day=new Date(d.date+"T00:00:00.000Z");
  if(start<=new Date()||end<=start)return res.status(400).json({error:"Confira a data e o intervalo do período."});
  const [doctor,unit,assignment,specialtyAssignment]=await Promise.all([prisma.user.findFirst({where:{id:d.doctorId,role:"DOCTOR",active:true,twoFactorOn:true,twoFactorSecret:{not:null}}}),prisma.healthUnit.findFirst({where:{id:d.healthUnitId,active:true}}),prisma.healthUnitDoctor.findUnique({where:{healthUnitId_doctorId:{healthUnitId:d.healthUnitId,doctorId:d.doctorId}}}),prisma.doctorSpecialty.findFirst({where:{doctorId:d.doctorId,name:d.specialty}})]);
  if(!doctor||!unit||!assignment)return res.status(409).json({error:"Confira se o médico está ativo, com 2FA e vinculado à unidade ativa."});
  if(!specialtyAssignment)return res.status(409).json({error:"Esta especialidade não está cadastrada no perfil do médico. Atualize as especialidades antes de publicar o período."});
  const unique={doctorId_healthUnitId_date_period:{doctorId:d.doctorId,healthUnitId:d.healthUnitId,date:day,period:d.period}};const existing=await prisma.doctorPeriodSchedule.findUnique({where:unique,include:{appointments:{where:{status:"SCHEDULED"},select:{id:true}}}});if(existing&&existing.appointments.length>d.capacity)return res.status(409).json({error:"A capacidade não pode ficar abaixo dos pacientes já agendados ("+existing.appointments.length+")."});const schedule=await prisma.doctorPeriodSchedule.upsert({where:unique,create:{...d,date:day,startsAt:start,endsAt:end},update:{startsAt:start,endsAt:end,specialty:d.specialty,capacity:d.capacity,active:true}});
  await log(req.user.id,"DOCTOR_PERIOD_SCHEDULE_SAVED","DoctorPeriodSchedule",schedule.id);
  res.status(201).json({schedule,message:"Período de atendimento publicado."});
 }catch(e){res.status(e.code==="P2002"?409:400).json({error:e.code==="P2002"?"Já existe um período para este médico, unidade e dia.":e.errors?.[0]?.message||"Não foi possível publicar o período."})}
});
app.patch("/api/appointments/:id/period",auth(),roles("PATIENT"),async(req,res)=>{
 try{
  const {periodScheduleId}=z.object({periodScheduleId:z.string().uuid()}).parse(req.body);
  const updated=await prisma.$transaction(async tx=>{
   const appointment=await tx.appointment.findUnique({where:{id:req.params.id}});
   if(!appointment||appointment.patientId!==req.user.id)throw Object.assign(new Error("Agendamento não encontrado."),{status:404});
   if(appointment.status!=="SCHEDULED")throw Object.assign(new Error("Este agendamento não está ativo."),{status:409});
   await tx.$queryRaw`SELECT "id" FROM "DoctorPeriodSchedule" WHERE "id" = ${periodScheduleId} FOR UPDATE`;
   const target=await tx.doctorPeriodSchedule.findUnique({where:{id:periodScheduleId},include:{appointments:{where:{status:"SCHEDULED"},select:{id:true}}}});
   if(!target||!target.active||target.appointments.length>=target.capacity||target.date<new Date(new Date().toISOString().slice(0,10)+"T00:00:00.000Z"))throw Object.assign(new Error("Este período não possui mais disponibilidade."),{status:409});
   if(target.doctorId!==appointment.doctorId||target.healthUnitId!== (await tx.doctorPeriodSchedule.findUnique({where:{id:appointment.periodScheduleId}}))?.healthUnitId)throw Object.assign(new Error("A troca deve ser para outro período do mesmo médico e unidade."),{status:400});
   return tx.appointment.update({where:{id:appointment.id},data:{periodScheduleId:target.id,startsAt:target.startsAt,specialty:target.specialty,unit:(await tx.healthUnit.findUnique({where:{id:target.healthUnitId}})).name}});
  });
  await log(req.user.id,"APPOINTMENT_PERIOD_CHANGED","Appointment",updated.id);
  res.json({appointment:updated,message:"Período alterado com sucesso."});
 }catch(e){res.status(e.status||400).json({error:e.message||"Não foi possível alterar o período."})}
});
app.post("/api/admin/slots",auth(),roles("ADMIN"),async(req,res)=>{
 try{
  const d=z.object({doctorId:z.string().uuid(),healthUnitId:z.string().uuid(),startsAt:z.string().datetime(),specialty:z.string().trim().min(2).max(80)}).parse(req.body);
  if(new Date(d.startsAt)<=new Date())return res.status(400).json({error:"O horário precisa ser futuro."});
  const [doctor,unit,assignment]=await Promise.all([
   prisma.user.findFirst({where:{id:d.doctorId,role:"DOCTOR",active:true,twoFactorOn:true,twoFactorSecret:{not:null}}}),
   prisma.healthUnit.findFirst({where:{id:d.healthUnitId,active:true}}),
   prisma.healthUnitDoctor.findUnique({where:{healthUnitId_doctorId:{healthUnitId:d.healthUnitId,doctorId:d.doctorId}}})
  ]);
  if(!doctor)return res.status(404).json({error:"Médico não encontrado ou inativo."});
  if(!unit)return res.status(404).json({error:"Unidade não encontrada ou ainda não está ativa."});
  if(!assignment)return res.status(409).json({error:"Vincule este médico à unidade antes de publicar horários."});
  const slot=await prisma.scheduleSlot.create({data:{doctorId:d.doctorId,healthUnitId:unit.id,startsAt:new Date(d.startsAt),specialty:d.specialty,unit:unit.name}});
  await log(req.user.id,"SCHEDULE_SLOT_CREATED","ScheduleSlot",slot.id);
  res.status(201).json({slot});
 }catch(e){res.status(e.code==="P2002"?409:400).json({error:e.code==="P2002"?"Este profissional já possui um horário cadastrado neste momento.":e.errors?.[0]?.message||"Não foi possível cadastrar o horário."})}
});
app.get("/api/admin/units",auth(),roles("ADMIN"),async(q,s)=>{
 const units=await prisma.healthUnit.findMany({include:{doctors:{include:{doctor:{select:{id:true,name:true,active:true}}}}},orderBy:[{municipality:"asc"},{name:"asc"}]});
 s.json({units:units.map(unit=>({...unit,doctors:unit.doctors.map(item=>item.doctor)}))});
});
app.post("/api/admin/units",auth(),roles("ADMIN"),async(req,res)=>{
 try{
  const d=z.object({name:z.string().trim().min(3).max(120),address:z.string().trim().min(5).max(240),phone:z.string().trim().max(30).optional().default(""),municipality:z.string().trim().min(2).max(120),coverageArea:z.string().trim().max(240).optional().default(""),latitude:z.number().min(-90).max(90).nullable().optional(),longitude:z.number().min(-180).max(180).nullable().optional()}).parse(req.body);
  const unit=await prisma.healthUnit.create({data:{...d,active:false}});
  await log(req.user.id,"HEALTH_UNIT_CREATED","HealthUnit",unit.id);
  res.status(201).json({unit,message:"Unidade cadastrada como Em preparação. Ative-a somente após revisar os dados."});
 }catch(e){res.status(e.code==="P2002"?409:400).json({error:e.code==="P2002"?"Já existe uma unidade com esse nome.":e.errors?.[0]?.message||"Não foi possível cadastrar a unidade."})}
});
app.patch("/api/admin/units/:id",auth(),roles("ADMIN"),async(req,res)=>{
 try{
  const d=z.object({name:z.string().trim().min(3).max(120).optional(),address:z.string().trim().min(5).max(240).optional(),phone:z.string().trim().max(30).optional(),municipality:z.string().trim().min(2).max(120).optional(),coverageArea:z.string().trim().max(240).optional(),latitude:z.number().min(-90).max(90).nullable().optional(),longitude:z.number().min(-180).max(180).nullable().optional(),active:z.boolean().optional()}).refine(v=>Object.keys(v).length>0).parse(req.body);
  const unit=await prisma.$transaction(async tx=>{
   const updated=await tx.healthUnit.update({where:{id:req.params.id},data:d});
   if(d.active===false)await tx.scheduleSlot.updateMany({where:{healthUnitId:updated.id,isOpen:true,startsAt:{gt:new Date()}},data:{isOpen:false}});
   return updated;
  });
  await log(req.user.id,d.active===undefined?"HEALTH_UNIT_UPDATED":d.active?"HEALTH_UNIT_ACTIVATED":"HEALTH_UNIT_DEACTIVATED","HealthUnit",unit.id);
  res.json({unit});
 }catch(e){res.status(e.code==="P2025"?404:e.code==="P2002"?409:400).json({error:e.code==="P2025"?"Unidade não encontrada.":e.code==="P2002"?"Já existe uma unidade com esse nome.":e.errors?.[0]?.message||"Não foi possível atualizar a unidade."})}
});
app.post("/api/admin/units/:id/doctors",auth(),roles("ADMIN"),async(req,res)=>{
 try{
  const {doctorId}=z.object({doctorId:z.string().uuid()}).parse(req.body);
  const [unit,doctor]=await Promise.all([
   prisma.healthUnit.findUnique({where:{id:req.params.id}}),
   prisma.user.findFirst({where:{id:doctorId,role:"DOCTOR",active:true}})
  ]);
  if(!unit)return res.status(404).json({error:"Unidade não encontrada."});
  if(!doctor)return res.status(404).json({error:"Médico não encontrado ou inativo."});
  const assignment=await prisma.healthUnitDoctor.upsert({where:{healthUnitId_doctorId:{healthUnitId:unit.id,doctorId:doctor.id}},create:{healthUnitId:unit.id,doctorId:doctor.id},update:{}});
  await log(req.user.id,"HEALTH_UNIT_DOCTOR_ASSIGNED","HealthUnitDoctor",assignment.id);
  res.status(201).json({assignment,message:"Profissional vinculado à unidade."});
 }catch(e){res.status(400).json({error:e.errors?.[0]?.message||"Não foi possível vincular o profissional."})}
});
app.delete("/api/admin/units/:id/doctors/:doctorId",auth(),roles("ADMIN"),async(req,res)=>{
 const result=await prisma.$transaction(async tx=>{const removed=await tx.healthUnitDoctor.deleteMany({where:{healthUnitId:req.params.id,doctorId:req.params.doctorId}});if(removed.count)await tx.scheduleSlot.updateMany({where:{healthUnitId:req.params.id,doctorId:req.params.doctorId,isOpen:true},data:{isOpen:false}});return removed;});
 if(!result.count)return res.status(404).json({error:"Vínculo não encontrado."});
 await log(req.user.id,"HEALTH_UNIT_DOCTOR_UNASSIGNED","HealthUnitDoctor",req.params.id+":"+req.params.doctorId);
 res.json({message:"Vínculo removido."});
});
app.get("/api/admin/staff",auth(),roles("ADMIN"),async(q,s)=>{
 const staff=await prisma.user.findMany({where:{role:{in:["DOCTOR","NURSE","ADMIN"]}},select:{id:true,name:true,email:true,role:true,active:true,twoFactorOn:true,doctorSpecialties:{select:{name:true,isPrimary:true},orderBy:{isPrimary:"desc"}}},orderBy:{name:"asc"}});
 s.json({staff});
});
app.patch("/api/admin/staff/:id/specialties",auth(),roles("ADMIN"),async(req,res)=>{
 try{
  const d=z.object({specialties:z.array(z.string().trim().min(2).max(80)).max(12)}).parse(req.body);
  const names=[...new Set(d.specialties.map(x=>x.trim()).filter(Boolean))];
  if(!names.length)return res.status(400).json({error:"Informe ao menos uma especialidade para o médico."});
  const doctor=await prisma.user.findFirst({where:{id:req.params.id,role:"DOCTOR"}});
  if(!doctor)return res.status(404).json({error:"Médico não encontrado."});
  await prisma.$transaction(async tx=>{
   await tx.doctorSpecialty.deleteMany({where:{doctorId:doctor.id}});
   await tx.doctorSpecialty.createMany({data:names.map((name,index)=>({doctorId:doctor.id,name,isPrimary:index===0}))});
  });
  await log(req.user.id,"DOCTOR_SPECIALTIES_UPDATED","User",doctor.id);
  res.json({message:"Especialidades atualizadas.",specialties:names.map((name,index)=>({name,isPrimary:index===0}))});
 }catch(e){res.status(400).json({error:e.errors?.[0]?.message||"Não foi possível atualizar as especialidades."})}
});
app.patch("/api/admin/staff/:id/status",auth(),roles("ADMIN"),async(req,res)=>{
 try{
  const {active}=z.object({active:z.boolean()}).parse(req.body);
  const staff=await prisma.user.findUnique({where:{id:req.params.id}});
  if(!staff||!["DOCTOR","NURSE"].includes(staff.role))return res.status(404).json({error:"Profissional não encontrado."});
  if(staff.id===req.user.id)return res.status(400).json({error:"Não é permitido desativar a própria conta por esta função."});
  await prisma.$transaction(async tx=>{
   await tx.user.update({where:{id:staff.id},data:{active}});
   if(!active&&staff.role==="DOCTOR")await tx.scheduleSlot.updateMany({where:{doctorId:staff.id,isOpen:true,startsAt:{gt:new Date()}},data:{isOpen:false}});
  });
  await log(req.user.id,active?"STAFF_REACTIVATED":"STAFF_DEACTIVATED","User",staff.id);
  res.json({message:active?"Profissional reativado. Revise e publique novos horários quando estiver pronto.":"Profissional desativado. Novos agendamentos foram bloqueados; consultas existentes e histórico foram preservados."});
 }catch(e){res.status(400).json({error:e.errors?.[0]?.message||"Não foi possível alterar a situação do profissional."})}
});
app.post("/api/admin/staff",auth(),roles("ADMIN"),async(req,res)=>{
 try{
  const d=z.object({name:z.string().trim().min(3).max(100),email:z.string().email(),cpf:cpfSchema,phone:z.string().min(10).max(20),password:z.string().min(12).max(72),role:z.enum(["DOCTOR","NURSE"]),specialties:z.array(z.string().trim().min(2).max(80)).max(12).optional().default([])}).parse(req.body);
  const specialties=[...new Set(d.specialties.map(x=>x.trim()).filter(Boolean))];
  if(d.role==="DOCTOR"&&!specialties.length)return res.status(400).json({error:"Informe ao menos uma especialidade para o médico."});
  const email=d.email.toLowerCase();
  if(await prisma.user.findFirst({where:{OR:[{email},{cpf:d.cpf}]}}))return res.status(409).json({error:"E-mail ou CPF já cadastrado."});
  const u=await prisma.$transaction(async tx=>{
   const created=await tx.user.create({data:{name:d.name,email,cpf:d.cpf,phone:d.phone,passwordHash:await bcrypt.hash(d.password,12),role:d.role}});
   if(d.role==="DOCTOR")await tx.doctorSpecialty.createMany({data:specialties.map((name,index)=>({doctorId:created.id,name,isPrimary:index===0}))});
   return created;
  });
  await log(req.user.id,"STAFF_CREATED","User",u.id);
  res.status(201).json({staff:{id:u.id,name:u.name,email:u.email,role:u.role,twoFactorOn:false},message:"Profissional cadastrado. Configure o 2FA antes de liberar o acesso."});
 }catch(e){res.status(400).json({error:e.errors?.[0]?.message||"Não foi possível cadastrar o profissional."})}
});
app.get("/api/appointments",auth(),roles("PATIENT","DOCTOR","ADMIN"),async(req,res)=>{const where=req.user.role==="PATIENT"?{patientId:req.user.id}:req.user.role==="DOCTOR"?{doctorId:req.user.id}:{};const rows=await prisma.appointment.findMany({where,include:{patient:{select:{id:true,name:true,cpf:true,susCard:true,phone:true}},doctor:{select:{name:true}},periodSchedule:{select:{id:true,period:true,startsAt:true,endsAt:true,healthUnitId:true,doctorId:true}}},orderBy:{startsAt:"asc"}});res.json({appointments:rows.map(a=>({id:a.id,startsAt:a.startsAt,specialty:a.specialty,unit:a.unit,status:a.status,doctor:a.doctor.name,periodSchedule:a.periodSchedule?{id:a.periodSchedule.id,period:a.periodSchedule.period,startsAt:a.periodSchedule.startsAt,endsAt:a.periodSchedule.endsAt,healthUnitId:a.periodSchedule.healthUnitId,doctorId:a.periodSchedule.doctorId}:null,patient:req.user.role==="PATIENT"?undefined:{id:a.patient.id,name:a.patient.name,cpf:cpfMask(a.patient.cpf),susCard:susMask(a.patient.susCard),phone:a.patient.phone}}))})});
app.post("/api/appointments",auth(),roles("PATIENT"),async(req,res)=>{
 try{
  const d=z.object({periodScheduleId:z.string().uuid().optional(),slotId:z.string().uuid().optional()}).refine(v=>Boolean(v.periodScheduleId||v.slotId),"Selecione um período.");
  const input=d.parse(req.body);
  const a=await prisma.$transaction(async tx=>{
   if(input.periodScheduleId){
    await tx.$queryRaw`SELECT "id" FROM "DoctorPeriodSchedule" WHERE "id" = ${input.periodScheduleId} FOR UPDATE`;
    const schedule=await tx.doctorPeriodSchedule.findUnique({where:{id:input.periodScheduleId},include:{appointments:{where:{status:"SCHEDULED"},select:{id:true}}}});
    if(!schedule||!schedule.active||schedule.startsAt<=new Date()||schedule.appointments.length>=schedule.capacity)throw Object.assign(new Error("Este período não está mais disponível."),{status:409});
    const unit=await tx.healthUnit.findUnique({where:{id:schedule.healthUnitId}});
    return tx.appointment.create({data:{patientId:req.user.id,doctorId:schedule.doctorId,startsAt:schedule.startsAt,specialty:schedule.specialty,unit:unit.name,periodScheduleId:schedule.id}});
   }
   const slot=await tx.scheduleSlot.findFirst({where:{id:input.slotId,isOpen:true,startsAt:{gt:new Date()}}});
   if(!slot)throw Object.assign(new Error("Este horário não está mais disponível."),{status:409});
   const claimed=await tx.scheduleSlot.updateMany({where:{id:slot.id,isOpen:true},data:{isOpen:false}});
   if(claimed.count!==1)throw Object.assign(new Error("Este horário acabou de ser reservado."),{status:409});
   return tx.appointment.create({data:{patientId:req.user.id,doctorId:slot.doctorId,startsAt:slot.startsAt,specialty:slot.specialty,unit:slot.unit,slotId:slot.id}});
  });
  await log(req.user.id,"APPOINTMENT_CREATED","Appointment",a.id);
  res.status(201).json({appointment:a});
 }catch(e){res.status(e.status||(e.code==="P2002"?409:400)).json({error:e.message||"Não foi possível agendar."})}
});
app.patch("/api/appointments/:id/cancel",auth(),roles("PATIENT","ADMIN"),async(req,res)=>{const a=await prisma.appointment.findUnique({where:{id:req.params.id}});if(!a)return res.status(404).json({error:"Agendamento não encontrado."});if(req.user.role==="PATIENT"&&a.patientId!==req.user.id)return res.status(403).json({error:"Você não pode alterar este agendamento."});if(!["PATIENT","ADMIN"].includes(req.user.role))return res.status(403).json({error:"Ação não permitida."});if(a.status!=="SCHEDULED")return res.status(409).json({error:"Agendamento não está ativo."});const updated=await prisma.$transaction(async tx=>{const item=await tx.appointment.update({where:{id:a.id},data:{status:"CANCELLED",cancelledAt:new Date()}});if(item.slotId)await tx.scheduleSlot.update({where:{id:item.slotId},data:{isOpen:true}});return item});await log(req.user.id,"APPOINTMENT_CANCELLED","Appointment",a.id);res.json({appointment:updated})});
app.get("/api/vaccines",async(q,s)=>{
 const now=new Date();
 await prisma.immunizationEvent.updateMany({where:{active:true,endsAt:{lt:now},archivedAt:null},data:{active:false,archivedAt:now}});
 const [vaccines,calendar]=await Promise.all([prisma.vaccine.findMany({where:{active:true},orderBy:{name:"asc"}}),prisma.immunizationEvent.findMany({where:{active:true,OR:[{endsAt:null},{endsAt:{gte:now}}]},orderBy:{startsAt:"asc"}})]);
 s.json({vaccines,calendar});
});
app.get("/api/admin/vaccines",auth(),roles("NURSE","ADMIN"),async(req,res)=>{const vaccines=await prisma.vaccine.findMany({orderBy:{updatedAt:"desc"}});res.json({vaccines})});
app.post("/api/vaccines",auth(),roles("NURSE","ADMIN"),async(req,res)=>{try{const d=z.object({name:z.string().min(2).max(120),description:z.string().min(5).max(1000),targetGroup:z.string().min(2).max(240),doses:z.string().min(1).max(120),imageData:imageSchema}).parse(req.body);const v=await prisma.vaccine.create({data:d});await log(req.user.id,"VACCINE_CREATED","Vaccine",v.id);res.status(201).json({vaccine:v})}catch(e){res.status(400).json({error:e.errors?.[0]?.message||"Dados inválidos."})}});
app.patch("/api/vaccines/:id",auth(),roles("NURSE","ADMIN"),async(req,res)=>{try{const d=z.object({name:z.string().min(2).max(120).optional(),description:z.string().min(5).max(1000).optional(),targetGroup:z.string().min(2).max(240).optional(),doses:z.string().min(1).max(120).optional(),imageData:imageSchema,active:z.boolean().optional()}).parse(req.body);const v=await prisma.vaccine.update({where:{id:req.params.id},data:d});await log(req.user.id,"VACCINE_UPDATED","Vaccine",v.id);res.json({vaccine:v})}catch(e){res.status(e.code==="P2025"?404:400).json({error:e.errors?.[0]?.message||"Não foi possível atualizar a vacina."})}});
app.get("/api/admin/immunization-events",auth(),roles("NURSE","ADMIN"),async(req,res)=>{const now=new Date();await prisma.immunizationEvent.updateMany({where:{active:true,endsAt:{lt:now},archivedAt:null},data:{active:false,archivedAt:now}});const events=await prisma.immunizationEvent.findMany({orderBy:{createdAt:"desc"},include:{editions:{select:{id:true,title:true,startsAt:true,endsAt:true,active:true}}}});res.json({events})});
app.post("/api/immunization-events",auth(),roles("NURSE","ADMIN"),async(req,res)=>{
 try{const d=z.object({title:z.string().min(3).max(120),description:z.string().min(5).max(1000),startsAt:z.string().datetime(),endsAt:z.string().datetime(),unit:z.string().min(2).max(120),imageData:imageSchema,parentCampaignId:z.string().uuid().optional()}).parse(req.body);const start=new Date(d.startsAt),end=new Date(d.endsAt);if(end<start)return res.status(400).json({error:"A data final deve ser posterior à inicial."});const event=await prisma.immunizationEvent.create({data:{...d,startsAt:start,endsAt:end}});await log(req.user.id,"IMMUNIZATION_EVENT_CREATED","ImmunizationEvent",event.id);res.status(201).json({event})}catch(e){res.status(400).json({error:e.errors?.[0]?.message||"Não foi possível cadastrar a campanha."})}
});
app.patch("/api/immunization-events/:id",auth(),roles("NURSE","ADMIN"),async(req,res)=>{try{const d=z.object({title:z.string().min(3).max(120).optional(),description:z.string().min(5).max(1000).optional(),startsAt:z.string().datetime().optional(),endsAt:z.string().datetime().optional(),unit:z.string().min(2).max(120).optional(),imageData:imageSchema,active:z.boolean().optional()}).parse(req.body);const data={...d};if(d.startsAt)data.startsAt=new Date(d.startsAt);if(d.endsAt)data.endsAt=new Date(d.endsAt);const event=await prisma.immunizationEvent.update({where:{id:req.params.id},data});await log(req.user.id,"IMMUNIZATION_EVENT_UPDATED","ImmunizationEvent",event.id);res.json({event})}catch(e){res.status(e.code==="P2025"?404:400).json({error:e.errors?.[0]?.message||"Não foi possível atualizar a campanha."})}});
app.post("/api/immunization-events/:id/reuse",auth(),roles("NURSE","ADMIN"),async(req,res)=>{try{const old=await prisma.immunizationEvent.findUnique({where:{id:req.params.id}});if(!old)return res.status(404).json({error:"Campanha anterior não encontrada."});const d=z.object({title:z.string().min(3).max(120).optional(),description:z.string().min(5).max(1000).optional(),startsAt:z.string().datetime(),endsAt:z.string().datetime(),unit:z.string().min(2).max(120).optional(),imageData:imageSchema}).parse(req.body);const start=new Date(d.startsAt),end=new Date(d.endsAt);if(end<start)return res.status(400).json({error:"A data final deve ser posterior à inicial."});const event=await prisma.immunizationEvent.create({data:{title:d.title||old.title,description:d.description||old.description,startsAt:start,endsAt:end,unit:d.unit||old.unit,imageData:d.imageData===undefined?old.imageData:d.imageData,parentCampaignId:old.parentCampaignId||old.id}});await log(req.user.id,"IMMUNIZATION_EVENT_REUSED","ImmunizationEvent",event.id);res.status(201).json({event,message:"Nova edição criada a partir da campanha anterior."})}catch(e){res.status(400).json({error:e.errors?.[0]?.message||"Não foi possível reutilizar a campanha."})}});
app.get("/api/staff/patients",auth(),roles("DOCTOR","ADMIN"),async(req,res)=>{
 let patientIds;
 if(req.user.role==="DOCTOR"){
  const assigned=await prisma.appointment.findMany({where:{doctorId:req.user.id},select:{patientId:true},distinct:["patientId"]});
  patientIds=assigned.map(x=>x.patientId);
 }
 const p=await prisma.user.findMany({where:{role:"PATIENT",active:true,...(patientIds?{id:{in:patientIds}}:{})},select:{id:true,name:true,cpf:true,susCard:true,phone:true}});
 res.json({patients:p.map(x=>({...x,cpf:cpfMask(x.cpf),susCard:susMask(x.susCard)}))});
});
app.use((e,q,s,n)=>{console.error(e);s.status(500).json({error:"Erro interno. Tente novamente mais tarde."})});
if (require.main === module) {
  app.listen(PORT, () => {
    console.log("Plataforma de Saúde na porta " + PORT);
  });
}

module.exports = app;
process.on("beforeExit",()=>prisma.$disconnect());