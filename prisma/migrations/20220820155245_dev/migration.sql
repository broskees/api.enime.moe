ALTER TABLE IF EXISTS "Relation" RENAME TO "relation";
CREATE INDEX "episode_airedAt_idx" ON "episode"("airedAt" DESC NULLS LAST);
