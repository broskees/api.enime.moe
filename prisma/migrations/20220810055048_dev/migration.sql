/*
  Warnings:

  - The primary key for the `Relation` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[type,animeId]` on the table `Relation` will be added. If there are existing duplicate values, this will fail.
  - The required column `id` was added to the `Relation` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE "Relation" DROP CONSTRAINT "Relation_pkey",
ADD COLUMN     "id" TEXT NOT NULL,
ADD CONSTRAINT "Relation_pkey" PRIMARY KEY ("id");

-- CreateTable
CREATE TABLE "_linkedRelations" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_linkedRelations_AB_unique" ON "_linkedRelations"("A", "B");

-- CreateIndex
CREATE INDEX "_linkedRelations_B_index" ON "_linkedRelations"("B");

-- CreateIndex
CREATE UNIQUE INDEX "Relation_type_animeId_key" ON "Relation"("type", "animeId");

-- AddForeignKey
ALTER TABLE "_linkedRelations" ADD CONSTRAINT "_linkedRelations_A_fkey" FOREIGN KEY ("A") REFERENCES "anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_linkedRelations" ADD CONSTRAINT "_linkedRelations_B_fkey" FOREIGN KEY ("B") REFERENCES "Relation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
