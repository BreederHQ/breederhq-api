// src/routes/resource-assignments.ts
// CRUD API for ResourceAssignments — powers "Team" tabs on Animal and BreedingPlan records.

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { requirePermission } from "../middleware/require-permission.js";
import { getActorId } from "../utils/session.js";

// ---------- Helpers ----------

const VALID_RESOURCE_TYPES = ["Animal", "BreedingPlan"] as const;
type ResourceType = (typeof VALID_RESOURCE_TYPES)[number];

const VALID_ASSIGNMENT_ROLES = ["caretaker", "trainer", "vet", "manager"] as const;
type AssignmentRole = (typeof VALID_ASSIGNMENT_ROLES)[number];

/** Map resourceType → the permission namespace used for authorization. */
function permissionNs(rt: string): string {
  return rt === "BreedingPlan" ? "breeding" : "animals";
}

/** Safe integer parser — returns null for invalid values. */
function idNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Prisma select for the User relation on ResourceAssignment. */
const USER_SELECT = {
  select: {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    image: true,
  },
} as const;

/** Shape an assignment row into a response DTO. */
function toDTO(row: any) {
  const user = row.User_ResourceAssignment_userIdToUser;
  return {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    assignmentRole: row.assignmentRole,
    assignedBy: row.assignedBy,
    startDate: row.startDate?.toISOString() ?? null,
    endDate: row.endDate?.toISOString() ?? null,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
    user: user
      ? {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          profileImageUrl: user.image ?? null,
        }
      : null,
  };
}

// ---------- Routes ----------

