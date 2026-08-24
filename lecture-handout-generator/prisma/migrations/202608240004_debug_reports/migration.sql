CREATE TABLE IF NOT EXISTS "DebugReport" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "projectId" TEXT,
  "pageUrl" TEXT,
  "note" TEXT NOT NULL,
  "selection" JSONB,
  "imageKey" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DebugReport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DebugReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "DebugReport_userId_createdAt_idx" ON "DebugReport"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "DebugReport_projectId_createdAt_idx" ON "DebugReport"("projectId", "createdAt");
