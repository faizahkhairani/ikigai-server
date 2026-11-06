/*
  Warnings:

  - A unique constraint covering the columns `[resi_thailand]` on the table `orders` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "orders_resi_thailand_key" ON "orders"("resi_thailand");