const resourceAssignmentRoutes: FastifyPluginAsync = async (
  app: FastifyInstance,
) => {
  // ---------------------------------------------------------------
  // GET /resource-assignments?resourceType=Animal&resourceId=123
  // Returns active assignments for a resource (endDate IS NULL or > today).
  // ---------------------------------------------------------------
  app.get(
    "/resource-assignments",
    {
      preHandler: async (req, reply) => {
        const rt = (req.query as any)?.resourceType;
        const cap = `${permissionNs(rt)}.view`;
        return requirePermission(cap)(req, reply);
      },
    },
    async (req, reply) => {
      const tenantId = req.tenantId;
      if (!tenantId)
        return reply
          .code(400)
          .send({ error: "tenant_required", message: "X-Tenant-Id header required" });

      const { resourceType, resourceId } = req.query as any;

      if (!VALID_RESOURCE_TYPES.includes(resourceType))
        return reply
          .code(400)
          .send({ error: "bad_request", message: "Invalid resourceType" });

      const resId = idNum(resourceId);
      if (!resId)
        return reply
          .code(400)
          .send({ error: "bad_request", message: "Invalid resourceId" });

      const now = new Date();

      const rows = await prisma.resourceAssignment.findMany({
        where: {
          tenantId,
          resourceType,
          resourceId: resId,
          OR: [{ endDate: null }, { endDate: { gt: now } }],
        },
        include: {
          User_ResourceAssignment_userIdToUser: USER_SELECT,
        },
        orderBy: { createdAt: "asc" },
      });

      return reply.send({ assignments: rows.map(toDTO) });
    },
  );

  // ---------------------------------------------------------------
  // GET /resource-assignments/mine
  // Returns all active assignments for the current user in the current tenant.
  // Used by scoped roles to know which resources they can access.
  // ---------------------------------------------------------------
  app.get("/resource-assignments/mine", async (req, reply) => {
    const actorId = getActorId(req);
    if (!actorId) return reply.code(401).send({ error: "unauthorized" });

    const tenantId = req.tenantId;
    if (!tenantId)
      return reply
        .code(400)
        .send({ error: "tenant_required", message: "X-Tenant-Id header required" });

    const now = new Date();

    const rows = await prisma.resourceAssignment.findMany({
      where: {
        tenantId,
        userId: actorId,
        OR: [{ endDate: null }, { endDate: { gt: now } }],
      },
      select: {
        resourceType: true,
        resourceId: true,
      },
    });

    return reply.send({
      assignments: rows.map((r) => ({
        resourceType: r.resourceType,
        resourceId: r.resourceId,
      })),
    });
  });

  // ---------------------------------------------------------------
  // POST /resource-assignments
  // Create a new resource assignment.
  // ---------------------------------------------------------------
  app.post(
    "/resource-assignments",
    {
      preHandler: async (req, reply) => {
        const rt = (req.body as any)?.resourceType;
        const cap = `${permissionNs(rt)}.*`;
        return requirePermission(cap)(req, reply);
      },
    },
    async (req, reply) => {
      const actorId = getActorId(req);
      if (!actorId) return reply.code(401).send({ error: "unauthorized" });

      const tenantId = req.tenantId;
      if (!tenantId)
        return reply
          .code(400)
          .send({ error: "tenant_required", message: "X-Tenant-Id header required" });

      const body = (req.body || {}) as any;
      const { resourceType, resourceId: rawResourceId, userId, assignmentRole, startDate, endDate } = body;

      // Validate resourceType
      if (!VALID_RESOURCE_TYPES.includes(resourceType))
        return reply
          .code(400)
          .send({ error: "bad_request", message: "Invalid resourceType. Must be 'Animal' or 'BreedingPlan'" });

      // Validate resourceId
      const resourceId = idNum(rawResourceId);
      if (!resourceId)
        return reply
          .code(400)
          .send({ error: "bad_request", message: "Invalid resourceId" });

      // Validate assignmentRole
      if (!VALID_ASSIGNMENT_ROLES.includes(assignmentRole))
        return reply
          .code(400)
          .send({
            error: "bad_request",
            message: "Invalid assignmentRole. Must be 'caretaker', 'trainer', 'vet', or 'manager'",
          });

      // Validate userId
      if (!userId || typeof userId !== "string")
        return reply
          .code(400)
          .send({ error: "bad_request", message: "userId is required" });

      // Validate userId is a member of this tenant
      const membership = await prisma.tenantMembership.findUnique({
        where: { userId_tenantId: { userId, tenantId } },
        select: { userId: true },
      });
      if (!membership)
        return reply
          .code(400)
          .send({ error: "bad_request", message: "User is not a member of this tenant" });

      try {
        const created = await prisma.resourceAssignment.create({
          data: {
            tenantId,
            userId,
            resourceType,
            resourceId,
            assignmentRole,
            assignedBy: actorId,
            startDate: startDate ? new Date(startDate) : null,
            endDate: endDate ? new Date(endDate) : null,
          },
          include: {
            User_ResourceAssignment_userIdToUser: USER_SELECT,
          },
        });

        return reply.code(201).send(toDTO(created));
      } catch (error: any) {
        if (error?.code === "P2002") {
          return reply.code(409).send({
            error: "conflict",
            message: "This user is already assigned to this resource with the same role",
          });
        }
        console.error("Error creating resource assignment:", error);
        return reply.code(500).send({ error: "internal_error" });
      }
    },
  );

  // ---------------------------------------------------------------
  // DELETE /resource-assignments/:id
  // Soft-delete by setting endDate = today (preserves history).
  // ---------------------------------------------------------------
  app.delete(
    "/resource-assignments/:id",
    {
      preHandler: async (req, reply) => {
        // Look up the assignment to determine resourceType for permission check.
        const tenantId = req.tenantId;
        const assignmentId = idNum((req.params as any).id);
        if (!tenantId || !assignmentId) {
          return requirePermission("animals.*")(req, reply);
        }
        const assignment = await prisma.resourceAssignment.findFirst({
          where: { id: assignmentId, tenantId },
          select: { resourceType: true },
        });
        const cap = `${permissionNs(assignment?.resourceType ?? "Animal")}.*`;
        return requirePermission(cap)(req, reply);
      },
    },
    async (req, reply) => {
      const tenantId = req.tenantId;
      if (!tenantId)
        return reply
          .code(400)
          .send({ error: "tenant_required", message: "X-Tenant-Id header required" });

      const assignmentId = idNum((req.params as any).id);
      if (!assignmentId)
        return reply
          .code(400)
          .send({ error: "bad_request", message: "Invalid assignment id" });

      // Verify assignment belongs to this tenant
      const existing = await prisma.resourceAssignment.findFirst({
        where: { id: assignmentId, tenantId },
        select: { id: true, endDate: true },
      });

      if (!existing)
        return reply.code(404).send({ error: "not_found" });

      if (existing.endDate && existing.endDate <= new Date())
        return reply
          .code(400)
          .send({ error: "bad_request", message: "Assignment is already ended" });

      // Soft-delete: set endDate to today
      await prisma.resourceAssignment.update({
        where: { id: assignmentId },
        data: { endDate: new Date(), updatedAt: new Date() },
      });

      return reply.code(200).send({ ok: true });
    },
  );
};

export default resourceAssignmentRoutes;
