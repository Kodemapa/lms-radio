-- Profile pictures: an optional public image per user (learners and instructors).
ALTER TABLE "User" ADD COLUMN "avatarAssetId" UUID;

ALTER TABLE "User"
  ADD CONSTRAINT "User_avatarAssetId_fkey" FOREIGN KEY ("avatarAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
