-- DropForeignKey
ALTER TABLE "Compra" DROP CONSTRAINT "Compra_clienteId_fkey";

-- AlterTable
ALTER TABLE "Compra" ALTER COLUMN "clienteId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
