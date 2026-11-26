-- CreateEnum
CREATE TYPE "ExamReviewStatus" AS ENUM ('PENDING', 'CLEARED', 'FLAGGED');

-- AlterEnum
ALTER TYPE "ProctorEventKind" ADD VALUE 'WARNING_DISPUTED';
ALTER TYPE "ProctorEventKind" ADD VALUE 'NOTICE';
ALTER TYPE "ProctorEventKind" ADD VALUE 'NO_FACE';
ALTER TYPE "ProctorEventKind" ADD VALUE 'MULTIPLE_FACES';
ALTER TYPE "ProctorEventKind" ADD VALUE 'LOOKING_AWAY';
ALTER TYPE "ProctorEventKind" ADD VALUE 'PROHIBITED_OBJECT';
ALTER TYPE "ProctorEventKind" ADD VALUE 'VOICE_DETECTED';
ALTER TYPE "ProctorEventKind" ADD VALUE 'SECOND_SCREEN';
ALTER TYPE "ProctorEventKind" ADD VALUE 'REVIEWED';

-- AlterTable
ALTER TABLE "ExamSession" ADD COLUMN     "answeredCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewStatus" "ExamReviewStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" UUID;

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "examAiMonitoring" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "examAutoWarn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "examMaxWarnings" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ProctorEvent" ADD COLUMN     "snapshotKey" TEXT;

