/*
  Warnings:

  - You are about to drop the `_relations` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_relations" DROP CONSTRAINT "_relations_A_fkey";

-- DropForeignKey
ALTER TABLE "_relations" DROP CONSTRAINT "_relations_B_fkey";

-- DropTable
DROP TABLE "_relations";

-- CreateTable
CREATE TABLE "_linkedRelations" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_linkedRelations_AB_unique" ON "_linkedRelations"("A", "B");

-- CreateIndex
CREATE INDEX "_linkedRelations_B_index" ON "_linkedRelations"("B");

-- AddForeignKey
ALTER TABLE "_linkedRelations" ADD CONSTRAINT "_linkedRelations_A_fkey" FOREIGN KEY ("A") REFERENCES "anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_linkedRelations" ADD CONSTRAINT "_linkedRelations_B_fkey" FOREIGN KEY ("B") REFERENCES "Relation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
