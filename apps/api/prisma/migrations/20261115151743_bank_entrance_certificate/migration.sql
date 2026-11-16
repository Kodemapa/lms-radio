-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "entranceMaxAttempts" INTEGER,
ADD COLUMN     "entrancePassPercent" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "entranceQuestionCount" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "entranceTestEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "entranceTopic" TEXT;

-- AlterTable
ALTER TABLE "QuizQuestion" ADD COLUMN     "bankQuestionId" UUID;

-- CreateTable
CREATE TABLE "BankQuestion" (
    "id" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "topic" TEXT,
    "text" TEXT NOT NULL,
    "explanation" TEXT,
    "allowMultiple" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntranceAttempt" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "paper" JSONB NOT NULL,
    "answers" JSONB,
    "scorePercent" INTEGER,
    "passed" BOOLEAN,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),

    CONSTRAINT "EntranceAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertificateTemplate" (
    "courseId" UUID NOT NULL,
    "heading" TEXT NOT NULL DEFAULT 'Certificate of Completion',
    "preamble" TEXT NOT NULL DEFAULT 'This is to certify that',
    "body" TEXT NOT NULL DEFAULT 'has successfully completed the course',
    "issuerName" TEXT,
    "issuerTagline" TEXT,
    "logoAssetId" UUID,
    "accentColor" TEXT NOT NULL DEFAULT '#5a5bb5',
    "signatories" JSONB NOT NULL DEFAULT '[]',
    "footerNote" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertificateTemplate_pkey" PRIMARY KEY ("courseId")
);

-- CreateIndex
CREATE INDEX "BankQuestion_courseId_topic_idx" ON "BankQuestion"("courseId", "topic");

-- CreateIndex
CREATE INDEX "EntranceAttempt_userId_courseId_startedAt_idx" ON "EntranceAttempt"("userId", "courseId", "startedAt");

-- AddForeignKey
ALTER TABLE "BankQuestion" ADD CONSTRAINT "BankQuestion_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntranceAttempt" ADD CONSTRAINT "EntranceAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntranceAttempt" ADD CONSTRAINT "EntranceAttempt_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificateTemplate" ADD CONSTRAINT "CertificateTemplate_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
