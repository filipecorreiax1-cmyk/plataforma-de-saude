CREATE TABLE "DoctorRecurringPeriod" (
  "id" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "healthUnitId" TEXT NOT NULL,
  "weekdays" INTEGER[] NOT NULL,
  "validFrom" DATE NOT NULL,
  "validUntil" DATE,
  "period" TEXT NOT NULL,
  "startsAtTime" TEXT NOT NULL,
  "endsAtTime" TEXT NOT NULL,
  "specialty" TEXT NOT NULL,
  "capacity" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DoctorRecurringPeriod_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DoctorRecurringPeriod_healthUnitId_active_validFrom_idx" ON "DoctorRecurringPeriod"("healthUnitId","active","validFrom");
CREATE INDEX "DoctorRecurringPeriod_doctorId_active_idx" ON "DoctorRecurringPeriod"("doctorId","active");
ALTER TABLE "DoctorRecurringPeriod" ADD CONSTRAINT "DoctorRecurringPeriod_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DoctorRecurringPeriod" ADD CONSTRAINT "DoctorRecurringPeriod_healthUnitId_fkey" FOREIGN KEY ("healthUnitId") REFERENCES "HealthUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
