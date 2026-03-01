import { BreedingRuleLevel, BreedingProgramRule } from '@prisma/client';
import prisma from '../prisma.js';
import { resolveOffspringPrice } from '../services/commerce-pricing.js';

/**
 * Represents a node in the inheritance chain
 */
interface ChainNode {
  level: BreedingRuleLevel;
  id: string | number;
}

/**
 * Build the inheritance chain from a specific level/entity up to the program level
 * Example: offspring(123) → plan(6) → program('german-shepherds')
 */
export async function buildInheritanceChain(
  level: BreedingRuleLevel,
  id: string | number,
  tenantId: number
): Promise<ChainNode[]> {
  const chain: ChainNode[] = [];

  switch (level) {
    case 'OFFSPRING': {
      const offspring = await prisma.offspring.findUnique({
        where: { id: Number(id), tenantId },
        include: {
          BreedingPlan: {
            include: {
              sire: true,
              dam: true
            }
          }
        }
      });

      if (offspring) {
        chain.push({ level: 'OFFSPRING', id: offspring.id });

        if (offspring.BreedingPlan) {
          const plan = offspring.BreedingPlan;
          chain.push({ level: 'PLAN', id: plan.id });

          // Find program via species/breed match
          // Get species from sire or dam
          const species = plan.sire?.species || plan.dam?.species;
          if (species) {
            // Find breeding program that matches species and optionally breed
            const program = await prisma.mktListingBreedingProgram.findFirst({
              where: {
                tenantId,
                species,
              }
            });

            if (program) {
              chain.push({ level: 'PROGRAM', id: program.slug });
            }
          }
        }
      }
      break;
    }

    case 'PLAN': {
      const plan = await prisma.breedingPlan.findUnique({
        where: { id: Number(id), tenantId },
        include: {
          sire: true,
          dam: true
        }
      });

      if (plan) {
        chain.push({ level: 'PLAN', id: plan.id });

        const species = plan.sire?.species || plan.dam?.species;
        if (species) {
          const program = await prisma.mktListingBreedingProgram.findFirst({
            where: { tenantId, species }
          });

          if (program) {
            chain.push({ level: 'PROGRAM', id: program.slug });
          }
        }
      }
      break;
    }

    case 'PROGRAM': {
      const program = await prisma.mktListingBreedingProgram.findUnique({
        where: {
          tenantId_slug: {
            tenantId,
            slug: String(id)
          }
        }
      });

      if (program) {
        chain.push({ level: 'PROGRAM', id: program.slug });
      }
      break;
    }
  }

  return chain;
}

/**
 * Get the effective rules for a specific entity, considering inheritance and overrides
 * Most specific rule (closest to leaf) wins for each rule type
 */
export async function getEffectiveRules(
  level: BreedingRuleLevel,
  id: string | number,
  tenantId: number
): Promise<BreedingProgramRule[]> {
  // 1. Build inheritance chain
  const chain = await buildInheritanceChain(level, id, tenantId);

  if (chain.length === 0) {
    return [];
  }

  // 2. Fetch all rules for entities in chain
  const allRules = await prisma.breedingProgramRule.findMany({
    where: {
      tenantId,
      OR: chain.map(node => ({
        level: node.level,
        levelId: String(node.id)
      }))
    }
  });

  // 3. Group by ruleType (same rule at different levels)
  const rulesByType = new Map<string, BreedingProgramRule[]>();
  for (const rule of allRules) {
    if (!rulesByType.has(rule.ruleType)) {
      rulesByType.set(rule.ruleType, []);
    }
    rulesByType.get(rule.ruleType)!.push(rule);
  }

  // 4. For each rule type, apply cascading logic
  const effectiveRules: BreedingProgramRule[] = [];

  for (const [ruleType, rules] of rulesByType.entries()) {
    // Sort by specificity (offspring > plan > program)
    const sorted = sortBySpecificity(rules, chain);

    // Most specific (closest to leaf) wins
    const effective = sorted[0];
    if (effective && effective.enabled) {
      effectiveRules.push(effective);
    }
  }

  return effectiveRules;
}

