-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "identifier" TEXT,
ALTER COLUMN "name" DROP NOT NULL,
ALTER COLUMN "phone" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "customers_identifier_key" ON "customers"("identifier");
