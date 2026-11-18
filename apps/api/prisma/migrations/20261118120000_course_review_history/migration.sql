-- CreateEnum
CREATE TYPE "CourseReviewKind" AS ENUM ('SUBMITTED', 'CHANGES_REQUESTED', 'PUBLISHED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "CourseReviewEvent" (
    "id" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "kind" "CourseReviewKind" NOT NULL,
    "note" TEXT,
    "actorId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseReviewEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseReviewEvent_courseId_createdAt_idx" ON "CourseReviewEvent"("courseId", "createdAt");

-- CreateIndex
CREATE INDEX "CourseReviewEvent_createdAt_idx" ON "CourseReviewEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "CourseReviewEvent" ADD CONSTRAINT "CourseReviewEvent_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseReviewEvent" ADD CONSTRAINT "CourseReviewEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: earlier submissions and decisions were only in the audit log.
INSERT INTO "CourseReviewEvent" ("id", "courseId", "kind", "note", "actorId", "createdAt")
SELECT
    gen_random_uuid(),
    c."id",
    CASE a."action"
        WHEN 'course.submitted' THEN 'SUBMITTED'::"CourseReviewKind"
        WHEN 'course.rejected' THEN 'CHANGES_REQUESTED'::"CourseReviewKind"
        WHEN 'course.published' THEN 'PUBLISHED'::"CourseReviewKind"
        ELSE 'WITHDRAWN'::"CourseReviewKind"
    END,
    CASE WHEN a."action" = 'course.rejected' THEN NULLIF(a."metadata"->>'note', '') END,
    a."actorId",
    a."createdAt"
FROM "AuditLog" a
JOIN "Course" c ON c."id"::text = a."resourceId"
WHERE a."resource" = 'course'
  AND a."action" IN ('course.submitted', 'course.rejected', 'course.published', 'course.withdrawn');
