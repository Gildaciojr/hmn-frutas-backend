/*
  Warnings:

  - A unique constraint covering the columns `[numeroPedido]` on the table `Venda` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `pesoLiquido` to the `Venda` table without a default value. This is not possible if the table is not empty.
  - Added the required column `precoMelancia` to the `Venda` table without a default value. This is not possible if the table is not empty.
  - Added the required column `valorMelancia` to the `Venda` table without a default value. This is not possible if the table is not empty.
  - Made the column `pesoBruto` on table `Venda` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Venda" ADD COLUMN     "cidade" TEXT,
ADD COLUMN     "dataVenda" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "localEntrega" TEXT,
ADD COLUMN     "numeroPedido" TEXT,
ADD COLUMN     "observacaoPreco" TEXT,
ADD COLUMN     "pesoDesconto" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "pesoLiquido" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "precoMelancia" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "produto" TEXT NOT NULL DEFAULT 'Melancia',
ADD COLUMN     "qualidade" TEXT,
ADD COLUMN     "telefone" TEXT,
ADD COLUMN     "valorMelancia" DECIMAL(12,2) NOT NULL,
ALTER COLUMN "pesoBruto" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Transacao_clienteId_tipo_idx" ON "Transacao"("clienteId", "tipo");

-- CreateIndex
CREATE INDEX "Transacao_clienteId_createdAt_idx" ON "Transacao"("clienteId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Venda_numeroPedido_key" ON "Venda"("numeroPedido");

-- CreateIndex
CREATE INDEX "Venda_numeroPedido_idx" ON "Venda"("numeroPedido");

-- CreateIndex
CREATE INDEX "Venda_dataVenda_idx" ON "Venda"("dataVenda");

-- CreateIndex
CREATE INDEX "Venda_produto_idx" ON "Venda"("produto");

-- CreateIndex
CREATE INDEX "Venda_qualidade_idx" ON "Venda"("qualidade");

-- CreateIndex
CREATE INDEX "Venda_cidade_idx" ON "Venda"("cidade");

-- CreateIndex
CREATE INDEX "Venda_dataVenda_status_idx" ON "Venda"("dataVenda", "status");

-- CreateIndex
CREATE INDEX "Venda_dataVenda_statusPagamento_idx" ON "Venda"("dataVenda", "statusPagamento");
