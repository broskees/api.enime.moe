/*
  Warnings:

  - A unique constraint covering the columns `[episodeId,websiteId]` on the table `source` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "source_episodeId_websiteId_key" ON "source"("episodeId", "websiteId");
