/*
  Warnings:

  - Added the required column `updatedAt` to the `Transacao` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "FormaPagamento" AS ENUM ('PIX', 'DINHEIRO', 'CHEQUE', 'TRANSFERENCIA', 'BOLETO');

-- CreateEnum
CREATE TYPE "StatusFinanceiro" AS ENUM ('PENDENTE', 'PARCIAL', 'PAGO', 'ATRASADO', 'CANCELADO');

-- AlterTable
ALTER TABLE "Transacao" ADD COLUMN     "formaPagamento" "FormaPagamento",
ADD COLUMN     "observacoes" TEXT,
ADD COLUMN     "pagoEm" TIMESTAMP(3),
ADD COLUMN     "referencia" TEXT,
ADD COLUMN     "statusFinanceiro" "StatusFinanceiro" NOT NULL DEFAULT 'PENDENTE',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "valorPago" DECIMAL(12,2),
ADD COLUMN     "valorRestante" DECIMAL(12,2),
ADD COLUMN     "vencimento" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Transacao_formaPagamento_idx" ON "Transacao"("formaPagamento");

-- CreateIndex
CREATE INDEX "Transacao_statusFinanceiro_idx" ON "Transacao"("statusFinanceiro");

-- CreateIndex
CREATE INDEX "Transacao_vencimento_idx" ON "Transacao"("vencimento");

-- CreateIndex
CREATE INDEX "Transacao_pagoEm_idx" ON "Transacao"("pagoEm");

-- CreateIndex
CREATE INDEX "Transacao_referencia_idx" ON "Transacao"("referencia");

-- CreateIndex
CREATE INDEX "Transacao_statusFinanceiro_vencimento_idx" ON "Transacao"("statusFinanceiro", "vencimento");

-- CreateIndex
CREATE INDEX "Transacao_formaPagamento_createdAt_idx" ON "Transacao"("formaPagamento", "createdAt");
