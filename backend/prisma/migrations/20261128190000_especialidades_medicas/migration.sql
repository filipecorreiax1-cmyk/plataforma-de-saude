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

-- Aproveita especialidades já usadas em agendas e consultas antigas, sem alterar o histórico.
WITH existing_specialties AS (
  SELECT "doctorId", "specialty" AS name FROM "DoctorPeriodSchedule"
  UNION
  SELECT "doctorId", "specialty" AS name FROM "ScheduleSlot"
  UNION
  SELECT "doctorId", "specialty" AS name FROM "Appointment"
), ranked AS (
  SELECT "doctorId", name, ROW_NUMBER() OVER (PARTITION BY "doctorId" ORDER BY name) AS position
  FROM existing_specialties
  WHERE name IS NOT NULL AND BTRIM(name) <> ''
)
INSERT INTO "DoctorSpecialty" ("id", "doctorId", "name", "isPrimary")
SELECT gen_random_uuid()::text, ranked."doctorId", ranked.name, ranked.position = 1
FROM ranked
JOIN "User" ON "User"."id" = ranked."doctorId" AND "User"."role" = 'DOCTOR'
ON CONFLICT ("doctorId", "name") DO NOTHING;
