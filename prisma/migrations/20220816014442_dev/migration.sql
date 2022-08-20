/*
  Warnings:

  - A unique constraint covering the columns `[animeId,number]` on the table `episode` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "episode_animeId_number_key" ON "episode"("animeId", "number");
