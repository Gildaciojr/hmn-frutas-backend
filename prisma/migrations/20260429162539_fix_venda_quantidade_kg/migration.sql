/*
  Warnings:

  - You are about to drop the column `kg` on the `Venda` table. All the data in the column will be lost.
  - Added the required column `quantidadeKg` to the `Venda` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Venda" DROP COLUMN "kg",
ADD COLUMN     "quantidadeKg" DOUBLE PRECISION NOT NULL;
