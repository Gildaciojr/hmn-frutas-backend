-- CreateEnum
CREATE TYPE "TipoAlertaFornecedor" AS ENUM ('LIMITE_PROXIMO', 'LIMITE_ULTRAPASSADO', 'VENCIMENTO_PROXIMO', 'VENCIDO');

-- AlterTable
ALTER TABLE "Compra" ADD COLUMN     "fazendaFornecedorId" TEXT,
ADD COLUMN     "fornecedorId" TEXT;

-- AlterTable
ALTER TABLE "PagamentoTransacao" ADD COLUMN     "fornecedorId" TEXT;

-- AlterTable
ALTER TABLE "Transacao" ADD COLUMN     "fornecedorId" TEXT;

-- CreateTable
CREATE TABLE "Fornecedor" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "sobrenome" TEXT,
    "telefone" TEXT,
    "estado" TEXT,
    "observacoes" TEXT,
    "limiteFinanceiroValor" DECIMAL(12,2),
    "limiteFinanceiroDias" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fornecedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FazendaFornecedor" (
    "id" TEXT NOT NULL,
    "fornecedorId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cidade" TEXT,
    "estado" TEXT,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FazendaFornecedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DespesaCompra" (
    "id" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "atividade" TEXT NOT NULL,
    "gasto" DECIMAL(12,2) NOT NULL,
    "observacoes" TEXT,
    "transacaoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DespesaCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertaFornecedor" (
    "id" TEXT NOT NULL,
    "fornecedorId" TEXT NOT NULL,
    "tipo" "TipoAlertaFornecedor" NOT NULL,
    "mensagem" TEXT NOT NULL,
    "resolvido" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertaFornecedor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Fornecedor_nome_idx" ON "Fornecedor"("nome");

-- CreateIndex
CREATE INDEX "Fornecedor_telefone_idx" ON "Fornecedor"("telefone");

-- CreateIndex
CREATE INDEX "Fornecedor_estado_idx" ON "Fornecedor"("estado");

-- CreateIndex
CREATE INDEX "Fornecedor_createdAt_idx" ON "Fornecedor"("createdAt");

-- CreateIndex
CREATE INDEX "FazendaFornecedor_fornecedorId_idx" ON "FazendaFornecedor"("fornecedorId");

-- CreateIndex
CREATE INDEX "FazendaFornecedor_nome_idx" ON "FazendaFornecedor"("nome");

-- CreateIndex
CREATE INDEX "FazendaFornecedor_estado_idx" ON "FazendaFornecedor"("estado");

-- CreateIndex
CREATE INDEX "DespesaCompra_data_idx" ON "DespesaCompra"("data");

-- CreateIndex
CREATE INDEX "DespesaCompra_atividade_idx" ON "DespesaCompra"("atividade");

-- CreateIndex
CREATE INDEX "DespesaCompra_transacaoId_idx" ON "DespesaCompra"("transacaoId");

-- CreateIndex
CREATE INDEX "DespesaCompra_createdAt_idx" ON "DespesaCompra"("createdAt");

-- CreateIndex
CREATE INDEX "AlertaFornecedor_fornecedorId_idx" ON "AlertaFornecedor"("fornecedorId");

-- CreateIndex
CREATE INDEX "AlertaFornecedor_tipo_idx" ON "AlertaFornecedor"("tipo");

-- CreateIndex
CREATE INDEX "AlertaFornecedor_resolvido_idx" ON "AlertaFornecedor"("resolvido");

-- CreateIndex
CREATE INDEX "AlertaFornecedor_createdAt_idx" ON "AlertaFornecedor"("createdAt");

-- CreateIndex
CREATE INDEX "Compra_fornecedorId_idx" ON "Compra"("fornecedorId");

-- CreateIndex
CREATE INDEX "Compra_fazendaFornecedorId_idx" ON "Compra"("fazendaFornecedorId");

-- CreateIndex
CREATE INDEX "PagamentoTransacao_fornecedorId_idx" ON "PagamentoTransacao"("fornecedorId");

-- CreateIndex
CREATE INDEX "Transacao_fornecedorId_idx" ON "Transacao"("fornecedorId");

-- AddForeignKey
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_fazendaFornecedorId_fkey" FOREIGN KEY ("fazendaFornecedorId") REFERENCES "FazendaFornecedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transacao" ADD CONSTRAINT "Transacao_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagamentoTransacao" ADD CONSTRAINT "PagamentoTransacao_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FazendaFornecedor" ADD CONSTRAINT "FazendaFornecedor_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DespesaCompra" ADD CONSTRAINT "DespesaCompra_transacaoId_fkey" FOREIGN KEY ("transacaoId") REFERENCES "Transacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertaFornecedor" ADD CONSTRAINT "AlertaFornecedor_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
