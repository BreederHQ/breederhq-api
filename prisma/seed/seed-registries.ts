// prisma/seed/seed-registries.ts
import "./seed-env-bootstrap";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const REGISTRIES = [
  { code: "AKC", name: "American Kennel Club", country: "US", url: "https://www.akc.org" },
  { code: "UKC", name: "United Kennel Club", country: "US", url: "https://www.ukcdogs.com" },
  { code: "FCI", name: "Fédération Cynologique Internationale", country: "INTL", url: "https://www.fci.be" },
  { code: "KC",  name: "The Kennel Club (UK)", country: "GB", url: "https://www.thekennelclub.org.uk" },
  { code: "CKC", name: "Canadian Kennel Club", country: "CA", url: "https://www.ckc.ca" },
  { code: "CFA", name: "Cat Fanciers' Association", country: "US", url: "https://cfa.org" },
  { code: "TICA",name: "The International Cat Association", country: "US", url: "https://tica.org" },
  { code: "WCF", name: "World Cat Federation", country: "INTL", url: "https://wcf.de" },
  { code: "WBFSH", name: "World Breeding Federation for Sport Horses", country: "INTL", url: "https://www.wbfsh.com" },
  { code: "USEF", name: "United States Equestrian Federation", country: "US", url: "https://www.usef.org" },
  { code: "FEI",  name: "Fédération Equestre Internationale", country: "INTL", url: "https://www.fei.org" },
  { code: "JOCKEY_CLUB", name: "The Jockey Club", country: "US", url: "https://jockeyclub.com" },
  { code: "OTHER", name: "Other / Misc" },
];

async function main() {
  console.log(`Upserting ${REGISTRIES.length} registries …`);
  for (const r of REGISTRIES) {
    await prisma.registryCatalog.upsert({
      where: { code: r.code },
      update: { name: r.name, country: r.country, url: r.url ?? undefined },
      create: { code: r.code, name: r.name, country: r.country, url: r.url ?? undefined },
    });
  }
  console.log("Registries seeded ✅");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
