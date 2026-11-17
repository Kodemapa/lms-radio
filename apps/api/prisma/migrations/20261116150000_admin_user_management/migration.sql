ALTER TABLE "User"
  ADD COLUMN "blockedAt" TIMESTAMP(3),
  ADD COLUMN "blockedReason" TEXT,
  ADD COLUMN "blockedById" UUID;

CREATE INDEX "User_role_deletedAt_blockedAt_idx"
  ON "User"("role", "deletedAt", "blockedAt");

ALTER TABLE "User"
  ADD CONSTRAINT "User_blockedById_fkey"
  FOREIGN KEY ("blockedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
