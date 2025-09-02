-- CreateTable for parts identification history
CREATE TABLE "PartIdentification" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT,
    "imageHash" TEXT NOT NULL,
    "identifiedPartNumber" TEXT,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "identificationData" JSONB NOT NULL,
    "extractionData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartIdentification_pkey" PRIMARY KEY ("id")
);

-- CreateTable for parts catalog
CREATE TABLE "PartsCatalog" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "partNumber" TEXT NOT NULL,
    "manufacturer" TEXT,
    "type" TEXT,
    "description" TEXT,
    "specifications" JSONB,
    "visualFeatures" JSONB,
    "commonApplications" TEXT[],
    "crossReferences" TEXT[],
    "imageUrls" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartsCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for fast lookups
CREATE INDEX "PartIdentification_imageHash_idx" ON "PartIdentification"("imageHash");
CREATE INDEX "PartIdentification_identifiedPartNumber_idx" ON "PartIdentification"("identifiedPartNumber");
CREATE INDEX "PartIdentification_createdAt_idx" ON "PartIdentification"("createdAt");

CREATE UNIQUE INDEX "PartsCatalog_partNumber_key" ON "PartsCatalog"("partNumber");
CREATE INDEX "PartsCatalog_manufacturer_idx" ON "PartsCatalog"("manufacturer");
CREATE INDEX "PartsCatalog_type_idx" ON "PartsCatalog"("type");
CREATE INDEX "PartsCatalog_specifications_idx" ON "PartsCatalog" USING GIN ("specifications");