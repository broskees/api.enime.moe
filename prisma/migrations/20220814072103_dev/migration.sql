-- CreateEnum
CREATE TYPE "MediaFormat" AS ENUM ('UNKNOWN', 'TV', 'TV_SHORT', 'MOVIE', 'SPECIAL', 'OVA', 'ONA', 'MUSIC');

-- AlterTable
ALTER TABLE "anime" ADD COLUMN     "format" "MediaFormat" DEFAULT 'UNKNOWN';
