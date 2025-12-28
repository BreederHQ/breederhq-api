-- CreateSchema
CREATE SCHEMA IF NOT EXISTS public;

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "public"."AnimalStatus" AS ENUM ('ACTIVE', 'BREEDING', 'UNAVAILABLE', 'RETIRED', 'DECEASED', 'PROSPECT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "public"."MembershipRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "public"."OwnerPartyType" AS ENUM ('Organization', 'Contact');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "public"."Sex" AS ENUM ('FEMALE', 'MALE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "public"."ShareScope" AS ENUM ('VIEW', 'BREED_PLAN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "public"."ShareStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "public"."Species" AS ENUM ('DOG', 'CAT', 'HORSE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "public"."TagModule" AS ENUM ('CONTACT', 'ORGANIZATION', 'ANIMAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "public"."TenantRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'BILLING', 'VIEWER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "public"."VerificationPurpose" AS ENUM ('VERIFY_EMAIL', 'RESET_PASSWORD', 'INVITE', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Everything below here stays exactly as it was in baseline,
-- starting at: CREATE TABLE "public"."Animal" ...
-- Paste the remainder of your existing baseline SQL starting at the first CREATE TABLE line.
