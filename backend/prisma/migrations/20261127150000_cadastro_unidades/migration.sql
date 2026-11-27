-- Cadastro inicial de unidades de saúde gerenciado pelo ADM
CREATE TABLE "HealthUnit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT,
    "municipality" TEXT NOT NULL,
    "coverageArea" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HealthUnit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HealthUnit_name_key" ON "HealthUnit"("name");
CREATE INDEX "HealthUnit_municipality_active_idx" ON "HealthUnit"("municipality", "active");
