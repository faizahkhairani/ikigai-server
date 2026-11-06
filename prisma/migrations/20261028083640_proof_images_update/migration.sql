/*
  Warnings:

  - You are about to drop the `proof_images_on_orders` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `order_id` to the `proof_images` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "proof_images_on_orders" DROP CONSTRAINT "proof_images_on_orders_order_id_fkey";

-- DropForeignKey
ALTER TABLE "proof_images_on_orders" DROP CONSTRAINT "proof_images_on_orders_proof_image_id_fkey";

-- AlterTable
ALTER TABLE "proof_images" ADD COLUMN     "order_id" TEXT NOT NULL;

-- DropTable
DROP TABLE "proof_images_on_orders";

-- CreateIndex
CREATE INDEX "proof_images_order_id_idx" ON "proof_images"("order_id");

-- AddForeignKey
ALTER TABLE "proof_images" ADD CONSTRAINT "proof_images_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
