/**
 * Breeding Groups API Routes
 *
 * Manages group breeding scenarios for livestock species (sheep, goats, cattle, pigs)
 * where one male is introduced to multiple females for an exposure window.
 *
 * @see docs/codebase/architecture-decisions/0008-BREEDING-GROUP-ENTITY.md
 */

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { Species, BreedingGroupStatus, BreedingGroupMemberStatus, PregnancyCheckMethod, Prisma } from "@prisma/client";

/* ───────────────────────── Constants ───────────────────────── */

const GROUP_BREEDING_SPECIES: Set<Species> = new Set([
  Species.SHEEP,
  Species.GOAT,
  Species.CATTLE,
  Species.PIG,
]);

const SPECIES_GESTATION_DAYS: Record<string, { min: number; max: number }> = {
  SHEEP: { min: 142, max: 152 },
  GOAT: { min: 145, max: 155 },
  PIG: { min: 111, max: 120 },
  CATTLE: { min: 279, max: 292 },
};

/* ───────────────────────── Helpers ───────────────────────── */

function toNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parseDate(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function errorReply(err: unknown): { status: number; payload: { error: string; message?: string } } {
  console.error("[breeding-groups] Error:", err);
  if (err instanceof Error) {
    if (err.message.includes("not found")) {
      return { status: 404, payload: { error: "not_found", message: err.message } };
    }
    if (err.message.includes("validation") || err.message.includes("invalid")) {
      return { status: 400, payload: { error: "validation_error", message: err.message } };
    }
    if (err.message.includes("conflict") || err.message.includes("already")) {
      return { status: 409, payload: { error: "conflict", message: err.message } };
    }
    return { status: 500, payload: { error: "internal_error", message: err.message } };
  }
  return { status: 500, payload: { error: "internal_error" } };
}

function calculateExpectedBirthRange(
  exposureStart: Date,
  exposureEnd: Date | null,
  species: string
): { expectedBirthStart: Date; expectedBirthEnd: Date } {
  const gestation = SPECIES_GESTATION_DAYS[species] || { min: 150, max: 150 };
  const effectiveExposureEnd = exposureEnd || exposureStart;
  return {
    expectedBirthStart: addDays(exposureStart, gestation.min),
    expectedBirthEnd: addDays(effectiveExposureEnd, gestation.max),
  };
}

/* ───────────────────────── Prisma Includes ───────────────────────── */

const groupInclude = {
  sire: { select: { id: true, name: true, species: true, sex: true, photoUrl: true, breed: true } },
  organization: { select: { id: true, name: true } },
  program: { select: { id: true, name: true, slug: true } },
  _count: { select: { members: true } },
};

const memberInclude = {
  dam: { select: { id: true, name: true, species: true, sex: true, photoUrl: true, breed: true } },
  breedingPlan: { select: { id: true, name: true, status: true, expectedBirthDate: true } },
};

const groupDetailInclude = {
  ...groupInclude,
  members: { include: memberInclude, orderBy: { createdAt: "asc" as const } },
};

/* ───────────────────────── DTOs ───────────────────────── */

function toGroupDTO(record: any) {
  const members = record.members || [];
  const pregnantCount = members.filter((m: any) => m.memberStatus === "PREGNANT" || m.memberStatus === "LAMBING_IMMINENT").length;
  const lambedCount = members.filter((m: any) => m.memberStatus === "LAMBED").length;

  return {
    id: record.id,
    tenantId: record.tenantId,
    organizationId: record.organizationId,
    programId: record.programId,
    name: record.name,
    species: record.species,
    breedText: record.breedText,
    seasonLabel: record.seasonLabel,
    notes: record.notes,
    sireId: record.sireId,
    sire: record.sire ? { id: record.sire.id, name: record.sire.name, species: record.sire.species, photoUrl: record.sire.photoUrl } : null,
    exposureStartDate: record.exposureStartDate.toISOString(),
    exposureEndDate: record.exposureEndDate?.toISOString() || null,
    status: record.status,
    memberCount: record._count?.members ?? members.length,
    pregnantCount,
    lambedCount,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toMemberDTO(record: any) {
  return {
    id: record.id,
    groupId: record.groupId,
    damId: record.damId,
    dam: record.dam ? { id: record.dam.id, name: record.dam.name, species: record.dam.species, photoUrl: record.dam.photoUrl } : null,
    memberStatus: record.memberStatus,
    exposedAt: record.exposedAt?.toISOString() || null,
    removedAt: record.removedAt?.toISOString() || null,
    pregnancyConfirmedAt: record.pregnancyConfirmedAt?.toISOString() || null,
    pregnancyCheckMethod: record.pregnancyCheckMethod,
    breedingPlanId: record.breedingPlanId,
    breedingPlan: record.breedingPlan ? {
      id: record.breedingPlan.id,
      name: record.breedingPlan.name,
      status: record.breedingPlan.status,
      expectedBirthDate: record.breedingPlan.expectedBirthDate?.toISOString() || null,
    } : null,
    expectedBirthStart: record.expectedBirthStart?.toISOString() || null,
    expectedBirthEnd: record.expectedBirthEnd?.toISOString() || null,
    actualBirthDate: record.actualBirthDate?.toISOString() || null,
    offspringCount: record.offspringCount,
    liveCount: record.liveCount,
    stillbornCount: record.stillbornCount,
    birthNotes: record.birthNotes,
    notes: record.notes,
    createdAt: record.createdAt.toISOString(),
  };
}

/* ───────────────────────── Routes ───────────────────────── */

const breedingGroupsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {

  // GET /breeding/groups - List all breeding groups
  app.get<{ Querystring: { species?: string; status?: string; programId?: string; sireId?: string; search?: string; page?: string; limit?: string } }>(
    "/breeding/groups",
    async (req, reply) => {
      try {
        const tenantId = Number((req as any).tenantId);
        const page = Math.max(1, parseInt(req.query.page || "1", 10));
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || "50", 10)));
        const skip = (page - 1) * limit;

        const where: Prisma.BreedingGroupWhereInput = { tenantId, deletedAt: null };
        if (req.query.species) where.species = { in: req.query.species.split(",").map(s => s.trim().toUpperCase()) as Species[] };
        if (req.query.status) where.status = { in: req.query.status.split(",").map(s => s.trim().toUpperCase()) as BreedingGroupStatus[] };
        const programIdFilter = toNum(req.query.programId);
        if (programIdFilter) where.programId = programIdFilter;
        const sireIdFilter = toNum(req.query.sireId);
        if (sireIdFilter) where.sireId = sireIdFilter;
        if (req.query.search) {
          where.OR = [
            { name: { contains: req.query.search, mode: "insensitive" } },
            { seasonLabel: { contains: req.query.search, mode: "insensitive" } },
            { sire: { name: { contains: req.query.search, mode: "insensitive" } } },
          ];
        }

        const [total, groups] = await Promise.all([
          prisma.breedingGroup.count({ where }),
          prisma.breedingGroup.findMany({
            where,
            include: { ...groupInclude, members: { select: { memberStatus: true } } },
            orderBy: [{ status: "asc" }, { exposureStartDate: "desc" }],
            skip,
            take: limit,
          }),
        ]);

        reply.send({ items: groups.map(toGroupDTO), total, page, limit, totalPages: Math.ceil(total / limit) });
      } catch (err) {
        const { status, payload } = errorReply(err);
        reply.status(status).send(payload);
      }
    }
  );

  // GET /breeding/groups/:id - Get single group with members
  app.get<{ Params: { id: string } }>("/breeding/groups/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const groupId = toNum(req.params.id);
      if (!groupId) return reply.code(400).send({ error: "invalid_group_id" });

      const group = await prisma.breedingGroup.findFirst({
        where: { id: groupId, tenantId, deletedAt: null },
        include: groupDetailInclude,
      });
      if (!group) return reply.code(404).send({ error: "group_not_found" });

      reply.send({ ...toGroupDTO(group), members: group.members.map(toMemberDTO) });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // POST /breeding/groups - Create new group
  app.post<{ Body: { name: string; species: string; breedText?: string; sireId: number; exposureStartDate: string; exposureEndDate?: string; programId?: number; organizationId?: number; notes?: string; seasonLabel?: string; damIds?: number[] } }>(
    "/breeding/groups",
    async (req, reply) => {
      try {
        const tenantId = Number((req as any).tenantId);
        const { name, species, breedText, sireId, exposureStartDate, exposureEndDate, programId, organizationId, notes, seasonLabel, damIds } = req.body;

        if (!name?.trim()) return reply.code(400).send({ error: "validation_error", message: "Name is required" });

        const speciesUpper = species?.toUpperCase() as Species;
        if (!GROUP_BREEDING_SPECIES.has(speciesUpper)) {
          return reply.code(400).send({ error: "validation_error", message: `Species ${species} does not support group breeding` });
        }

        const exposureStart = parseDate(exposureStartDate);
        if (!exposureStart) return reply.code(400).send({ error: "validation_error", message: "Valid exposureStartDate required" });
        const exposureEnd = exposureEndDate ? parseDate(exposureEndDate) : null;

        const sire = await prisma.animal.findFirst({ where: { id: sireId, tenantId }, select: { id: true, species: true, sex: true } });
        if (!sire) return reply.code(404).send({ error: "sire_not_found" });
        if (sire.species !== speciesUpper) return reply.code(400).send({ error: "validation_error", message: `Sire species must match group species` });
        if (sire.sex !== "MALE") return reply.code(400).send({ error: "validation_error", message: "Sire must be male" });

        if (programId) {
          const program = await prisma.mktListingBreedingProgram.findFirst({ where: { id: programId, tenantId } });
          if (!program) return reply.code(404).send({ error: "program_not_found" });
        }

        const result = await prisma.$transaction(async (tx) => {
          const group = await tx.breedingGroup.create({
            data: {
              tenantId,
              organizationId: organizationId || null,
              programId: programId || null,
              name: name.trim(),
              species: speciesUpper,
              breedText: breedText || null,
              seasonLabel: seasonLabel || null,
              notes: notes || null,
              sireId,
              exposureStartDate: exposureStart,
              exposureEndDate: exposureEnd,
              status: exposureEnd ? BreedingGroupStatus.EXPOSURE_COMPLETE : BreedingGroupStatus.ACTIVE,
            },
          });

          if (damIds && damIds.length > 0) {
            const { expectedBirthStart, expectedBirthEnd } = calculateExpectedBirthRange(exposureStart, exposureEnd, speciesUpper);
            for (const damId of damIds) {
              const dam = await tx.animal.findFirst({ where: { id: damId, tenantId }, select: { id: true, species: true, sex: true } });
              if (!dam || dam.species !== speciesUpper || dam.sex !== "FEMALE") continue;

              const existing = await tx.breedingGroupMember.findFirst({
                where: {
                  damId,
                  group: { tenantId, status: { in: ["ACTIVE", "EXPOSURE_COMPLETE", "MONITORING"] }, deletedAt: null },
                  memberStatus: { notIn: ["REMOVED", "NOT_PREGNANT"] },
                },
              });
              if (existing) continue;

              await tx.breedingGroupMember.create({
                data: { tenantId, groupId: group.id, damId, memberStatus: "EXPOSED", exposedAt: exposureStart, expectedBirthStart, expectedBirthEnd },
              });
            }
          }

          return tx.breedingGroup.findUnique({ where: { id: group.id }, include: groupDetailInclude });
        });

        if (!result) return reply.code(500).send({ error: "internal_error" });
        reply.code(201).send({ ...toGroupDTO(result), members: result.members.map(toMemberDTO) });
      } catch (err) {
        const { status, payload } = errorReply(err);
        reply.status(status).send(payload);
      }
    }
  );

  // PATCH /breeding/groups/:id - Update group
  app.patch<{ Params: { id: string }; Body: { name?: string; breedText?: string; exposureEndDate?: string; programId?: number | null; notes?: string; seasonLabel?: string; status?: string } }>(
    "/breeding/groups/:id",
    async (req, reply) => {
      try {
        const tenantId = Number((req as any).tenantId);
        const groupId = toNum(req.params.id);
        if (!groupId) return reply.code(400).send({ error: "invalid_group_id" });

        const group = await prisma.breedingGroup.findFirst({ where: { id: groupId, tenantId, deletedAt: null } });
        if (!group) return reply.code(404).send({ error: "group_not_found" });

        const updateData: Prisma.BreedingGroupUpdateInput = {};
        if (req.body.name !== undefined) updateData.name = req.body.name.trim();
        if (req.body.breedText !== undefined) updateData.breedText = req.body.breedText || null;
        if (req.body.notes !== undefined) updateData.notes = req.body.notes || null;
        if (req.body.seasonLabel !== undefined) updateData.seasonLabel = req.body.seasonLabel || null;
        if (req.body.exposureEndDate !== undefined) {
          const exposureEnd = req.body.exposureEndDate ? parseDate(req.body.exposureEndDate) : null;
          updateData.exposureEndDate = exposureEnd;
          if (exposureEnd && group.status === "ACTIVE") updateData.status = "EXPOSURE_COMPLETE";
        }
        if (req.body.programId !== undefined) {
          if (req.body.programId === null) updateData.program = { disconnect: true };
          else updateData.program = { connect: { id: req.body.programId } };
        }
        if (req.body.status !== undefined) {
          const status = req.body.status.toUpperCase() as BreedingGroupStatus;
          if (Object.values(BreedingGroupStatus).includes(status)) updateData.status = status;
        }

        const updated = await prisma.breedingGroup.update({ where: { id: groupId }, data: updateData, include: groupDetailInclude });
        reply.send({ ...toGroupDTO(updated), members: updated.members.map(toMemberDTO) });
      } catch (err) {
        const { status, payload } = errorReply(err);
        reply.status(status).send(payload);
      }
    }
  );

  // DELETE /breeding/groups/:id - Soft delete group
  app.delete<{ Params: { id: string } }>("/breeding/groups/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const groupId = toNum(req.params.id);
      if (!groupId) return reply.code(400).send({ error: "invalid_group_id" });

      const group = await prisma.breedingGroup.findFirst({
        where: { id: groupId, tenantId, deletedAt: null },
        include: { members: { where: { breedingPlanId: { not: null } }, select: { id: true } } },
      });
      if (!group) return reply.code(404).send({ error: "group_not_found" });
      if (group.members.length > 0) return reply.code(409).send({ error: "conflict", message: `Cannot delete group with ${group.members.length} graduated member(s)` });

      await prisma.breedingGroup.update({ where: { id: groupId }, data: { deletedAt: new Date(), status: "CANCELED" } });
      reply.code(204).send();
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // POST /breeding/groups/:id/members - Add single member
  app.post<{ Params: { id: string }; Body: { damId: number; exposedAt?: string } }>("/breeding/groups/:id/members", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const groupId = toNum(req.params.id);
      if (!groupId) return reply.code(400).send({ error: "invalid_group_id" });

      const { damId, exposedAt } = req.body;
      if (!damId) return reply.code(400).send({ error: "validation_error", message: "damId required" });

      const group = await prisma.breedingGroup.findFirst({ where: { id: groupId, tenantId, deletedAt: null } });
      if (!group) return reply.code(404).send({ error: "group_not_found" });

      const dam = await prisma.animal.findFirst({ where: { id: damId, tenantId }, select: { id: true, species: true, sex: true, name: true } });
      if (!dam) return reply.code(404).send({ error: "dam_not_found" });
      if (dam.species !== group.species) return reply.code(400).send({ error: "validation_error", message: "Dam species must match group" });
      if (dam.sex !== "FEMALE") return reply.code(400).send({ error: "validation_error", message: "Dam must be female" });

      const existingInGroup = await prisma.breedingGroupMember.findFirst({ where: { groupId, damId } });
      if (existingInGroup) return reply.code(409).send({ error: "conflict", message: "Dam already in this group" });

      const existingInOther = await prisma.breedingGroupMember.findFirst({
        where: { damId, groupId: { not: groupId }, group: { tenantId, status: { in: ["ACTIVE", "EXPOSURE_COMPLETE", "MONITORING"] }, deletedAt: null }, memberStatus: { notIn: ["REMOVED", "NOT_PREGNANT"] } },
        include: { group: { select: { name: true } } },
      });
      if (existingInOther) return reply.code(409).send({ error: "conflict", message: `Dam in active group "${existingInOther.group.name}"` });

      const exposedDate = exposedAt ? parseDate(exposedAt) : group.exposureStartDate;
      const { expectedBirthStart, expectedBirthEnd } = calculateExpectedBirthRange(exposedDate!, group.exposureEndDate, group.species);

      const member = await prisma.breedingGroupMember.create({
        data: { tenantId, groupId, damId, memberStatus: "EXPOSED", exposedAt: exposedDate, expectedBirthStart, expectedBirthEnd },
        include: memberInclude,
      });

      reply.code(201).send(toMemberDTO(member));
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // POST /breeding/groups/:id/members/bulk - Add multiple members
  app.post<{ Params: { id: string }; Body: { damIds: number[] } }>("/breeding/groups/:id/members/bulk", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const groupId = toNum(req.params.id);
      if (!groupId) return reply.code(400).send({ error: "invalid_group_id" });

      const { damIds } = req.body;
      if (!damIds || !Array.isArray(damIds) || damIds.length === 0) return reply.code(400).send({ error: "validation_error", message: "damIds array required" });

      const group = await prisma.breedingGroup.findFirst({ where: { id: groupId, tenantId, deletedAt: null } });
      if (!group) return reply.code(404).send({ error: "group_not_found" });

      const { expectedBirthStart, expectedBirthEnd } = calculateExpectedBirthRange(group.exposureStartDate, group.exposureEndDate, group.species);
      const added: any[] = [];
      const skipped: Array<{ damId: number; reason: string }> = [];

      for (const damId of damIds) {
        const dam = await prisma.animal.findFirst({ where: { id: damId, tenantId }, select: { id: true, species: true, sex: true } });
        if (!dam) { skipped.push({ damId, reason: "Not found" }); continue; }
        if (dam.species !== group.species) { skipped.push({ damId, reason: "Species mismatch" }); continue; }
        if (dam.sex !== "FEMALE") { skipped.push({ damId, reason: "Not female" }); continue; }

        const existingInGroup = await prisma.breedingGroupMember.findFirst({ where: { groupId, damId } });
        if (existingInGroup) { skipped.push({ damId, reason: "Already in group" }); continue; }

        const existingInOther = await prisma.breedingGroupMember.findFirst({
          where: { damId, groupId: { not: groupId }, group: { tenantId, status: { in: ["ACTIVE", "EXPOSURE_COMPLETE", "MONITORING"] }, deletedAt: null }, memberStatus: { notIn: ["REMOVED", "NOT_PREGNANT"] } },
        });
        if (existingInOther) { skipped.push({ damId, reason: "In another active group" }); continue; }

        const member = await prisma.breedingGroupMember.create({
          data: { tenantId, groupId, damId, memberStatus: "EXPOSED", exposedAt: group.exposureStartDate, expectedBirthStart, expectedBirthEnd },
          include: memberInclude,
        });
        added.push(toMemberDTO(member));
      }

      reply.send({ added, skipped });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // DELETE /breeding/groups/:id/members/:damId - Remove member
  app.delete<{ Params: { id: string; damId: string } }>("/breeding/groups/:id/members/:damId", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const groupId = toNum(req.params.id);
      const damId = toNum(req.params.damId);
      if (!groupId) return reply.code(400).send({ error: "invalid_group_id" });
      if (!damId) return reply.code(400).send({ error: "invalid_dam_id" });

      const member = await prisma.breedingGroupMember.findFirst({ where: { groupId, damId, group: { tenantId, deletedAt: null } } });
      if (!member) return reply.code(404).send({ error: "member_not_found" });
      if (member.breedingPlanId) return reply.code(409).send({ error: "conflict", message: "Cannot remove member with breeding plan" });

      await prisma.breedingGroupMember.update({ where: { id: member.id }, data: { memberStatus: "REMOVED", removedAt: new Date() } });
      reply.code(204).send();
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // POST /breeding/groups/:id/end-exposure - End exposure period
  app.post<{ Params: { id: string }; Body: { exposureEndDate: string } }>("/breeding/groups/:id/end-exposure", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const groupId = toNum(req.params.id);
      if (!groupId) return reply.code(400).send({ error: "invalid_group_id" });

      const exposureEnd = parseDate(req.body.exposureEndDate);
      if (!exposureEnd) return reply.code(400).send({ error: "validation_error", message: "Valid exposureEndDate required" });

      const group = await prisma.breedingGroup.findFirst({ where: { id: groupId, tenantId, deletedAt: null } });
      if (!group) return reply.code(404).send({ error: "group_not_found" });
      if (group.status !== "ACTIVE") return reply.code(400).send({ error: "validation_error", message: `Cannot end exposure for ${group.status} group` });

      const updated = await prisma.$transaction(async (tx) => {
        const { expectedBirthStart, expectedBirthEnd } = calculateExpectedBirthRange(group.exposureStartDate, exposureEnd, group.species);
        await tx.breedingGroupMember.updateMany({ where: { groupId, memberStatus: "EXPOSED" }, data: { expectedBirthStart, expectedBirthEnd } });
        return tx.breedingGroup.update({ where: { id: groupId }, data: { exposureEndDate: exposureEnd, status: "EXPOSURE_COMPLETE" }, include: groupDetailInclude });
      });

      reply.send({ ...toGroupDTO(updated), members: updated.members.map(toMemberDTO) });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // POST /breeding/groups/:id/members/:damId/confirm-pregnancy - Confirm pregnancy & create plan
  app.post<{ Params: { id: string; damId: string }; Body: { pregnancyConfirmedAt?: string; pregnancyCheckMethod?: string; notes?: string } }>(
    "/breeding/groups/:id/members/:damId/confirm-pregnancy",
    async (req, reply) => {
      try {
        const tenantId = Number((req as any).tenantId);
        const groupId = toNum(req.params.id);
        const damId = toNum(req.params.damId);
        if (!groupId) return reply.code(400).send({ error: "invalid_group_id" });
        if (!damId) return reply.code(400).send({ error: "invalid_dam_id" });

        const { pregnancyConfirmedAt, pregnancyCheckMethod, notes } = req.body;

        const member = await prisma.breedingGroupMember.findFirst({
          where: { groupId, damId, group: { tenantId, deletedAt: null } },
          include: { group: true, dam: { select: { id: true, name: true, species: true } } },
        });
        if (!member) return reply.code(404).send({ error: "member_not_found" });
        if (member.breedingPlanId) return reply.code(409).send({ error: "conflict", message: "Already has breeding plan" });
        if (member.memberStatus === "REMOVED") return reply.code(400).send({ error: "validation_error", message: "Cannot confirm removed member" });

        const confirmedAt = pregnancyConfirmedAt ? parseDate(pregnancyConfirmedAt) : new Date();

        const result = await prisma.$transaction(async (tx) => {
          const expectedBirthDate = member.expectedBirthStart
            ? new Date((member.expectedBirthStart.getTime() + (member.expectedBirthEnd?.getTime() || member.expectedBirthStart.getTime())) / 2)
            : null;

          const plan = await tx.breedingPlan.create({
            data: {
              tenantId,
              organizationId: member.group.organizationId,
              programId: member.group.programId,
              name: `${member.dam?.name || "Unknown"} - ${member.group.name}`,
              species: member.group.species,
              breedText: member.group.breedText,
              damId: member.damId,
              sireId: member.group.sireId,
              status: "BRED",
              expectedBirthDate,
              breedDateActual: member.group.exposureStartDate,
              notes: notes || null,
            },
          });

          const updatedMember = await tx.breedingGroupMember.update({
            where: { id: member.id },
            data: {
              memberStatus: "PREGNANT",
              pregnancyConfirmedAt: confirmedAt,
              pregnancyCheckMethod: pregnancyCheckMethod ? (pregnancyCheckMethod.toUpperCase() as PregnancyCheckMethod) : null,
              breedingPlanId: plan.id,
              notes: notes || member.notes,
            },
            include: memberInclude,
          });

          if (member.group.status === "EXPOSURE_COMPLETE") {
            await tx.breedingGroup.update({ where: { id: groupId }, data: { status: "MONITORING" } });
          }

          return { member: updatedMember, plan };
        });

        reply.send({
          member: toMemberDTO(result.member),
          breedingPlan: { id: result.plan.id, damId: result.plan.damId, sireId: result.plan.sireId, status: result.plan.status, expectedBirthDate: result.plan.expectedBirthDate?.toISOString() || null, groupMemberId: result.member.id },
        });
      } catch (err) {
        const { status, payload } = errorReply(err);
        reply.status(status).send(payload);
      }
    }
  );

  // POST /breeding/groups/:id/members/:damId/mark-not-pregnant
  app.post<{ Params: { id: string; damId: string }; Body: { checkedAt?: string; notes?: string } }>(
    "/breeding/groups/:id/members/:damId/mark-not-pregnant",
    async (req, reply) => {
      try {
        const tenantId = Number((req as any).tenantId);
        const groupId = toNum(req.params.id);
        const damId = toNum(req.params.damId);
        if (!groupId) return reply.code(400).send({ error: "invalid_group_id" });
        if (!damId) return reply.code(400).send({ error: "invalid_dam_id" });

        const { checkedAt, notes } = req.body;

        const member = await prisma.breedingGroupMember.findFirst({ where: { groupId, damId, group: { tenantId, deletedAt: null } }, include: memberInclude });
        if (!member) return reply.code(404).send({ error: "member_not_found" });
        if (member.breedingPlanId) return reply.code(409).send({ error: "conflict", message: "Cannot mark - has breeding plan" });

        const updated = await prisma.breedingGroupMember.update({
          where: { id: member.id },
          data: { memberStatus: "NOT_PREGNANT", pregnancyConfirmedAt: checkedAt ? parseDate(checkedAt) : new Date(), notes: notes || member.notes },
          include: memberInclude,
        });

        reply.send(toMemberDTO(updated));
      } catch (err) {
        const { status, payload } = errorReply(err);
        reply.status(status).send(payload);
      }
    }
  );

  // PATCH /breeding/groups/:id/members/:damId/status - Update member status
  app.patch<{ Params: { id: string; damId: string }; Body: { status: string } }>(
    "/breeding/groups/:id/members/:damId/status",
    async (req, reply) => {
      try {
        const tenantId = Number((req as any).tenantId);
        const groupId = toNum(req.params.id);
        const damId = toNum(req.params.damId);
        if (!groupId) return reply.code(400).send({ error: "invalid_group_id" });
        if (!damId) return reply.code(400).send({ error: "invalid_dam_id" });

        const memberStatus = req.body.status?.toUpperCase() as BreedingGroupMemberStatus;
        if (!Object.values(BreedingGroupMemberStatus).includes(memberStatus)) {
          return reply.code(400).send({ error: "validation_error", message: `Invalid status` });
        }

        const member = await prisma.breedingGroupMember.findFirst({ where: { groupId, damId, group: { tenantId, deletedAt: null } } });
        if (!member) return reply.code(404).send({ error: "member_not_found" });

        const updated = await prisma.breedingGroupMember.update({ where: { id: member.id }, data: { memberStatus }, include: memberInclude });
        reply.send(toMemberDTO(updated));
      } catch (err) {
        const { status, payload } = errorReply(err);
        reply.status(status).send(payload);
      }
    }
  );

  // POST /breeding/groups/:id/members/:damId/record-birth - Record birth outcome
  app.post<{
    Params: { id: string; damId: string };
    Body: {
      actualBirthDate: string;
      offspringCount: number;
      liveCount?: number;
      stillbornCount?: number;
      birthNotes?: string;
    };
  }>(
    "/breeding/groups/:id/members/:damId/record-birth",
    async (req, reply) => {
      try {
        const tenantId = Number((req as any).tenantId);
        const groupId = toNum(req.params.id);
        const damId = toNum(req.params.damId);
        if (!groupId) return reply.code(400).send({ error: "invalid_group_id" });
        if (!damId) return reply.code(400).send({ error: "invalid_dam_id" });

        const { actualBirthDate, offspringCount, liveCount, stillbornCount, birthNotes } = req.body;

        // Validate required fields
        if (!actualBirthDate) {
          return reply.code(400).send({ error: "validation_error", message: "actualBirthDate is required" });
        }
        if (offspringCount === undefined || offspringCount === null || offspringCount < 0) {
          return reply.code(400).send({ error: "validation_error", message: "offspringCount must be >= 0" });
        }

        const birthDate = parseDate(actualBirthDate);
        if (!birthDate) {
          return reply.code(400).send({ error: "validation_error", message: "Invalid date format" });
        }

        const member = await prisma.breedingGroupMember.findFirst({
          where: { groupId, damId, group: { tenantId, deletedAt: null } },
          include: { group: true },
        });
        if (!member) return reply.code(404).send({ error: "member_not_found" });

        // Only pregnant members can have birth recorded
        if (member.memberStatus !== "PREGNANT" && member.memberStatus !== "LAMBING_IMMINENT") {
          return reply.code(400).send({
            error: "validation_error",
            message: "Birth can only be recorded for pregnant members",
          });
        }

        // Calculate live/stillborn counts if not provided
        const live = liveCount ?? offspringCount;
        const stillborn = stillbornCount ?? 0;

        // Update the member with birth information
        const updated = await prisma.breedingGroupMember.update({
          where: { id: member.id },
          data: {
            memberStatus: "LAMBED",
            actualBirthDate: birthDate,
            offspringCount,
            liveCount: live,
            stillbornCount: stillborn,
            birthNotes: birthNotes || null,
          },
          include: memberInclude,
        });

        // Check if all pregnant members have lambed - if so, update group status
        const remainingPregnant = await prisma.breedingGroupMember.count({
          where: {
            groupId,
            memberStatus: { in: ["PREGNANT", "LAMBING_IMMINENT"] },
          },
        });

        if (remainingPregnant === 0 && member.group.status !== "COMPLETE") {
          // All births recorded - mark group as complete
          await prisma.breedingGroup.update({
            where: { id: groupId },
            data: { status: "COMPLETE" },
          });
        }

        reply.send(toMemberDTO(updated));
      } catch (err) {
        const { status, payload } = errorReply(err);
        reply.status(status).send(payload);
      }
    }
  );
};

export default breedingGroupsRoutes;
