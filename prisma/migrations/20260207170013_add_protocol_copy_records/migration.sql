-- CreateTable
CREATE TABLE "public"."ProtocolCopyRecord" (
    "id" SERIAL NOT NULL,
    "protocolId" INTEGER NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "copiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProtocolCopyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProtocolCopyRecord_protocolId_idx" ON "public"."ProtocolCopyRecord"("protocolId");

-- CreateIndex
CREATE UNIQUE INDEX "ProtocolCopyRecord_protocolId_tenantId_key" ON "public"."ProtocolCopyRecord"("protocolId", "tenantId");

-- AddForeignKey
ALTER TABLE "public"."ProtocolCopyRecord" ADD CONSTRAINT "ProtocolCopyRecord_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "public"."RearingProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProtocolCopyRecord" ADD CONSTRAINT "ProtocolCopyRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
