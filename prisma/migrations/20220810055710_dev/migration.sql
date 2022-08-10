-- DropIndex
DROP INDEX "Relation_type_animeId_key";

-- CreateIndex
CREATE INDEX "Relation_type_animeId_idx" ON "Relation"("type", "animeId");
