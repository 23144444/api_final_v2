-- CreateEnum
CREATE TYPE "Unidade" AS ENUM ('UN', 'KG', 'CX');

-- AlterTable
ALTER TABLE "mercadorias" ADD COLUMN     "unidade" "Unidade" NOT NULL DEFAULT 'UN';
