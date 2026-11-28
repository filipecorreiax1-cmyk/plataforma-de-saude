-- Agenda por período: mantém os horários e consultas antigos intactos.
CREATE TABLE "DoctorPeriodSchedule" (
  "id" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "healthUnitId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "period" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "specialty" TEXT NOT NULL,
  "capacity" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DoctorPeriodSchedule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DoctorPeriodSchedule_capacity_check" CHECK ("capacity" > 0),
  CONSTRAINT "DoctorPeriodSchedule_period_check" CHECK ("period" IN ('MORNING','AFTERNOON','EVENING'))
);
CREATE UNIQUE INDEX "DoctorPeriodSchedule_doctorId_healthUnitId_date_period_key"
  ON "DoctorPeriodSchedule"("doctorId","healthUnitId","date","period");
CREATE INDEX "DoctorPeriodSchedule_healthUnitId_date_period_active_idx"
  ON "DoctorPeriodSchedule"("healthUnitId","date","period","active");
CREATE INDEX "DoctorPeriodSchedule_doctorId_date_active_idx"
  ON "DoctorPeriodSchedule"("doctorId","date","active");
ALTER TABLE "DoctorPeriodSchedule" ADD CONSTRAINT "DoctorPeriodSchedule_doctorId_fkey"
  FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DoctorPeriodSchedule" ADD CONSTRAINT "DoctorPeriodSchedule_healthUnitId_fkey"
  FOREIGN KEY ("healthUnitId") REFERENCES "HealthUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Appointment" ADD COLUMN "periodScheduleId" TEXT;
CREATE INDEX "Appointment_periodScheduleId_status_idx" ON "Appointment"("periodScheduleId","status");
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_periodScheduleId_fkey"
  FOREIGN KEY ("periodScheduleId") REFERENCES "DoctorPeriodSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- Removemos somente a unicidade de médico + instante, necessária para vários pacientes no mesmo período.
DROP INDEX IF EXISTS "Appointment_doctorId_startsAt_key";
CREATE INDEX IF NOT EXISTS "Appointment_doctorId_startsAt_idx" ON "Appointment"("doctorId","startsAt");

ALTER TABLE "Vaccine" ADD COLUMN "imageData" TEXT;
ALTER TABLE "ImmunizationEvent" ADD COLUMN "imageData" TEXT;
ALTER TABLE "ImmunizationEvent" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ImmunizationEvent" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "ImmunizationEvent" ADD COLUMN "parentCampaignId" TEXT;
ALTER TABLE "ImmunizationEvent" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX "ImmunizationEvent_startsAt_endsAt_active_idx" ON "ImmunizationEvent"("startsAt","endsAt","active");
CREATE INDEX "ImmunizationEvent_parentCampaignId_idx" ON "ImmunizationEvent"("parentCampaignId");
ALTER TABLE "ImmunizationEvent" ADD CONSTRAINT "ImmunizationEvent_parentCampaignId_fkey"
  FOREIGN KEY ("parentCampaignId") REFERENCES "ImmunizationEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
