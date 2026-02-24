import { executeAllRulesForEntity } from './rule-engine.js';

/**
 * Trigger hooks for automatic rule execution
 * These functions should be called after data changes to execute relevant rules
 */

/**
 * Trigger rules when an offspring is created
 */
export async function triggerOnOffspringCreated(
  offspringId: number,
  tenantId: number
): Promise<void> {
  try {
    await executeAllRulesForEntity('OFFSPRING', offspringId, tenantId, 'webhook');
  } catch (error) {
    console.error(`Failed to execute rules for offspring ${offspringId}:`, error);
    // Don't throw - rule execution failures shouldn't block the main operation
  }
}

/**
 * Trigger rules when an offspring is updated
 * This should be called after keeperIntent, marketplaceListed, or other key fields change
 */
export async function triggerOnOffspringUpdated(
  offspringId: number,
  tenantId: number,
  changedFields: string[]
): Promise<void> {
  try {
    // Only trigger if relevant fields changed
    const relevantFields = [
      'keeperIntent',
      'marketplaceListed',
      'sex',
      'dateOfBirth',
      'priceCents'
    ];

    const hasRelevantChanges = changedFields.some(field => relevantFields.includes(field));

    if (hasRelevantChanges) {
      await executeAllRulesForEntity('OFFSPRING', offspringId, tenantId, 'webhook');
    }
  } catch (error) {
    console.error(`Failed to execute rules for offspring ${offspringId}:`, error);
  }
}

/**
 * Trigger rules when photos are added to an offspring
 */
export async function triggerOnOffspringPhotosAdded(
  offspringId: number,
  tenantId: number,
  photoCount: number
): Promise<void> {
  try {
    // Execute rules that might care about photos (listing rules, notification rules)
    await executeAllRulesForEntity('OFFSPRING', offspringId, tenantId, 'webhook');
  } catch (error) {
    console.error(`Failed to execute rules for offspring ${offspringId} photos:`, error);
  }
}

/**
 * Trigger rules when a breeding plan is created
 */
export async function triggerOnBreedingPlanCreated(
  planId: number,
  tenantId: number
): Promise<void> {
  try {
    await executeAllRulesForEntity('PLAN', planId, tenantId, 'webhook');
  } catch (error) {
    console.error(`Failed to execute rules for breeding plan ${planId}:`, error);
  }
}

/**
 * Trigger rules when a breeding plan is updated
 */
export async function triggerOnBreedingPlanUpdated(
  planId: number,
  tenantId: number,
  changedFields: string[]
): Promise<void> {
  try {
    const relevantFields = ['status', 'expectedDate'];
    const hasRelevantChanges = changedFields.some(field => relevantFields.includes(field));

    if (hasRelevantChanges) {
      await executeAllRulesForEntity('PLAN', planId, tenantId, 'webhook');
    }
  } catch (error) {
    console.error(`Failed to execute rules for breeding plan ${planId}:`, error);
  }
}

/**
 * Trigger rules for all offspring in a breeding plan
 * Useful when plan-level settings change that should cascade
 */
export async function triggerOnAllOffspringInPlan(
  planId: number,
  tenantId: number
): Promise<void> {
  try {
    const prisma = (await import('../prisma.js')).default;

    const allOffspring = await prisma.offspring.findMany({
      where: { breedingPlanId: planId, tenantId },
      select: { id: true }
    });

    // Execute rules for each offspring in parallel
    await Promise.all(
      allOffspring.map(o =>
        executeAllRulesForEntity('OFFSPRING', o.id, tenantId, 'webhook')
          .catch(err => console.error(`Failed to execute rules for offspring ${o.id}:`, err))
      )
    );
  } catch (error) {
    console.error(`Failed to trigger rules for offspring in plan ${planId}:`, error);
  }
}
