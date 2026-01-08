-- Sample genetic data for remaining animals (Goats, Rabbits, Sheep)

-- GOATS (IDs 44-47)
INSERT INTO "AnimalGenetics" ("animalId", "testProvider", "testDate", "testId", "coatColorData", "healthGeneticsData")
VALUES
  -- Din Djarin (Male Goat)
  (44, 'UC Davis VGL', '2024-08-10', 'UCD-DD001',
   '[
     {"locus": "Agouti", "locusName": "Agouti Pattern", "allele1": "A", "allele2": "a", "genotype": "A/a"},
     {"locus": "Brown", "locusName": "Brown", "allele1": "B", "allele2": "b", "genotype": "B/b"},
     {"locus": "Spotting", "locusName": "White Spotting", "allele1": "S", "allele2": "s", "genotype": "S/s"}
   ]'::jsonb,
   '[
     {"locus": "Scrapie", "locusName": "Scrapie Resistance", "genotype": "QR/QQ"},
     {"locus": "Spider", "locusName": "Spider Syndrome", "genotype": "N/N"}
   ]'::jsonb),

  -- Grogu (Male Goat)
  (45, 'UC Davis VGL', '2024-07-25', 'UCD-GR002',
   '[
     {"locus": "Agouti", "locusName": "Agouti Pattern", "allele1": "A", "allele2": "A", "genotype": "A/A"},
     {"locus": "Brown", "locusName": "Brown", "allele1": "B", "allele2": "B", "genotype": "B/B"},
     {"locus": "Spotting", "locusName": "White Spotting", "allele1": "s", "allele2": "s", "genotype": "s/s"}
   ]'::jsonb,
   '[
     {"locus": "Scrapie", "locusName": "Scrapie Resistance", "genotype": "QQ/QQ"},
     {"locus": "Spider", "locusName": "Spider Syndrome", "genotype": "N/N"}
   ]'::jsonb),

  -- Bo-Katan Kryze (Female Goat)
  (46, 'Neogen', '2024-09-18', 'NEO-BK003',
   '[
     {"locus": "Agouti", "locusName": "Agouti Pattern", "allele1": "a", "allele2": "a", "genotype": "a/a"},
     {"locus": "Brown", "locusName": "Brown", "allele1": "B", "allele2": "b", "genotype": "B/b"},
     {"locus": "Spotting", "locusName": "White Spotting", "allele1": "S", "allele2": "S", "genotype": "S/S"}
   ]'::jsonb,
   '[
     {"locus": "Scrapie", "locusName": "Scrapie Resistance", "genotype": "QR/QR"},
     {"locus": "Spider", "locusName": "Spider Syndrome", "genotype": "N/Spider"}
   ]'::jsonb),

  -- Sabine Wren (Female Goat)
  (47, 'Neogen', '2024-10-05', 'NEO-SW004',
   '[
     {"locus": "Agouti", "locusName": "Agouti Pattern", "allele1": "A", "allele2": "a", "genotype": "A/a"},
     {"locus": "Brown", "locusName": "Brown", "allele1": "b", "allele2": "b", "genotype": "b/b"},
     {"locus": "Spotting", "locusName": "White Spotting", "allele1": "S", "allele2": "s", "genotype": "S/s"}
   ]'::jsonb,
   '[
     {"locus": "Scrapie", "locusName": "Scrapie Resistance", "genotype": "QQ/QR"},
     {"locus": "Spider", "locusName": "Spider Syndrome", "genotype": "N/N"}
   ]'::jsonb);

-- RABBITS (IDs 48-51)
INSERT INTO "AnimalGenetics" ("animalId", "testProvider", "testDate", "testId", "coatColorData", "healthGeneticsData")
VALUES
  -- R2-D2 (Male Rabbit)
  (48, 'Custom Lab', '2024-06-15', 'CL-R2D2001',
   '[
     {"locus": "A", "locusName": "Agouti", "allele1": "A", "allele2": "at", "genotype": "A/at"},
     {"locus": "B", "locusName": "Brown", "allele1": "B", "allele2": "B", "genotype": "B/B"},
     {"locus": "C", "locusName": "Color", "allele1": "C", "allele2": "cchd", "genotype": "C/cchd"},
     {"locus": "D", "locusName": "Dilute", "allele1": "D", "allele2": "D", "genotype": "D/D"},
     {"locus": "E", "locusName": "Extension", "allele1": "E", "allele2": "e", "genotype": "E/e"}
   ]'::jsonb,
   '[]'::jsonb),

  -- C-3PO (Male Rabbit)
  (49, 'Custom Lab', '2024-05-22', 'CL-3PO002',
   '[
     {"locus": "A", "locusName": "Agouti", "allele1": "at", "allele2": "at", "genotype": "at/at"},
     {"locus": "B", "locusName": "Brown", "allele1": "B", "allele2": "b", "genotype": "B/b"},
     {"locus": "C", "locusName": "Color", "allele1": "C", "allele2": "C", "genotype": "C/C"},
     {"locus": "D", "locusName": "Dilute", "allele1": "D", "allele2": "d", "genotype": "D/d"},
     {"locus": "E", "locusName": "Extension", "allele1": "E", "allele2": "E", "genotype": "E/E"}
   ]'::jsonb,
   '[]'::jsonb),

  -- BB-8 (Male Rabbit)
  (50, 'Custom Lab', '2024-07-08', 'CL-BB8003',
   '[
     {"locus": "A", "locusName": "Agouti", "allele1": "A", "allele2": "A", "genotype": "A/A"},
     {"locus": "B", "locusName": "Brown", "allele1": "B", "allele2": "B", "genotype": "B/B"},
     {"locus": "C", "locusName": "Color", "allele1": "cchd", "allele2": "cchl", "genotype": "cchd/cchl"},
     {"locus": "D", "locusName": "Dilute", "allele1": "D", "allele2": "D", "genotype": "D/D"},
     {"locus": "E", "locusName": "Extension", "allele1": "e", "allele2": "e", "genotype": "e/e"}
   ]'::jsonb,
   '[]'::jsonb),

  -- K-2SO (Male Rabbit)
  (51, 'Custom Lab', '2024-08-14', 'CL-K2SO004',
   '[
     {"locus": "A", "locusName": "Agouti", "allele1": "at", "allele2": "a", "genotype": "at/a"},
     {"locus": "B", "locusName": "Brown", "allele1": "b", "allele2": "b", "genotype": "b/b"},
     {"locus": "C", "locusName": "Color", "allele1": "C", "allele2": "C", "genotype": "C/C"},
     {"locus": "D", "locusName": "Dilute", "allele1": "d", "allele2": "d", "genotype": "d/d"},
     {"locus": "E", "locusName": "Extension", "allele1": "E", "allele2": "E", "genotype": "E/E"}
   ]'::jsonb,
   '[]'::jsonb);

