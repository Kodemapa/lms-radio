-- PDF lessons: instructors may let learners download a copy stamped with their name and user ID.
ALTER TABLE "Lesson" ADD COLUMN "allowDownload" BOOLEAN NOT NULL DEFAULT false;
