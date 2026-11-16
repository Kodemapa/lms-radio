-- AlterTable
ALTER TABLE "QuizQuestion" ADD COLUMN     "atSec" INTEGER;

-- CreateTable
CREATE TABLE "CheckpointAnswer" (
    "userId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "lessonId" UUID NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "passedAt" TIMESTAMP(3),

    CONSTRAINT "CheckpointAnswer_pkey" PRIMARY KEY ("userId","questionId")
);

-- CreateIndex
CREATE INDEX "CheckpointAnswer_userId_lessonId_idx" ON "CheckpointAnswer"("userId", "lessonId");

-- AddForeignKey
ALTER TABLE "CheckpointAnswer" ADD CONSTRAINT "CheckpointAnswer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckpointAnswer" ADD CONSTRAINT "CheckpointAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
