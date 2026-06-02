/*
  Warnings:

  - The `modeloCaminhao` column on the `Venda` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[numeroRomaneio]` on the table `Venda` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `clienteNomeSnapshot` to the `Compra` table without a default value. This is not possible if the table is not empty.
  - Added the required column `clienteNomeSnapshot` to the `Venda` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "StatusCompra" AS ENUM ('ABERTA', 'FECHADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "StatusVenda" AS ENUM ('ABERTA', 'FATURADA', 'CANCELADA', 'ENTREGUE');

-- AlterTable
ALTER TABLE "Compra" ADD COLUMN     "canceladoEm" TIMESTAMP(3),
ADD COLUMN     "clienteDocumentoSnapshot" TEXT,
ADD COLUMN     "clienteEnderecoSnapshot" TEXT,
ADD COLUMN     "clienteNomeSnapshot" TEXT NOT NULL,
ADD COLUMN     "clienteTelefoneSnapshot" TEXT,
ADD COLUMN     "motivoCancelamento" TEXT,
ADD COLUMN     "status" "StatusCompra" NOT NULL DEFAULT 'FECHADA';

-- AlterTable
ALTER TABLE "Venda" ADD COLUMN     "canceladoEm" TIMESTAMP(3),
ADD COLUMN     "clienteDocumentoSnapshot" TEXT,
ADD COLUMN     "clienteEnderecoSnapshot" TEXT,
ADD COLUMN     "clienteNomeSnapshot" TEXT NOT NULL,
ADD COLUMN     "clienteTelefoneSnapshot" TEXT,
ADD COLUMN     "motivoCancelamento" TEXT,
ADD COLUMN     "pdfGeradoEm" TIMESTAMP(3),
ADD COLUMN     "status" "StatusVenda" NOT NULL DEFAULT 'ABERTA',
DROP COLUMN "modeloCaminhao",
ADD COLUMN     "modeloCaminhao" "ModeloCaminhao";

-- CreateIndex
CREATE INDEX "Cliente_createdAt_idx" ON "Cliente"("createdAt");

-- CreateIndex
CREATE INDEX "Compra_status_idx" ON "Compra"("status");

-- CreateIndex
CREATE INDEX "Compra_createdAt_status_idx" ON "Compra"("createdAt", "status");

-- CreateIndex
CREATE INDEX "Transacao_createdAt_tipo_idx" ON "Transacao"("createdAt", "tipo");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Venda_numeroRomaneio_key" ON "Venda"("numeroRomaneio");

-- CreateIndex
CREATE INDEX "Venda_modeloCaminhao_idx" ON "Venda"("modeloCaminhao");

-- CreateIndex
CREATE INDEX "Venda_statusPagamento_idx" ON "Venda"("statusPagamento");

-- CreateIndex
CREATE INDEX "Venda_status_idx" ON "Venda"("status");

-- CreateIndex
CREATE INDEX "Venda_createdAt_statusPagamento_idx" ON "Venda"("createdAt", "statusPagamento");

-- CreateIndex
CREATE INDEX "Venda_createdAt_status_idx" ON "Venda"("createdAt", "status");
