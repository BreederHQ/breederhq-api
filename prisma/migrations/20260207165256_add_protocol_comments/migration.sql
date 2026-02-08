-- CreateTable
CREATE TABLE "public"."ProtocolComment" (
    "id" SERIAL NOT NULL,
    "protocolId" INTEGER NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "parentId" INTEGER,
    "authorName" TEXT NOT NULL,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "hiddenAt" TIMESTAMP(3),
    "hiddenBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProtocolComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProtocolComment_protocolId_createdAt_idx" ON "public"."ProtocolComment"("protocolId", "createdAt");

-- CreateIndex
CREATE INDEX "ProtocolComment_parentId_idx" ON "public"."ProtocolComment"("parentId");

-- AddForeignKey
ALTER TABLE "public"."ProtocolComment" ADD CONSTRAINT "ProtocolComment_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "public"."RearingProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProtocolComment" ADD CONSTRAINT "ProtocolComment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProtocolComment" ADD CONSTRAINT "ProtocolComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."ProtocolComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
