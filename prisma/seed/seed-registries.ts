// prisma/seed/seed-registries.ts
import "./seed-env-bootstrap";
import { PrismaClient, Species } from "@prisma/client";

const prisma = new PrismaClient();

type RegistrySeed = {
  code: string;
  name: string;
  country: string | null;
  url: string | null;
};

// base registry metadata, no species stored here on purpose
const REGISTRIES: RegistrySeed[] = [
  // ---------- Dogs ----------
  { code: "AKC",        name: "American Kennel Club",                          country: "US",   url: "https://www.akc.org" },
  { code: "UKC",        name: "United Kennel Club",                            country: "US",   url: "https://www.ukcdogs.com" },
  { code: "FCI",        name: "Fédération Cynologique Internationale",         country: "INTL", url: "https://www.fci.be" },
  { code: "KC",         name: "The Kennel Club (UK)",                          country: "GB",   url: "https://www.thekennelclub.org.uk" },

  { code: "CKC",        name: "Canadian Kennel Club",                          country: "CA",   url: "https://www.ckc.ca" },
  { code: "CKC_CONT",   name: "Continental Kennel Club",                       country: "US",   url: null },

  { code: "BREED_OTHER",name: "Breed Club / Other",                            country: null,   url: null },

  { code: "ACA",        name: "American Canine Association",                   country: "US",   url: null },
  { code: "ACCC",       name: "ACCC (Dog Registry)",                           country: null,   url: null },
  { code: "CKCCA",      name: "CKCCA (Dog Registry)",                          country: null,   url: null },

  { code: "APRI",       name: "American Pet Registry Inc",                     country: "US",   url: null },
  { code: "ABKC",       name: "American Bully Kennel Club",                    country: "US",   url: null },
  { code: "ICCF",       name: "International Cane Corso Federation",           country: null,   url: null },

  { code: "ASDR",       name: "American Stock Dog Registry",                   country: "US",   url: null },
  { code: "ANKC",       name: "Australian National Kennel Council",            country: "AU",   url: null },
  { code: "NSDR",       name: "National Stock Dog Registry",                   country: "US",   url: null },

  { code: "JRTCA",      name: "Jack Russell Terrier Club of America",          country: "US",   url: null },
  { code: "ASCA",       name: "Australian Shepherd Club of America",           country: "US",   url: null },
  { code: "ICA",        name: "International Canine Association",              country: null,   url: null },

  { code: "NAVHDA",     name: "North American Versatile Hunting Dog Association", country: "US", url: null },

  { code: "IOEBA",      name: "International Olde English Bulldogge Association", country: null, url: null },

  { code: "ALAA",       name: "Australian Labradoodle Association of America", country: "US",   url: null },
  { code: "WALA",       name: "Worldwide Australian Labradoodle Association",  country: "INTL", url: null },
  { code: "ALCA",       name: "Australian Labradoodle Club of America",        country: "US",   url: null },

  { code: "NALC",       name: "National Association of Louisiana Catahoulas",  country: "US",   url: null },

  // ---------- Cats ----------
  { code: "CFA",        name: "Cat Fanciers' Association",                     country: "US",   url: "https://cfa.org" },
  { code: "TICA",       name: "The International Cat Association",             country: "US",   url: "https://tica.org" },
  { code: "WCF",        name: "World Cat Federation",                          country: "INTL", url: "https://wcf.de" },
  { code: "GCCF",       name: "Governing Council of the Cat Fancy",            country: "GB",   url: "https://www.gccfcats.org" },
  { code: "FIFE",       name: "Fédération Internationale Féline",              country: "INTL", url: "https://fifeweb.org" },

  // ---------- Horses ----------
  { code: "WBFSH",      name: "World Breeding Federation for Sport Horses",    country: "INTL", url: "https://www.wbfsh.com" },
  { code: "USEF",       name: "United States Equestrian Federation",           country: "US",   url: "https://www.usef.org" },
  { code: "FEI",        name: "Fédération Equestre Internationale",            country: "INTL", url: "https://www.fei.org" },
  { code: "JOCKEY_CLUB",name: "The Jockey Club",                               country: "US",   url: "https://jockeyclub.com" },

  // ---------- Goats ----------
  { code: "ADGA",       name: "American Dairy Goat Association",               country: "US",   url: "https://adga.org" },
  { code: "AGS",        name: "American Goat Society",                         country: "US",   url: "https://americangoatsociety.com" },
  { code: "NPGA",       name: "National Pygmy Goat Association",               country: "US",   url: "https://npga-pygmy.com" },
  { code: "ABGA_GOAT",  name: "American Boer Goat Association",                country: "US",   url: "https://abga.org" },
  { code: "IBGA",       name: "International Boer Goat Association",           country: "INTL", url: "https://ibga-goats.com" },
  { code: "MGR",        name: "Myotonic Goat Registry",                        country: "US",   url: "https://myotonicgoatregistry.net" },
  { code: "MDGA",       name: "Miniature Dairy Goat Association",              country: "US",   url: "https://miniaturedairygoats.org" },
  { code: "NAPgR",      name: "North American Packgoat Registry",              country: "US",   url: "https://packgoats.org" },
  { code: "SCIGR",      name: "San Clemente Island Goat Registry",             country: "US",   url: "https://scigoats.org" },
  { code: "KGBA",       name: "Kinder Goat Breeders Association",              country: "US",   url: "https://kindergoatbreeders.com" },
  { code: "NDGA",       name: "Nigerian Dwarf Goat Association",               country: "US",   url: "https://ndga.org" },

  // ---------- Catch all ----------
  { code: "OTHER",      name: "Other / Misc",                                  country: null,   url: null },
];

// map registry code to Species enum
function getSpeciesForCode(code: string): Species | null {
  const dogCodes = new Set([
    "AKC","UKC","FCI","KC","CKC","CKC_CONT","BREED_OTHER","ACA","ACCC","CKCCA",
    "APRI","ABKC","ICCF","ASDR","ANKC","NSDR","JRTCA","ASCA","ICA","NAVHDA",
    "IOEBA","ALAA","WALA","ALCA","NALC",
  ]);
  const catCodes = new Set(["CFA","TICA","WCF","GCCF","FIFE"]);
  const horseCodes = new Set(["WBFSH","USEF","FEI","JOCKEY_CLUB"]);
  const goatCodes = new Set([
    "ADGA","AGS","NPGA","ABGA_GOAT","IBGA","MGR","MDGA","NAPgR","SCIGR","KGBA","NDGA",
  ]);

  if (dogCodes.has(code)) return Species.Dog;
  if (catCodes.has(code)) return Species.Cat;
  if (horseCodes.has(code)) return Species.Horse;
  if (goatCodes.has(code)) return Species.Goat;
  return null;
}

async function main() {
  for (const r of REGISTRIES) {
    const species = getSpeciesForCode(r.code);

    const result = await prisma.registry.upsert({
      where: { code: r.code },
      update: {
        name: r.name,
        country: r.country,
        url: r.url,
        species,
      },
      create: {
        code: r.code,
        name: r.name,
        country: r.country,
        url: r.url,
        species,
      },
    });

    console.log(`Upserted registry ${result.code} species=${result.species}`);
  }

  const countWithSpecies = await prisma.registry.count({
    where: { species: { not: null } },
  });
  console.log(`Done. Registries with non null species: ${countWithSpecies}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
