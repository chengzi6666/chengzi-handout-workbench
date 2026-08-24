-- Add a soft-delete timestamp so projects can be recovered from the recycle bin.
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Project_ownerId_deletedAt_idx"
ON "Project"("ownerId", "deletedAt");
