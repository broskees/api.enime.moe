/*
  Warnings:

  - The primary key for the `Relation` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The required column `id` was added to the `Relation` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE "Relation" DROP CONSTRAINT "Relation_pkey",
ADD COLUMN     "id" TEXT NOT NULL,
ADD CONSTRAINT "Relation_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE INDEX "Relation_type_animeId_idx" ON "Relation"("type", "animeId");
