-- CreateEnum
CREATE TYPE "public"."MembershipRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "public"."AnimalStatus" AS ENUM ('ACTIVE', 'BREEDING', 'UNAVAILABLE', 'RETIRED', 'DECEASED', 'PROSPECT');

-- CreateEnum
CREATE TYPE "public"."Species" AS ENUM ('DOG', 'CAT', 'HORSE');

-- CreateEnum
CREATE TYPE "public"."Sex" AS ENUM ('FEMALE', 'MALE');

-- CreateEnum
CREATE TYPE "public"."TagModule" AS ENUM ('CONTACT', 'ORGANIZATION', 'ANIMAL');

-- CreateEnum
CREATE TYPE "public"."OwnerPartyType" AS ENUM ('Organization', 'Contact');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "contactId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("identifier","token")
);

-- CreateTable
CREATE TABLE "public"."Passkey" (
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
CREATE TABLE "public"."RecoveryCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecoveryCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Organization" (
    "id" SERIAL NOT NULL,
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

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Membership" (
    "userId" TEXT NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "role" "public"."MembershipRole" NOT NULL DEFAULT 'MEMBER',

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("userId","organizationId")
);

-- CreateTable
CREATE TABLE "public"."Contact" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER,
    "display_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "street" TEXT,
    "street2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "country" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Animal" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER,
    "name" TEXT NOT NULL,
    "species" "public"."Species" NOT NULL,
    "sex" "public"."Sex" NOT NULL,
    "status" "public"."AnimalStatus" NOT NULL DEFAULT 'ACTIVE',
    "birthDate" TIMESTAMP(3),
    "microchip" TEXT,
    "notes" TEXT,
    "breed" TEXT,
    "canonicalBreedId" INTEGER,
    "customBreedId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Animal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AnimalOwner" (
    "id" SERIAL NOT NULL,
    "animalId" INTEGER NOT NULL,
    "partyType" "public"."OwnerPartyType" NOT NULL,
    "organizationId" INTEGER,
    "contactId" INTEGER,
    "percent" INTEGER NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimalOwner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Tag" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "module" "public"."TagModule" NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TagAssignment" (
    "id" SERIAL NOT NULL,
    "tagId" INTEGER NOT NULL,
    "contactId" INTEGER,
    "organizationId" INTEGER,
    "animalId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TagAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomBreed" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "species" "public"."Species" NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomBreed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE INDEX "User_contactId_idx" ON "public"."User"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "public"."Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "public"."Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "public"."VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Passkey_credentialId_key" ON "public"."Passkey"("credentialId");

-- CreateIndex
CREATE INDEX "Passkey_userId_idx" ON "public"."Passkey"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryCode_code_key" ON "public"."RecoveryCode"("code");

-- CreateIndex
CREATE INDEX "RecoveryCode_userId_idx" ON "public"."RecoveryCode"("userId");

-- CreateIndex
CREATE INDEX "Organization_archived_idx" ON "public"."Organization"("archived");

-- CreateIndex
CREATE INDEX "Organization_name_idx" ON "public"."Organization"("name");

-- CreateIndex
CREATE INDEX "Membership_organizationId_idx" ON "public"."Membership"("organizationId");

-- CreateIndex
CREATE INDEX "Contact_organizationId_idx" ON "public"."Contact"("organizationId");

-- CreateIndex
CREATE INDEX "Contact_display_name_idx" ON "public"."Contact"("display_name");

-- CreateIndex
CREATE INDEX "Contact_archived_idx" ON "public"."Contact"("archived");

-- CreateIndex
CREATE INDEX "Animal_organizationId_idx" ON "public"."Animal"("organizationId");

-- CreateIndex
CREATE INDEX "Animal_species_idx" ON "public"."Animal"("species");

-- CreateIndex
CREATE INDEX "Animal_status_idx" ON "public"."Animal"("status");

-- CreateIndex
CREATE INDEX "Animal_archived_idx" ON "public"."Animal"("archived");

-- CreateIndex
CREATE UNIQUE INDEX "Animal_organizationId_microchip_key" ON "public"."Animal"("organizationId", "microchip");

-- CreateIndex
CREATE INDEX "AnimalOwner_animalId_idx" ON "public"."AnimalOwner"("animalId");

-- CreateIndex
CREATE INDEX "AnimalOwner_organizationId_idx" ON "public"."AnimalOwner"("organizationId");

-- CreateIndex
CREATE INDEX "AnimalOwner_contactId_idx" ON "public"."AnimalOwner"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "AnimalOwner_animalId_organizationId_key" ON "public"."AnimalOwner"("animalId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "AnimalOwner_animalId_contactId_key" ON "public"."AnimalOwner"("animalId", "contactId");

-- CreateIndex
CREATE INDEX "Tag_organizationId_module_idx" ON "public"."Tag"("organizationId", "module");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_organizationId_module_name_key" ON "public"."Tag"("organizationId", "module", "name");

-- CreateIndex
CREATE INDEX "TagAssignment_contactId_idx" ON "public"."TagAssignment"("contactId");

-- CreateIndex
CREATE INDEX "TagAssignment_organizationId_idx" ON "public"."TagAssignment"("organizationId");

-- CreateIndex
CREATE INDEX "TagAssignment_animalId_idx" ON "public"."TagAssignment"("animalId");

-- CreateIndex
CREATE UNIQUE INDEX "TagAssignment_tagId_contactId_key" ON "public"."TagAssignment"("tagId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "TagAssignment_tagId_organizationId_key" ON "public"."TagAssignment"("tagId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "TagAssignment_tagId_animalId_key" ON "public"."TagAssignment"("tagId", "animalId");

-- CreateIndex
CREATE INDEX "CustomBreed_organizationId_species_idx" ON "public"."CustomBreed"("organizationId", "species");

-- CreateIndex
CREATE UNIQUE INDEX "CustomBreed_organizationId_species_name_key" ON "public"."CustomBreed"("organizationId", "species", "name");

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VerificationToken" ADD CONSTRAINT "VerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Passkey" ADD CONSTRAINT "Passkey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RecoveryCode" ADD CONSTRAINT "RecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Contact" ADD CONSTRAINT "Contact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Animal" ADD CONSTRAINT "Animal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnimalOwner" ADD CONSTRAINT "AnimalOwner_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnimalOwner" ADD CONSTRAINT "AnimalOwner_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnimalOwner" ADD CONSTRAINT "AnimalOwner_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Tag" ADD CONSTRAINT "Tag_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TagAssignment" ADD CONSTRAINT "TagAssignment_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "public"."Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TagAssignment" ADD CONSTRAINT "TagAssignment_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TagAssignment" ADD CONSTRAINT "TagAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TagAssignment" ADD CONSTRAINT "TagAssignment_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomBreed" ADD CONSTRAINT "CustomBreed_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
