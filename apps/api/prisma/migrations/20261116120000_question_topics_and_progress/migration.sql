-- Question topics become first-class records (were free text on BankQuestion
-- and Course.entranceTopic). Existing topic names are carried over.

-- CreateTable
CREATE TABLE "QuestionTopic" (
    "id" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionTopic_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "QuestionTopic_courseId_position_idx" ON "QuestionTopic"("courseId", "position");
CREATE UNIQUE INDEX "QuestionTopic_courseId_name_key" ON "QuestionTopic"("courseId", "name");
ALTER TABLE "QuestionTopic" ADD CONSTRAINT "QuestionTopic_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- New columns
ALTER TABLE "BankQuestion" ADD COLUMN "topicId" UUID;
ALTER TABLE "QuizQuestion" ADD COLUMN "topicId" UUID;
ALTER TABLE "Course" ADD COLUMN "entranceTopicId" UUID;
ALTER TABLE "LessonProgress" ADD COLUMN "furthestSec" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "views" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "watchedSec" INTEGER NOT NULL DEFAULT 0;

-- Data: one topic per distinct (course, name), from the bank and the entrance setting.
INSERT INTO "QuestionTopic" ("id", "courseId", "name", "position")
SELECT gen_random_uuid(), "courseId", "name",
       ROW_NUMBER() OVER (PARTITION BY "courseId" ORDER BY "name")
FROM (
    SELECT DISTINCT "courseId", btrim("topic") AS "name" FROM "BankQuestion" WHERE btrim(coalesce("topic", '')) <> ''
    UNION
    SELECT "id", btrim("entranceTopic") FROM "Course" WHERE btrim(coalesce("entranceTopic", '')) <> ''
) AS names;

UPDATE "BankQuestion" b SET "topicId" = t."id"
FROM "QuestionTopic" t WHERE t."courseId" = b."courseId" AND t."name" = btrim(b."topic");

UPDATE "Course" c SET "entranceTopicId" = t."id"
FROM "QuestionTopic" t WHERE t."courseId" = c."id" AND t."name" = btrim(c."entranceTopic");

-- Quiz / in-video questions copied from the bank inherit the bank question's topic.
UPDATE "QuizQuestion" q SET "topicId" = b."topicId"
FROM "BankQuestion" b WHERE q."bankQuestionId" = b."id";

-- Furthest point reached so far is at least the saved resume position.
UPDATE "LessonProgress" SET "furthestSec" = "positionSec";

-- Drop the old free-text columns
DROP INDEX "BankQuestion_courseId_topic_idx";
ALTER TABLE "BankQuestion" DROP COLUMN "topic";
ALTER TABLE "Course" DROP COLUMN "entranceTopic";

CREATE INDEX "BankQuestion_courseId_topicId_idx" ON "BankQuestion"("courseId", "topicId");
CREATE INDEX "QuizQuestion_topicId_idx" ON "QuizQuestion"("topicId");

ALTER TABLE "Course" ADD CONSTRAINT "Course_entranceTopicId_fkey" FOREIGN KEY ("entranceTopicId") REFERENCES "QuestionTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QuizQuestion" ADD CONSTRAINT "QuizQuestion_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "QuestionTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BankQuestion" ADD CONSTRAINT "BankQuestion_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "QuestionTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
