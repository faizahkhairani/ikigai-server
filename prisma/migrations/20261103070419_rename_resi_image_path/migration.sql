/*
  Warnings:

  - You are about to drop the column `resi_image_url` on the `orders` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "orders" RENAME COLUMN "resi_image_url" TO "resi_image_path";
