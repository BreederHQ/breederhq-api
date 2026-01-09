-- AlterEnum - Add MESSAGE_THREAD and DRAFT to TagModule
ALTER TYPE "TagModule" ADD VALUE 'MESSAGE_THREAD';
ALTER TYPE "TagModule" ADD VALUE 'DRAFT';

-- AlterTable - Add foreign key columns to TagAssignment
ALTER TABLE "TagAssignment" ADD COLUMN "draftId" INTEGER,
ADD COLUMN "messageThreadId" INTEGER;

-- CreateIndex
CREATE INDEX "TagAssignment_messageThreadId_idx" ON "TagAssignment"("messageThreadId");

-- CreateIndex
CREATE INDEX "TagAssignment_draftId_idx" ON "TagAssignment"("draftId");

-- CreateIndex
CREATE UNIQUE INDEX "TagAssignment_tagId_messageThreadId_key" ON "TagAssignment"("tagId", "messageThreadId");

-- CreateIndex
CREATE UNIQUE INDEX "TagAssignment_tagId_draftId_key" ON "TagAssignment"("tagId", "draftId");

-- AddForeignKey
ALTER TABLE "TagAssignment" ADD CONSTRAINT "TagAssignment_messageThreadId_fkey" FOREIGN KEY ("messageThreadId") REFERENCES "MessageThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagAssignment" ADD CONSTRAINT "TagAssignment_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "Draft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
