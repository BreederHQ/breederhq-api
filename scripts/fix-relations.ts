// scripts/fix-relations.ts
import fs from "node:fs";
import path from "node:path";

const schemaPath = path.resolve(process.cwd(), "prisma/schema.prisma");
let s = fs.readFileSync(schemaPath, "utf8");

// util helpers
const hasField = (block: string, fieldName: string) =>
  new RegExp(`\\b${fieldName}\\b`).test(block);

function replaceModel(modelName: string, cb: (block: string) => string) {
  const rx = new RegExp(`model\\s+${modelName}\\s*\\{[\\s\\S]*?\\}`, "m");
  const m = s.match(rx);
  if (!m) return;
  const fixed = cb(m[0]);
  s = s.replace(m[0], fixed);
}

function ensureIndex(block: string, fieldName: string) {
  const idx = `@@index([${fieldName}])`;
  if (!block.includes(idx)) {
    block = block.replace(/\}\s*$/, `  ${idx}\n}\n`);
  }
  return block;
}

function ensureUniqueOnField(block: string, fieldName: string) {
  const rx = new RegExp(`^\\s*${fieldName}\\s+[^\\n]+$`, "m");
  const m = block.match(rx);
  if (!m) return block;
  if (!/@unique\b/.test(m[0])) {
    const withUnique = m[0].replace(/\s*$/, " @unique");
    block = block.replace(m[0], withUnique);
  }
  return block;
}

function addLineBeforeBrace(block: string, line: string) {
  if (block.includes(line)) return block;
  return block.replace(/\}\s*$/, `  ${line}\n}\n`);
}

// --- 1) Organization <-> Animal (1:M) ---
replaceModel("Organization", (b) => {
  if (!hasField(b, "animals")) {
    b = addLineBeforeBrace(b, "animals   Animal[]");
  }
  return b;
});
replaceModel("Animal", (b) => {
  if (hasField(b, "organizationId")) {
    b = ensureIndex(b, "organizationId");
  }
  if (!hasField(b, "cycleHistories")) {
    // Add here; CycleHistory fix happens below
    // we'll add the backref on Animal so Prisma is happy
    b = addLineBeforeBrace(b, "cycleHistories  CycleHistory[]");
  }
  return b;
});

// --- 2) Animal <-> CycleHistory (1:M) ---
// CycleHistory likely already has: animal   Animal @relation(...)
// we just ensure Animal has cycleHistories[] (added above)

// --- 3) Breeding <-> OffspringGroup (1:1) ---
replaceModel("OffspringGroup", (b) => {
  // ensure breedingId exists is optional—just make it unique if present
  if (/^\s*breedingId\s+/m.test(b)) {
    b = ensureUniqueOnField(b, "breedingId");
  } else {
    // if missing entirely, add nullable FK
    b = addLineBeforeBrace(b, 'breedingId String? @unique');
  }
  // ensure named relation
  const relRx = /^\s*breeding\s+Breeding\??\s+@relation\([^\)]*\)/m;
  if (relRx.test(b)) {
    b = b.replace(relRx, (line) => {
      // ensure name and fields/references
      if (!/BreedingToOffspringGroup/.test(line)) {
        line = line.replace(
          /@relation\(([^\)]*)\)/,
          (_m, inner) => `@relation("BreedingToOffspringGroup", ${inner})`
        );
      }
      if (!/fields:\s*\[breedingId\]/.test(line)) {
        line = line.replace(
          /@relation\([^\)]*\)/,
          '@relation("BreedingToOffspringGroup", fields: [breedingId], references: [id])'
        );
      }
      return line;
    });
  } else {
    b = addLineBeforeBrace(b, 'breeding   Breeding? @relation("BreedingToOffspringGroup", fields: [breedingId], references: [id])');
  }
  return b;
});

replaceModel("Breeding", (b) => {
  if (!hasField(b, "offspringGroup")) {
    b = addLineBeforeBrace(b, 'offspringGroup  OffspringGroup? @relation("BreedingToOffspringGroup")');
  }
  return b;
});

// --- 4) (Breeding | OffspringGroup | Animal) <-> Invoice (M:1) ---
replaceModel("Invoice", (b) => {
  // breeding
  if (!/^\s*breedingId\s+/m.test(b)) b = addLineBeforeBrace(b, "breedingId        String?");
  if (!/^\s*breeding\s+Breeding\?/m.test(b)) {
    b = addLineBeforeBrace(b, 'breeding          Breeding?       @relation("BreedingToInvoices", fields: [breedingId], references: [id])');
  }
  b = ensureIndex(b, "breedingId");

  // offspringGroup
  if (!/^\s*offspringGroupId\s+/m.test(b)) b = addLineBeforeBrace(b, "offspringGroupId  String?");
  if (!/^\s*offspringGroup\s+OffspringGroup\?/m.test(b)) {
    b = addLineBeforeBrace(b, 'offspringGroup    OffspringGroup? @relation("OffspringGroupToInvoices", fields: [offspringGroupId], references: [id])');
  }
  b = ensureIndex(b, "offspringGroupId");

  // animal
  if (!/^\s*animalId\s+/m.test(b)) b = addLineBeforeBrace(b, "animalId          String?");
  if (!/^\s*animal\s+Animal\?/m.test(b)) {
    b = addLineBeforeBrace(b, 'animal            Animal?         @relation("AnimalToInvoices", fields: [animalId], references: [id])');
  }
  b = ensureIndex(b, "animalId");

  return b;
});

