-- Sample genetic data for Luke Skywalker's animals

-- DOGS (IDs 29-33)
INSERT INTO "AnimalGenetics" ("animalId", "testProvider", "testDate", "testId", "coatColorData", "healthGeneticsData")
VALUES
  -- Luke Skybarker (Male Dog)
  (29, 'Embark', '2024-11-15', 'EMB-SKY001',
   '[
     {"locus": "A", "locusName": "Agouti", "allele1": "ay", "allele2": "at", "genotype": "ay/at"},
     {"locus": "B", "locusName": "Brown", "allele1": "B", "allele2": "B", "genotype": "B/B"},
     {"locus": "D", "locusName": "Dilute", "allele1": "D", "allele2": "D", "genotype": "D/D"},
     {"locus": "E", "locusName": "Extension", "allele1": "E", "allele2": "e", "genotype": "E/e"},
     {"locus": "K", "locusName": "Black Extension", "allele1": "ky", "allele2": "ky", "genotype": "ky/ky"},
     {"locus": "S", "locusName": "White Spotting", "allele1": "S", "allele2": "sp", "genotype": "S/sp"}
   ]'::jsonb,
   '[
     {"locus": "MDR1", "locusName": "MDR1 Drug Sensitivity", "genotype": "N/N"},
     {"locus": "DM", "locusName": "Degenerative Myelopathy", "genotype": "N/DM"},
     {"locus": "PRA", "locusName": "Progressive Retinal Atrophy", "genotype": "N/N"},
     {"locus": "vWD", "locusName": "Von Willebrand Disease", "genotype": "N/N"}
   ]'::jsonb),

  -- Princess Leia Barkana (Female Dog)
  (30, 'Embark', '2024-10-22', 'EMB-LEI002',
   '[
     {"locus": "A", "locusName": "Agouti", "allele1": "aw", "allele2": "at", "genotype": "aw/at"},
     {"locus": "B", "locusName": "Brown", "allele1": "B", "allele2": "b", "genotype": "B/b"},
     {"locus": "D", "locusName": "Dilute", "allele1": "D", "allele2": "D", "genotype": "D/D"},
     {"locus": "E", "locusName": "Extension", "allele1": "E", "allele2": "E", "genotype": "E/E"},
     {"locus": "K", "locusName": "Black Extension", "allele1": "KB", "allele2": "ky", "genotype": "KB/ky"},
     {"locus": "S", "locusName": "White Spotting", "allele1": "S", "allele2": "S", "genotype": "S/S"}
   ]'::jsonb,
   '[
     {"locus": "MDR1", "locusName": "MDR1 Drug Sensitivity", "genotype": "N/N"},
     {"locus": "DM", "locusName": "Degenerative Myelopathy", "genotype": "N/N"},
     {"locus": "PRA", "locusName": "Progressive Retinal Atrophy", "genotype": "N/PRA"},
     {"locus": "vWD", "locusName": "Von Willebrand Disease", "genotype": "N/N"}
   ]'::jsonb),

  -- Han Solo Paws (Male Dog)
  (31, 'Wisdom Panel', '2024-09-10', 'WIS-HAN003',
   '[
     {"locus": "A", "locusName": "Agouti", "allele1": "at", "allele2": "a", "genotype": "at/a"},
     {"locus": "B", "locusName": "Brown", "allele1": "B", "allele2": "B", "genotype": "B/B"},
     {"locus": "D", "locusName": "Dilute", "allele1": "D", "allele2": "d", "genotype": "D/d"},
     {"locus": "E", "locusName": "Extension", "allele1": "E", "allele2": "E", "genotype": "E/E"},
     {"locus": "K", "locusName": "Black Extension", "allele1": "ky", "allele2": "ky", "genotype": "ky/ky"},
     {"locus": "S", "locusName": "White Spotting", "allele1": "sp", "allele2": "sp", "genotype": "sp/sp"}
   ]'::jsonb,
   '[
     {"locus": "MDR1", "locusName": "MDR1 Drug Sensitivity", "genotype": "N/MDR1"},
     {"locus": "DM", "locusName": "Degenerative Myelopathy", "genotype": "N/N"},
     {"locus": "PRA", "locusName": "Progressive Retinal Atrophy", "genotype": "N/N"},
     {"locus": "vWD", "locusName": "Von Willebrand Disease", "genotype": "vWD/vWD"}
   ]'::jsonb),

  -- Chewbarka (Male Dog)
  (32, 'Embark', '2024-12-01', 'EMB-CHW004',
   '[
     {"locus": "A", "locusName": "Agouti", "allele1": "ay", "allele2": "ay", "genotype": "ay/ay"},
     {"locus": "B", "locusName": "Brown", "allele1": "b", "allele2": "b", "genotype": "b/b"},
     {"locus": "D", "locusName": "Dilute", "allele1": "D", "allele2": "D", "genotype": "D/D"},
     {"locus": "E", "locusName": "Extension", "allele1": "E", "allele2": "e", "genotype": "E/e"},
     {"locus": "K", "locusName": "Black Extension", "allele1": "ky", "allele2": "ky", "genotype": "ky/ky"},
     {"locus": "M", "locusName": "Merle", "allele1": "m", "allele2": "m", "genotype": "m/m"}
   ]'::jsonb,
   '[
     {"locus": "MDR1", "locusName": "MDR1 Drug Sensitivity", "genotype": "N/N"},
     {"locus": "DM", "locusName": "Degenerative Myelopathy", "genotype": "DM/DM"},
     {"locus": "PRA", "locusName": "Progressive Retinal Atrophy", "genotype": "N/N"},
     {"locus": "vWD", "locusName": "Von Willebrand Disease", "genotype": "N/vWD"}
   ]'::jsonb),

  -- Padme Pawdala (Female Dog)
  (33, 'Embark', '2024-11-30', 'EMB-PAD005',
   '[
     {"locus": "A", "locusName": "Agouti", "allele1": "at", "allele2": "at", "genotype": "at/at"},
     {"locus": "B", "locusName": "Brown", "allele1": "B", "allele2": "B", "genotype": "B/B"},
     {"locus": "D", "locusName": "Dilute", "allele1": "D", "allele2": "D", "genotype": "D/D"},
     {"locus": "E", "locusName": "Extension", "allele1": "E", "allele2": "E", "genotype": "E/E"},
     {"locus": "K", "locusName": "Black Extension", "allele1": "ky", "allele2": "ky", "genotype": "ky/ky"},
     {"locus": "S", "locusName": "White Spotting", "allele1": "S", "allele2": "sp", "genotype": "S/sp"}
   ]'::jsonb,
   '[
     {"locus": "MDR1", "locusName": "MDR1 Drug Sensitivity", "genotype": "N/N"},
     {"locus": "DM", "locusName": "Degenerative Myelopathy", "genotype": "N/N"},
     {"locus": "PRA", "locusName": "Progressive Retinal Atrophy", "genotype": "N/N"},
     {"locus": "vWD", "locusName": "Von Willebrand Disease", "genotype": "N/N"}
   ]'::jsonb);

