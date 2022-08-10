/*
  Warnings:

  - You are about to drop the column `prequelId` on the `anime` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "anime" DROP CONSTRAINT "anime_prequelId_fkey";

-- DropIndex
DROP INDEX "anime_prequelId_key";

-- AlterTable
ALTER TABLE "anime" DROP COLUMN "prequelId";
