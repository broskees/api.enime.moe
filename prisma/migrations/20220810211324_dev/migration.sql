/*
  Warnings:

  - You are about to drop the `_linkedRelations` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_linkedRelations" DROP CONSTRAINT "_linkedRelations_A_fkey";

-- DropForeignKey
ALTER TABLE "_linkedRelations" DROP CONSTRAINT "_linkedRelations_B_fkey";

-- DropTable
DROP TABLE "_linkedRelations";

-- CreateTable
CREATE TABLE "_relations" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_relations_AB_unique" ON "_relations"("A", "B");

-- CreateIndex
CREATE INDEX "_relations_B_index" ON "_relations"("B");

-- AddForeignKey
ALTER TABLE "_relations" ADD CONSTRAINT "_relations_A_fkey" FOREIGN KEY ("A") REFERENCES "anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_relations" ADD CONSTRAINT "_relations_B_fkey" FOREIGN KEY ("B") REFERENCES "Relation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
