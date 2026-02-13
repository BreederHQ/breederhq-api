-- CreateTable
CREATE TABLE "public"."animal_loci" (
    "id" SERIAL NOT NULL,
    "animal_id" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "locus" TEXT NOT NULL,
    "locus_name" TEXT NOT NULL,
    "allele1" TEXT,
    "allele2" TEXT,
    "genotype" TEXT,
    "network_visible" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "animal_loci_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "animal_loci_animal_id_idx" ON "public"."animal_loci"("animal_id");

-- CreateIndex
CREATE INDEX "animal_loci_locus_idx" ON "public"."animal_loci"("locus");

-- CreateIndex
CREATE INDEX "animal_loci_category_idx" ON "public"."animal_loci"("category");

-- CreateIndex
CREATE INDEX "animal_loci_genotype_idx" ON "public"."animal_loci"("genotype");

-- CreateIndex
CREATE INDEX "animal_loci_allele1_idx" ON "public"."animal_loci"("allele1");

-- CreateIndex
CREATE INDEX "animal_loci_allele2_idx" ON "public"."animal_loci"("allele2");

-- CreateIndex
CREATE INDEX "animal_loci_locus_genotype_idx" ON "public"."animal_loci"("locus", "genotype");

-- CreateIndex
CREATE INDEX "animal_loci_locus_allele1_idx" ON "public"."animal_loci"("locus", "allele1");

-- CreateIndex
CREATE INDEX "animal_loci_locus_allele2_idx" ON "public"."animal_loci"("locus", "allele2");

-- CreateIndex
CREATE INDEX "animal_loci_category_locus_idx" ON "public"."animal_loci"("category", "locus");

-- CreateIndex
CREATE UNIQUE INDEX "animal_loci_animal_id_category_locus_key" ON "public"."animal_loci"("animal_id", "category", "locus");

-- AddForeignKey
ALTER TABLE "public"."animal_loci" ADD CONSTRAINT "animal_loci_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "public"."Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