-- CATS (IDs 34-38)
INSERT INTO "AnimalGenetics" ("animalId", "testProvider", "testDate", "testId", "coatColorData", "healthGeneticsData")
VALUES
  -- Darth Whiskers (Male Cat)
  (34, 'UC Davis VGL', '2024-10-15', 'UCD-DW001',
   '[
     {"locus": "B", "locusName": "Brown", "allele1": "B", "allele2": "b", "genotype": "B/b"},
     {"locus": "D", "locusName": "Dilute", "allele1": "D", "allele2": "D", "genotype": "D/D"},
     {"locus": "W", "locusName": "White", "allele1": "w", "allele2": "w", "genotype": "w/w"},
     {"locus": "L", "locusName": "Long Hair", "allele1": "L", "allele2": "l", "genotype": "L/l"}
   ]'::jsonb,
   '[
     {"locus": "PKD", "locusName": "Polycystic Kidney Disease", "genotype": "N/N"},
     {"locus": "HCM", "locusName": "Hypertrophic Cardiomyopathy", "genotype": "N/HCM"}
   ]'::jsonb),

  -- Emperor Pawpatine (Male Cat)
  (35, 'UC Davis VGL', '2024-09-20', 'UCD-EP002',
   '[
     {"locus": "B", "locusName": "Brown", "allele1": "b", "allele2": "b", "genotype": "b/b"},
     {"locus": "D", "locusName": "Dilute", "allele1": "D", "allele2": "d", "genotype": "D/d"},
     {"locus": "W", "locusName": "White", "allele1": "w", "allele2": "w", "genotype": "w/w"},
     {"locus": "L", "locusName": "Long Hair", "allele1": "l", "allele2": "l", "genotype": "l/l"}
   ]'::jsonb,
   '[
     {"locus": "PKD", "locusName": "Polycystic Kidney Disease", "genotype": "N/PKD"},
     {"locus": "HCM", "locusName": "Hypertrophic Cardiomyopathy", "genotype": "N/N"}
   ]'::jsonb),

  -- Kylo Ren Meow (Male Cat)
  (36, 'Basepaws', '2024-11-05', 'BP-KRM003',
   '[
     {"locus": "B", "locusName": "Brown", "allele1": "B", "allele2": "B", "genotype": "B/B"},
     {"locus": "D", "locusName": "Dilute", "allele1": "d", "allele2": "d", "genotype": "d/d"},
     {"locus": "W", "locusName": "White", "allele1": "W", "allele2": "w", "genotype": "W/w"},
     {"locus": "L", "locusName": "Long Hair", "allele1": "L", "allele2": "L", "genotype": "L/L"}
   ]'::jsonb,
   '[
     {"locus": "PKD", "locusName": "Polycystic Kidney Disease", "genotype": "N/N"},
     {"locus": "HCM", "locusName": "Hypertrophic Cardiomyopathy", "genotype": "N/N"}
   ]'::jsonb),

  -- Captain Phasma (Female Cat)
  (37, 'UC Davis VGL', '2024-12-10', 'UCD-CP004',
   '[
     {"locus": "B", "locusName": "Brown", "allele1": "B", "allele2": "B", "genotype": "B/B"},
     {"locus": "D", "locusName": "Dilute", "allele1": "D", "allele2": "D", "genotype": "D/D"},
     {"locus": "W", "locusName": "White", "allele1": "w", "allele2": "w", "genotype": "w/w"},
     {"locus": "L", "locusName": "Long Hair", "allele1": "L", "allele2": "l", "genotype": "L/l"}
   ]'::jsonb,
   '[
     {"locus": "PKD", "locusName": "Polycystic Kidney Disease", "genotype": "N/N"},
     {"locus": "HCM", "locusName": "Hypertrophic Cardiomyopathy", "genotype": "HCM/HCM"}
   ]'::jsonb),

  -- Asajj Ventress (Female Cat)
  (38, 'Basepaws', '2024-08-25', 'BP-AV005',
   '[
     {"locus": "B", "locusName": "Brown", "allele1": "B", "allele2": "b", "genotype": "B/b"},
     {"locus": "D", "locusName": "Dilute", "allele1": "D", "allele2": "d", "genotype": "D/d"},
     {"locus": "W", "locusName": "White", "allele1": "w", "allele2": "w", "genotype": "w/w"},
     {"locus": "L", "locusName": "Long Hair", "allele1": "l", "allele2": "l", "genotype": "l/l"}
   ]'::jsonb,
   '[
     {"locus": "PKD", "locusName": "Polycystic Kidney Disease", "genotype": "N/N"},
     {"locus": "HCM", "locusName": "Hypertrophic Cardiomyopathy", "genotype": "N/HCM"}
   ]'::jsonb);

