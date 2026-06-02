/*
  Warnings:

  - You are about to drop the column `valorPorKg` on the `Compra` table. All the data in the column will be lost.
  - Added the required column `dataCompra` to the `Compra` table without a default value. This is not possible if the table is not empty.
  - Added the required column `descontoKgCalculado` to the `Compra` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mediaFruta` to the `Compra` table without a default value. This is not possible if the table is not empty.
  - Added the required column `modeloCaminhao` to the `Compra` table without a default value. This is not possible if the table is not empty.
  - Added the required column `placa` to the `Compra` table without a default value. This is not possible if the table is not empty.
  - Added the required column `precoKg` to the `Compra` table without a default value. This is not possible if the table is not empty.
  - Added the required column `quantidadeFrutas` to the `Compra` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tipoDesconto` to the `Compra` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalBruto` to the `Compra` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ModeloCaminhao" AS ENUM ('TRUCK', 'BITRUCK', 'CARRETA');

-- CreateEnum
CREATE TYPE "TipoDescontoCompra" AS ENUM ('AUTOMATICO_MODELO', 'PERCENTUAL', 'MANUAL_KG');

-- CreateEnum
CREATE TYPE "TipoFreteVenda" AS ENUM ('CIF', 'FOB');

-- AlterTable
ALTER TABLE "Cliente" ALTER COLUMN "telefone" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Compra" DROP COLUMN "valorPorKg",
ADD COLUMN     "dataCompra" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "descontoKg" DOUBLE PRECISION,
ADD COLUMN     "descontoKgCalculado" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "descontoKgManual" DOUBLE PRECISION,
ADD COLUMN     "descontoValor" DOUBLE PRECISION,
ADD COLUMN     "despesas" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "mediaFruta" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "modeloCaminhao" "ModeloCaminhao" NOT NULL,
ADD COLUMN     "numeroFolha" TEXT,
ADD COLUMN     "placa" TEXT NOT NULL,
ADD COLUMN     "precoKg" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "quantidadeFrutas" INTEGER NOT NULL,
ADD COLUMN     "safra" TEXT,
ADD COLUMN     "tipoDesconto" "TipoDescontoCompra" NOT NULL,
ADD COLUMN     "totalBruto" DECIMAL(12,2) NOT NULL,
ALTER COLUMN "caminhoes" SET DEFAULT 1,
ALTER COLUMN "descontoPercentualAplicado" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Venda" ADD COLUMN     "descontoFruta" DECIMAL(10,2),
ADD COLUMN     "descontoValor" DECIMAL(10,2),
ADD COLUMN     "destino" TEXT,
ADD COLUMN     "freteTotal" DECIMAL(12,2),
ADD COLUMN     "icmsOutros" DECIMAL(10,2),
ADD COLUMN     "mediaFruta" DOUBLE PRECISION,
ADD COLUMN     "modeloCaminhao" TEXT,
ADD COLUMN     "motoristaCpf" TEXT,
ADD COLUMN     "motoristaNome" TEXT,
ADD COLUMN     "motoristaTelefone" TEXT,
ADD COLUMN     "numeroRomaneio" TEXT,
ADD COLUMN     "pesoBruto" DOUBLE PRECISION,
ADD COLUMN     "placa" TEXT,
ADD COLUMN     "precoFinal" DECIMAL(10,2),
ADD COLUMN     "precoFrete" DECIMAL(10,2),
ADD COLUMN     "precoMercado" DECIMAL(10,2),
ADD COLUMN     "quantidadeFrutas" INTEGER,
ADD COLUMN     "tipoFrete" "TipoFreteVenda";

-- CreateIndex
CREATE INDEX "Cliente_documento_idx" ON "Cliente"("documento");

-- CreateIndex
CREATE INDEX "Cliente_telefone_idx" ON "Cliente"("telefone");

-- CreateIndex
CREATE INDEX "Compra_dataCompra_idx" ON "Compra"("dataCompra");

-- CreateIndex
CREATE INDEX "Compra_modeloCaminhao_idx" ON "Compra"("modeloCaminhao");

-- CreateIndex
CREATE INDEX "Compra_placa_idx" ON "Compra"("placa");

-- CreateIndex
CREATE INDEX "Compra_numeroFolha_idx" ON "Compra"("numeroFolha");

-- CreateIndex
CREATE INDEX "Compra_createdAt_idx" ON "Compra"("createdAt");

-- CreateIndex
CREATE INDEX "Transacao_tipo_idx" ON "Transacao"("tipo");

-- CreateIndex
CREATE INDEX "Transacao_createdAt_idx" ON "Transacao"("createdAt");

-- CreateIndex
CREATE INDEX "Transacao_compraId_idx" ON "Transacao"("compraId");

-- CreateIndex
CREATE INDEX "Transacao_vendaId_idx" ON "Transacao"("vendaId");

-- CreateIndex
CREATE INDEX "Venda_numeroRomaneio_idx" ON "Venda"("numeroRomaneio");

-- CreateIndex
CREATE INDEX "Venda_placa_idx" ON "Venda"("placa");

-- CreateIndex
CREATE INDEX "Venda_createdAt_idx" ON "Venda"("createdAt");