/**
 * Sort rules by specificity based on the inheritance chain
 * Rules closer to the leaf (offspring) are more specific
 */
function sortBySpecificity(
  rules: BreedingProgramRule[],
  chain: ChainNode[]
): BreedingProgramRule[] {
  // Create a specificity map based on chain order
  const specificityMap = new Map<string, number>();
  chain.forEach((node, index) => {
    const key = `${node.level}:${node.id}`;
    // Lower index = more specific (offspring at 0, program at end)
    specificityMap.set(key, index);
  });

  return rules.sort((a, b) => {
    const keyA = `${a.level}:${a.levelId}`;
    const keyB = `${b.level}:${b.levelId}`;
    const specificityA = specificityMap.get(keyA) ?? 999;
    const specificityB = specificityMap.get(keyB) ?? 999;

    // Lower specificity value = more specific = should come first
    return specificityA - specificityB;
  });
}

/**
 * Execute a rule and log the result
 */
export async function executeRule(
  rule: BreedingProgramRule,
  entityType: 'offspring' | 'plan',
  entityId: number,
  triggeredBy: 'user_action' | 'cron_job' | 'webhook'
): Promise<{ success: boolean; action?: string; changes?: any; error?: string }> {
  try {
    let result: { success: boolean; action?: string; changes?: any; error?: string };

    // Execute the rule based on ruleType
    switch (rule.ruleType) {
      case 'auto_list_available':
        result = await executeAutoListAvailable(rule, entityType, entityId);
        break;

      case 'auto_unlist_on_status_change':
        result = await executeAutoUnlistOnStatusChange(rule, entityType, entityId);
        break;

      case 'default_price_by_sex':
        result = await executeDefaultPriceBySex(rule, entityType, entityId);
        break;

      case 'hide_photos_until_age':
        result = await executeHidePhotosUntilAge(rule, entityType, entityId);
        break;

      case 'accept_inquiries':
        result = await executeAcceptInquiries(rule, entityType, entityId);
        break;

      case 'notify_waitlist_on_photos':
        result = await executeNotifyWaitlistOnPhotos(rule, entityType, entityId);
        break;

      // Add more rule types here as they're implemented
      default:
        result = {
          success: false,
          error: `Unknown rule type: ${rule.ruleType}`
        };
    }

    // Log execution
    await prisma.breedingProgramRuleExecution.create({
      data: {
        tenantId: rule.tenantId,
        ruleId: rule.id,
        triggeredBy,
        entityType,
        entityId,
        success: result.success,
        action: result.action,
        changes: result.changes || null,
        error: result.error || null
      }
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Log failed execution
    await prisma.breedingProgramRuleExecution.create({
      data: {
        tenantId: rule.tenantId,
        ruleId: rule.id,
        triggeredBy,
        entityType,
        entityId,
        success: false,
        error: errorMessage
      }
    });

    return { success: false, error: errorMessage };
  }
}

/**
 * Execute the "auto_list_available" rule
 * Automatically set marketplaceListed = true when keeperIntent = AVAILABLE
 */
async function executeAutoListAvailable(
  rule: BreedingProgramRule,
  entityType: 'offspring' | 'plan',
  entityId: number
): Promise<{ success: boolean; action?: string; changes?: any; error?: string }> {
  if (entityType !== 'offspring') {
    return {
      success: false,
      error: 'auto_list_available rule only applies to offspring'
    };
  }

  const config = rule.config as any;
  const minAgeWeeks = config.minAgeWeeks || 0;
  const requirePhotos = config.requirePhotos || false;
  const minPhotoCount = config.minPhotoCount || 1;

  // Fetch offspring
  const offspring = await prisma.offspring.findUnique({
    where: { id: entityId },
    include: {
      Attachments: true
    }
  });

  if (!offspring) {
    return { success: false, error: 'Offspring not found' };
  }

  // Check if keeperIntent is AVAILABLE
  if (offspring.keeperIntent !== 'AVAILABLE') {
    return {
      success: true,
      action: 'no_action',
      changes: { reason: 'keeperIntent is not AVAILABLE' }
    };
  }

  // Check age condition
  if (offspring.bornAt) {
    const ageInWeeks = Math.floor(
      (Date.now() - offspring.bornAt.getTime()) / (1000 * 60 * 60 * 24 * 7)
    );
    if (ageInWeeks < minAgeWeeks) {
      return {
        success: true,
        action: 'no_action',
        changes: { reason: `Age ${ageInWeeks} weeks is less than minimum ${minAgeWeeks} weeks` }
      };
    }
  }

  // Check photo condition
  if (requirePhotos) {
    const photoCount = offspring.Attachments?.length || 0;
    if (photoCount < minPhotoCount) {
      return {
        success: true,
        action: 'no_action',
        changes: { reason: `Only ${photoCount} photos, requires ${minPhotoCount}` }
      };
    }
  }

  // All conditions met - set marketplaceListed = true
  if (offspring.marketplaceListed) {
    return {
      success: true,
      action: 'no_action',
      changes: { reason: 'Already listed on marketplace' }
    };
  }

  // Resolve price from cascade before listing
  const resolved = await resolveOffspringPrice(entityId, prisma);

  await prisma.offspring.update({
    where: { id: entityId },
    data: {
      marketplaceListed: true,
      marketplacePriceCents: resolved.priceCents,
    }
  });

  return {
    success: true,
    action: 'set_marketplace_listed',
    changes: {
      before: { marketplaceListed: false, marketplacePriceCents: null },
      after: {
        marketplaceListed: true,
        marketplacePriceCents: resolved.priceCents,
        priceSource: resolved.source,
      }
    }
  };
}

/**
 * Execute all effective rules for an entity
 */
export async function executeAllRulesForEntity(
  level: BreedingRuleLevel,
  id: string | number,
  tenantId: number,
  triggeredBy: 'user_action' | 'cron_job' | 'webhook'
): Promise<{ success: boolean; results: any[] }> {
  const rules = await getEffectiveRules(level, id, tenantId);

  const results = [];
  let allSuccessful = true;

  for (const rule of rules) {
    // Determine entity type and ID based on level
    let entityType: 'offspring' | 'plan';
    let entityId: number;

    if (level === 'OFFSPRING') {
      entityType = 'offspring';
      entityId = Number(id);
    } else if (level === 'PLAN') {
      entityType = 'plan';
      entityId = Number(id);
    } else {
      continue; // Skip program level
    }

    const result = await executeRule(rule, entityType, entityId, triggeredBy);
    results.push({
      ruleId: rule.id,
      ruleType: rule.ruleType,
      ...result
    });

    if (!result.success) {
      allSuccessful = false;
    }
  }

  return { success: allSuccessful, results };
}

/**
 * Execute the "auto_unlist_on_status_change" rule
 * Automatically set marketplaceListed = false when keeperIntent changes from AVAILABLE
 */
async function executeAutoUnlistOnStatusChange(
  rule: BreedingProgramRule,
  entityType: 'offspring' | 'plan',
  entityId: number
): Promise<{ success: boolean; action?: string; changes?: any; error?: string }> {
  if (entityType !== 'offspring') {
    return {
      success: false,
      error: 'auto_unlist_on_status_change rule only applies to offspring'
    };
  }

  const offspring = await prisma.offspring.findUnique({
    where: { id: entityId }
  });

  if (!offspring) {
    return { success: false, error: 'Offspring not found' };
  }

  // If keeperIntent is not AVAILABLE and is currently listed, unlist it
  if (offspring.keeperIntent !== 'AVAILABLE' && offspring.marketplaceListed) {
    await prisma.offspring.update({
      where: { id: entityId },
      data: { marketplaceListed: false }
    });

    return {
      success: true,
      action: 'unset_marketplace_listed',
      changes: {
        before: { marketplaceListed: true, keeperIntent: offspring.keeperIntent },
        after: { marketplaceListed: false }
      }
    };
  }

  return {
    success: true,
    action: 'no_action',
    changes: { reason: 'No unlisting needed' }
  };
}

/**
 * Execute the "default_price_by_sex" rule
 * Set different default prices for males and females
 */
async function executeDefaultPriceBySex(
  rule: BreedingProgramRule,
  entityType: 'offspring' | 'plan',
  entityId: number
): Promise<{ success: boolean; action?: string; changes?: any; error?: string }> {
  if (entityType !== 'offspring') {
    return {
      success: false,
      error: 'default_price_by_sex rule only applies to offspring'
    };
  }

  const config = rule.config as any;
  const malePriceCents = config.malePriceCents || 0;
  const femalePriceCents = config.femalePriceCents || 0;
  const applyToExisting = config.applyToExisting || false;

  const offspring = await prisma.offspring.findUnique({
    where: { id: entityId }
  });

  if (!offspring) {
    return { success: false, error: 'Offspring not found' };
  }

  // Skip if already has a price and not applying to existing
  if (!applyToExisting && offspring.priceCents !== null && offspring.priceCents > 0) {
    return {
      success: true,
      action: 'no_action',
      changes: { reason: 'Already has a price' }
    };
  }

  // Determine price based on sex
  let newPrice: number | null = null;
  if (offspring.sex === 'MALE') {
    newPrice = malePriceCents;
  } else if (offspring.sex === 'FEMALE') {
    newPrice = femalePriceCents;
  }

  if (newPrice === null || offspring.priceCents === newPrice) {
    return {
      success: true,
      action: 'no_action',
      changes: { reason: 'No price update needed' }
    };
  }

  await prisma.offspring.update({
    where: { id: entityId },
    data: { priceCents: newPrice }
  });

  return {
    success: true,
    action: 'set_price',
    changes: {
      before: { priceCents: offspring.priceCents },
      after: { priceCents: newPrice }
    }
  };
}

/**
 * Execute the "hide_photos_until_age" rule
 * This is a visibility rule that would be checked when rendering photos
 * No action to take in the database, just returns success
 */
async function executeHidePhotosUntilAge(
  rule: BreedingProgramRule,
  entityType: 'offspring' | 'plan',
  entityId: number
): Promise<{ success: boolean; action?: string; changes?: any; error?: string }> {
  // This rule is passive - it's checked when rendering, not executed
  return {
    success: true,
    action: 'passive_rule',
    changes: { reason: 'Visibility rule - enforced at render time' }
  };
}

/**
 * Execute the "accept_inquiries" rule
 * Enable or disable inquiry acceptance
 * This is metadata that would be checked when handling inquiries
 */
async function executeAcceptInquiries(
  rule: BreedingProgramRule,
  entityType: 'offspring' | 'plan',
  entityId: number
): Promise<{ success: boolean; action?: string; changes?: any; error?: string }> {
  // This rule is passive - it's checked when handling inquiries
  return {
    success: true,
    action: 'passive_rule',
    changes: { reason: 'Inquiry rule - enforced when handling inquiries' }
  };
}

/**
 * Execute the "notify_waitlist_on_photos" rule
 * Send notifications to waitlist members when photos are added
 * This would be triggered by a webhook when photos are uploaded
 */
async function executeNotifyWaitlistOnPhotos(
  rule: BreedingProgramRule,
  entityType: 'offspring' | 'plan',
  entityId: number
): Promise<{ success: boolean; action?: string; changes?: any; error?: string }> {
  if (entityType !== 'offspring') {
    return {
      success: false,
      error: 'notify_waitlist_on_photos rule only applies to offspring'
    };
  }

  const config = rule.config as any;
  const enabled = config.enabled !== false;
  const minPhotos = config.minPhotos || 1;

  if (!enabled) {
    return {
      success: true,
      action: 'no_action',
      changes: { reason: 'Notifications disabled' }
    };
  }

  // In a real implementation, this would:
  // 1. Check if enough photos exist
  // 2. Find all waitlist members for this offspring
  // 3. Send email notifications
  // 4. Track who was notified to avoid duplicates

  // For now, just log that notification should be sent
  return {
    success: true,
    action: 'notification_queued',
    changes: {
      reason: 'Notification would be sent to waitlist members',
      minPhotos,
      entityType,
      entityId
    }
  };
}
