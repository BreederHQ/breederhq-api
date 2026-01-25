// src/routes/document-bundles.ts
// Document Bundle CRUD endpoints for Marketing module
// Allows grouping documents together for easy email attachments

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";

/**
 * Transform backend DocumentBundle to frontend shape with document count
 */
function toFrontendBundle(bundle: any): any {
  return {
    id: bundle.id,
    tenantId: bundle.tenantId,
    name: bundle.name,
    description: bundle.description,
    status: bundle.status,
    documentCount: bundle._count?.items ?? bundle.items?.length ?? 0,
    documents: bundle.items
      ? bundle.items.map((item: any) => ({
          id: item.id,
          documentId: item.documentId,
          name: item.document?.title || "Untitled",
          mimeType: item.document?.mimeType || null,
          sizeBytes: item.document?.bytes || item.document?.sizeBytes || null,
          sortOrder: item.sortOrder,
        }))
      : undefined,
    createdAt: bundle.createdAt?.toISOString() || new Date().toISOString(),
    updatedAt: bundle.updatedAt?.toISOString() || new Date().toISOString(),
  };
}

const routes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /document-bundles - List bundles with filtering
  app.get("/document-bundles", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const { status, q, limit, offset } = req.query as any;

    const where: any = { tenantId };

    // Filter by status (default: active only)
    if (status) {
      where.status = status;
    } else {
      where.status = "active";
    }

    // Search by name or description
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ];
    }

    const take = limit ? Number(limit) : 100;
    const skip = offset ? Number(offset) : 0;

    const [bundles, total] = await Promise.all([
      prisma.documentBundle.findMany({
        where,
        include: {
          _count: {
            select: { items: true },
          },
        },
        orderBy: { updatedAt: "desc" },
        take,
        skip,
      }),
      prisma.documentBundle.count({ where }),
    ]);

    return reply.send({
      items: bundles.map(toFrontendBundle),
      total,
    });
  });

  // GET /document-bundles/:id - Get single bundle with documents
  app.get("/document-bundles/:id", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const id = Number((req.params as any).id);

    const bundle = await prisma.documentBundle.findFirst({
      where: { id, tenantId },
      include: {
        items: {
          include: {
            document: {
              select: {
                id: true,
                title: true,
                mimeType: true,
                bytes: true,
                sizeBytes: true,
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!bundle) {
      return reply.code(404).send({ error: "bundle_not_found" });
    }

    return reply.send(toFrontendBundle(bundle));
  });

  // POST /document-bundles - Create bundle
  app.post("/document-bundles", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const { name, description, documentIds } = req.body as any;

    if (!name || !name.trim()) {
      return reply.code(400).send({
        error: "missing_required_fields",
        required: ["name"],
      });
    }

    // Validate document IDs if provided
    if (documentIds && Array.isArray(documentIds) && documentIds.length > 0) {
      const documents = await prisma.document.findMany({
        where: {
          id: { in: documentIds },
          tenantId,
        },
        select: { id: true },
      });

      if (documents.length !== documentIds.length) {
        return reply.code(400).send({
          error: "invalid_documents",
          message: "Some document IDs are invalid or do not belong to this tenant",
        });
      }
    }

    // Create bundle with optional documents
    const bundle = await prisma.documentBundle.create({
      data: {
        tenantId,
        name: name.trim(),
        description: description?.trim() || null,
        status: "active",
        items: documentIds?.length
          ? {
              create: documentIds.map((docId: number, index: number) => ({
                documentId: docId,
                sortOrder: index,
              })),
            }
          : undefined,
      },
      include: {
        items: {
          include: {
            document: {
              select: {
                id: true,
                title: true,
                mimeType: true,
                bytes: true,
                sizeBytes: true,
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    return reply.send(toFrontendBundle(bundle));
  });

  // PATCH /document-bundles/:id - Update bundle metadata
  app.patch("/document-bundles/:id", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const id = Number((req.params as any).id);

    const existing = await prisma.documentBundle.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return reply.code(404).send({ error: "bundle_not_found" });
    }

    const { name, description, status } = req.body as any;

    // Build update data
    const updateData: any = {};
    if (name !== undefined) {
      if (!name.trim()) {
        return reply.code(400).send({ error: "name_required" });
      }
      updateData.name = name.trim();
    }
    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }
    if (status !== undefined) {
      if (!["active", "archived"].includes(status)) {
        return reply.code(400).send({
          error: "invalid_status",
          allowed: ["active", "archived"],
        });
      }
      updateData.status = status;
    }

    const updated = await prisma.documentBundle.update({
      where: { id },
      data: updateData,
      include: {
        items: {
          include: {
            document: {
              select: {
                id: true,
                title: true,
                mimeType: true,
                bytes: true,
                sizeBytes: true,
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    return reply.send(toFrontendBundle(updated));
  });

  // DELETE /document-bundles/:id - Delete bundle (hard delete)
  app.delete("/document-bundles/:id", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const id = Number((req.params as any).id);

    const existing = await prisma.documentBundle.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return reply.code(404).send({ error: "bundle_not_found" });
    }

    // Hard delete (cascade will remove items)
    await prisma.documentBundle.delete({
      where: { id },
    });

    return reply.send({ success: true });
  });

  // POST /document-bundles/:id/documents - Add documents to bundle
  app.post("/document-bundles/:id/documents", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const bundleId = Number((req.params as any).id);
    const { documentIds } = req.body as any;

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return reply.code(400).send({
        error: "missing_required_fields",
        required: ["documentIds"],
      });
    }

    // Verify bundle exists and belongs to tenant
    const bundle = await prisma.documentBundle.findFirst({
      where: { id: bundleId, tenantId },
      include: { items: true },
    });

    if (!bundle) {
      return reply.code(404).send({ error: "bundle_not_found" });
    }

    // Verify all documents exist and belong to tenant
    const documents = await prisma.document.findMany({
      where: {
        id: { in: documentIds },
        tenantId,
      },
      select: { id: true },
    });

    if (documents.length !== documentIds.length) {
      return reply.code(400).send({
        error: "invalid_documents",
        message: "Some document IDs are invalid or do not belong to this tenant",
      });
    }

    // Get max sort order
    const maxSortOrder = bundle.items.length > 0
      ? Math.max(...bundle.items.map((item: any) => item.sortOrder))
      : -1;

    // Add documents (skip duplicates)
    const existingDocIds = new Set(bundle.items.map((item: any) => item.documentId));
    const newDocIds = documentIds.filter((id: number) => !existingDocIds.has(id));

    if (newDocIds.length > 0) {
      await prisma.documentBundle.update({
        where: { id: bundleId },
        data: {
          items: {
            create: newDocIds.map((docId: number, index: number) => ({
              documentId: docId,
              sortOrder: maxSortOrder + index + 1,
            })),
          },
        },
      });
    }

    // Return updated bundle
    const updated = await prisma.documentBundle.findUnique({
      where: { id: bundleId },
      include: {
        items: {
          include: {
            document: {
              select: {
                id: true,
                title: true,
                mimeType: true,
                bytes: true,
                sizeBytes: true,
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    return reply.send(toFrontendBundle(updated));
  });

  // DELETE /document-bundles/:id/documents/:documentId - Remove document from bundle
  app.delete("/document-bundles/:bundleId/documents/:documentId", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const { bundleId, documentId } = req.params as any;

    // Verify bundle exists and belongs to tenant
    const bundle = await prisma.documentBundle.findFirst({
      where: { id: Number(bundleId), tenantId },
    });

    if (!bundle) {
      return reply.code(404).send({ error: "bundle_not_found" });
    }

    // Remove the item
    await prisma.documentBundleItem.deleteMany({
      where: {
        bundleId: Number(bundleId),
        documentId: Number(documentId),
      },
    });

    // Return updated bundle
    const updated = await prisma.documentBundle.findUnique({
      where: { id: Number(bundleId) },
      include: {
        items: {
          include: {
            document: {
              select: {
                id: true,
                title: true,
                mimeType: true,
                bytes: true,
                sizeBytes: true,
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    return reply.send(toFrontendBundle(updated));
  });

  // PUT /document-bundles/:id/documents/order - Reorder documents
  app.put("/document-bundles/:id/documents/order", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const bundleId = Number((req.params as any).id);
    const { documentIds } = req.body as any;

    if (!documentIds || !Array.isArray(documentIds)) {
      return reply.code(400).send({
        error: "missing_required_fields",
        required: ["documentIds"],
      });
    }

    // Verify bundle exists and belongs to tenant
    const bundle = await prisma.documentBundle.findFirst({
      where: { id: bundleId, tenantId },
      include: { items: true },
    });

    if (!bundle) {
      return reply.code(404).send({ error: "bundle_not_found" });
    }

    // Update sort order for each document
    await Promise.all(
      documentIds.map((docId: number, index: number) =>
        prisma.documentBundleItem.updateMany({
          where: {
            bundleId,
            documentId: docId,
          },
          data: {
            sortOrder: index,
          },
        })
      )
    );

    // Return updated bundle
    const updated = await prisma.documentBundle.findUnique({
      where: { id: bundleId },
      include: {
        items: {
          include: {
            document: {
              select: {
                id: true,
                title: true,
                mimeType: true,
                bytes: true,
                sizeBytes: true,
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    return reply.send(toFrontendBundle(updated));
  });
};

export default routes;
