/*
  Warnings:

  - A unique constraint covering the columns `[target,websiteId]` on the table `source` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "source_target_key";

-- CreateIndex
CREATE UNIQUE INDEX "source_target_websiteId_key" ON "source"("target", "websiteId");
