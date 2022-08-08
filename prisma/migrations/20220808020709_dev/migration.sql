-- CreateEnum
CREATE TYPE "RelationType" AS ENUM ('PREQUEL', 'SEQUEL', 'PARENT');

-- CreateEnum
CREATE TYPE "AiringStatus" AS ENUM ('FINISHED', 'RELEASING', 'NOT_YET_RELEASED', 'CANCELLED', 'HIATUS');

-- CreateEnum
CREATE TYPE "AiringSeason" AS ENUM ('UNKNOWN', 'SPRING', 'SUMMER', 'FALL', 'WINTER');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('DIRECT', 'PROXY');

-- CreateTable
CREATE TABLE "proxies" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "port_http" INTEGER NOT NULL,
    "port_socks5" INTEGER NOT NULL,
    "country" TEXT NOT NULL,
    "city" TEXT,
    "used" INTEGER NOT NULL,

    CONSTRAINT "proxies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anime" (
    "id" TEXT NOT NULL,
    "slug" TEXT,
    "anilistId" INTEGER NOT NULL,
    "coverImage" TEXT,
    "bannerImage" TEXT,
    "status" "AiringStatus",
    "season" "AiringSeason" NOT NULL DEFAULT 'UNKNOWN',
    "title" JSONB NOT NULL,
    "mappings" JSONB NOT NULL DEFAULT '{}',
    "currentEpisode" INTEGER,
    "next" TIMESTAMP(3),
    "synonyms" TEXT[],
    "lastEpisodeUpdate" TIMESTAMP(3),
    "seasonInt" INTEGER,
    "description" TEXT,
    "duration" INTEGER,
    "averageScore" INTEGER,
    "popularity" INTEGER,
    "color" TEXT,
    "year" INTEGER,
    "prequelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "genre" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "genre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "episode" (
    "id" TEXT NOT NULL,
    "animeId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT,
    "image" TEXT,
    "introStart" INTEGER,
    "introEnd" INTEGER,
    "filler" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "episode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "type" "SourceType" NOT NULL DEFAULT 'DIRECT',
    "referer" TEXT,
    "resolution" TEXT,
    "format" TEXT,
    "browser" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priority" INTEGER DEFAULT -1,
    "url" TEXT NOT NULL,
    "subtitle" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT NOT NULL,

    CONSTRAINT "website_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AnimeToGenre" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "proxies_address_key" ON "proxies"("address");

-- CreateIndex
CREATE UNIQUE INDEX "anime_slug_key" ON "anime"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "anime_anilistId_key" ON "anime"("anilistId");

-- CreateIndex
CREATE UNIQUE INDEX "anime_prequelId_key" ON "anime"("prequelId");

-- CreateIndex
CREATE UNIQUE INDEX "genre_name_key" ON "genre"("name");

-- CreateIndex
CREATE UNIQUE INDEX "source_url_key" ON "source"("url");

-- CreateIndex
CREATE UNIQUE INDEX "website_url_key" ON "website"("url");

-- CreateIndex
CREATE UNIQUE INDEX "_AnimeToGenre_AB_unique" ON "_AnimeToGenre"("A", "B");

-- CreateIndex
CREATE INDEX "_AnimeToGenre_B_index" ON "_AnimeToGenre"("B");

-- AddForeignKey
ALTER TABLE "anime" ADD CONSTRAINT "anime_prequelId_fkey" FOREIGN KEY ("prequelId") REFERENCES "anime"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episode" ADD CONSTRAINT "episode_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source" ADD CONSTRAINT "source_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source" ADD CONSTRAINT "source_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AnimeToGenre" ADD CONSTRAINT "_AnimeToGenre_A_fkey" FOREIGN KEY ("A") REFERENCES "anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AnimeToGenre" ADD CONSTRAINT "_AnimeToGenre_B_fkey" FOREIGN KEY ("B") REFERENCES "genre"("id") ON DELETE CASCADE ON UPDATE CASCADE;
