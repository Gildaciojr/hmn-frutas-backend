/*
  Warnings:

  - You are about to drop the column `documento` on the `Cliente` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[cpf]` on the table `Cliente` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[cnpj]` on the table `Cliente` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "TipoCliente" AS ENUM ('PESSOA_FISICA', 'PESSOA_JURIDICA');

-- DropIndex
DROP INDEX "Cliente_documento_idx";

-- AlterTable
ALTER TABLE "Cliente" DROP COLUMN "documento",
ADD COLUMN     "cep" TEXT,
ADD COLUMN     "cidade" TEXT,
ADD COLUMN     "cnpj" TEXT,
ADD COLUMN     "cpf" TEXT,
ADD COLUMN     "estado" TEXT,
ADD COLUMN     "nomeFantasia" TEXT,
ADD COLUMN     "proprietarioNome" TEXT,
ADD COLUMN     "razaoSocial" TEXT,
ADD COLUMN     "tipoCliente" "TipoCliente" NOT NULL DEFAULT 'PESSOA_FISICA';

-- AlterTable
ALTER TABLE "Compra" ADD COLUMN     "usuarioResponsavelId" TEXT,
ADD COLUMN     "usuarioResponsavelNome" TEXT;

-- AlterTable
ALTER TABLE "Venda" ADD COLUMN     "usuarioResponsavelId" TEXT,
ADD COLUMN     "usuarioResponsavelNome" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_cpf_key" ON "Cliente"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_cnpj_key" ON "Cliente"("cnpj");

-- CreateIndex
CREATE INDEX "Cliente_tipoCliente_idx" ON "Cliente"("tipoCliente");

-- CreateIndex
CREATE INDEX "Cliente_cpf_idx" ON "Cliente"("cpf");

-- CreateIndex
CREATE INDEX "Cliente_cnpj_idx" ON "Cliente"("cnpj");

-- CreateIndex
CREATE INDEX "Cliente_nomeFantasia_idx" ON "Cliente"("nomeFantasia");

-- CreateIndex
CREATE INDEX "Cliente_razaoSocial_idx" ON "Cliente"("razaoSocial");

-- CreateIndex
CREATE INDEX "Cliente_proprietarioNome_idx" ON "Cliente"("proprietarioNome");

-- CreateIndex
CREATE INDEX "Cliente_cidade_idx" ON "Cliente"("cidade");

-- CreateIndex
CREATE INDEX "Cliente_estado_idx" ON "Cliente"("estado");

-- CreateIndex
CREATE INDEX "Compra_usuarioResponsavelId_idx" ON "Compra"("usuarioResponsavelId");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "Venda_usuarioResponsavelId_idx" ON "Venda"("usuarioResponsavelId");
