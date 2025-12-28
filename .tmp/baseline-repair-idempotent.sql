-- Baseline Repair Migration
-- This migration creates the full schema from scratch in an idempotent way.
-- It can run on empty databases or databases that already have the schema.

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS citext;


-- CreateEnum PartyType
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PartyType') THEN
    CREATE TYPE "PartyType" AS ENUM ('CONTACT', 'ORGANIZATION');
  END IF;
END $$;


-- CreateEnum MembershipRole
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MembershipRole') THEN
    CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');
  END IF;
END $$;


-- CreateEnum AnimalStatus
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AnimalStatus') THEN
    CREATE TYPE "AnimalStatus" AS ENUM ('ACTIVE', 'BREEDING', 'UNAVAILABLE', 'RETIRED', 'DECEASED', 'PROSPECT');
  END IF;
END $$;


-- CreateEnum Species
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Species') THEN
    CREATE TYPE "Species" AS ENUM ('DOG', 'CAT', 'HORSE', 'GOAT', 'RABBIT', 'SHEEP');
  END IF;
END $$;


-- CreateEnum TenantOperationType
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TenantOperationType') THEN
    CREATE TYPE "TenantOperationType" AS ENUM ('HOBBY', 'COMMERCIAL', 'PERFORMANCE');
  END IF;
END $$;


-- CreateEnum HorseIntendedUse
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'HorseIntendedUse') THEN
    CREATE TYPE "HorseIntendedUse" AS ENUM ('BREEDING', 'SHOW', 'RACING');
  END IF;
END $$;


-- CreateEnum HorseValuationSource
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'HorseValuationSource') THEN
    CREATE TYPE "HorseValuationSource" AS ENUM ('PRIVATE_SALE', 'AUCTION', 'APPRAISAL', 'INSURANCE', 'OTHER');
  END IF;
END $$;


-- CreateEnum OwnershipChangeKind
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OwnershipChangeKind') THEN
    CREATE TYPE "OwnershipChangeKind" AS ENUM ('SALE', 'SYNDICATION', 'TRANSFER', 'LEASE', 'DEATH', 'OTHER');
  END IF;
END $$;


-- CreateEnum PaymentIntentStatus
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentIntentStatus') THEN
    CREATE TYPE "PaymentIntentStatus" AS ENUM ('PLANNED', 'EXTERNAL', 'COMPLETED', 'CANCELED');
  END IF;
END $$;


-- CreateEnum PaymentIntentPurpose
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentIntentPurpose') THEN
    CREATE TYPE "PaymentIntentPurpose" AS ENUM ('DEPOSIT', 'PURCHASE', 'STUD_FEE', 'BOARDING', 'TRAINING', 'OTHER');
  END IF;
END $$;


-- CreateEnum Sex
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Sex') THEN
    CREATE TYPE "Sex" AS ENUM ('FEMALE', 'MALE');
  END IF;
END $$;


-- CreateEnum TagModule
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TagModule') THEN
    CREATE TYPE "TagModule" AS ENUM ('CONTACT', 'ORGANIZATION', 'ANIMAL', 'WAITLIST_ENTRY', 'OFFSPRING_GROUP', 'OFFSPRING');
  END IF;
END $$;


-- CreateEnum OwnerPartyType
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OwnerPartyType') THEN
    CREATE TYPE "OwnerPartyType" AS ENUM ('Organization', 'Contact');
  END IF;
END $$;


-- CreateEnum TenantRole
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TenantRole') THEN
    CREATE TYPE "TenantRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'BILLING', 'VIEWER');
  END IF;
END $$;


-- CreateEnum ShareScope
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ShareScope') THEN
    CREATE TYPE "ShareScope" AS ENUM ('VIEW', 'BREED_PLAN');
  END IF;
END $$;


-- CreateEnum ShareStatus
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ShareStatus') THEN
    CREATE TYPE "ShareStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');
  END IF;
END $$;


-- CreateEnum VerificationPurpose
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VerificationPurpose') THEN
    CREATE TYPE "VerificationPurpose" AS ENUM ('VERIFY_EMAIL', 'RESET_PASSWORD', 'INVITE', 'OTHER');
  END IF;
END $$;


-- CreateEnum CommChannel
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CommChannel') THEN
    CREATE TYPE "CommChannel" AS ENUM ('EMAIL', 'SMS', 'PHONE', 'MAIL', 'WHATSAPP');
  END IF;
END $$;


-- CreateEnum PreferenceLevel
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PreferenceLevel') THEN
    CREATE TYPE "PreferenceLevel" AS ENUM ('ALLOW', 'NOT_PREFERRED', 'NEVER');
  END IF;
END $$;


-- CreateEnum ComplianceStatus
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ComplianceStatus') THEN
    CREATE TYPE "ComplianceStatus" AS ENUM ('SUBSCRIBED', 'UNSUBSCRIBED');
  END IF;
END $$;


-- CreateEnum TraitValueType
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TraitValueType') THEN
    CREATE TYPE "TraitValueType" AS ENUM ('BOOLEAN', 'ENUM', 'NUMBER', 'DATE', 'TEXT', 'JSON');
  END IF;
END $$;


-- CreateEnum TraitSource
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TraitSource') THEN
    CREATE TYPE "TraitSource" AS ENUM ('SELF_REPORTED', 'VET', 'LAB', 'REGISTRY');
  END IF;
END $$;


-- CreateEnum TraitStatus
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TraitStatus') THEN
    CREATE TYPE "TraitStatus" AS ENUM ('NOT_PROVIDED', 'PROVIDED', 'PENDING', 'PASS', 'FAIL');
  END IF;
END $$;


-- CreateEnum DocVisibility
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DocVisibility') THEN
    CREATE TYPE "DocVisibility" AS ENUM ('PRIVATE', 'BUYERS', 'PUBLIC');
  END IF;
END $$;


-- CreateEnum DocStatus
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DocStatus') THEN
    CREATE TYPE "DocStatus" AS ENUM ('PLACEHOLDER', 'UPLOADING', 'READY', 'FAILED');
  END IF;
END $$;


-- CreateEnum BreedingPlanStatus
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BreedingPlanStatus') THEN
    CREATE TYPE "BreedingPlanStatus" AS ENUM ('PLANNING', 'COMMITTED', 'CYCLE_EXPECTED', 'HORMONE_TESTING', 'BRED', 'PREGNANT', 'BIRTHED', 'WEANED', 'PLACEMENT', 'COMPLETE', 'CANCELED');
  END IF;
END $$;


-- CreateEnum BreedingMethod
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BreedingMethod') THEN
    CREATE TYPE "BreedingMethod" AS ENUM ('NATURAL', 'AI_TCI', 'AI_SI', 'AI_FROZEN');
  END IF;
END $$;


-- CreateEnum PregnancyCheckMethod
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PregnancyCheckMethod') THEN
    CREATE TYPE "PregnancyCheckMethod" AS ENUM ('PALPATION', 'ULTRASOUND', 'RELAXIN_TEST', 'XRAY', 'OTHER');
  END IF;
END $$;


-- CreateEnum WaitlistStatus
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WaitlistStatus') THEN
    CREATE TYPE "WaitlistStatus" AS ENUM ('INQUIRY', 'DEPOSIT_DUE', 'DEPOSIT_PAID', 'READY', 'ALLOCATED', 'COMPLETED', 'CANCELED');
  END IF;
END $$;


-- CreateEnum OffspringLinkState
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OffspringLinkState') THEN
    CREATE TYPE "OffspringLinkState" AS ENUM ('linked', 'orphan', 'pending');
  END IF;
END $$;


-- CreateEnum OffspringLinkReason
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OffspringLinkReason') THEN
    CREATE TYPE "OffspringLinkReason" AS ENUM ('legacy_import', 'rescue', 'accidental', 'third_party', 'cobreeder', 'placeholder', 'historical', 'other');
  END IF;
END $$;


-- CreateEnum OffspringStatus
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OffspringStatus') THEN
    CREATE TYPE "OffspringStatus" AS ENUM ('NEWBORN', 'ALIVE', 'WEANED', 'PLACED', 'DECEASED');
  END IF;
END $$;


-- CreateEnum OffspringLifeState
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OffspringLifeState') THEN
    CREATE TYPE "OffspringLifeState" AS ENUM ('ALIVE', 'DECEASED');
  END IF;
END $$;


-- CreateEnum OffspringPlacementState
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OffspringPlacementState') THEN
    CREATE TYPE "OffspringPlacementState" AS ENUM ('UNASSIGNED', 'OPTION_HOLD', 'RESERVED', 'PLACED', 'RETURNED', 'TRANSFERRED');
  END IF;
END $$;


-- CreateEnum OffspringKeeperIntent
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OffspringKeeperIntent') THEN
    CREATE TYPE "OffspringKeeperIntent" AS ENUM ('AVAILABLE', 'UNDER_EVALUATION', 'WITHHELD', 'KEEP');
  END IF;
