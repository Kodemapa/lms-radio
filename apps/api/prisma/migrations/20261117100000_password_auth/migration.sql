-- Email + password accounts: hashed password, change timestamp and sign-up consent.
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);
