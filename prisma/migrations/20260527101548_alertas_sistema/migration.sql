-- CreateEnum
CREATE TYPE "CategoriaAlerta" AS ENUM ('LIMITE_FINANCEIRO', 'VENCIMENTO', 'INADIMPLENCIA', 'FINANCEIRO', 'OPERACIONAL');

-- CreateEnum
CREATE TYPE "SeveridadeAlerta" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA');

-- CreateTable
CREATE TABLE "AlertaSistema" (
    "id" TEXT NOT NULL,
    "categoria" "CategoriaAlerta" NOT NULL,
    "severidade" "SeveridadeAlerta" NOT NULL,
    "clienteId" TEXT,
    "fornecedorId" TEXT,
    "titulo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "lido" BOOLEAN NOT NULL DEFAULT false,
    "resolvido" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertaSistema_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlertaSistema_categoria_idx" ON "AlertaSistema"("categoria");

-- CreateIndex
CREATE INDEX "AlertaSistema_severidade_idx" ON "AlertaSistema"("severidade");

-- CreateIndex
CREATE INDEX "AlertaSistema_lido_idx" ON "AlertaSistema"("lido");

-- CreateIndex
CREATE INDEX "AlertaSistema_resolvido_idx" ON "AlertaSistema"("resolvido");

-- CreateIndex
CREATE INDEX "AlertaSistema_createdAt_idx" ON "AlertaSistema"("createdAt");

-- AddForeignKey
ALTER TABLE "AlertaSistema" ADD CONSTRAINT "AlertaSistema_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertaSistema" ADD CONSTRAINT "AlertaSistema_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