-- HORSES (IDs 39-43)
INSERT INTO "AnimalGenetics" ("animalId", "testProvider", "testDate", "testId", "coatColorData", "healthGeneticsData")
VALUES
  -- Obi-Wan Kenobi (Male Horse)
  (39, 'VGL Equine', '2024-07-15', 'VGL-OWK001',
   '[
     {"locus": "Cream", "locusName": "Cream Dilution", "allele1": "n", "allele2": "n", "genotype": "n/n"},
     {"locus": "Champagne", "locusName": "Champagne", "allele1": "n", "allele2": "n", "genotype": "n/n"},
     {"locus": "Dun", "locusName": "Dun", "allele1": "D", "allele2": "nd1", "genotype": "D/nd1"},
     {"locus": "Agouti", "locusName": "Agouti", "allele1": "A", "allele2": "a", "genotype": "A/a"}
   ]'::jsonb,
   '[
     {"locus": "HYPP", "locusName": "Hyperkalemic Periodic Paralysis", "genotype": "N/N"},
     {"locus": "PSSM", "locusName": "Polysaccharide Storage Myopathy", "genotype": "N/PSSM1"}
   ]'::jsonb),

  -- Yoda (Male Horse)
  (40, 'Animal Genetics', '2024-06-20', 'AG-YOD002',
   '[
     {"locus": "Cream", "locusName": "Cream Dilution", "allele1": "Cr", "allele2": "n", "genotype": "Cr/n"},
     {"locus": "Champagne", "locusName": "Champagne", "allele1": "n", "allele2": "n", "genotype": "n/n"},
     {"locus": "Dun", "locusName": "Dun", "allele1": "nd1", "allele2": "nd1", "genotype": "nd1/nd1"},
     {"locus": "Agouti", "locusName": "Agouti", "allele1": "A", "allele2": "A", "genotype": "A/A"}
   ]'::jsonb,
   '[
     {"locus": "HYPP", "locusName": "Hyperkalemic Periodic Paralysis", "genotype": "N/N"},
     {"locus": "PSSM", "locusName": "Polysaccharide Storage Myopathy", "genotype": "N/N"}
   ]'::jsonb),

  -- Mace Windu (Male Horse)
  (41, 'VGL Equine', '2024-09-12', 'VGL-MW003',
   '[
     {"locus": "Cream", "locusName": "Cream Dilution", "allele1": "n", "allele2": "n", "genotype": "n/n"},
     {"locus": "Champagne", "locusName": "Champagne", "allele1": "Ch", "allele2": "n", "genotype": "Ch/n"},
     {"locus": "Dun", "locusName": "Dun", "allele1": "nd1", "allele2": "nd1", "genotype": "nd1/nd1"},
     {"locus": "Agouti", "locusName": "Agouti", "allele1": "a", "allele2": "a", "genotype": "a/a"}
   ]'::jsonb,
   '[
     {"locus": "HYPP", "locusName": "Hyperkalemic Periodic Paralysis", "genotype": "N/HYPP"},
     {"locus": "PSSM", "locusName": "Polysaccharide Storage Myopathy", "genotype": "N/N"}
   ]'::jsonb),

  -- Ahsoka Tano (Female Horse)
  (42, 'Animal Genetics', '2024-10-08', 'AG-AT004',
   '[
     {"locus": "Cream", "locusName": "Cream Dilution", "allele1": "Cr", "allele2": "Cr", "genotype": "Cr/Cr"},
     {"locus": "Champagne", "locusName": "Champagne", "allele1": "n", "allele2": "n", "genotype": "n/n"},
     {"locus": "Dun", "locusName": "Dun", "allele1": "D", "allele2": "nd1", "genotype": "D/nd1"},
     {"locus": "Agouti", "locusName": "Agouti", "allele1": "A", "allele2": "a", "genotype": "A/a"}
   ]'::jsonb,
   '[
     {"locus": "HYPP", "locusName": "Hyperkalemic Periodic Paralysis", "genotype": "N/N"},
     {"locus": "PSSM", "locusName": "Polysaccharide Storage Myopathy", "genotype": "PSSM1/PSSM1"}
   ]'::jsonb),

  -- Rey Skywalker (Female Horse)
  (43, 'VGL Equine', '2024-11-18', 'VGL-RS005',
   '[
     {"locus": "Cream", "locusName": "Cream Dilution", "allele1": "n", "allele2": "n", "genotype": "n/n"},
     {"locus": "Champagne", "locusName": "Champagne", "allele1": "n", "allele2": "n", "genotype": "n/n"},
     {"locus": "Dun", "locusName": "Dun", "allele1": "D", "allele2": "D", "genotype": "D/D"},
     {"locus": "Agouti", "locusName": "Agouti", "allele1": "A", "allele2": "A", "genotype": "A/A"}
   ]'::jsonb,
   '[
     {"locus": "HYPP", "locusName": "Hyperkalemic Periodic Paralysis", "genotype": "N/N"},
     {"locus": "PSSM", "locusName": "Polysaccharide Storage Myopathy", "genotype": "N/PSSM1"}
   ]'::jsonb);
