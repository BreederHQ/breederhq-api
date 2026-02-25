-- migrate:up
-- Create HelpConversation table for persisting AI Copilot and AI Assistant chat histories.

CREATE TABLE "public"."HelpConversation" (
  "id" SERIAL PRIMARY KEY,
  "userId" text NOT NULL,
  "tenantId" integer NOT NULL,
  "title" text NOT NULL,
  "messages" jsonb NOT NULL DEFAULT '[]',
  "mode" text NOT NULL DEFAULT 'copilot',
  "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" timestamp(3) without time zone NOT NULL,
  CONSTRAINT "HelpConversation_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "public"."User"(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "HelpConversation_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"(id)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX "HelpConversation_userId_idx"
  ON "public"."HelpConversation" USING btree ("userId");
CREATE INDEX "HelpConversation_tenantId_idx"
  ON "public"."HelpConversation" USING btree ("tenantId");
CREATE INDEX "HelpConversation_updatedAt_idx"
  ON "public"."HelpConversation" USING btree ("updatedAt" DESC);

-- migrate:down
DROP TABLE IF EXISTS "public"."HelpConversation";
