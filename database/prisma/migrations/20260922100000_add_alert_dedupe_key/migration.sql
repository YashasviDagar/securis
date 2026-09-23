-- Securis - Add Alert.dedupeKey
--
-- Makes detection idempotent: repeated scans over the same events update the
-- existing alert (matching on dedupeKey) instead of creating duplicates.
-- The key format is `<ruleCode>:<groupValue>:<windowBucketStartMs>`.
--
-- The column is nullable; PostgreSQL permits multiple NULLs under a unique
-- index, so alerts created outside the engine (e.g. manually) are unaffected.

ALTER TABLE "Alert" ADD COLUMN "dedupeKey" TEXT;

CREATE UNIQUE INDEX "Alert_dedupeKey_key" ON "Alert"("dedupeKey");
