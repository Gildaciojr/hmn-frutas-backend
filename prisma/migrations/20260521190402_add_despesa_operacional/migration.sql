-- CreateTable
CREATE TABLE "DespesaOperacional" (
    "id" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "atividade" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "observacoes" TEXT,
    "transacaoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DespesaOperacional_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DespesaOperacional_data_idx" ON "DespesaOperacional"("data");

-- CreateIndex
CREATE INDEX "DespesaOperacional_atividade_idx" ON "DespesaOperacional"("atividade");

-- CreateIndex
CREATE INDEX "DespesaOperacional_transacaoId_idx" ON "DespesaOperacional"("transacaoId");

-- CreateIndex
CREATE INDEX "DespesaOperacional_createdAt_idx" ON "DespesaOperacional"("createdAt");

-- AddForeignKey
ALTER TABLE "DespesaOperacional" ADD CONSTRAINT "DespesaOperacional_transacaoId_fkey" FOREIGN KEY ("transacaoId") REFERENCES "Transacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
