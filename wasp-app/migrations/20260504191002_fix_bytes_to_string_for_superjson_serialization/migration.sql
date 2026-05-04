-- AlterTable
ALTER TABLE "users" ALTER COLUMN "snyk_api_key_encrypted" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "webhooks" ALTER COLUMN "signing_secret_encrypted" SET DATA TYPE TEXT;
