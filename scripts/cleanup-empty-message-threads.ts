#!/usr/bin/env tsx
/**
 * Cleanup Script: Remove Empty Message Threads
 *
 * Purpose: Removes orphaned message threads that have no messages or no participants.
 * This occurs when parties are deleted, triggering cascade deletes on messages and
 * participants, but leaving the thread record behind.
 *
 * Usage:
 *   npm run cleanup:empty-threads
 *
 * Options:
 *   --dry-run    Show what would be deleted without actually deleting
 *   --tenant-id  Only cleanup threads for specific tenant (default: all)
 *
 * Example:
 *   npm run cleanup:empty-threads -- --dry-run
 *   npm run cleanup:empty-threads -- --tenant-id=1
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CleanupStats {
  totalThreads: number;
  threadsWithNoMessages: number;
  threadsWithNoParticipants: number;
  threadsDeleted: number;
  errors: number;
}

async function cleanupEmptyThreads(options: { dryRun: boolean; tenantId?: number }) {
  const stats: CleanupStats = {
    totalThreads: 0,
    threadsWithNoMessages: 0,
    threadsWithNoParticipants: 0,
    threadsDeleted: 0,
    errors: 0,
  };

  console.log('🔍 Scanning for empty message threads...\n');

  try {
    // Build where clause
    const whereClause: any = {};
    if (options.tenantId) {
      whereClause.tenantId = options.tenantId;
    }

    // Get all threads
    const allThreads = await prisma.messageThread.findMany({
      where: whereClause,
      include: {
        messages: { select: { id: true } },
        participants: { select: { id: true } },
      },
    });

    stats.totalThreads = allThreads.length;
    console.log(`📊 Total threads: ${stats.totalThreads}`);

    // Find threads with no messages
    const threadsWithNoMessages = allThreads.filter((t) => t.messages.length === 0);
    stats.threadsWithNoMessages = threadsWithNoMessages.length;
    console.log(`❌ Threads with no messages: ${stats.threadsWithNoMessages}`);

    // Find threads with no participants
    const threadsWithNoParticipants = allThreads.filter((t) => t.participants.length === 0);
    stats.threadsWithNoParticipants = threadsWithNoParticipants.length;
    console.log(`👤 Threads with no participants: ${stats.threadsWithNoParticipants}`);

    // Get threads to delete (either no messages OR no participants)
    const threadsToDelete = new Set<number>();
    threadsWithNoMessages.forEach((t) => threadsToDelete.add(t.id));
    threadsWithNoParticipants.forEach((t) => threadsToDelete.add(t.id));

    console.log(`\n🗑️  Total threads to delete: ${threadsToDelete.size}\n`);

    if (threadsToDelete.size === 0) {
      console.log('✅ No empty threads found. Database is clean!\n');
      return stats;
    }

    // Show details of threads to be deleted
    console.log('📋 Threads to be deleted:\n');
    for (const threadId of threadsToDelete) {
      const thread = allThreads.find((t) => t.id === threadId);
      if (thread) {
        console.log(`  Thread #${thread.id}`);
        console.log(`    Tenant: ${thread.tenantId}`);
        console.log(`    Subject: ${thread.subject || '(no subject)'}`);
        console.log(`    Messages: ${thread.messages.length}`);
        console.log(`    Participants: ${thread.participants.length}`);
        console.log(`    Created: ${thread.createdAt.toISOString()}`);
        console.log(`    Archived: ${thread.archived ? 'Yes' : 'No'}`);
        console.log('');
      }
    }

    if (options.dryRun) {
      console.log('🔄 DRY RUN - No changes made to database\n');
      stats.threadsDeleted = 0;
    } else {
      console.log('🚀 Deleting empty threads...\n');

      // Delete threads in batches
      const threadIds = Array.from(threadsToDelete);
      const batchSize = 100;

      for (let i = 0; i < threadIds.length; i += batchSize) {
        const batch = threadIds.slice(i, i + batchSize);

        try {
          const result = await prisma.messageThread.deleteMany({
            where: {
              id: { in: batch },
            },
          });

          stats.threadsDeleted += result.count;
          console.log(`  Deleted batch ${Math.floor(i / batchSize) + 1}: ${result.count} threads`);
        } catch (err) {
          console.error(`  ❌ Error deleting batch ${Math.floor(i / batchSize) + 1}:`, err);
          stats.errors += batch.length;
        }
      }

      console.log(`\n✅ Cleanup complete! Deleted ${stats.threadsDeleted} threads\n`);
    }

    return stats;
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);

  const dryRun = args.includes('--dry-run');
  const tenantIdArg = args.find((arg) => arg.startsWith('--tenant-id='));
  const tenantId = tenantIdArg ? parseInt(tenantIdArg.split('=')[1], 10) : undefined;

  console.log('\n╔════════════════════════════════════════╗');
  console.log('║  Message Thread Cleanup Script         ║');
  console.log('╚════════════════════════════════════════╝\n');

  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  }

  if (tenantId) {
    console.log(`🎯 Filtering to tenant ID: ${tenantId}\n`);
  }

  try {
    const stats = await cleanupEmptyThreads({ dryRun, tenantId });

    console.log('═══════════════════════════════════════');
    console.log('Summary:');
    console.log('═══════════════════════════════════════');
    console.log(`Total threads scanned:       ${stats.totalThreads}`);
    console.log(`Threads with no messages:    ${stats.threadsWithNoMessages}`);
    console.log(`Threads with no participants: ${stats.threadsWithNoParticipants}`);
    console.log(`Threads deleted:             ${stats.threadsDeleted}`);
    console.log(`Errors:                      ${stats.errors}`);
    console.log('═══════════════════════════════════════\n');

    if (dryRun && (stats.threadsWithNoMessages > 0 || stats.threadsWithNoParticipants > 0)) {
      console.log('💡 To actually delete these threads, run without --dry-run flag\n');
    }
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
