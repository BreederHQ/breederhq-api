import prisma from '../prisma.js';
import { executeAllRulesForEntity } from '../lib/rule-engine.js';

/**
 * Daily cron job to execute time-based rules
 * This checks all offspring for age-based rules that might need to be triggered
 */

let cronJobHandle: NodeJS.Timeout | null = null;

/**
 * Start the rule execution cron job
 * Runs every day at 3 AM to execute time-based rules
 */
export function startRuleExecutionJob(): void {
  if (cronJobHandle) {
    console.log('[RuleExecution] Job already running');
    return;
  }

  console.log('[RuleExecution] Starting daily rule execution job');

  // Run immediately on startup (in background)
  setTimeout(() => {
    executeTimeBasedRules().catch(err => {
      console.error('[RuleExecution] Initial run failed:', err);
    });
  }, 5000); // Wait 5 seconds after startup

  // Schedule to run daily at 3 AM
  const scheduleNextRun = () => {
    const now = new Date();
    const next = new Date(now);
    next.setHours(3, 0, 0, 0); // 3:00 AM

    // If 3 AM has already passed today, schedule for tomorrow
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    const msUntilNext = next.getTime() - now.getTime();

    console.log(
      `[RuleExecution] Next run scheduled for ${next.toISOString()} (in ${Math.round(
        msUntilNext / 1000 / 60
      )} minutes)`
    );

    cronJobHandle = setTimeout(() => {
      executeTimeBasedRules()
        .catch(err => {
          console.error('[RuleExecution] Daily run failed:', err);
        })
        .finally(() => {
          // Schedule the next run
          scheduleNextRun();
        });
    }, msUntilNext);
  };

  scheduleNextRun();
}

/**
 * Stop the rule execution cron job
 */
export function stopRuleExecutionJob(): void {
  if (cronJobHandle) {
    clearTimeout(cronJobHandle);
    cronJobHandle = null;
    console.log('[RuleExecution] Job stopped');
  }
}

/**
 * Execute time-based rules for all relevant entities
 * This includes:
 * - Age-based listing rules
 * - Age-based visibility rules
 * - Scheduled notifications
 */
async function executeTimeBasedRules(): Promise<void> {
  console.log('[RuleExecution] Starting time-based rule execution');

  const startTime = Date.now();
  let offspringProcessed = 0;
  let rulesExecuted = 0;
  let errors = 0;

  try {
    // Find all offspring that might be affected by time-based rules
    // Focus on:
    // 1. Offspring that are not yet listed but might be old enough now
    // 2. Offspring that recently reached age milestones

    const offspring = await prisma.offspring.findMany({
      where: {
        // Only check offspring that are still relevant
        lifeState: {
          not: 'DECEASED'
        },
        // Either not placed or recently born (within last 6 months)
        OR: [
          {
            placementState: {
              not: 'PLACED'
            }
          },
          {
            bornAt: {
              gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) // 6 months ago
            }
          }
        ]
      },
      select: {
        id: true,
        tenantId: true,
        bornAt: true,
        marketplaceListed: true,
        keeperIntent: true,
      },
      // Limit to prevent overwhelming the system
      take: 1000
    });

    console.log(`[RuleExecution] Found ${offspring.length} offspring to check`);

    // Execute rules for each offspring in batches to avoid overwhelming the system
    const batchSize = 50;
    for (let i = 0; i < offspring.length; i += batchSize) {
      const batch = offspring.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (o) => {
          try {
            const result = await executeAllRulesForEntity(
              'OFFSPRING',
              o.id,
              o.tenantId,
              'cron_job'
            );

            offspringProcessed++;
            rulesExecuted += result.results.length;

            if (!result.success) {
              errors++;
            }
          } catch (err) {
            errors++;
            console.error(`[RuleExecution] Failed for offspring ${o.id}:`, err);
          }
        })
      );

      // Log progress every batch
      if ((i + batchSize) % 200 === 0) {
        console.log(
          `[RuleExecution] Progress: ${offspringProcessed}/${offspring.length} offspring processed`
        );
      }
    }

    const duration = Date.now() - startTime;

    console.log(
      `[RuleExecution] Completed in ${duration}ms: ` +
      `${offspringProcessed} offspring, ${rulesExecuted} rules executed, ${errors} errors`
    );

  } catch (err) {
    console.error('[RuleExecution] Fatal error during rule execution:', err);
    throw err;
  }
}

/**
 * Manually trigger rule execution (for testing or admin actions)
 */
export async function triggerManualRuleExecution(): Promise<{
  success: boolean;
  processed: number;
  errors: number;
}> {
  console.log('[RuleExecution] Manual trigger initiated');

  try {
    await executeTimeBasedRules();

    return {
      success: true,
      processed: 0, // Would need to track this in executeTimeBasedRules
      errors: 0
    };
  } catch (err) {
    console.error('[RuleExecution] Manual trigger failed:', err);
    return {
      success: false,
      processed: 0,
      errors: 1
    };
  }
}