replaceModel("Breeding", (b) => {
  if (!hasField(b, "invoices")) {
    b = addLineBeforeBrace(b, 'invoices   Invoice[] @relation("BreedingToInvoices")');
  }
  return b;
});
replaceModel("OffspringGroup", (b) => {
  if (!hasField(b, "invoices")) {
    b = addLineBeforeBrace(b, 'invoices   Invoice[] @relation("OffspringGroupToInvoices")');
  }
  return b;
});
replaceModel("Animal", (b) => {
  if (!hasField(b, "invoices")) {
    b = addLineBeforeBrace(b, 'invoices   Invoice[] @relation("AnimalToInvoices")');
  }
  return b;
});

// --- 5) (Breeding | OffspringGroup | Animal) <-> InvoiceLine (M:1) ---
replaceModel("InvoiceLine", (b) => {
  if (!/^\s*breedingId\s+/m.test(b)) b = addLineBeforeBrace(b, "breedingId        String?");
  if (!/^\s*breeding\s+Breeding\?/m.test(b)) {
    b = addLineBeforeBrace(b, 'breeding          Breeding?       @relation("BreedingToInvoiceLines", fields: [breedingId], references: [id])');
  }
  b = ensureIndex(b, "breedingId");

  if (!/^\s*offspringGroupId\s+/m.test(b)) b = addLineBeforeBrace(b, "offspringGroupId  String?");
  if (!/^\s*offspringGroup\s+OffspringGroup\?/m.test(b)) {
    b = addLineBeforeBrace(b, 'offspringGroup    OffspringGroup? @relation("OffspringGroupToInvoiceLines", fields: [offspringGroupId], references: [id])');
  }
  b = ensureIndex(b, "offspringGroupId");

  if (!/^\s*animalId\s+/m.test(b)) b = addLineBeforeBrace(b, "animalId          String?");
  if (!/^\s*animal\s+Animal\?/m.test(b)) {
    b = addLineBeforeBrace(b, 'animal            Animal?         @relation("AnimalToInvoiceLines", fields: [animalId], references: [id])');
  }
  b = ensureIndex(b, "animalId");

  return b;
});

replaceModel("Breeding", (b) => {
  if (!hasField(b, "invoiceLines")) {
    b = addLineBeforeBrace(b, 'invoiceLines InvoiceLine[] @relation("BreedingToInvoiceLines")');
  }
  return b;
});
replaceModel("OffspringGroup", (b) => {
  if (!hasField(b, "invoiceLines")) {
    b = addLineBeforeBrace(b, 'invoiceLines InvoiceLine[] @relation("OffspringGroupToInvoiceLines")');
  }
  return b;
});
replaceModel("Animal", (b) => {
  if (!hasField(b, "invoiceLines")) {
    b = addLineBeforeBrace(b, 'invoiceLines InvoiceLine[] @relation("AnimalToInvoiceLines")');
  }
  return b;
});

// --- 6) (Breeding | OffspringGroup | Animal) <-> Payment (M:1) ---
replaceModel("Payment", (b) => {
  if (!/^\s*breedingId\s+/m.test(b)) b = addLineBeforeBrace(b, "breedingId        String?");
  if (!/^\s*breeding\s+Breeding\?/m.test(b)) {
    b = addLineBeforeBrace(b, 'breeding          Breeding?       @relation("BreedingToPayments", fields: [breedingId], references: [id])');
  }
  b = ensureIndex(b, "breedingId");

  if (!/^\s*offspringGroupId\s+/m.test(b)) b = addLineBeforeBrace(b, "offspringGroupId  String?");
  if (!/^\s*offspringGroup\s+OffspringGroup\?/m.test(b)) {
    b = addLineBeforeBrace(b, 'offspringGroup    OffspringGroup? @relation("OffspringGroupToPayments", fields: [offspringGroupId], references: [id])');
  }
  b = ensureIndex(b, "offspringGroupId");

  if (!/^\s*animalId\s+/m.test(b)) b = addLineBeforeBrace(b, "animalId          String?");
  if (!/^\s*animal\s+Animal\?/m.test(b)) {
    b = addLineBeforeBrace(b, 'animal            Animal?         @relation("AnimalToPayments", fields: [animalId], references: [id])');
  }
  b = ensureIndex(b, "animalId");

  return b;
});

replaceModel("Breeding", (b) => {
  if (!hasField(b, "payments")) {
    b = addLineBeforeBrace(b, 'payments Payment[] @relation("BreedingToPayments")');
  }
  return b;
});
replaceModel("OffspringGroup", (b) => {
  if (!hasField(b, "payments")) {
    b = addLineBeforeBrace(b, 'payments Payment[] @relation("OffspringGroupToPayments")');
  }
  return b;
});
replaceModel("Animal", (b) => {
  if (!hasField(b, "payments")) {
    b = addLineBeforeBrace(b, 'payments Payment[] @relation("AnimalToPayments")');
  }
  return b;
});

// write back
fs.writeFileSync(schemaPath, s, "utf8");
console.log("✅ prisma/schema.prisma updated with relation/back-relation fixes.");
