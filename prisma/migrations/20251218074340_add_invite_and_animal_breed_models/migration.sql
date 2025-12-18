-- CreateTable
CREATE TABLE "Invite" (
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
CREATE TABLE "AnimalBreed" (
    "id" SERIAL NOT NULL,
    "animalId" INTEGER NOT NULL,
    "breedId" INTEGER NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimalBreed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Invite_email_idx" ON "Invite"("email");

-- CreateIndex
CREATE INDEX "Invite_token_idx" ON "Invite"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_token_key" ON "Invite"("token");

-- CreateIndex
CREATE INDEX "AnimalBreed_animalId_idx" ON "AnimalBreed"("animalId");

-- CreateIndex
CREATE INDEX "AnimalBreed_breedId_idx" ON "AnimalBreed"("breedId");

-- CreateIndex
CREATE UNIQUE INDEX "AnimalBreed_animalId_breedId_key" ON "AnimalBreed"("animalId", "breedId");

-- AddForeignKey
ALTER TABLE "AnimalBreed" ADD CONSTRAINT "AnimalBreed_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalBreed" ADD CONSTRAINT "AnimalBreed_breedId_fkey" FOREIGN KEY ("breedId") REFERENCES "Breed"("id") ON DELETE CASCADE ON UPDATE CASCADE;
