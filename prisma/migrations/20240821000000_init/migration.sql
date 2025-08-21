-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('ADMIN', 'MANAGER', 'USER', 'VIEWER');

-- CreateEnum
CREATE TYPE "public"."PartStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DISCONTINUED', 'OUT_OF_STOCK', 'PENDING');

-- CreateEnum
CREATE TYPE "public"."InventoryAction" AS ENUM ('ADD', 'REMOVE', 'ADJUST', 'TRANSFER', 'RETURN', 'DAMAGE', 'LOSS');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "role" "public"."Role" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "apiKey" TEXT,
    "refreshToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLogin" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Part" (
    "id" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "manufacturer" TEXT,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "cost" DECIMAL(10,2),
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "minQuantity" INTEGER NOT NULL DEFAULT 0,
    "location" TEXT,
    "barcode" TEXT,
    "sku" TEXT,
    "weight" DECIMAL(10,3),
    "dimensions" JSONB,
    "specifications" JSONB,
    "images" TEXT[],
    "tags" TEXT[],
    "status" "public"."PartStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InventoryLog" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "type" "public"."InventoryAction" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "previousQty" INTEGER NOT NULL,
    "newQty" INTEGER NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "performedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ApiKey" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT[],
    "expiresAt" TIMESTAMP(3),
    "lastUsed" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "public"."User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_apiKey_key" ON "public"."User"("apiKey");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "public"."User"("email");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "public"."User"("username");

-- CreateIndex
CREATE INDEX "User_apiKey_idx" ON "public"."User"("apiKey");

-- CreateIndex
CREATE UNIQUE INDEX "Part_partNumber_key" ON "public"."Part"("partNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Part_barcode_key" ON "public"."Part"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "Part_sku_key" ON "public"."Part"("sku");

-- CreateIndex
CREATE INDEX "Part_partNumber_idx" ON "public"."Part"("partNumber");

-- CreateIndex
CREATE INDEX "Part_name_idx" ON "public"."Part"("name");

-- CreateIndex
CREATE INDEX "Part_category_idx" ON "public"."Part"("category");

-- CreateIndex
CREATE INDEX "Part_status_idx" ON "public"."Part"("status");

-- CreateIndex
CREATE INDEX "Part_barcode_idx" ON "public"."Part"("barcode");

-- CreateIndex
CREATE INDEX "Part_sku_idx" ON "public"."Part"("sku");

-- CreateIndex
CREATE INDEX "InventoryLog_partId_idx" ON "public"."InventoryLog"("partId");

-- CreateIndex
CREATE INDEX "InventoryLog_type_idx" ON "public"."InventoryLog"("type");

-- CreateIndex
CREATE INDEX "InventoryLog_createdAt_idx" ON "public"."InventoryLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "public"."AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_idx" ON "public"."AuditLog"("entity");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "public"."AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_key_key" ON "public"."ApiKey"("key");

-- CreateIndex
CREATE INDEX "ApiKey_key_idx" ON "public"."ApiKey"("key");

-- CreateIndex
CREATE INDEX "ApiKey_isActive_idx" ON "public"."ApiKey"("isActive");

-- AddForeignKey
ALTER TABLE "public"."Part" ADD CONSTRAINT "Part_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InventoryLog" ADD CONSTRAINT "InventoryLog_partId_fkey" FOREIGN KEY ("partId") REFERENCES "public"."Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

