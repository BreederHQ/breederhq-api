-- AlterTable
ALTER TABLE "marketplace"."message_threads" ADD COLUMN     "archived_by_provider_at" TIMESTAMP(3),
ADD COLUMN     "deleted_by_provider_at" TIMESTAMP(3),
ADD COLUMN     "first_client_message_at" TIMESTAMP(3),
ADD COLUMN     "first_provider_reply_at" TIMESTAMP(3),
ADD COLUMN     "response_time_seconds" INTEGER;

-- AlterTable
ALTER TABLE "marketplace"."messages" ADD COLUMN     "deleted_at" TIMESTAMP(3);
