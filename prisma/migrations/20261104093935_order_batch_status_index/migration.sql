-- DropIndex
DROP INDEX "orders_batch_id_idx";

-- CreateIndex
CREATE INDEX "orders_batch_id_status_idx" ON "orders"("batch_id", "status");
