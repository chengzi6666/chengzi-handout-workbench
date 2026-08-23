CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'PARSING', 'TEXT_REVIEW', 'PINYIN_REVIEW', 'LAYOUT_GENERATING', 'LAYOUT_REVIEW', 'COMPLETED', 'FAILED');
CREATE TYPE "LessonStatus" AS ENUM ('DRAFT', 'TEXT_REVIEW', 'APPROVED');
CREATE TYPE "OutputKind" AS ENUM ('LESSON_STUDENT', 'COMBINED_STUDENT', 'COMBINED_ANSWERS', 'PARENT_MANUAL', 'LESSON_ANSWERS', 'WECHAT_FLIPBOOK');
CREATE TYPE "AiProviderKind" AS ENUM ('OPENAI', 'OPENAI_COMPATIBLE', 'INTERNAL');
CREATE TYPE "AssetKind" AS ENUM ('PORTRAIT', 'EXPRESSION');
CREATE TYPE "BackgroundRole" AS ENUM ('SIMPLE', 'COVER', 'PARENT_MANUAL', 'LESSON_HOME', 'CONVERSATION', 'READING', 'PRACTICE', 'LITTLE_TEACHER');
CREATE TYPE "SourceFileKind" AS ENUM ('PDF', 'QUESTION_IMAGE', 'COVER_IMAGE', 'BACKGROUND_IMAGE');

CREATE TABLE "User" (
  "id" TEXT NOT NULL, "employeeNumber" TEXT NOT NULL, "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  "lastLoginAt" TIMESTAMP(3), CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Project" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "grade" TEXT NOT NULL, "teachingYear" INTEGER NOT NULL,
  "teachingYearConfirmedAt" TIMESTAMP(3), "season" TEXT, "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
  "pinned" BOOLEAN NOT NULL DEFAULT false, "lessonCount" INTEGER NOT NULL DEFAULT 1,
  "selectedProviderId" TEXT, "teacherId" TEXT, "backgroundPackId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  "ownerId" TEXT NOT NULL, CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CurriculumReference" (
  "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "lessonNumber" INTEGER, "category" TEXT NOT NULL,
  "claim" TEXT NOT NULL, "sourceTitle" TEXT NOT NULL, "sourceUrl" TEXT NOT NULL, "publishedAt" TIMESTAMP(3),
  "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "aiRationale" TEXT, "confirmedAt" TIMESTAMP(3),
  CONSTRAINT "CurriculumReference_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Lesson" (
  "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "lessonNumber" INTEGER NOT NULL, "title" TEXT NOT NULL,
  "subtitle" TEXT, "technique" TEXT, "status" "LessonStatus" NOT NULL DEFAULT 'DRAFT', "structuredContent" JSONB,
  "readingExcerpt" TEXT, "readingExcerptSource" JSONB, "pinyinReview" JSONB, "textApprovedAt" TIMESTAMP(3),
  "pinyinApprovedAt" TIMESTAMP(3), "layoutApprovedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ProjectOutput" (
  "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "kind" "OutputKind" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true, CONSTRAINT "ProjectOutput_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AiProviderConfig" (
  "id" TEXT NOT NULL, "displayName" TEXT NOT NULL, "kind" "AiProviderKind" NOT NULL, "baseUrl" TEXT NOT NULL,
  "model" TEXT NOT NULL, "encryptedApiKey" TEXT NOT NULL, "extraHeaders" JSONB,
  "supportsVision" BOOLEAN NOT NULL DEFAULT false, "supportsSearch" BOOLEAN NOT NULL DEFAULT false,
  "supportsJson" BOOLEAN NOT NULL DEFAULT true, "enabled" BOOLEAN NOT NULL DEFAULT true,
  "isDefault" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "AiProviderConfig_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Teacher" (
  "id" TEXT NOT NULL, "formalName" TEXT NOT NULL, "nickname" TEXT NOT NULL, "grade" TEXT,
  "introduction" TEXT NOT NULL, "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TeacherAsset" (
  "id" TEXT NOT NULL, "teacherId" TEXT NOT NULL, "kind" "AssetKind" NOT NULL, "label" TEXT,
  "objectKey" TEXT NOT NULL, "width" INTEGER, "height" INTEGER, "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "TeacherAsset_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "BackgroundPack" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "mode" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BackgroundPack_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "BackgroundAsset" (
  "id" TEXT NOT NULL, "backgroundPackId" TEXT NOT NULL, "role" "BackgroundRole" NOT NULL,
  "objectKey" TEXT NOT NULL, CONSTRAINT "BackgroundAsset_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SourceFile" (
  "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "kind" "SourceFileKind" NOT NULL, "originalName" TEXT NOT NULL,
  "objectKey" TEXT NOT NULL, "mimeType" TEXT NOT NULL, "size" INTEGER NOT NULL, "checksum" TEXT,
  "lessonNumber" INTEGER, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SourceFile_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "GeneratedFile" (
  "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "kind" "OutputKind" NOT NULL, "fileName" TEXT NOT NULL,
  "objectKey" TEXT NOT NULL, "version" INTEGER NOT NULL DEFAULT 1, "pageCount" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "GeneratedFile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_employeeNumber_key" ON "User"("employeeNumber");
CREATE INDEX "Project_ownerId_pinned_updatedAt_idx" ON "Project"("ownerId", "pinned", "updatedAt");
CREATE INDEX "CurriculumReference_projectId_lessonNumber_idx" ON "CurriculumReference"("projectId", "lessonNumber");
CREATE UNIQUE INDEX "Lesson_projectId_lessonNumber_key" ON "Lesson"("projectId", "lessonNumber");
CREATE UNIQUE INDEX "ProjectOutput_projectId_kind_key" ON "ProjectOutput"("projectId", "kind");
CREATE UNIQUE INDEX "Teacher_formalName_nickname_key" ON "Teacher"("formalName", "nickname");
CREATE UNIQUE INDEX "BackgroundAsset_backgroundPackId_role_key" ON "BackgroundAsset"("backgroundPackId", "role");

ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_backgroundPackId_fkey" FOREIGN KEY ("backgroundPackId") REFERENCES "BackgroundPack"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CurriculumReference" ADD CONSTRAINT "CurriculumReference_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectOutput" ADD CONSTRAINT "ProjectOutput_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherAsset" ADD CONSTRAINT "TeacherAsset_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BackgroundAsset" ADD CONSTRAINT "BackgroundAsset_backgroundPackId_fkey" FOREIGN KEY ("backgroundPackId") REFERENCES "BackgroundPack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SourceFile" ADD CONSTRAINT "SourceFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GeneratedFile" ADD CONSTRAINT "GeneratedFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
