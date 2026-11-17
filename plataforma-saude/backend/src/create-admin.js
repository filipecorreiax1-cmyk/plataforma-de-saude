require("dotenv").config();
const {PrismaClient}=require("@prisma/client");
const bcrypt=require("bcryptjs");
const {cpfOk}=require("./validation");
const prisma=new PrismaClient();
(async()=>{
 const {ADMIN_NAME,ADMIN_EMAIL,ADMIN_CPF,ADMIN_PHONE,ADMIN_PASSWORD}=process.env;
 if(!ADMIN_NAME||!ADMIN_EMAIL||!ADMIN_CPF||!ADMIN_PHONE||!ADMIN_PASSWORD||ADMIN_PASSWORD.length<14)throw Error("Defina ADMIN_NAME, ADMIN_EMAIL, ADMIN_CPF, ADMIN_PHONE e ADMIN_PASSWORD (mínimo 14 caracteres) no .env.");
 if(!cpfOk(ADMIN_CPF))throw Error("ADMIN_CPF precisa ser um CPF válido.");
 const count=await prisma.user.count({where:{role:"ADMIN"}});
 if(count)throw Error("Já existe administrador cadastrado. Operação bloqueada.");
 await prisma.user.create({data:{name:ADMIN_NAME,email:ADMIN_EMAIL.toLowerCase(),cpf:ADMIN_CPF.replace(/\D/g,""),phone:ADMIN_PHONE,passwordHash:await bcrypt.hash(ADMIN_PASSWORD,12),role:"ADMIN"}});
 console.log("Administrador inicial criado. Apague as variáveis de bootstrap do ambiente após o uso.");
})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>prisma.$disconnect());