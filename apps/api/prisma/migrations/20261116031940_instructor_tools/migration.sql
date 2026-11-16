-- CreateEnum
CREATE TYPE "CollaboratorRole" AS ENUM ('EDITOR', 'GRADER');

-- CreateEnum
CREATE TYPE "CollaboratorStatus" AS ENUM ('PENDING', 'ACCEPTED');

-- AlterTable
ALTER TABLE "Chapter" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CourseReview" ADD COLUMN     "hiddenAt" TIMESTAMP(3),
ADD COLUMN     "repliedAt" TIMESTAMP(3),
ADD COLUMN     "repliedById" UUID,
ADD COLUMN     "reply" TEXT,
ADD COLUMN     "reportReason" TEXT,
ADD COLUMN     "reportedAt" TIMESTAMP(3),
ADD COLUMN     "reportedById" UUID;

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CourseCollaborator" (
    "id" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "CollaboratorRole" NOT NULL,
    "status" "CollaboratorStatus" NOT NULL DEFAULT 'PENDING',
    "invitedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "CourseCollaborator_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseCollaborator_userId_status_idx" ON "CourseCollaborator"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CourseCollaborator_courseId_userId_key" ON "CourseCollaborator"("courseId", "userId");

-- AddForeignKey
ALTER TABLE "CourseCollaborator" ADD CONSTRAINT "CourseCollaborator_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseCollaborator" ADD CONSTRAINT "CourseCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
