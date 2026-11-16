-- AlterEnum
ALTER TYPE "LessonKind" ADD VALUE 'IMAGING';

-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "dicomMeta" JSONB;

-- CreateTable
CREATE TABLE "ImagingCase" (
    "lessonId" UUID NOT NULL,
    "instructions" TEXT NOT NULL DEFAULT '',
    "key" JSONB NOT NULL,
    "referenceSrAssetId" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImagingCase_pkey" PRIMARY KEY ("lessonId")
);

-- CreateTable
CREATE TABLE "ImagingImage" (
    "id" UUID NOT NULL,
    "lessonId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "ImagingImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImagingAttempt" (
    "id" UUID NOT NULL,
    "lessonId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "srAssetId" UUID NOT NULL,
    "scorePercent" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImagingAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImagingImage_lessonId_assetId_key" ON "ImagingImage"("lessonId", "assetId");

-- CreateIndex
CREATE INDEX "ImagingAttempt_userId_lessonId_createdAt_idx" ON "ImagingAttempt"("userId", "lessonId", "createdAt");

-- AddForeignKey
ALTER TABLE "ImagingCase" ADD CONSTRAINT "ImagingCase_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImagingCase" ADD CONSTRAINT "ImagingCase_referenceSrAssetId_fkey" FOREIGN KEY ("referenceSrAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImagingImage" ADD CONSTRAINT "ImagingImage_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImagingImage" ADD CONSTRAINT "ImagingImage_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImagingAttempt" ADD CONSTRAINT "ImagingAttempt_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImagingAttempt" ADD CONSTRAINT "ImagingAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImagingAttempt" ADD CONSTRAINT "ImagingAttempt_srAssetId_fkey" FOREIGN KEY ("srAssetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
