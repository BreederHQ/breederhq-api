import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { BreedingRuleLevel, BreedingRuleCategory } from '@prisma/client';
import { getEffectiveRules, executeAllRulesForEntity, buildInheritanceChain } from '../lib/rule-engine.js';
import prisma from '../prisma.js';

export default async function breedingProgramRulesRoutes(app: FastifyInstance) {
  /**
   * GET /api/v1/breeding/programs/rules/effective
   * Get effective rules for a specific entity (with inheritance resolved)
   */
  app.get('/programs/rules/effective', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = req.query as any;
      const { level, id } = query;
      const tenantId = (req as any).tenantId;

      if (!tenantId) {
        return reply.code(401).send({ error: 'Not authenticated' });
      }

      if (!level || !id) {
        return reply.code(400).send({ error: 'Missing required parameters: level, id' });
      }

      const validLevels: BreedingRuleLevel[] = ['OFFSPRING', 'GROUP', 'PLAN', 'PROGRAM'];
      if (!validLevels.includes(level as BreedingRuleLevel)) {
        return reply.code(400).send({ error: 'Invalid level. Must be: OFFSPRING, GROUP, PLAN, or PROGRAM' });
      }

      const rules = await getEffectiveRules(level as BreedingRuleLevel, id as string, tenantId);

      return reply.send({
        level,
        id,
        rules
      });
    } catch (error) {
      req.log.error('Error fetching effective rules:', error);
      return reply.code(500).send({ error: 'Failed to fetch effective rules' });
    }
  });

  /**
   * GET /api/v1/breeding/programs/rules
   * Get all rules for a specific level/entity
   */
  app.get('/programs/rules', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = req.query as any;
      const { level, levelId, category, enabled } = query;
      const tenantId = (req as any).tenantId;

      if (!tenantId) {
        return reply.code(401).send({ error: 'Not authenticated' });
      }

      const where: any = { tenantId };

      if (level) {
        where.level = level;
      }

      if (levelId) {
        where.levelId = String(levelId);
      }

      if (category) {
        where.category = category;
      }

      if (enabled !== undefined) {
        where.enabled = enabled === 'true';
      }

      const rules = await prisma.breedingProgramRule.findMany({
        where,
        orderBy: [
          { level: 'asc' },
          { category: 'asc' },
          { ruleType: 'asc' }
        ]
      });

      return reply.send({ rules });
    } catch (error) {
      req.log.error('Error fetching rules:', error);
      return reply.code(500).send({ error: 'Failed to fetch rules' });
    }
  });

  /**
   * GET /api/v1/breeding/programs/rules/:id
   * Get a specific rule by ID
   */
  app.get('/programs/rules/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = req.params as any;
      const { id } = params;
      const tenantId = (req as any).tenantId;

      if (!tenantId) {
        return reply.code(401).send({ error: 'Not authenticated' });
      }

      const rule = await prisma.breedingProgramRule.findFirst({
        where: {
          id: parseInt(id),
          tenantId
        },
        include: {
          inheritsFrom: true,
          overriddenBy: true,
          executions: {
            orderBy: { executedAt: 'desc' },
            take: 10
          }
        }
      });

      if (!rule) {
        return reply.code(404).send({ error: 'Rule not found' });
      }

      return reply.send({ rule });
    } catch (error) {
      req.log.error('Error fetching rule:', error);
      return reply.code(500).send({ error: 'Failed to fetch rule' });
    }
  });

  /**
   * POST /api/v1/breeding/programs/rules
   * Create or update a rule
   */
  app.post('/programs/rules', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = req.body as any;
      const {
        category,
        ruleType,
        name,
        description,
        enabled,
        config,
        level,
        levelId,
        inheritsFromId
      } = body;

      const tenantId = (req as any).tenantId;

      if (!tenantId) {
        return reply.code(401).send({ error: 'Not authenticated' });
      }

      // Validate required fields
      if (!category || !ruleType || !name || !level || !levelId) {
        return reply.code(400).send({
          error: 'Missing required fields: category, ruleType, name, level, levelId'
        });
      }

      // Validate enums
      const validCategories: BreedingRuleCategory[] = [
        'LISTING',
        'PRICING',
        'VISIBILITY',
        'BUYER_INTERACTION',
        'STATUS',
        'NOTIFICATIONS'
      ];
      const validLevels: BreedingRuleLevel[] = ['OFFSPRING', 'GROUP', 'PLAN', 'PROGRAM'];

      if (!validCategories.includes(category)) {
        return reply.code(400).send({ error: `Invalid category. Must be one of: ${validCategories.join(', ')}` });
      }

      if (!validLevels.includes(level)) {
        return reply.code(400).send({ error: `Invalid level. Must be one of: ${validLevels.join(', ')}` });
      }

      // Check if rule already exists for this level/entity/type
      const existing = await prisma.breedingProgramRule.findUnique({
        where: {
          tenantId_level_levelId_ruleType: {
            tenantId,
            level,
            levelId: String(levelId),
            ruleType
          }
        }
      });

      let rule;

      if (existing) {
        // Update existing rule
        rule = await prisma.breedingProgramRule.update({
          where: { id: existing.id },
          data: {
            name,
            description,
            enabled: enabled ?? true,
            config: config || {},
            inheritsFromId: inheritsFromId || null
          }
        });
      } else {
        // Create new rule
        rule = await prisma.breedingProgramRule.create({
          data: {
            tenantId,
            category,
            ruleType,
            name,
            description,
            enabled: enabled ?? true,
            config: config || {},
            level,
            levelId: String(levelId),
            inheritsFromId: inheritsFromId || null
          }
        });
      }

      return reply.send({ rule });
    } catch (error) {
      req.log.error('Error creating/updating rule:', error);
      return reply.code(500).send({ error: 'Failed to create/update rule' });
    }
  });

  /**
   * POST /api/v1/breeding/programs/rules/:id/override
   * Create an override for a rule at a more specific level
   */
  app.post('/programs/rules/:id/override', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = req.params as any;
      const { id } = params;
      const body = req.body as any;
      const { level, levelId, enabled, config } = body;
      const tenantId = (req as any).tenantId;

      if (!tenantId) {
        return reply.code(401).send({ error: 'Not authenticated' });
      }

      if (!level || !levelId) {
        return reply.code(400).send({ error: 'Missing required fields: level, levelId' });
      }

      // Get parent rule
      const parentRule = await prisma.breedingProgramRule.findFirst({
        where: {
          id: parseInt(id),
          tenantId
        }
      });

      if (!parentRule) {
        return reply.code(404).send({ error: 'Parent rule not found' });
      }

      // Validate that override is at a more specific level
      const levelHierarchy: BreedingRuleLevel[] = ['PROGRAM', 'PLAN', 'GROUP', 'OFFSPRING'];
      const parentLevelIndex = levelHierarchy.indexOf(parentRule.level);
      const overrideLevelIndex = levelHierarchy.indexOf(level as BreedingRuleLevel);

      if (overrideLevelIndex <= parentLevelIndex) {
        return reply.code(400).send({
          error: 'Override must be at a more specific level than parent rule'
        });
      }

      // Check if override already exists
      const existing = await prisma.breedingProgramRule.findUnique({
        where: {
          tenantId_level_levelId_ruleType: {
            tenantId,
            level: level as BreedingRuleLevel,
            levelId: String(levelId),
            ruleType: parentRule.ruleType
          }
        }
      });

      let override;

      if (existing) {
        // Update existing override
        override = await prisma.breedingProgramRule.update({
          where: { id: existing.id },
          data: {
            enabled: enabled ?? existing.enabled,
            config: config ?? existing.config,
            inheritsFromId: parentRule.id
          }
        });
      } else {
        // Create new override
        override = await prisma.breedingProgramRule.create({
          data: {
            tenantId,
            category: parentRule.category,
            ruleType: parentRule.ruleType,
            name: `${parentRule.name} (Override)`,
            description: parentRule.description,
            enabled: enabled ?? parentRule.enabled,
            config: config ?? parentRule.config,
            level: level as BreedingRuleLevel,
            levelId: String(levelId),
            inheritsFromId: parentRule.id
          }
        });
      }

      return reply.send({ override });
    } catch (error) {
      req.log.error('Error creating override:', error);
      return reply.code(500).send({ error: 'Failed to create override' });
    }
  });

  /**
   * DELETE /api/v1/breeding/programs/rules/:id
   * Delete a rule (or remove an override to revert to inherited)
   */
  app.delete('/programs/rules/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = req.params as any;
      const { id } = params;
      const tenantId = (req as any).tenantId;

      if (!tenantId) {
        return reply.code(401).send({ error: 'Not authenticated' });
      }

      const rule = await prisma.breedingProgramRule.findFirst({
        where: {
          id: parseInt(id),
          tenantId
        }
      });

      if (!rule) {
        return reply.code(404).send({ error: 'Rule not found' });
      }

      await prisma.breedingProgramRule.delete({
        where: { id: parseInt(id) }
      });

      return reply.send({ success: true, message: 'Rule deleted' });
    } catch (error) {
      req.log.error('Error deleting rule:', error);
      return reply.code(500).send({ error: 'Failed to delete rule' });
    }
  });

  /**
   * PATCH /api/v1/breeding/programs/rules/:id/toggle
   * Toggle a rule enabled/disabled
   */
  app.patch('/programs/rules/:id/toggle', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = req.params as any;
      const { id } = params;
      const tenantId = (req as any).tenantId;

      if (!tenantId) {
        return reply.code(401).send({ error: 'Not authenticated' });
      }

      const rule = await prisma.breedingProgramRule.findFirst({
        where: {
          id: parseInt(id),
          tenantId
        }
      });

      if (!rule) {
        return reply.code(404).send({ error: 'Rule not found' });
      }

      const updated = await prisma.breedingProgramRule.update({
        where: { id: parseInt(id) },
        data: { enabled: !rule.enabled }
      });

      return reply.send({ rule: updated });
    } catch (error) {
      req.log.error('Error toggling rule:', error);
      return reply.code(500).send({ error: 'Failed to toggle rule' });
    }
  });

  /**
   * POST /api/v1/breeding/programs/rules/execute
   * Manually execute all rules for an entity (for testing/debugging)
   */
  app.post('/programs/rules/execute', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = req.body as any;
      const { level, id } = body;
      const tenantId = (req as any).tenantId;

      if (!tenantId) {
        return reply.code(401).send({ error: 'Not authenticated' });
      }

      if (!level || !id) {
        return reply.code(400).send({ error: 'Missing required parameters: level, id' });
      }

      const result = await executeAllRulesForEntity(
        level as BreedingRuleLevel,
        id,
        tenantId,
        'user_action'
      );

      return reply.send(result);
    } catch (error) {
      req.log.error('Error executing rules:', error);
      return reply.code(500).send({ error: 'Failed to execute rules' });
    }
  });

  /**
   * GET /api/v1/breeding/programs/rules/:id/executions
   * Get execution history for a rule
   */
  app.get('/programs/rules/:id/executions', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = req.params as any;
      const { id } = params;
      const query = req.query as any;
      const { limit = '50', offset = '0' } = query;
      const tenantId = (req as any).tenantId;

      if (!tenantId) {
        return reply.code(401).send({ error: 'Not authenticated' });
      }

      const rule = await prisma.breedingProgramRule.findFirst({
        where: {
          id: parseInt(id),
          tenantId
        }
      });

      if (!rule) {
        return reply.code(404).send({ error: 'Rule not found' });
      }

      const executions = await prisma.breedingProgramRuleExecution.findMany({
        where: { ruleId: parseInt(id) },
        orderBy: { executedAt: 'desc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string)
      });

      const total = await prisma.breedingProgramRuleExecution.count({
        where: { ruleId: parseInt(id) }
      });

      return reply.send({
        executions,
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });
    } catch (error) {
      req.log.error('Error fetching executions:', error);
      return reply.code(500).send({ error: 'Failed to fetch executions' });
    }
  });

  /**
   * GET /api/v1/breeding/programs/rules/chain
   * Get the inheritance chain for an entity (debugging)
   */
  app.get('/programs/rules/chain', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = req.query as any;
      const { level, id } = query;
      const tenantId = (req as any).tenantId;

      if (!tenantId) {
        return reply.code(401).send({ error: 'Not authenticated' });
      }

      if (!level || !id) {
        return reply.code(400).send({ error: 'Missing required parameters: level, id' });
      }

      const chain = await buildInheritanceChain(
        level as BreedingRuleLevel,
        id as string,
        tenantId
      );

      return reply.send({ chain });
    } catch (error) {
      req.log.error('Error building chain:', error);
      return reply.code(500).send({ error: 'Failed to build inheritance chain' });
    }
  });
}
