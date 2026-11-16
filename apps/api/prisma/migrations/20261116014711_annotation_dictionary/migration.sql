-- CreateTable
CREATE TABLE "AnnotationTerm" (
    "id" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "abbr" TEXT NOT NULL,
    "abbrKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "loinc" TEXT,
    "tools" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "AnnotationTerm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnnotationTerm_courseId_position_idx" ON "AnnotationTerm"("courseId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "AnnotationTerm_courseId_abbrKey_key" ON "AnnotationTerm"("courseId", "abbrKey");

-- AddForeignKey
ALTER TABLE "AnnotationTerm" ADD CONSTRAINT "AnnotationTerm_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
