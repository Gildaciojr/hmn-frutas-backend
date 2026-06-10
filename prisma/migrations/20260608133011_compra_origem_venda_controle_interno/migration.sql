-- CreateEnum
CREATE TYPE "QualidadeFrutaCompra" AS ENUM ('GRAUDA', 'MEDIA', 'MIUDA');

-- AlterTable
ALTER TABLE "Compra" ADD COLUMN     "cargueiro" TEXT,
ADD COLUMN     "controleInterno" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "icmsOutros" DECIMAL(10,2),
ADD COLUMN     "motoristaNome" TEXT,
ADD COLUMN     "motoristaTelefone" TEXT,
ADD COLUMN     "qualidadeFruta" "QualidadeFrutaCompra";

-- AlterTable
ALTER TABLE "Venda" ADD COLUMN     "compraOrigemId" TEXT,
ADD COLUMN     "compraOrigemNumeroFolha" TEXT;

-- CreateIndex
CREATE INDEX "Venda_compraOrigemId_idx" ON "Venda"("compraOrigemId");

-- CreateIndex
CREATE INDEX "Venda_compraOrigemNumeroFolha_idx" ON "Venda"("compraOrigemNumeroFolha");

-- AddForeignKey
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_compraOrigemId_fkey" FOREIGN KEY ("compraOrigemId") REFERENCES "Compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
