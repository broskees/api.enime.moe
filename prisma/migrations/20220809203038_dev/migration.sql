-- CreateTable
CREATE TABLE "Relation" (
    "type" "RelationType" NOT NULL,
    "animeId" TEXT NOT NULL,

    CONSTRAINT "Relation_pkey" PRIMARY KEY ("type","animeId")
);

-- AddForeignKey
ALTER TABLE "Relation" ADD CONSTRAINT "Relation_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;
