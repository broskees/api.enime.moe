/*
  Warnings:

  - You are about to drop the column `url` on the `source` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[target]` on the table `source` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `target` to the `source` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "source_url_key";

-- AlterTable
ALTER TABLE "source" RENAME COLUMN "url" TO "target";

-- CreateIndex
CREATE UNIQUE INDEX "source_target_key" ON "source"("target");
