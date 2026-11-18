-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('COURSE_CHANGES_REQUESTED', 'COURSE_PUBLISHED', 'APPLICATION_APPROVED', 'APPLICATION_REJECTED', 'COLLABORATOR_INVITED', 'ASSIGNMENT_REVIEWED', 'WORKING_REVIEWED', 'CONTACT_MESSAGE');

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: courses currently sent back for changes notify their owner, so a request
-- made before notifications existed is not missed.
INSERT INTO "Notification" ("id", "userId", "kind", "data", "link", "createdAt")
SELECT gen_random_uuid(), c."instructorId", 'COURSE_CHANGES_REQUESTED',
       jsonb_build_object('courseTitle', c."title", 'note', COALESCE(c."reviewNote", '')),
       '/instructor/courses/' || c."id"::text,
       COALESCE((SELECT max(e."createdAt") FROM "CourseReviewEvent" e WHERE e."courseId" = c."id" AND e."kind" = 'CHANGES_REQUESTED'), c."updatedAt")
FROM "Course" c
WHERE c."status" = 'DRAFT' AND c."reviewNote" IS NOT NULL AND c."instructorId" IS NOT NULL;