END $$;


-- CreateEnum OffspringFinancialState
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OffspringFinancialState') THEN
    CREATE TYPE "OffspringFinancialState" AS ENUM ('NONE', 'DEPOSIT_PENDING', 'DEPOSIT_PAID', 'PAID_IN_FULL', 'REFUNDED', 'CHARGEBACK');
  END IF;
END $$;


-- CreateEnum OffspringPaperworkState
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OffspringPaperworkState') THEN
    CREATE TYPE "OffspringPaperworkState" AS ENUM ('NONE', 'SENT', 'SIGNED', 'COMPLETE');
  END IF;
END $$;


-- CreateEnum FinanceScope
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FinanceScope') THEN
    CREATE TYPE "FinanceScope" AS ENUM ('group', 'offspring', 'contact', 'organization', 'general');
  END IF;
END $$;


-- CreateEnum InvoiceStatus
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InvoiceStatus') THEN
    CREATE TYPE "InvoiceStatus" AS ENUM ('draft', 'open', 'paid', 'void', 'uncollectible', 'refunded', 'cancelled');
  END IF;
END $$;


-- CreateEnum PaymentStatus
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentStatus') THEN
    CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'succeeded', 'failed', 'refunded', 'disputed', 'cancelled');
  END IF;
END $$;


-- CreateEnum CampaignChannel
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CampaignChannel') THEN
    CREATE TYPE "CampaignChannel" AS ENUM ('email', 'social', 'ads', 'marketplace', 'website', 'other');
  END IF;
END $$;


-- CreateEnum TaskScope
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TaskScope') THEN
    CREATE TYPE "TaskScope" AS ENUM ('group', 'offspring');
  END IF;
END $$;


-- CreateEnum TaskStatus
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TaskStatus') THEN
    CREATE TYPE "TaskStatus" AS ENUM ('open', 'in_progress', 'done', 'cancelled');
  END IF;
END $$;


-- CreateEnum HealthType
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'HealthType') THEN
    CREATE TYPE "HealthType" AS ENUM ('weight', 'vaccine', 'deworm', 'vet_visit', 'treatment', 'other');
  END IF;
END $$;


-- CreateEnum DocumentScope
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DocumentScope') THEN
    CREATE TYPE "DocumentScope" AS ENUM ('group', 'offspring', 'invoice', 'contract', 'animal');
  END IF;
END $$;


-- CreateEnum DocumentKind
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DocumentKind') THEN
    CREATE TYPE "DocumentKind" AS ENUM ('generic', 'health_certificate', 'registration', 'contract_pdf', 'invoice_pdf', 'photo', 'other', 'bill_of_sale', 'syndication_agreement', 'lease_agreement', 'insurance_policy', 'vet_certificate');
  END IF;
END $$;


-- CreateEnum SignatureProvider
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SignatureProvider') THEN
    CREATE TYPE "SignatureProvider" AS ENUM ('internal', 'docusign', 'hellosign', 'adobe', 'other');
  END IF;
END $$;


-- CreateEnum ContractStatus
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ContractStatus') THEN
    CREATE TYPE "ContractStatus" AS ENUM ('draft', 'sent', 'viewed', 'signed', 'declined', 'voided', 'expired');
  END IF;
END $$;


-- CreateEnum SignatureStatus
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SignatureStatus') THEN
    CREATE TYPE "SignatureStatus" AS ENUM ('pending', 'viewed', 'signed', 'declined', 'voided', 'expired');
  END IF;
END $$;


-- CreateEnum InvoiceRole
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InvoiceRole') THEN
    CREATE TYPE "InvoiceRole" AS ENUM ('RESERVATION', 'DEPOSIT', 'FINAL', 'MISC');
  END IF;
END $$;


-- CreateEnum EsignProvider
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EsignProvider') THEN
    CREATE TYPE "EsignProvider" AS ENUM ('DOCUSIGN', 'HELLOSIGN', 'ADOBE', 'OTHER');
  END IF;
END $$;


-- CreateEnum EsignStatus
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EsignStatus') THEN
    CREATE TYPE "EsignStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'SIGNED', 'DECLINED', 'EXPIRED', 'VOIDED');
  END IF;
END $$;


