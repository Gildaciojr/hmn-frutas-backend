-- CreateTable
CREATE TABLE "PagamentoTransacao" (
    "id" TEXT NOT NULL,
    "transacaoId" TEXT NOT NULL,
    "clienteId" TEXT,
    "valor" DECIMAL(12,2) NOT NULL,
    "valorRestanteApos" DECIMAL(12,2) NOT NULL,
    "formaPagamento" "FormaPagamento" NOT NULL,
    "pagoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vencimento" TIMESTAMP(3),
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PagamentoTransacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PagamentoTransacao_transacaoId_idx" ON "PagamentoTransacao"("transacaoId");

-- CreateIndex
CREATE INDEX "PagamentoTransacao_clienteId_idx" ON "PagamentoTransacao"("clienteId");

-- CreateIndex
CREATE INDEX "PagamentoTransacao_formaPagamento_idx" ON "PagamentoTransacao"("formaPagamento");

-- CreateIndex
CREATE INDEX "PagamentoTransacao_pagoEm_idx" ON "PagamentoTransacao"("pagoEm");

-- CreateIndex
CREATE INDEX "PagamentoTransacao_createdAt_idx" ON "PagamentoTransacao"("createdAt");

-- CreateIndex
CREATE INDEX "PagamentoTransacao_clienteId_createdAt_idx" ON "PagamentoTransacao"("clienteId", "createdAt");

-- CreateIndex
CREATE INDEX "PagamentoTransacao_transacaoId_createdAt_idx" ON "PagamentoTransacao"("transacaoId", "createdAt");

-- AddForeignKey
ALTER TABLE "PagamentoTransacao" ADD CONSTRAINT "PagamentoTransacao_transacaoId_fkey" FOREIGN KEY ("transacaoId") REFERENCES "Transacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagamentoTransacao" ADD CONSTRAINT "PagamentoTransacao_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
