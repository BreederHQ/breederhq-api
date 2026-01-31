#!/usr/bin/env tsx
/**
 * Check for messages with null senderPartyId
 * This helps diagnose the "No messages" display issue
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking for messages with null senderPartyId...\n');

  // Count messages with null sender
  const nullSenderCount = await prisma.message.count({
    where: { senderPartyId: null },
  });

  console.log(`Messages with null senderPartyId: ${nullSenderCount}\n`);

  if (nullSenderCount > 0) {
    // Get threads that have messages with null senders
    const messagesWithNullSender = await prisma.message.findMany({
      where: { senderPartyId: null },
      include: {
        thread: {
          select: {
            id: true,
            subject: true,
            tenantId: true,
          },
        },
      },
      take: 10,
    });

    console.log('Sample threads with null sender messages:');
    console.log('═══════════════════════════════════════\n');

    for (const msg of messagesWithNullSender) {
      console.log(`Thread #${msg.thread.id}: ${msg.thread.subject || '(no subject)'}`);
      console.log(`  Message ID: ${msg.id}`);
      console.log(`  Body preview: ${msg.body.substring(0, 50)}...`);
      console.log(`  Created: ${msg.createdAt.toISOString()}`);
      console.log('');
    }
  }

  // Check for threads where ALL messages have null senders
  const allThreads = await prisma.messageThread.findMany({
    include: {
      messages: true,
    },
  });

  const threadsWithOnlyNullSenders = allThreads.filter((t) => {
    if (t.messages.length === 0) return false;
    return t.messages.every((m) => m.senderPartyId === null);
  });

  console.log(`\n📊 Threads where ALL messages have null senders: ${threadsWithOnlyNullSenders.length}`);

  if (threadsWithOnlyNullSenders.length > 0) {
    console.log('\nThese threads might show "No messages" in UI:');
    console.log('═══════════════════════════════════════\n');

    for (const thread of threadsWithOnlyNullSenders) {
      console.log(`Thread #${thread.id}: ${thread.subject || '(no subject)'}`);
      console.log(`  Tenant ID: ${thread.tenantId}`);
      console.log(`  Message count: ${thread.messages.length}`);
      console.log(`  All messages have null sender: YES`);
      console.log('');
    }
  }

  await prisma.$disconnect();
}

main();