-- CreateTable
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "name" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "nickname" TEXT,
    "image" TEXT,
    "passwordHash" TEXT,
    "passwordUpdatedAt" TIMESTAMP(3),
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "passwordSetAt" TIMESTAMP(3),
    "lastPasswordChangeAt" TIMESTAMP(3),
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifiedAt" TIMESTAMP(3),
    "phoneE164" VARCHAR(32),
    "whatsappE164" VARCHAR(32),
    "street" TEXT,
    "street2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "country" CHAR(2),
    "partyId" INTEGER,
    "defaultTenantId" INTEGER,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT,
    "tokenHash" TEXT NOT NULL,
    "purpose" "VerificationPurpose" NOT NULL DEFAULT 'VERIFY_EMAIL',
    "expires" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("identifier","tokenHash")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Passkey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Passkey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RecoveryCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecoveryCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Invitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'MEMBER',
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Invite" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "organizationId" INTEGER,
    "role" TEXT NOT NULL DEFAULT 'STAFF',
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Tenant" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "primaryEmail" TEXT,
    "operationType" "TenantOperationType" NOT NULL DEFAULT 'HOBBY',
    "availabilityPrefs" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TenantMembership" (
    "userId" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "role" "TenantRole" NOT NULL DEFAULT 'MEMBER',

    CONSTRAINT "TenantMembership_pkey" PRIMARY KEY ("userId","tenantId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BillingAccount" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "provider" TEXT,
    "customerId" TEXT,
    "subscriptionId" TEXT,
    "plan" TEXT,
    "status" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Organization" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "partyId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "street" TEXT,
    "street2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "country" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "externalProvider" TEXT,
    "externalId" TEXT,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Membership" (
    "userId" TEXT NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'MEMBER',

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("userId","organizationId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Party" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "type" "PartyType" NOT NULL,
    "name" TEXT NOT NULL,
    "email" CITEXT,
    "phoneE164" VARCHAR(32),
    "whatsappE164" VARCHAR(32),
    "street" TEXT,
    "street2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "country" CHAR(2),
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PartyCommPreference" (
    "id" SERIAL NOT NULL,
    "partyId" INTEGER NOT NULL,
    "channel" "CommChannel" NOT NULL,
    "preference" "PreferenceLevel" NOT NULL DEFAULT 'ALLOW',
    "compliance" "ComplianceStatus",
    "complianceSetAt" TIMESTAMP(3),
    "complianceSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyCommPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PartyCommPreferenceEvent" (
    "id" SERIAL NOT NULL,
    "partyId" INTEGER NOT NULL,
    "channel" "CommChannel" NOT NULL,
    "prevPreference" "PreferenceLevel",
    "newPreference" "PreferenceLevel",
    "prevCompliance" "ComplianceStatus",
    "newCompliance" "ComplianceStatus",
    "actorPartyId" INTEGER,
    "reason" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartyCommPreferenceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Contact" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "organizationId" INTEGER,
    "partyId" INTEGER,
    "display_name" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "nickname" TEXT,
    "email" CITEXT,
    "phoneE164" VARCHAR(32),
    "whatsappE164" VARCHAR(32),
    "street" TEXT,
    "street2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "country" CHAR(2),
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "externalProvider" TEXT,
    "externalId" TEXT,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Animal" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "organizationId" INTEGER,
    "name" TEXT NOT NULL,
    "species" "Species" NOT NULL,
    "sex" "Sex" NOT NULL,
    "status" "AnimalStatus" NOT NULL DEFAULT 'ACTIVE',
    "intendedUse" "HorseIntendedUse",
    "declaredValueCents" INTEGER,
    "declaredValueCurrency" VARCHAR(3),
    "valuationDate" TIMESTAMP(3),
    "valuationSource" "HorseValuationSource",
    "forSale" BOOLEAN NOT NULL DEFAULT false,
    "inSyndication" BOOLEAN NOT NULL DEFAULT false,
    "isLeased" BOOLEAN NOT NULL DEFAULT false,
    "birthDate" TIMESTAMP(3),
    "microchip" TEXT,
    "notes" TEXT,
    "breed" TEXT,
    "photoUrl" TEXT,
    "canonicalBreedId" INTEGER,
    "customBreedId" INTEGER,
    "litterId" INTEGER,
    "offspringGroupId" INTEGER,
    "collarColorId" TEXT,
    "collarColorName" TEXT,
    "collarColorHex" TEXT,
    "collarAssignedAt" TIMESTAMP(3),
    "collarLocked" BOOLEAN NOT NULL DEFAULT false,
    "buyerPartyId" INTEGER,
    "priceCents" INTEGER,
    "depositCents" INTEGER,
    "saleInvoiceId" TEXT,
    "contractId" TEXT,
    "contractSignedAt" TIMESTAMP(3),
    "paidInFullAt" TIMESTAMP(3),
    "healthCertAt" TIMESTAMP(3),
    "microchipAppliedAt" TIMESTAMP(3),
    "pickupAt" TIMESTAMP(3),
    "placedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Animal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AnimalOwner" (
    "id" SERIAL NOT NULL,
    "animalId" INTEGER NOT NULL,
    "percent" INTEGER NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "partyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimalOwner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Registry" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "url" TEXT,
    "country" TEXT,
    "species" "Species",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AnimalRegistryIdentifier" (
    "id" SERIAL NOT NULL,
    "animalId" INTEGER NOT NULL,
    "registryId" INTEGER NOT NULL,
    "identifier" TEXT NOT NULL,
    "registrarOfRecord" TEXT,
    "issuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimalRegistryIdentifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AnimalShare" (
    "id" SERIAL NOT NULL,
    "animalId" INTEGER NOT NULL,
    "fromTenantId" INTEGER NOT NULL,
    "toTenantId" INTEGER NOT NULL,
    "scope" "ShareScope" NOT NULL DEFAULT 'VIEW',
    "status" "ShareStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimalShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AnimalPublicListing" (
    "id" SERIAL NOT NULL,
    "animalId" INTEGER NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "isListed" BOOLEAN NOT NULL DEFAULT false,
    "visibility" TEXT,
    "urlSlug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimalPublicListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TraitDefinition" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER,
    "species" "Species" NOT NULL,
    "key" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "valueType" "TraitValueType" NOT NULL,
    "enumValues" JSONB,
    "requiresDocument" BOOLEAN NOT NULL DEFAULT false,
    "marketplaceVisibleDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TraitDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AnimalTraitValue" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "animalId" INTEGER NOT NULL,
    "traitDefinitionId" INTEGER NOT NULL,
    "valueBoolean" BOOLEAN,
    "valueNumber" DOUBLE PRECISION,
    "valueText" TEXT,
    "valueDate" TIMESTAMP(3),
    "valueJson" JSONB,
    "status" "TraitStatus",
    "performedAt" TIMESTAMP(3),
    "source" "TraitSource",
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "marketplaceVisible" BOOLEAN,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimalTraitValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AnimalTraitValueDocument" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "animalId" INTEGER NOT NULL,
    "animalTraitValueId" INTEGER NOT NULL,
    "documentId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnimalTraitValueDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Tag" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "module" "TagModule" NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TagAssignment" (
    "id" SERIAL NOT NULL,
    "tagId" INTEGER NOT NULL,
    "taggedPartyId" INTEGER,
    "animalId" INTEGER,
    "waitlistEntryId" INTEGER,
    "offspringGroupId" INTEGER,
    "offspringId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TagAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Breed" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "species" "Species" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Breed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AnimalBreed" (
    "id" SERIAL NOT NULL,
    "animalId" INTEGER NOT NULL,
    "breedId" INTEGER NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimalBreed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BreedRegistryLink" (
    "breedId" INTEGER NOT NULL,
    "registryId" INTEGER NOT NULL,
    "statusText" TEXT,
    "registryRef" TEXT,
    "url" TEXT,
    "primary" BOOLEAN,
    "since" INTEGER,
    "notes" TEXT,
    "proofUrl" TEXT,

    CONSTRAINT "BreedRegistryLink_pkey" PRIMARY KEY ("breedId","registryId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CustomBreed" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "createdByOrganizationId" INTEGER,
    "species" "Species" NOT NULL,
    "name" TEXT NOT NULL,
    "composition" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomBreed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BreedingPlan" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "organizationId" INTEGER,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "nickname" TEXT,
    "species" "Species" NOT NULL,
    "breedText" TEXT,
    "damId" INTEGER NOT NULL,
    "sireId" INTEGER,
    "lockedCycleKey" TEXT,
    "lockedCycleStart" TIMESTAMP(3),
    "lockedOvulationDate" TIMESTAMP(3),
    "lockedDueDate" TIMESTAMP(3),
    "lockedPlacementStartDate" TIMESTAMP(3),
    "expectedCycleStart" TIMESTAMP(3),
    "expectedHormoneTestingStart" TIMESTAMP(3),
    "expectedBreedDate" TIMESTAMP(3),
    "expectedBirthDate" TIMESTAMP(3),
    "expectedWeaned" TIMESTAMP(3),
    "expectedPlacementStart" TIMESTAMP(3),
    "expectedPlacementCompleted" TIMESTAMP(3),
    "cycleStartDateActual" TIMESTAMP(3),
    "hormoneTestingStartDateActual" TIMESTAMP(3),
    "breedDateActual" TIMESTAMP(3),
    "birthDateActual" TIMESTAMP(3),
    "weanedDateActual" TIMESTAMP(3),
    "placementStartDateActual" TIMESTAMP(3),
    "placementCompletedDateActual" TIMESTAMP(3),
    "completedDateActual" TIMESTAMP(3),
    "status" "BreedingPlanStatus" NOT NULL DEFAULT 'PLANNING',
    "notes" TEXT,
    "committedAt" TIMESTAMP(3),
    "committedByUserId" TEXT,
    "depositsCommittedCents" INTEGER,
    "depositsPaidCents" INTEGER,
    "depositRiskScore" INTEGER,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreedingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ReproductiveCycle" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "femaleId" INTEGER NOT NULL,
    "cycleStart" TIMESTAMP(3) NOT NULL,
    "ovulation" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "placementStartDate" TIMESTAMP(3),
    "status" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReproductiveCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BreedingPlanShare" (
    "id" SERIAL NOT NULL,
    "planId" INTEGER NOT NULL,
    "fromTenantId" INTEGER NOT NULL,
    "toTenantId" INTEGER NOT NULL,
    "scope" "ShareScope" NOT NULL DEFAULT 'BREED_PLAN',
    "status" "ShareStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreedingPlanShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BreedingPlanEvent" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "planId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "label" TEXT,
    "notes" TEXT,
    "data" JSONB,
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreedingPlanEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TestResult" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "planId" INTEGER,
    "animalId" INTEGER,
    "kind" TEXT NOT NULL,
    "method" TEXT,
    "labName" TEXT,
    "valueNumber" DOUBLE PRECISION,
    "valueText" TEXT,
    "units" TEXT,
    "referenceRange" TEXT,
    "collectedAt" TIMESTAMP(3) NOT NULL,
    "resultAt" TIMESTAMP(3),
    "notes" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BreedingAttempt" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "planId" INTEGER NOT NULL,
    "method" "BreedingMethod" NOT NULL,
    "attemptAt" TIMESTAMP(3),
    "windowStart" TIMESTAMP(3),
    "windowEnd" TIMESTAMP(3),
    "studOwnerPartyId" INTEGER,
    "semenBatchId" INTEGER,
    "success" BOOLEAN,
    "notes" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreedingAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PregnancyCheck" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "planId" INTEGER NOT NULL,
    "method" "PregnancyCheckMethod" NOT NULL,
    "result" BOOLEAN NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PregnancyCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OffspringGroup" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "planId" INTEGER,
    "linkState" "OffspringLinkState" NOT NULL DEFAULT 'linked',
    "linkReason" "OffspringLinkReason",
    "species" "Species" NOT NULL,
    "damId" INTEGER NOT NULL,
    "sireId" INTEGER,
    "name" TEXT,
    "expectedBirthOn" TIMESTAMP(3),
    "actualBirthOn" TIMESTAMP(3),
    "countBorn" INTEGER,
    "countLive" INTEGER,
    "countStillborn" INTEGER,
    "countMale" INTEGER,
    "countFemale" INTEGER,
    "countWeaned" INTEGER,
    "countPlaced" INTEGER,
    "weanedAt" TIMESTAMP(3),
    "placementStartAt" TIMESTAMP(3),
    "placementCompletedAt" TIMESTAMP(3),
    "published" BOOLEAN NOT NULL DEFAULT false,
    "coverImageUrl" TEXT,
    "themeName" TEXT,
    "notes" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OffspringGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OffspringGroupBuyer" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "groupId" INTEGER NOT NULL,
    "buyerPartyId" INTEGER,
    "waitlistEntryId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OffspringGroupBuyer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Offspring" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "groupId" INTEGER NOT NULL,
    "name" TEXT,
    "species" "Species" NOT NULL,
    "breed" TEXT,
    "sex" "Sex",
    "bornAt" TIMESTAMP(3),
    "diedAt" TIMESTAMP(3),
    "status" "OffspringStatus" NOT NULL DEFAULT 'NEWBORN',
    "lifeState" "OffspringLifeState" NOT NULL DEFAULT 'ALIVE',
    "placementState" "OffspringPlacementState" NOT NULL DEFAULT 'UNASSIGNED',
    "keeperIntent" "OffspringKeeperIntent" NOT NULL DEFAULT 'AVAILABLE',
    "financialState" "OffspringFinancialState" NOT NULL DEFAULT 'NONE',
    "paperworkState" "OffspringPaperworkState" NOT NULL DEFAULT 'NONE',
    "damId" INTEGER,
    "sireId" INTEGER,
    "collarColorId" TEXT,
    "collarColorName" TEXT,
    "collarColorHex" TEXT,
    "collarAssignedAt" TIMESTAMP(3),
    "collarLocked" BOOLEAN NOT NULL DEFAULT false,
    "buyerPartyId" INTEGER,
    "priceCents" INTEGER,
    "depositCents" INTEGER,
    "contractId" TEXT,
    "contractSignedAt" TIMESTAMP(3),
    "paidInFullAt" TIMESTAMP(3),
    "pickupAt" TIMESTAMP(3),
    "placedAt" TIMESTAMP(3),
    "promotedAnimalId" INTEGER,
    "notes" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offspring_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OffspringEvent" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "offspringId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "field" TEXT,
    "before" JSONB,
    "after" JSONB,
    "notes" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OffspringEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Litter" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "planId" INTEGER NOT NULL,
    "identifier" TEXT,
    "birthedStartAt" TIMESTAMP(3),
    "birthedEndAt" TIMESTAMP(3),
    "countBorn" INTEGER,
    "countLive" INTEGER,
    "countStillborn" INTEGER,
    "countMale" INTEGER,
    "countFemale" INTEGER,
    "countWeaned" INTEGER,
    "countPlaced" INTEGER,
    "weanedAt" TIMESTAMP(3),
    "placementStartAt" TIMESTAMP(3),
    "placementCompletedAt" TIMESTAMP(3),
    "statusOverride" TEXT,
    "statusOverrideReason" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "coverImageUrl" TEXT,
    "themeName" TEXT,
    "notes" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Litter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WaitlistEntry" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "planId" INTEGER,
    "litterId" INTEGER,
    "offspringGroupId" INTEGER,
    "clientPartyId" INTEGER,
    "speciesPref" "Species",
    "breedPrefs" JSONB,
    "sirePrefId" INTEGER,
    "damPrefId" INTEGER,
    "status" "WaitlistStatus" NOT NULL DEFAULT 'INQUIRY',
    "priority" INTEGER,
    "depositInvoiceId" TEXT,
    "balanceInvoiceId" TEXT,
    "depositPaidAt" TIMESTAMP(3),
    "depositRequiredCents" INTEGER,
    "depositPaidCents" INTEGER,
    "balanceDueCents" INTEGER,
    "animalId" INTEGER,
    "offspringId" INTEGER,
    "skipCount" INTEGER,
    "lastSkipAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OffspringGroupEvent" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "offspringGroupId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "field" TEXT,
    "before" JSONB,
    "after" JSONB,
    "notes" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OffspringGroupEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LitterEvent" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "litterId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "field" TEXT,
    "before" JSONB,
    "after" JSONB,
    "notes" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LitterEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Attachment" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "planId" INTEGER,
    "animalId" INTEGER,
    "litterId" INTEGER,
    "offspringGroupId" INTEGER,
    "offspringId" INTEGER,
    "attachmentPartyId" INTEGER,
    "kind" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PlanParty" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "planId" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "partyId" INTEGER,
    "notes" TEXT,

    CONSTRAINT "PlanParty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PlanCodeCounter" (
    "tenantId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "seq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlanCodeCounter_pkey" PRIMARY KEY ("tenantId","year")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TenantSetting" (
    "tenantId" INTEGER NOT NULL,
    "namespace" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "data" JSONB NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantSetting_pkey" PRIMARY KEY ("tenantId","namespace")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Invoice" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "scope" "FinanceScope" NOT NULL,
    "groupId" INTEGER,
    "offspringId" INTEGER,
    "clientPartyId" INTEGER,
    "number" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "amountCents" INTEGER NOT NULL,
    "balanceCents" INTEGER NOT NULL,
    "depositCents" INTEGER,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'draft',
    "dueAt" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "paymentTerms" TEXT,
    "externalProvider" TEXT,
    "externalId" TEXT,
    "syncedAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "lastSyncError" TEXT,
    "notes" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "InvoiceLineItem" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "unitCents" INTEGER NOT NULL,
    "discountCents" INTEGER,
    "taxRate" DOUBLE PRECISION,
    "category" TEXT,
    "itemCode" TEXT,
    "totalCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Payment" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "amountCents" INTEGER NOT NULL,
    "method" TEXT,
    "reference" TEXT,
    "paidAt" TIMESTAMP(3),
    "externalProvider" TEXT,
    "externalId" TEXT,
    "syncedAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "lastSyncError" TEXT,
    "notes" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AnimalOwnershipChange" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "animalId" INTEGER NOT NULL,
    "kind" "OwnershipChangeKind" NOT NULL,
    "effectiveDate" TIMESTAMP(3),
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valueCents" INTEGER,
    "currency" VARCHAR(3),
    "fromOwners" JSONB NOT NULL,
    "toOwners" JSONB NOT NULL,
    "fromOwnerParties" JSONB,
    "toOwnerParties" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimalOwnershipChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PaymentIntent" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "invoiceId" INTEGER,
    "animalId" INTEGER,
    "ownershipChangeId" INTEGER,
    "purpose" "PaymentIntentPurpose" NOT NULL,
    "status" "PaymentIntentStatus" NOT NULL DEFAULT 'PLANNED',
    "amountCents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "externalProvider" TEXT,
    "externalId" TEXT,
    "reference" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Campaign" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "offspringGroupId" INTEGER,
    "name" TEXT NOT NULL,
    "channel" "CampaignChannel" NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "budgetCents" INTEGER,
    "spendCents" INTEGER,
    "impressions" INTEGER,
    "clicks" INTEGER,
    "inquiries" INTEGER,
    "reservations" INTEGER,
    "conversions" INTEGER,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "notes" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CampaignAttribution" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "campaignId" INTEGER NOT NULL,
    "offspringId" INTEGER,
    "weight" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Task" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "scope" "TaskScope" NOT NULL,
    "groupId" INTEGER,
    "offspringId" INTEGER,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "dueAt" TIMESTAMP(3),
    "status" "TaskStatus" NOT NULL DEFAULT 'open',
    "assignedToUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "HealthEvent" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "offspringId" INTEGER NOT NULL,
    "kind" "HealthType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "weightGrams" INTEGER,
    "vaccineCode" TEXT,
    "dose" TEXT,
    "vetClinic" TEXT,
    "result" TEXT,
    "notes" TEXT,
    "data" JSONB,
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Document" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "scope" "DocumentScope" NOT NULL,
    "kind" "DocumentKind" NOT NULL DEFAULT 'generic',
    "animalId" INTEGER,
    "ownershipChangeId" INTEGER,
    "offspringId" INTEGER,
    "groupId" INTEGER,
    "invoiceId" INTEGER,
    "contractId" INTEGER,
    "title" TEXT NOT NULL,
    "storageKey" TEXT,
    "externalUrl" TEXT,
    "mimeType" TEXT,
    "bytes" INTEGER,
    "sha256" TEXT,
    "data" JSONB,
    "visibility" "DocVisibility" DEFAULT 'PRIVATE',
    "status" "DocStatus" DEFAULT 'PLACEHOLDER',
    "sizeBytes" INTEGER,
    "originalFileName" TEXT,
    "storageProvider" TEXT,
    "bucket" TEXT,
    "objectKey" TEXT,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ContractTemplate" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT,
    "storageKey" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Contract" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "templateId" INTEGER,
    "offspringId" INTEGER,
    "groupId" INTEGER,
    "invoiceId" INTEGER,
    "title" TEXT NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'draft',
    "provider" "SignatureProvider" NOT NULL DEFAULT 'internal',
    "providerEnvelopeId" TEXT,
    "providerDocId" TEXT,
    "issuedAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ContractParty" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "contractId" INTEGER NOT NULL,
    "userId" TEXT,
    "partyId" INTEGER,
    "role" TEXT,
    "email" TEXT,
    "name" TEXT,
    "signer" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER,
    "status" "SignatureStatus" NOT NULL DEFAULT 'pending',
    "signedAt" TIMESTAMP(3),
    "providerRecipientId" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractParty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SignatureEvent" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "contractId" INTEGER NOT NULL,
    "partyId" INTEGER,
    "status" "SignatureStatus" NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "message" TEXT,
    "data" JSONB,

    CONSTRAINT "SignatureEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OffspringDocument" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "offspringId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "templateId" TEXT,
    "provider" "EsignProvider",
    "status" "EsignStatus" NOT NULL DEFAULT 'DRAFT',
    "sentAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "fileId" INTEGER,
    "metaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OffspringDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OffspringContract" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "offspringId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "version" TEXT,
    "provider" "EsignProvider",
    "status" "EsignStatus" NOT NULL DEFAULT 'DRAFT',
    "sentAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "fileId" INTEGER,
    "buyerPartyId" INTEGER,
    "metaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OffspringContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OffspringInvoiceLink" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "offspringId" INTEGER NOT NULL,
    "invoiceId" INTEGER,
    "role" "InvoiceRole" NOT NULL DEFAULT 'MISC',
    "amountCents" INTEGER,
    "currency" TEXT,
    "externalProvider" TEXT,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OffspringInvoiceLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AccountingIntegration" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "realmId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "accessTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "syncDirection" TEXT NOT NULL DEFAULT 'outbound',
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_partyId_idx" ON "User"("partyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_defaultTenantId_idx" ON "User"("defaultTenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_phoneE164_idx" ON "User"("phoneE164");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_whatsappE164_idx" ON "User"("whatsappE164");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_country_idx" ON "User"("country");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_tokenHash_key" ON "VerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VerificationToken_identifier_purpose_idx" ON "VerificationToken"("identifier", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Passkey_credentialId_key" ON "Passkey"("credentialId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Passkey_userId_idx" ON "Passkey"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RecoveryCode_code_key" ON "RecoveryCode"("code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RecoveryCode_userId_idx" ON "RecoveryCode"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Invitation_token_key" ON "Invitation"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invitation_email_idx" ON "Invitation"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invitation_organizationId_idx" ON "Invitation"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Invite_token_key" ON "Invite"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invite_email_idx" ON "Invite"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invite_token_idx" ON "Invite"("token");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Tenant_name_idx" ON "Tenant"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TenantMembership_tenantId_idx" ON "TenantMembership"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BillingAccount_tenantId_key" ON "BillingAccount"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Organization_partyId_key" ON "Organization"("partyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Organization_archived_idx" ON "Organization"("archived");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Organization_name_idx" ON "Organization"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Organization_tenantId_idx" ON "Organization"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Organization_id_tenantId_key" ON "Organization"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Organization_tenantId_name_key" ON "Organization"("tenantId", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Membership_organizationId_idx" ON "Membership"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Party_tenantId_type_idx" ON "Party"("tenantId", "type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Party_tenantId_name_idx" ON "Party"("tenantId", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Party_tenantId_email_idx" ON "Party"("tenantId", "email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PartyCommPreference_partyId_idx" ON "PartyCommPreference"("partyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PartyCommPreference_channel_compliance_idx" ON "PartyCommPreference"("channel", "compliance");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PartyCommPreference_partyId_channel_key" ON "PartyCommPreference"("partyId", "channel");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PartyCommPreferenceEvent_partyId_createdAt_idx" ON "PartyCommPreferenceEvent"("partyId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PartyCommPreferenceEvent_channel_createdAt_idx" ON "PartyCommPreferenceEvent"("channel", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Contact_partyId_key" ON "Contact"("partyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Contact_organizationId_idx" ON "Contact"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Contact_tenantId_idx" ON "Contact"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Contact_display_name_idx" ON "Contact"("display_name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Contact_archived_idx" ON "Contact"("archived");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Contact_last_name_idx" ON "Contact"("last_name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Contact_first_name_idx" ON "Contact"("first_name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Contact_nickname_idx" ON "Contact"("nickname");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Contact_tenantId_partyId_idx" ON "Contact"("tenantId", "partyId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Contact_tenantId_email_key" ON "Contact"("tenantId", "email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Animal_organizationId_idx" ON "Animal"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Animal_tenantId_idx" ON "Animal"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Animal_species_idx" ON "Animal"("species");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Animal_status_idx" ON "Animal"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Animal_archived_idx" ON "Animal"("archived");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Animal_canonicalBreedId_idx" ON "Animal"("canonicalBreedId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Animal_tenantId_customBreedId_idx" ON "Animal"("tenantId", "customBreedId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Animal_litterId_idx" ON "Animal"("litterId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Animal_offspringGroupId_idx" ON "Animal"("offspringGroupId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Animal_tenantId_placedAt_idx" ON "Animal"("tenantId", "placedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Animal_buyerPartyId_idx" ON "Animal"("buyerPartyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Animal_tenantId_buyerPartyId_idx" ON "Animal"("tenantId", "buyerPartyId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Animal_tenantId_microchip_key" ON "Animal"("tenantId", "microchip");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AnimalOwner_animalId_idx" ON "AnimalOwner"("animalId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AnimalOwner_partyId_idx" ON "AnimalOwner"("partyId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AnimalOwner_animalId_partyId_key" ON "AnimalOwner"("animalId", "partyId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Registry_code_key" ON "Registry"("code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AnimalRegistryIdentifier_animalId_idx" ON "AnimalRegistryIdentifier"("animalId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AnimalRegistryIdentifier_registryId_idx" ON "AnimalRegistryIdentifier"("registryId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AnimalRegistryIdentifier_registryId_identifier_key" ON "AnimalRegistryIdentifier"("registryId", "identifier");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AnimalShare_fromTenantId_idx" ON "AnimalShare"("fromTenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AnimalShare_toTenantId_idx" ON "AnimalShare"("toTenantId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AnimalShare_animalId_toTenantId_key" ON "AnimalShare"("animalId", "toTenantId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AnimalPublicListing_animalId_key" ON "AnimalPublicListing"("animalId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AnimalPublicListing_urlSlug_key" ON "AnimalPublicListing"("urlSlug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AnimalPublicListing_tenantId_idx" ON "AnimalPublicListing"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TraitDefinition_species_idx" ON "TraitDefinition"("species");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TraitDefinition_tenantId_species_idx" ON "TraitDefinition"("tenantId", "species");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TraitDefinition_species_key_tenantId_key" ON "TraitDefinition"("species", "key", "tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AnimalTraitValue_tenantId_animalId_idx" ON "AnimalTraitValue"("tenantId", "animalId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AnimalTraitValue_tenantId_traitDefinitionId_idx" ON "AnimalTraitValue"("tenantId", "traitDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AnimalTraitValue_tenantId_animalId_traitDefinitionId_key" ON "AnimalTraitValue"("tenantId", "animalId", "traitDefinitionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AnimalTraitValueDocument_tenantId_animalId_idx" ON "AnimalTraitValueDocument"("tenantId", "animalId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AnimalTraitValueDocument_tenantId_animalTraitValueId_idx" ON "AnimalTraitValueDocument"("tenantId", "animalTraitValueId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AnimalTraitValueDocument_tenantId_documentId_idx" ON "AnimalTraitValueDocument"("tenantId", "documentId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AnimalTraitValueDocument_tenantId_animalTraitValueId_docume_key" ON "AnimalTraitValueDocument"("tenantId", "animalTraitValueId", "documentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Tag_tenantId_module_idx" ON "Tag"("tenantId", "module");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Tag_tenantId_module_name_key" ON "Tag"("tenantId", "module", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TagAssignment_taggedPartyId_idx" ON "TagAssignment"("taggedPartyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TagAssignment_animalId_idx" ON "TagAssignment"("animalId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TagAssignment_waitlistEntryId_idx" ON "TagAssignment"("waitlistEntryId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TagAssignment_offspringGroupId_idx" ON "TagAssignment"("offspringGroupId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TagAssignment_offspringId_idx" ON "TagAssignment"("offspringId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TagAssignment_tagId_taggedPartyId_idx" ON "TagAssignment"("tagId", "taggedPartyId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TagAssignment_tagId_taggedPartyId_key" ON "TagAssignment"("tagId", "taggedPartyId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TagAssignment_tagId_animalId_key" ON "TagAssignment"("tagId", "animalId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TagAssignment_tagId_waitlistEntryId_key" ON "TagAssignment"("tagId", "waitlistEntryId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TagAssignment_tagId_offspringGroupId_key" ON "TagAssignment"("tagId", "offspringGroupId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TagAssignment_tagId_offspringId_key" ON "TagAssignment"("tagId", "offspringId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Breed_name_key" ON "Breed"("name");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Breed_slug_key" ON "Breed"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Breed_species_idx" ON "Breed"("species");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AnimalBreed_animalId_idx" ON "AnimalBreed"("animalId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AnimalBreed_breedId_idx" ON "AnimalBreed"("breedId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AnimalBreed_animalId_breedId_key" ON "AnimalBreed"("animalId", "breedId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BreedRegistryLink_registryId_idx" ON "BreedRegistryLink"("registryId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomBreed_tenantId_species_idx" ON "CustomBreed"("tenantId", "species");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomBreed_tenantId_createdByOrganizationId_idx" ON "CustomBreed"("tenantId", "createdByOrganizationId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CustomBreed_id_tenantId_key" ON "CustomBreed"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CustomBreed_tenantId_species_name_key" ON "CustomBreed"("tenantId", "species", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BreedingPlan_tenantId_idx" ON "BreedingPlan"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BreedingPlan_organizationId_idx" ON "BreedingPlan"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BreedingPlan_damId_idx" ON "BreedingPlan"("damId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BreedingPlan_sireId_idx" ON "BreedingPlan"("sireId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BreedingPlan_status_idx" ON "BreedingPlan"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BreedingPlan_committedAt_idx" ON "BreedingPlan"("committedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BreedingPlan_expectedWeaned_idx" ON "BreedingPlan"("expectedWeaned");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BreedingPlan_expectedPlacementCompleted_idx" ON "BreedingPlan"("expectedPlacementCompleted");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BreedingPlan_expectedPlacementStart_idx" ON "BreedingPlan"("expectedPlacementStart");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BreedingPlan_placementStartDateActual_idx" ON "BreedingPlan"("placementStartDateActual");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BreedingPlan_placementCompletedDateActual_idx" ON "BreedingPlan"("placementCompletedDateActual");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BreedingPlan_expectedBirthDate_idx" ON "BreedingPlan"("expectedBirthDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BreedingPlan_expectedCycleStart_idx" ON "BreedingPlan"("expectedCycleStart");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BreedingPlan_expectedHormoneTestingStart_idx" ON "BreedingPlan"("expectedHormoneTestingStart");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BreedingPlan_expectedBreedDate_idx" ON "BreedingPlan"("expectedBreedDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BreedingPlan_cycleStartDateActual_idx" ON "BreedingPlan"("cycleStartDateActual");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BreedingPlan_tenantId_code_key" ON "BreedingPlan"("tenantId", "code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReproductiveCycle_tenantId_idx" ON "ReproductiveCycle"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReproductiveCycle_femaleId_idx" ON "ReproductiveCycle"("femaleId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReproductiveCycle_cycleStart_idx" ON "ReproductiveCycle"("cycleStart");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BreedingPlanShare_fromTenantId_idx" ON "BreedingPlanShare"("fromTenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BreedingPlanShare_toTenantId_idx" ON "BreedingPlanShare"("toTenantId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BreedingPlanShare_planId_toTenantId_key" ON "BreedingPlanShare"("planId", "toTenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BreedingPlanEvent_tenantId_idx" ON "BreedingPlanEvent"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BreedingPlanEvent_planId_type_occurredAt_idx" ON "BreedingPlanEvent"("planId", "type", "occurredAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TestResult_tenantId_idx" ON "TestResult"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TestResult_animalId_idx" ON "TestResult"("animalId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TestResult_planId_idx" ON "TestResult"("planId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TestResult_kind_collectedAt_idx" ON "TestResult"("kind", "collectedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BreedingAttempt_tenantId_idx" ON "BreedingAttempt"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BreedingAttempt_planId_idx" ON "BreedingAttempt"("planId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BreedingAttempt_studOwnerPartyId_idx" ON "BreedingAttempt"("studOwnerPartyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PregnancyCheck_tenantId_idx" ON "PregnancyCheck"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PregnancyCheck_planId_checkedAt_idx" ON "PregnancyCheck"("planId", "checkedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OffspringGroup_tenantId_idx" ON "OffspringGroup"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OffspringGroup_tenantId_species_expectedBirthOn_idx" ON "OffspringGroup"("tenantId", "species", "expectedBirthOn");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OffspringGroup_tenantId_damId_actualBirthOn_idx" ON "OffspringGroup"("tenantId", "damId", "actualBirthOn");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OffspringGroup_sireId_idx" ON "OffspringGroup"("sireId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OffspringGroup_linkState_idx" ON "OffspringGroup"("linkState");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OffspringGroup_placementStartAt_idx" ON "OffspringGroup"("placementStartAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OffspringGroup_placementCompletedAt_idx" ON "OffspringGroup"("placementCompletedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OffspringGroup_planId_key" ON "OffspringGroup"("planId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OffspringGroupBuyer_tenantId_idx" ON "OffspringGroupBuyer"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OffspringGroupBuyer_groupId_idx" ON "OffspringGroupBuyer"("groupId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OffspringGroupBuyer_buyerPartyId_idx" ON "OffspringGroupBuyer"("buyerPartyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OffspringGroupBuyer_tenantId_buyerPartyId_idx" ON "OffspringGroupBuyer"("tenantId", "buyerPartyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OffspringGroupBuyer_waitlistEntryId_idx" ON "OffspringGroupBuyer"("waitlistEntryId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OffspringGroupBuyer_groupId_buyerPartyId_key" ON "OffspringGroupBuyer"("groupId", "buyerPartyId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OffspringGroupBuyer_groupId_waitlistEntryId_key" ON "OffspringGroupBuyer"("groupId", "waitlistEntryId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Offspring_tenantId_idx" ON "Offspring"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Offspring_groupId_idx" ON "Offspring"("groupId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Offspring_tenantId_status_idx" ON "Offspring"("tenantId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Offspring_tenantId_lifeState_idx" ON "Offspring"("tenantId", "lifeState");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Offspring_tenantId_placementState_idx" ON "Offspring"("tenantId", "placementState");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Offspring_tenantId_keeperIntent_idx" ON "Offspring"("tenantId", "keeperIntent");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Offspring_tenantId_financialState_idx" ON "Offspring"("tenantId", "financialState");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Offspring_tenantId_paperworkState_idx" ON "Offspring"("tenantId", "paperworkState");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Offspring_buyerPartyId_idx" ON "Offspring"("buyerPartyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Offspring_tenantId_buyerPartyId_idx" ON "Offspring"("tenantId", "buyerPartyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Offspring_placedAt_idx" ON "Offspring"("placedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Offspring_tenantId_damId_idx" ON "Offspring"("tenantId", "damId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Offspring_tenantId_sireId_idx" ON "Offspring"("tenantId", "sireId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OffspringEvent_tenantId_idx" ON "OffspringEvent"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OffspringEvent_offspringId_type_occurredAt_idx" ON "OffspringEvent"("offspringId", "type", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Litter_planId_key" ON "Litter"("planId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Litter_tenantId_idx" ON "Litter"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Litter_tenantId_weanedAt_idx" ON "Litter"("tenantId", "weanedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Litter_tenantId_placementStartAt_idx" ON "Litter"("tenantId", "placementStartAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Litter_tenantId_placementCompletedAt_idx" ON "Litter"("tenantId", "placementCompletedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WaitlistEntry_tenantId_idx" ON "WaitlistEntry"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WaitlistEntry_planId_idx" ON "WaitlistEntry"("planId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WaitlistEntry_litterId_idx" ON "WaitlistEntry"("litterId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WaitlistEntry_offspringGroupId_idx" ON "WaitlistEntry"("offspringGroupId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WaitlistEntry_offspringId_idx" ON "WaitlistEntry"("offspringId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WaitlistEntry_clientPartyId_idx" ON "WaitlistEntry"("clientPartyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WaitlistEntry_tenantId_clientPartyId_idx" ON "WaitlistEntry"("tenantId", "clientPartyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WaitlistEntry_tenantId_speciesPref_idx" ON "WaitlistEntry"("tenantId", "speciesPref");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WaitlistEntry_sirePrefId_idx" ON "WaitlistEntry"("sirePrefId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WaitlistEntry_damPrefId_idx" ON "WaitlistEntry"("damPrefId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WaitlistEntry_animalId_idx" ON "WaitlistEntry"("animalId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WaitlistEntry_tenantId_depositPaidAt_idx" ON "WaitlistEntry"("tenantId", "depositPaidAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OffspringGroupEvent_tenantId_idx" ON "OffspringGroupEvent"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OffspringGroupEvent_offspringGroupId_type_occurredAt_idx" ON "OffspringGroupEvent"("offspringGroupId", "type", "occurredAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LitterEvent_tenantId_idx" ON "LitterEvent"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LitterEvent_litterId_type_occurredAt_idx" ON "LitterEvent"("litterId", "type", "occurredAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Attachment_tenantId_idx" ON "Attachment"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Attachment_planId_idx" ON "Attachment"("planId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Attachment_animalId_idx" ON "Attachment"("animalId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Attachment_litterId_idx" ON "Attachment"("litterId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Attachment_offspringGroupId_idx" ON "Attachment"("offspringGroupId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Attachment_offspringId_idx" ON "Attachment"("offspringId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Attachment_attachmentPartyId_idx" ON "Attachment"("attachmentPartyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PlanParty_tenantId_idx" ON "PlanParty"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PlanParty_planId_idx" ON "PlanParty"("planId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PlanParty_partyId_idx" ON "PlanParty"("partyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PlanParty_tenantId_partyId_role_idx" ON "PlanParty"("tenantId", "partyId", "role");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PlanCodeCounter_tenantId_idx" ON "PlanCodeCounter"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TenantSetting_tenantId_idx" ON "TenantSetting"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TenantSetting_namespace_idx" ON "TenantSetting"("namespace");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invoice_tenantId_idx" ON "Invoice"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invoice_scope_groupId_idx" ON "Invoice"("scope", "groupId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invoice_scope_offspringId_idx" ON "Invoice"("scope", "offspringId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invoice_clientPartyId_idx" ON "Invoice"("clientPartyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invoice_tenantId_clientPartyId_idx" ON "Invoice"("tenantId", "clientPartyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InvoiceLineItem_tenantId_idx" ON "InvoiceLineItem"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InvoiceLineItem_invoiceId_idx" ON "InvoiceLineItem"("invoiceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payment_tenantId_idx" ON "Payment"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AnimalOwnershipChange_tenantId_idx" ON "AnimalOwnershipChange"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AnimalOwnershipChange_animalId_idx" ON "AnimalOwnershipChange"("animalId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AnimalOwnershipChange_kind_idx" ON "AnimalOwnershipChange"("kind");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AnimalOwnershipChange_occurredAt_idx" ON "AnimalOwnershipChange"("occurredAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentIntent_tenantId_idx" ON "PaymentIntent"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentIntent_invoiceId_idx" ON "PaymentIntent"("invoiceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentIntent_animalId_idx" ON "PaymentIntent"("animalId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentIntent_ownershipChangeId_idx" ON "PaymentIntent"("ownershipChangeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentIntent_status_idx" ON "PaymentIntent"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentIntent_purpose_idx" ON "PaymentIntent"("purpose");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Campaign_tenantId_idx" ON "Campaign"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Campaign_offspringGroupId_idx" ON "Campaign"("offspringGroupId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Campaign_channel_idx" ON "Campaign"("channel");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CampaignAttribution_tenantId_idx" ON "CampaignAttribution"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CampaignAttribution_campaignId_idx" ON "CampaignAttribution"("campaignId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CampaignAttribution_offspringId_idx" ON "CampaignAttribution"("offspringId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Task_tenantId_idx" ON "Task"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Task_scope_groupId_idx" ON "Task"("scope", "groupId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Task_scope_offspringId_idx" ON "Task"("scope", "offspringId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Task_status_dueAt_idx" ON "Task"("status", "dueAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "HealthEvent_tenantId_idx" ON "HealthEvent"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "HealthEvent_offspringId_occurredAt_idx" ON "HealthEvent"("offspringId", "occurredAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "HealthEvent_kind_idx" ON "HealthEvent"("kind");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Document_invoiceId_key" ON "Document"("invoiceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Document_tenantId_idx" ON "Document"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Document_scope_offspringId_idx" ON "Document"("scope", "offspringId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Document_scope_groupId_idx" ON "Document"("scope", "groupId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Document_scope_invoiceId_idx" ON "Document"("scope", "invoiceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Document_scope_contractId_idx" ON "Document"("scope", "contractId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Document_kind_idx" ON "Document"("kind");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ContractTemplate_tenantId_idx" ON "ContractTemplate"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ContractTemplate_isActive_idx" ON "ContractTemplate"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Contract_invoiceId_key" ON "Contract"("invoiceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Contract_tenantId_idx" ON "Contract"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Contract_offspringId_idx" ON "Contract"("offspringId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Contract_groupId_idx" ON "Contract"("groupId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Contract_invoiceId_idx" ON "Contract"("invoiceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Contract_status_idx" ON "Contract"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Contract_provider_providerEnvelopeId_idx" ON "Contract"("provider", "providerEnvelopeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ContractParty_tenantId_idx" ON "ContractParty"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ContractParty_contractId_idx" ON "ContractParty"("contractId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ContractParty_partyId_idx" ON "ContractParty"("partyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ContractParty_tenantId_partyId_idx" ON "ContractParty"("tenantId", "partyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ContractParty_status_idx" ON "ContractParty"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SignatureEvent_tenantId_idx" ON "SignatureEvent"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SignatureEvent_contractId_idx" ON "SignatureEvent"("contractId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SignatureEvent_partyId_idx" ON "SignatureEvent"("partyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SignatureEvent_status_at_idx" ON "SignatureEvent"("status", "at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OffspringDocument_tenantId_idx" ON "OffspringDocument"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OffspringDocument_offspringId_idx" ON "OffspringDocument"("offspringId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OffspringDocument_status_idx" ON "OffspringDocument"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OffspringContract_tenantId_idx" ON "OffspringContract"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OffspringContract_offspringId_idx" ON "OffspringContract"("offspringId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OffspringContract_buyerPartyId_idx" ON "OffspringContract"("buyerPartyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OffspringContract_tenantId_buyerPartyId_idx" ON "OffspringContract"("tenantId", "buyerPartyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OffspringContract_status_idx" ON "OffspringContract"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OffspringInvoiceLink_tenantId_idx" ON "OffspringInvoiceLink"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OffspringInvoiceLink_offspringId_idx" ON "OffspringInvoiceLink"("offspringId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OffspringInvoiceLink_invoiceId_idx" ON "OffspringInvoiceLink"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OffspringInvoiceLink_offspringId_invoiceId_role_key" ON "OffspringInvoiceLink"("offspringId", "invoiceId", "role");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AccountingIntegration_tenantId_provider_idx" ON "AccountingIntegration"("tenantId", "provider");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_defaultTenantId_fkey" FOREIGN KEY ("defaultTenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationToken" ADD CONSTRAINT "VerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Passkey" ADD CONSTRAINT "Passkey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryCode" ADD CONSTRAINT "RecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingAccount" ADD CONSTRAINT "BillingAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Party" ADD CONSTRAINT "Party_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyCommPreference" ADD CONSTRAINT "PartyCommPreference_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyCommPreferenceEvent" ADD CONSTRAINT "PartyCommPreferenceEvent_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_organizationId_tenantId_fkey" FOREIGN KEY ("organizationId", "tenantId") REFERENCES "Organization"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_organizationId_tenantId_fkey" FOREIGN KEY ("organizationId", "tenantId") REFERENCES "Organization"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_canonicalBreedId_fkey" FOREIGN KEY ("canonicalBreedId") REFERENCES "Breed"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_customBreedId_tenantId_fkey" FOREIGN KEY ("customBreedId", "tenantId") REFERENCES "CustomBreed"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_litterId_fkey" FOREIGN KEY ("litterId") REFERENCES "Litter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_offspringGroupId_fkey" FOREIGN KEY ("offspringGroupId") REFERENCES "OffspringGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_buyerPartyId_fkey" FOREIGN KEY ("buyerPartyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalOwner" ADD CONSTRAINT "AnimalOwner_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalOwner" ADD CONSTRAINT "AnimalOwner_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalRegistryIdentifier" ADD CONSTRAINT "AnimalRegistryIdentifier_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalRegistryIdentifier" ADD CONSTRAINT "AnimalRegistryIdentifier_registryId_fkey" FOREIGN KEY ("registryId") REFERENCES "Registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalShare" ADD CONSTRAINT "AnimalShare_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalShare" ADD CONSTRAINT "AnimalShare_fromTenantId_fkey" FOREIGN KEY ("fromTenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalShare" ADD CONSTRAINT "AnimalShare_toTenantId_fkey" FOREIGN KEY ("toTenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalPublicListing" ADD CONSTRAINT "AnimalPublicListing_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalPublicListing" ADD CONSTRAINT "AnimalPublicListing_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalTraitValue" ADD CONSTRAINT "AnimalTraitValue_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalTraitValue" ADD CONSTRAINT "AnimalTraitValue_traitDefinitionId_fkey" FOREIGN KEY ("traitDefinitionId") REFERENCES "TraitDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalTraitValue" ADD CONSTRAINT "AnimalTraitValue_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalTraitValueDocument" ADD CONSTRAINT "AnimalTraitValueDocument_animalTraitValueId_fkey" FOREIGN KEY ("animalTraitValueId") REFERENCES "AnimalTraitValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalTraitValueDocument" ADD CONSTRAINT "AnimalTraitValueDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagAssignment" ADD CONSTRAINT "TagAssignment_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagAssignment" ADD CONSTRAINT "TagAssignment_taggedPartyId_fkey" FOREIGN KEY ("taggedPartyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagAssignment" ADD CONSTRAINT "TagAssignment_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagAssignment" ADD CONSTRAINT "TagAssignment_waitlistEntryId_fkey" FOREIGN KEY ("waitlistEntryId") REFERENCES "WaitlistEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagAssignment" ADD CONSTRAINT "TagAssignment_offspringGroupId_fkey" FOREIGN KEY ("offspringGroupId") REFERENCES "OffspringGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagAssignment" ADD CONSTRAINT "TagAssignment_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES "Offspring"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalBreed" ADD CONSTRAINT "AnimalBreed_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalBreed" ADD CONSTRAINT "AnimalBreed_breedId_fkey" FOREIGN KEY ("breedId") REFERENCES "Breed"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedRegistryLink" ADD CONSTRAINT "BreedRegistryLink_breedId_fkey" FOREIGN KEY ("breedId") REFERENCES "Breed"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedRegistryLink" ADD CONSTRAINT "BreedRegistryLink_registryId_fkey" FOREIGN KEY ("registryId") REFERENCES "Registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomBreed" ADD CONSTRAINT "CustomBreed_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomBreed" ADD CONSTRAINT "CustomBreed_createdByOrganizationId_tenantId_fkey" FOREIGN KEY ("createdByOrganizationId", "tenantId") REFERENCES "Organization"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingPlan" ADD CONSTRAINT "BreedingPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingPlan" ADD CONSTRAINT "BreedingPlan_organizationId_tenantId_fkey" FOREIGN KEY ("organizationId", "tenantId") REFERENCES "Organization"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingPlan" ADD CONSTRAINT "BreedingPlan_damId_fkey" FOREIGN KEY ("damId") REFERENCES "Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingPlan" ADD CONSTRAINT "BreedingPlan_sireId_fkey" FOREIGN KEY ("sireId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingPlan" ADD CONSTRAINT "BreedingPlan_committedByUserId_fkey" FOREIGN KEY ("committedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReproductiveCycle" ADD CONSTRAINT "ReproductiveCycle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReproductiveCycle" ADD CONSTRAINT "ReproductiveCycle_femaleId_fkey" FOREIGN KEY ("femaleId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingPlanShare" ADD CONSTRAINT "BreedingPlanShare_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BreedingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingPlanShare" ADD CONSTRAINT "BreedingPlanShare_fromTenantId_fkey" FOREIGN KEY ("fromTenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingPlanShare" ADD CONSTRAINT "BreedingPlanShare_toTenantId_fkey" FOREIGN KEY ("toTenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingPlanEvent" ADD CONSTRAINT "BreedingPlanEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingPlanEvent" ADD CONSTRAINT "BreedingPlanEvent_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BreedingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingPlanEvent" ADD CONSTRAINT "BreedingPlanEvent_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BreedingPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingAttempt" ADD CONSTRAINT "BreedingAttempt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingAttempt" ADD CONSTRAINT "BreedingAttempt_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BreedingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingAttempt" ADD CONSTRAINT "BreedingAttempt_studOwnerPartyId_fkey" FOREIGN KEY ("studOwnerPartyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PregnancyCheck" ADD CONSTRAINT "PregnancyCheck_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PregnancyCheck" ADD CONSTRAINT "PregnancyCheck_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BreedingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringGroup" ADD CONSTRAINT "OffspringGroup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringGroup" ADD CONSTRAINT "OffspringGroup_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BreedingPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringGroup" ADD CONSTRAINT "OffspringGroup_damId_fkey" FOREIGN KEY ("damId") REFERENCES "Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringGroup" ADD CONSTRAINT "OffspringGroup_sireId_fkey" FOREIGN KEY ("sireId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringGroupBuyer" ADD CONSTRAINT "OffspringGroupBuyer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringGroupBuyer" ADD CONSTRAINT "OffspringGroupBuyer_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "OffspringGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringGroupBuyer" ADD CONSTRAINT "OffspringGroupBuyer_buyerPartyId_fkey" FOREIGN KEY ("buyerPartyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringGroupBuyer" ADD CONSTRAINT "OffspringGroupBuyer_waitlistEntryId_fkey" FOREIGN KEY ("waitlistEntryId") REFERENCES "WaitlistEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offspring" ADD CONSTRAINT "Offspring_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offspring" ADD CONSTRAINT "Offspring_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "OffspringGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offspring" ADD CONSTRAINT "Offspring_damId_fkey" FOREIGN KEY ("damId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offspring" ADD CONSTRAINT "Offspring_sireId_fkey" FOREIGN KEY ("sireId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offspring" ADD CONSTRAINT "Offspring_buyerPartyId_fkey" FOREIGN KEY ("buyerPartyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offspring" ADD CONSTRAINT "Offspring_promotedAnimalId_fkey" FOREIGN KEY ("promotedAnimalId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringEvent" ADD CONSTRAINT "OffspringEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringEvent" ADD CONSTRAINT "OffspringEvent_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES "Offspring"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringEvent" ADD CONSTRAINT "OffspringEvent_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Litter" ADD CONSTRAINT "Litter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Litter" ADD CONSTRAINT "Litter_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BreedingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BreedingPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_litterId_fkey" FOREIGN KEY ("litterId") REFERENCES "Litter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_offspringGroupId_fkey" FOREIGN KEY ("offspringGroupId") REFERENCES "OffspringGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_clientPartyId_fkey" FOREIGN KEY ("clientPartyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_sirePrefId_fkey" FOREIGN KEY ("sirePrefId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_damPrefId_fkey" FOREIGN KEY ("damPrefId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES "Offspring"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringGroupEvent" ADD CONSTRAINT "OffspringGroupEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringGroupEvent" ADD CONSTRAINT "OffspringGroupEvent_offspringGroupId_fkey" FOREIGN KEY ("offspringGroupId") REFERENCES "OffspringGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringGroupEvent" ADD CONSTRAINT "OffspringGroupEvent_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LitterEvent" ADD CONSTRAINT "LitterEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LitterEvent" ADD CONSTRAINT "LitterEvent_litterId_fkey" FOREIGN KEY ("litterId") REFERENCES "Litter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LitterEvent" ADD CONSTRAINT "LitterEvent_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BreedingPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_litterId_fkey" FOREIGN KEY ("litterId") REFERENCES "Litter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_offspringGroupId_fkey" FOREIGN KEY ("offspringGroupId") REFERENCES "OffspringGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES "Offspring"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_attachmentPartyId_fkey" FOREIGN KEY ("attachmentPartyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanParty" ADD CONSTRAINT "PlanParty_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanParty" ADD CONSTRAINT "PlanParty_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BreedingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanParty" ADD CONSTRAINT "PlanParty_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanCodeCounter" ADD CONSTRAINT "PlanCodeCounter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantSetting" ADD CONSTRAINT "TenantSetting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "OffspringGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES "Offspring"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_clientPartyId_fkey" FOREIGN KEY ("clientPartyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalOwnershipChange" ADD CONSTRAINT "AnimalOwnershipChange_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalOwnershipChange" ADD CONSTRAINT "AnimalOwnershipChange_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_ownershipChangeId_fkey" FOREIGN KEY ("ownershipChangeId") REFERENCES "AnimalOwnershipChange"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_offspringGroupId_fkey" FOREIGN KEY ("offspringGroupId") REFERENCES "OffspringGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignAttribution" ADD CONSTRAINT "CampaignAttribution_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignAttribution" ADD CONSTRAINT "CampaignAttribution_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignAttribution" ADD CONSTRAINT "CampaignAttribution_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES "Offspring"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "OffspringGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES "Offspring"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthEvent" ADD CONSTRAINT "HealthEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthEvent" ADD CONSTRAINT "HealthEvent_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES "Offspring"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthEvent" ADD CONSTRAINT "HealthEvent_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_ownershipChangeId_fkey" FOREIGN KEY ("ownershipChangeId") REFERENCES "AnimalOwnershipChange"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES "Offspring"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "OffspringGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractTemplate" ADD CONSTRAINT "ContractTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ContractTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES "Offspring"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "OffspringGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractParty" ADD CONSTRAINT "ContractParty_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractParty" ADD CONSTRAINT "ContractParty_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractParty" ADD CONSTRAINT "ContractParty_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractParty" ADD CONSTRAINT "ContractParty_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureEvent" ADD CONSTRAINT "SignatureEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureEvent" ADD CONSTRAINT "SignatureEvent_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureEvent" ADD CONSTRAINT "SignatureEvent_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "ContractParty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringDocument" ADD CONSTRAINT "OffspringDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringDocument" ADD CONSTRAINT "OffspringDocument_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES "Offspring"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringDocument" ADD CONSTRAINT "OffspringDocument_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "Attachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringContract" ADD CONSTRAINT "OffspringContract_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringContract" ADD CONSTRAINT "OffspringContract_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES "Offspring"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringContract" ADD CONSTRAINT "OffspringContract_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "Attachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringContract" ADD CONSTRAINT "OffspringContract_buyerPartyId_fkey" FOREIGN KEY ("buyerPartyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringInvoiceLink" ADD CONSTRAINT "OffspringInvoiceLink_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringInvoiceLink" ADD CONSTRAINT "OffspringInvoiceLink_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES "Offspring"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringInvoiceLink" ADD CONSTRAINT "OffspringInvoiceLink_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingIntegration" ADD CONSTRAINT "AccountingIntegration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

