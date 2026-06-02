-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "bairro" TEXT,
ADD COLUMN     "inscricaoEstadual" TEXT;

-- CreateIndex
CREATE INDEX "Cliente_inscricaoEstadual_idx" ON "Cliente"("inscricaoEstadual");

-- CreateIndex
CREATE INDEX "Cliente_bairro_idx" ON "Cliente"("bairro");
