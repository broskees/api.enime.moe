/*
  Warnings:

  - You are about to drop the column `lastChecks` on the `episode` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "anime" ADD COLUMN     "lastChecks" JSONB;

-- AlterTable
ALTER TABLE "episode" DROP COLUMN "lastChecks";
