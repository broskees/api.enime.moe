/*
  Warnings:

  - A unique constraint covering the columns `[type,animeId]` on the table `Relation` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Relation_type_animeId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "Relation_type_animeId_key" ON "Relation"("type", "animeId");
