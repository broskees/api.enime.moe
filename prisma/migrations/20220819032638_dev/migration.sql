-- AlterTable
ALTER TABLE "episode" ADD COLUMN     "airedAt" TIMESTAMP(3),
ADD COLUMN     "titleVariations" JSONB;
