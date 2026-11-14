ALTER TABLE "learning_attempts" ADD COLUMN IF NOT EXISTS "client_attempt_id" text;
CREATE UNIQUE INDEX IF NOT EXISTS "learning_attempts_learner_activity_client_attempt_idx" ON "learning_attempts" USING btree ("learner_id","activity_id","client_attempt_id");
