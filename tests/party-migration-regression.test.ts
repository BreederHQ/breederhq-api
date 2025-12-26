/**
 * Phase 6: Party Migration Regression Tests
 *
 * Database-level validation to prevent regressions:
 * 1. Mandatory partyId fields must never be null
 * 2. No orphaned partyId references (referential integrity)
 * 3. Legacy columns must not exist in Party-touched tables
 * 4. Foreign key constraints must exist for all partyId fields
 *
 * These tests directly query the database schema and data integrity.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

describe("Phase 6: Party Migration Regression Tests", () => {
  describe("Schema Validation - Legacy Columns Removed", () => {
    it("should not have legacy contactId/organizationId in WaitlistEntry", async () => {
      const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'WaitlistEntry'
          AND column_name IN ('contactId', 'organizationId', 'partyType')
      `;

      assert.strictEqual(columns.length, 0, "WaitlistEntry should not have legacy identity columns");
    });

    it("should not have legacy contactId/organizationId in AnimalOwner", async () => {
      const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'AnimalOwner'
          AND column_name IN ('contactId', 'organizationId', 'partyType')
      `;

      assert.strictEqual(columns.length, 0, "AnimalOwner should not have legacy identity columns");
    });

    it("should not have legacy studOwnerContactId in BreedingAttempt", async () => {
      const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'BreedingAttempt'
          AND column_name = 'studOwnerContactId'
      `;

      assert.strictEqual(columns.length, 0, "BreedingAttempt should not have studOwnerContactId");
    });

    it("should not have legacy buyer fields in Offspring", async () => {
      const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Offspring'
          AND column_name IN ('buyerContactId', 'buyerOrganizationId')
      `;

      assert.strictEqual(columns.length, 0, "Offspring should not have legacy buyer identity columns");
    });

    it("should not have legacy buyer fields in Animal", async () => {
      const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Animal'
          AND column_name IN ('buyerContactId', 'buyerOrganizationId', 'buyerPartyType')
      `;

      assert.strictEqual(columns.length, 0, "Animal should not have legacy buyer identity columns");
    });

    it("should not have legacy contactId in User", async () => {
      const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'User'
          AND column_name = 'contactId'
      `;

      assert.strictEqual(columns.length, 0, "User should not have contactId");
    });

    it("should not have legacy fields in Invoice", async () => {
      const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Invoice'
          AND column_name IN ('contactId', 'organizationId')
      `;

      assert.strictEqual(columns.length, 0, "Invoice should not have legacy identity columns");
    });

    it("should not have legacy fields in ContractParty", async () => {
      const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'ContractParty'
          AND column_name IN ('contactId', 'organizationId')
      `;

      assert.strictEqual(columns.length, 0, "ContractParty should not have legacy identity columns");
    });

    it("should not have legacy fields in OffspringContract", async () => {
      const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'OffspringContract'
          AND column_name IN ('buyerContactId', 'buyerOrganizationId')
      `;

      assert.strictEqual(columns.length, 0, "OffspringContract should not have legacy buyer identity columns");
    });

    it("Party table should have kind not type", async () => {
      const kindColumn = await prisma.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Party'
          AND column_name = 'kind'
      `;

      const typeColumn = await prisma.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Party'
          AND column_name = 'type'
      `;

      assert.strictEqual(kindColumn.length, 1, "Party should have kind column");
      assert.strictEqual(typeColumn.length, 0, "Party should not have type column");
    });
  });

  describe("Foreign Key Constraints - Party References", () => {
    it("should have FK constraint on WaitlistEntry.clientPartyId", async () => {
      const fks = await prisma.$queryRaw<Array<{ constraint_name: string }>>`
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND tc.table_name = 'WaitlistEntry'
          AND kcu.column_name = 'clientPartyId'
      `;

      assert.ok(fks.length > 0, "WaitlistEntry.clientPartyId should have FK constraint");
    });

    it("should have FK constraint on AnimalOwner.partyId", async () => {
      const fks = await prisma.$queryRaw<Array<{ constraint_name: string }>>`
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND tc.table_name = 'AnimalOwner'
          AND kcu.column_name = 'partyId'
      `;

      assert.ok(fks.length > 0, "AnimalOwner.partyId should have FK constraint");
    });

    it("should have FK constraint on BreedingAttempt.studOwnerPartyId", async () => {
      const fks = await prisma.$queryRaw<Array<{ constraint_name: string }>>`
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND tc.table_name = 'BreedingAttempt'
          AND kcu.column_name = 'studOwnerPartyId'
      `;

      assert.ok(fks.length > 0, "BreedingAttempt.studOwnerPartyId should have FK constraint");
    });

    it("should have FK constraint on User.partyId", async () => {
      const fks = await prisma.$queryRaw<Array<{ constraint_name: string }>>`
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND tc.table_name = 'User'
          AND kcu.column_name = 'partyId'
      `;

      assert.ok(fks.length > 0, "User.partyId should have FK constraint");
    });
  });

  describe("Data Integrity - No Orphaned Party References", () => {
    it("should have no orphaned clientPartyId in WaitlistEntry", async () => {
      const orphans = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count
        FROM "WaitlistEntry" we
        WHERE we."clientPartyId" IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM "Party" p WHERE p.id = we."clientPartyId"
          )
      `;

      assert.strictEqual(Number(orphans[0].count), 0, "No orphaned clientPartyId references should exist");
    });

    it("should have no orphaned partyId in AnimalOwner", async () => {
      const orphans = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count
        FROM "AnimalOwner" ao
        WHERE ao."partyId" IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM "Party" p WHERE p.id = ao."partyId"
          )
      `;

      assert.strictEqual(Number(orphans[0].count), 0, "No orphaned partyId references should exist");
    });

    it("should have no orphaned studOwnerPartyId in BreedingAttempt", async () => {
      const orphans = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count
        FROM "BreedingAttempt" ba
        WHERE ba."studOwnerPartyId" IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM "Party" p WHERE p.id = ba."studOwnerPartyId"
          )
      `;

      assert.strictEqual(Number(orphans[0].count), 0, "No orphaned studOwnerPartyId references should exist");
    });

    it("should have no orphaned buyerPartyId in Offspring", async () => {
      const orphans = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count
        FROM "Offspring" o
        WHERE o."buyerPartyId" IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM "Party" p WHERE p.id = o."buyerPartyId"
          )
      `;

      assert.strictEqual(Number(orphans[0].count), 0, "No orphaned buyerPartyId references should exist");
    });

    it("should have no orphaned buyerPartyId in Animal", async () => {
      const orphans = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count
        FROM "Animal" a
        WHERE a."buyerPartyId" IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM "Party" p WHERE p.id = a."buyerPartyId"
          )
      `;

      assert.strictEqual(Number(orphans[0].count), 0, "No orphaned buyerPartyId references should exist");
    });

    it("should have no orphaned partyId in User", async () => {
      const orphans = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count
        FROM "User" u
        WHERE u."partyId" IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM "Party" p WHERE p.id = u."partyId"
          )
      `;

      assert.strictEqual(Number(orphans[0].count), 0, "No orphaned partyId references should exist");
    });

    it("should have no orphaned clientPartyId in Invoice", async () => {
      const orphans = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count
        FROM "Invoice" i
        WHERE i."clientPartyId" IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM "Party" p WHERE p.id = i."clientPartyId"
          )
      `;

      assert.strictEqual(Number(orphans[0].count), 0, "No orphaned clientPartyId references should exist");
    });

    it("should have no orphaned partyId in ContractParty", async () => {
      const orphans = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count
        FROM "ContractParty" cp
        WHERE cp."partyId" IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM "Party" p WHERE p.id = cp."partyId"
          )
      `;

      assert.strictEqual(Number(orphans[0].count), 0, "No orphaned partyId references should exist");
    });

    it("should have no orphaned buyerPartyId in OffspringContract", async () => {
      const orphans = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count
        FROM "OffspringContract" oc
        WHERE oc."buyerPartyId" IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM "Party" p WHERE p.id = oc."buyerPartyId"
          )
      `;

      assert.strictEqual(Number(orphans[0].count), 0, "No orphaned buyerPartyId references should exist");
    });
  });

  describe("Data Integrity - Mandatory Party Fields", () => {
    it("WaitlistEntry should have non-null clientPartyId", async () => {
      const nullCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count
        FROM "WaitlistEntry"
        WHERE "clientPartyId" IS NULL
      `;

      assert.strictEqual(Number(nullCount[0].count), 0, "All WaitlistEntry records should have clientPartyId");
    });

    it("AnimalOwner should have non-null partyId", async () => {
      const nullCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count
        FROM "AnimalOwner"
        WHERE "partyId" IS NULL
      `;

      assert.strictEqual(Number(nullCount[0].count), 0, "All AnimalOwner records should have partyId");
    });

    it("User should have non-null partyId", async () => {
      const nullCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count
        FROM "User"
        WHERE "partyId" IS NULL
      `;

      assert.strictEqual(Number(nullCount[0].count), 0, "All User records should have partyId");
    });
  });
});
