-- CreateEnum
CREATE TYPE "WorkingStatus" AS ENUM ('PENDING', 'VERIFIED', 'RETURNED');

-- AlterTable
ALTER TABLE "ImagingAttempt" ADD COLUMN     "explanation" TEXT,
ADD COLUMN     "workingAssetIds" UUID[] DEFAULT ARRAY[]::UUID[],
ADD COLUMN     "workingFeedback" TEXT,
ADD COLUMN     "workingReviewedAt" TIMESTAMP(3),
ADD COLUMN     "workingReviewedById" UUID,
ADD COLUMN     "workingStatus" "WorkingStatus";

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "resources" JSONB NOT NULL DEFAULT '[]';

-- CreateIndex
CREATE INDEX "ImagingAttempt_workingAssetIds_idx" ON "ImagingAttempt" USING GIN ("workingAssetIds");

-- AddForeignKey
ALTER TABLE "ImagingAttempt" ADD CONSTRAINT "ImagingAttempt_workingReviewedById_fkey" FOREIGN KEY ("workingReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

