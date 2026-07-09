-- Garante unicidade para numeros de folha informados manualmente ou gerados automaticamente.
-- Em PostgreSQL, valores NULL continuam permitidos em multiplos registros.
DROP INDEX IF EXISTS "Compra_numeroFolha_idx";

CREATE UNIQUE INDEX "Compra_numeroFolha_key" ON "Compra"("numeroFolha");