-- CreateEnum
CREATE TYPE "ExamSessionStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'TERMINATED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ProctorEventKind" AS ENUM ('STARTED', 'RESUMED', 'CAMERA_ON', 'CAMERA_OFF', 'TAB_HIDDEN', 'TAB_VISIBLE', 'WINDOW_BLUR', 'FULLSCREEN_EXIT', 'FULLSCREEN_ENTER', 'COPY_PASTE', 'CONNECTION_LOST', 'WARNING', 'TERMINATED', 'SUBMITTED', 'EXPIRED');

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "examClosesAt" TIMESTAMP(3),
ADD COLUMN     "examDurationMin" INTEGER,
ADD COLUMN     "examMode" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "examOpensAt" TIMESTAMP(3),
ADD COLUMN     "examProctored" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ExamSession" (
    "id" UUID NOT NULL,
    "lessonId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "ExamSessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "terminatedReason" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "cameraOn" BOOLEAN NOT NULL DEFAULT false,
    "fullscreen" BOOLEAN NOT NULL DEFAULT false,
    "tabVisible" BOOLEAN NOT NULL DEFAULT true,
    "streamEpoch" TEXT,
    "quizAttemptId" UUID,

    CONSTRAINT "ExamSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProctorEvent" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "kind" "ProctorEventKind" NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "actorId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProctorEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExamSession_lessonId_status_idx" ON "ExamSession"("lessonId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ExamSession_userId_lessonId_key" ON "ExamSession"("userId", "lessonId");

-- CreateIndex
CREATE INDEX "ProctorEvent_sessionId_createdAt_idx" ON "ProctorEvent"("sessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "ExamSession" ADD CONSTRAINT "ExamSession_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSession" ADD CONSTRAINT "ExamSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProctorEvent" ADD CONSTRAINT "ProctorEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExamSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

