-- DropIndex
DROP INDEX "episode_airedAt_idx";

-- AlterTable
ALTER TABLE "relation" RENAME CONSTRAINT "Relation_pkey" TO "relation_pkey";

-- RenameForeignKey
ALTER TABLE "relation" RENAME CONSTRAINT "Relation_animeId_fkey" TO "relation_animeId_fkey";

-- RenameIndex
ALTER INDEX "Relation_type_animeId_key" RENAME TO "relation_type_animeId_key";