-- SHEEP (IDs 52-56)
INSERT INTO "AnimalGenetics" ("animalId", "testProvider", "testDate", "testId", "coatColorData", "healthGeneticsData")
VALUES
  -- Captain Rex (Male Sheep)
  (52, 'Neogen', '2024-04-10', 'NEO-REX001',
   '[
     {"locus": "Agouti", "locusName": "Agouti Pattern", "allele1": "A", "allele2": "A", "genotype": "A/A"},
     {"locus": "Color", "locusName": "Color", "allele1": "C", "allele2": "c", "genotype": "C/c"},
     {"locus": "Spotting", "locusName": "Spotting", "allele1": "S", "allele2": "s", "genotype": "S/s"}
   ]'::jsonb,
   '[
     {"locus": "Scrapie", "locusName": "Scrapie Resistance", "genotype": "QR/QR"},
     {"locus": "Spider", "locusName": "Spider Syndrome", "genotype": "N/N"}
   ]'::jsonb),

  -- Commander Cody (Male Sheep)
  (53, 'Neogen', '2024-05-16', 'NEO-CODY002',
   '[
     {"locus": "Agouti", "locusName": "Agouti Pattern", "allele1": "A", "allele2": "a", "genotype": "A/a"},
     {"locus": "Color", "locusName": "Color", "allele1": "C", "allele2": "C", "genotype": "C/C"},
     {"locus": "Spotting", "locusName": "Spotting", "allele1": "s", "allele2": "s", "genotype": "s/s"}
   ]'::jsonb,
   '[
     {"locus": "Scrapie", "locusName": "Scrapie Resistance", "genotype": "QQ/QQ"},
     {"locus": "Spider", "locusName": "Spider Syndrome", "genotype": "N/N"}
   ]'::jsonb),

  -- Fives (Male Sheep)
  (54, 'Neogen', '2024-06-22', 'NEO-FIVES003',
   '[
     {"locus": "Agouti", "locusName": "Agouti Pattern", "allele1": "a", "allele2": "a", "genotype": "a/a"},
     {"locus": "Color", "locusName": "Color", "allele1": "C", "allele2": "c", "genotype": "C/c"},
     {"locus": "Spotting", "locusName": "Spotting", "allele1": "S", "allele2": "S", "genotype": "S/S"}
   ]'::jsonb,
   '[
     {"locus": "Scrapie", "locusName": "Scrapie Resistance", "genotype": "QR/QQ"},
     {"locus": "Spider", "locusName": "Spider Syndrome", "genotype": "N/Spider"}
   ]'::jsonb),

  -- Echo (Male Sheep)
  (55, 'UC Davis VGL', '2024-07-30', 'UCD-ECHO004',
   '[
     {"locus": "Agouti", "locusName": "Agouti Pattern", "allele1": "A", "allele2": "A", "genotype": "A/A"},
     {"locus": "Color", "locusName": "Color", "allele1": "c", "allele2": "c", "genotype": "c/c"},
     {"locus": "Spotting", "locusName": "Spotting", "allele1": "S", "allele2": "s", "genotype": "S/s"}
   ]'::jsonb,
   '[
     {"locus": "Scrapie", "locusName": "Scrapie Resistance", "genotype": "QQ/QR"},
     {"locus": "Spider", "locusName": "Spider Syndrome", "genotype": "N/N"}
   ]'::jsonb),

  -- Omega (Female Sheep)
  (56, 'UC Davis VGL', '2024-09-05', 'UCD-OMEGA005',
   '[
     {"locus": "Agouti", "locusName": "Agouti Pattern", "allele1": "A", "allele2": "a", "genotype": "A/a"},
     {"locus": "Color", "locusName": "Color", "allele1": "C", "allele2": "C", "genotype": "C/C"},
     {"locus": "Spotting", "locusName": "Spotting", "allele1": "S", "allele2": "S", "genotype": "S/S"}
   ]'::jsonb,
   '[
     {"locus": "Scrapie", "locusName": "Scrapie Resistance", "genotype": "QR/QR"},
     {"locus": "Spider", "locusName": "Spider Syndrome", "genotype": "N/N"}
   ]'::jsonb);
