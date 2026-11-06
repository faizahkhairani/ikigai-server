-- DropForeignKey
ALTER TABLE "order_status_logs" DROP CONSTRAINT "order_status_logs_changed_by_fkey";

-- AlterTable
ALTER TABLE "order_status_logs" ALTER COLUMN "changed_by" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "order_status_logs" ADD CONSTRAINT "order_status_logs_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
