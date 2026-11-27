-- Relaciona médicos, unidades e horários sem apagar agendas antigas.
ALTER TABLE "ScheduleSlot" ADD COLUMN "healthUnitId" TEXT;
CREATE INDEX "ScheduleSlot_healthUnitId_startsAt_isOpen_idx" ON "ScheduleSlot"("healthUnitId", "startsAt", "isOpen");
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_healthUnitId_fkey"
  FOREIGN KEY ("healthUnitId") REFERENCES "HealthUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "HealthUnitDoctor" (
  "id" TEXT NOT NULL,
  "healthUnitId" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HealthUnitDoctor_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HealthUnitDoctor_healthUnitId_doctorId_key" ON "HealthUnitDoctor"("healthUnitId", "doctorId");
CREATE INDEX "HealthUnitDoctor_doctorId_idx" ON "HealthUnitDoctor"("doctorId");
ALTER TABLE "HealthUnitDoctor" ADD CONSTRAINT "HealthUnitDoctor_healthUnitId_fkey"
  FOREIGN KEY ("healthUnitId") REFERENCES "HealthUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HealthUnitDoctor" ADD CONSTRAINT "HealthUnitDoctor_doctorId_fkey"
  FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
