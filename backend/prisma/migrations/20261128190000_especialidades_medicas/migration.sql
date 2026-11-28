-- Especialidades múltiplas por médico, sem duplicar contas ou alterar consultas existentes.
CREATE TABLE "DoctorSpecialty" (
  "id" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DoctorSpecialty_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DoctorSpecialty_doctorId_name_key" ON "DoctorSpecialty"("doctorId", "name");
CREATE INDEX "DoctorSpecialty_name_idx" ON "DoctorSpecialty"("name");
ALTER TABLE "DoctorSpecialty" ADD CONSTRAINT "DoctorSpecialty_doctorId_fkey"
  FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
