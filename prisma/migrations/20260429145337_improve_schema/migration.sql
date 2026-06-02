/*
  Warnings:

  - You are about to alter the column `valorPorKg` on the `Compra` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to alter the column `valorTotal` on the `Compra` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - Added the required column `updatedAt` to the `Compra` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Compra" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "valorPorKg" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "valorTotal" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "telefone" DROP NOT NULL,
ALTER COLUMN "endereco" DROP NOT NULL;
