-- CreateEnum
CREATE TYPE "DrmPackageStatus" AS ENUM ('QUEUED', 'PACKAGING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "DrmPackage" (
    "assetId" UUID NOT NULL,
    "status" "DrmPackageStatus" NOT NULL DEFAULT 'QUEUED',
    "scheme" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "keyCiphertext" TEXT NOT NULL,
    "storagePrefix" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "packagedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrmPackage_pkey" PRIMARY KEY ("assetId")
);

-- CreateIndex
CREATE UNIQUE INDEX "DrmPackage_keyId_key" ON "DrmPackage"("keyId");

-- AddForeignKey
ALTER TABLE "DrmPackage" ADD CONSTRAINT "DrmPackage_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
