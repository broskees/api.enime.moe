/*
  Warnings:

  - The primary key for the `Relation` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `Relation` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Relation_type_animeId_idx";

-- AlterTable
ALTER TABLE "Relation" DROP CONSTRAINT "Relation_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "Relation_pkey" PRIMARY KEY ("type", "animeId");
