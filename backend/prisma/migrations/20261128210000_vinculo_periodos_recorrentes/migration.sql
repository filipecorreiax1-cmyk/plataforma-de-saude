ALTER TABLE "DoctorPeriodSchedule" ADD COLUMN "recurringPeriodId" TEXT;
CREATE INDEX "DoctorPeriodSchedule_recurringPeriodId_idx" ON "DoctorPeriodSchedule"("recurringPeriodId");
ALTER TABLE "DoctorPeriodSchedule" ADD CONSTRAINT "DoctorPeriodSchedule_recurringPeriodId_fkey" FOREIGN KEY ("recurringPeriodId") REFERENCES "DoctorRecurringPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
