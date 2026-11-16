-- CreateIndex
CREATE INDEX "AssignmentSubmission_fileAssetId_idx" ON "AssignmentSubmission"("fileAssetId");

-- CreateIndex
CREATE INDEX "Course_previewAssetId_idx" ON "Course"("previewAssetId");

-- CreateIndex
CREATE INDEX "Enrollment_courseId_createdAt_idx" ON "Enrollment"("courseId", "createdAt");

-- CreateIndex
CREATE INDEX "ImagingAttempt_lessonId_idx" ON "ImagingAttempt"("lessonId");

-- CreateIndex
CREATE INDEX "ImagingAttempt_srAssetId_idx" ON "ImagingAttempt"("srAssetId");

-- CreateIndex
CREATE INDEX "ImagingCase_referenceSrAssetId_idx" ON "ImagingCase"("referenceSrAssetId");

-- CreateIndex
CREATE INDEX "ImagingImage_assetId_idx" ON "ImagingImage"("assetId");

-- CreateIndex
CREATE INDEX "Lesson_mediaAssetId_idx" ON "Lesson"("mediaAssetId");

-- CreateIndex
CREATE INDEX "LessonProgress_courseId_lessonId_idx" ON "LessonProgress"("courseId", "lessonId");

-- CreateIndex
CREATE INDEX "MediaAsset_ownerId_idx" ON "MediaAsset"("ownerId");
