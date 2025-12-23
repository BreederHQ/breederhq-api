// prisma/seed/seed-registries.ts
import "./seed-env-bootstrap";
import { PrismaClient, Species } from "@prisma/client";

const prisma = new PrismaClient();

type RegistrySeed = {
  code: string;
  name: string;
  country: string | null;
  url: string | null;
  species: Species | null;
};

const REGISTRIES: RegistrySeed[] = [
  // Dogs
  { code: "AKC", name: "American Kennel Club", country: "US", url: "https://www.akc.org", species: Species.DOG },
  { code: "UKC", name: "United Kennel Club", country: "US", url: "https://www.ukcdogs.com", species: Species.DOG },
  { code: "FCI", name: "Fédération Cynologique Internationale", country: "INTL", url: "https://www.fci.be", species: Species.DOG },
  { code: "KC", name: "The Kennel Club (UK)", country: "GB", url: "https://www.thekennelclub.org.uk", species: Species.DOG },
  { code: "CKC", name: "Canadian Kennel Club", country: "CA", url: "https://www.ckc.ca", species: Species.DOG },
  { code: "CKC_CONT", name: "Continental Kennel Club", country: "US", url: null, species: Species.DOG },
  { code: "BREED_OTHER", name: "Breed Club / Other", country: null, url: null, species: Species.DOG },

  { code: "ACA", name: "American Canine Association", country: "US", url: null, species: Species.DOG },
  { code: "ACCC", name: "ACCC (Dog Registry)", country: null, url: null, species: Species.DOG },
  { code: "CKCCA", name: "CKCCA (Dog Registry)", country: null, url: null, species: Species.DOG },

  { code: "APRI", name: "American Pet Registry Inc", country: "US", url: null, species: Species.DOG },
  { code: "ABKC", name: "American Bully Kennel Club", country: "US", url: null, species: Species.DOG },
  { code: "ICCF", name: "International Cane Corso Federation", country: null, url: null, species: Species.DOG },

  { code: "ASDR", name: "American Stock Dog Registry", country: "US", url: null, species: Species.DOG },
  { code: "ANKC", name: "Australian National Kennel Council", country: "AU", url: null, species: Species.DOG },
  { code: "NSDR", name: "National Stock Dog Registry", country: "US", url: null, species: Species.DOG },

  { code: "JRTCA", name: "Jack Russell Terrier Club of America", country: "US", url: null, species: Species.DOG },
  { code: "ASCA", name: "Australian Shepherd Club of America", country: "US", url: null, species: Species.DOG },
  { code: "ICA", name: "International Cat Association (Dog Division)", country: null, url: null, species: Species.DOG }, // legacy, keep if referenced
  { code: "NAVHDA", name: "North American Versatile Hunting Dog Association", country: "US", url: null, species: Species.DOG },
  { code: "IOEBA", name: "International Olde English Bulldogge Association", country: null, url: null, species: Species.DOG },

  { code: "ALAA", name: "Australian Labradoodle Association of America", country: "US", url: null, species: Species.DOG },
  { code: "WALA", name: "Worldwide Australian Labradoodle Association", country: null, url: null, species: Species.DOG },
  { code: "ALCA", name: "Australian Labradoodle Club of America", country: "US", url: null, species: Species.DOG },
  { code: "NALC", name: "North American Labradoodle Coalition", country: null, url: null, species: Species.DOG },

  // Cats
  { code: "CFA", name: "Cat Fanciers' Association", country: "US", url: "https://cfa.org", species: Species.CAT },
  { code: "TICA", name: "The International Cat Association", country: "US", url: "https://tica.org", species: Species.CAT },
  { code: "WCF", name: "World Cat Federation", country: "INTL", url: "https://www.wcf.info", species: Species.CAT },
  { code: "GCCF", name: "Governing Council of the Cat Fancy", country: "GB", url: "https://www.gccfcats.org", species: Species.CAT },
  { code: "FIFE", name: "Fédération Internationale Féline", country: "INTL", url: "https://fifeweb.org", species: Species.CAT },

  // Horses (existing)
  { code: "WBFSH", name: "World Breeding Federation for Sport Horses", country: "INTL", url: null, species: Species.HORSE },
  { code: "USEF", name: "United States Equestrian Federation", country: "US", url: null, species: Species.HORSE },
  { code: "FEI", name: "Fédération Équestre Internationale", country: "INTL", url: "https://www.fei.org", species: Species.HORSE },

  // Horses (codes referenced by horses.json, add all to avoid skipped links)
  { code: "JC", name: "The Jockey Club", country: "US", url: null, species: Species.HORSE },
  { code: "JOCKEY_CLUB", name: "The Jockey Club (Alt Code)", country: "US", url: null, species: Species.HORSE },

  { code: "AQHA", name: "American Quarter Horse Association", country: "US", url: null, species: Species.HORSE },
  { code: "AHA", name: "Arabian Horse Association", country: "US", url: null, species: Species.HORSE },
  { code: "APHA", name: "American Paint Horse Association", country: "US", url: null, species: Species.HORSE },
  { code: "AMHA", name: "American Morgan Horse Association / Miniature (Ambiguous)", country: "US", url: null, species: Species.HORSE },

  { code: "TWHBEA", name: "Tennessee Walking Horse Breeders' & Exhibitors' Association", country: "US", url: null, species: Species.HORSE },
  { code: "MFTHBA", name: "Missouri Fox Trotting Horse Breed Association", country: "US", url: null, species: Species.HORSE },
  { code: "USTA", name: "United States Trotting Association", country: "US", url: null, species: Species.HORSE },
  { code: "ASHBA", name: "American Saddlebred Horse and Breeders Association", country: "US", url: null, species: Species.HORSE },
  { code: "RHBAA", name: "Racking Horse Breeders Association of America", country: "US", url: null, species: Species.HORSE },

  { code: "APHC", name: "Appaloosa Horse Club", country: "US", url: null, species: Species.HORSE },
  { code: "KMSHA", name: "Kentucky Mountain Saddle Horse Association", country: "US", url: null, species: Species.HORSE },
  { code: "RMHA", name: "Rocky Mountain Horse Association", country: "US", url: null, species: Species.HORSE },
  { code: "SSHBEA", name: "Spotted Saddle Horse Breeders' and Exhibitors' Association", country: "US", url: null, species: Species.HORSE },

  { code: "NAPHA", name: "North American Peruvian Horse Association", country: "US", url: null, species: Species.HORSE },
  { code: "PFHA", name: "Paso Fino Horse Association", country: "US", url: null, species: Species.HORSE },

  { code: "KFPS", name: "Koninklijke Vereniging Het Friesch Paarden-Stamboek", country: "NL", url: null, species: Species.HORSE },
  { code: "SHIREHS", name: "Shire Horse Society", country: "GB", url: null, species: Species.HORSE },
  { code: "CBHS", name: "Cleveland Bay Horse Society", country: "GB", url: null, species: Species.HORSE },
  { code: "ACDHA", name: "American Cream Draft Horse Association", country: "US", url: null, species: Species.HORSE },
  { code: "SUFFOLKHS", name: "Suffolk Horse Society", country: "GB", url: null, species: Species.HORSE },
  { code: "SHPF", name: "Société Hippique Percheronne de France", country: "FR", url: null, species: Species.HORSE },

  { code: "ANCCE", name: "ANCCE (PRE Studbook)", country: "ES", url: null, species: Species.HORSE },
  { code: "RMC_AZTECA", name: "Registro Mexicano de la Raza Azteca", country: "MX", url: null, species: Species.HORSE },
  { code: "APSL", name: "Associação Portuguesa de Criadores do Cavalo Puro Sangue Lusitano", country: "PT", url: null, species: Species.HORSE },

  { code: "IHSI", name: "Indigenous Horse Society of India", country: "IN", url: null, species: Species.HORSE },
  { code: "BDHCA", name: "Belgian Draft Horse Corporation of America", country: "US", url: null, species: Species.HORSE },
  { code: "CHS", name: "Clydesdale Horse Society", country: "GB", url: null, species: Species.HORSE },

  { code: "VNIIK", name: "VNIIK (Russian horse registry)", country: "RU", url: null, species: Species.HORSE },
  { code: "LIF", name: "Lipizzaner International Federation", country: "INTL", url: null, species: Species.HORSE },

  { code: "ACCC_AR", name: "Criollo Association (Argentina)", country: "AR", url: null, species: Species.HORSE },
  { code: "ABCCCAMPOLINA", name: "Associação Brasileira dos Criadores do Cavalo Campolina", country: "BR", url: null, species: Species.HORSE },
  { code: "ABCCMM", name: "Associação Brasileira de Criadores do Cavalo Mangalarga Marchador", country: "BR", url: null, species: Species.HORSE },

  { code: "ASHS", name: "Australian Stock Horse Society", country: "AU", url: null, species: Species.HORSE },
  { code: "CHS_UK", name: "Caspian Horse Society (UK)", country: "GB", url: null, species: Species.HORSE },
  { code: "SECC_CA", name: "Canadian Horse Registry (SECC)", country: "CA", url: null, species: Species.HORSE },

  { code: "HOLV", name: "Holsteiner Verband", country: "DE", url: null, species: Species.HORSE },
  { code: "KWPN", name: "KWPN (Dutch Warmblood)", country: "NL", url: null, species: Species.HORSE },
  { code: "HV", name: "Hanoverian Verband", country: "DE", url: null, species: Species.HORSE },
  { code: "GOV", name: "Oldenburg Verband (GOV)", country: "DE", url: null, species: Species.HORSE },
  { code: "TRAKV", name: "Trakehner Verband", country: "DE", url: null, species: Species.HORSE },
  { code: "WESTF", name: "Westfälisches Pferdestammbuch", country: "DE", url: null, species: Species.HORSE },

  { code: "ANAA_FR", name: "Anglo-Arab Association (France)", country: "FR", url: null, species: Species.HORSE },
  { code: "DWB", name: "Danish Warmblood", country: "DK", url: null, species: Species.HORSE },
  { code: "HSI", name: "Horse Sport Ireland", country: "IE", url: null, species: Species.HORSE },
  { code: "SWB", name: "Swedish Warmblood Association", country: "SE", url: null, species: Species.HORSE },
  { code: "ANSF", name: "Association Nationale du Selle Français", country: "FR", url: null, species: Species.HORSE },
  { code: "BWP", name: "Belgian Warmblood (BWP)", country: "BE", url: null, species: Species.HORSE },
  { code: "Z", name: "Zangersheide", country: "BE", url: null, species: Species.HORSE },

  { code: "FEIF", name: "FEIF (Icelandic Horse)", country: "INTL", url: null, species: Species.HORSE },
  { code: "SPSBS", name: "Shetland Pony Stud-Book Society", country: "GB", url: null, species: Species.HORSE },
  { code: "WHF", name: "World Haflinger Federation", country: "INTL", url: null, species: Species.HORSE },
  { code: "WPCS", name: "Welsh Pony and Cob Society", country: "GB", url: null, species: Species.HORSE },
  { code: "CPBS_IE", name: "Connemara Pony Breeders' Society", country: "IE", url: null, species: Species.HORSE },

  { code: "NFHL_NO", name: "Norwegian Fjord Horse Registry (NO)", country: "NO", url: null, species: Species.HORSE },
  { code: "FPS", name: "Fell Pony Society", country: "GB", url: null, species: Species.HORSE },
  { code: "NFPBCS", name: "New Forest Pony Breeding & Cattle Society", country: "GB", url: null, species: Species.HORSE },
  { code: "DARTMOORPS", name: "Dartmoor Pony Society", country: "GB", url: null, species: Species.HORSE },
  { code: "DPS", name: "Dales Pony Society", country: "GB", url: null, species: Species.HORSE },
  { code: "NATIONAL_NA_STUDBOOKS", name: "National Studbooks (NA)", country: null, url: null, species: Species.HORSE },

  { code: "POAC", name: "Pony of the Americas Club", country: "US", url: null, species: Species.HORSE },
  { code: "EPS", name: "Exmoor Pony Society", country: "GB", url: null, species: Species.HORSE },
  { code: "GVHS_US", name: "Gypsy Vanner Horse Society (US)", country: "US", url: null, species: Species.HORSE },
  { code: "HIF", name: "Hucul International Federation", country: "INTL", url: null, species: Species.HORSE },
  { code: "PZHK_PL", name: "Polish Horse Breeders Association (PZHK)", country: "PL", url: null, species: Species.HORSE },

  { code: "ABCR", name: "American Bashkir Curly Registry", country: "US", url: null, species: Species.HORSE },
  { code: "WEATHERBYS", name: "Weatherbys (Thoroughbred)", country: "GB", url: null, species: Species.HORSE },
  { code: "PHAOA", name: "Percheron Horse Association of America", country: "US", url: null, species: Species.HORSE },
  { code: "FHANA", name: "Friesian Horse Association of North America", country: "US", url: null, species: Species.HORSE },
  { code: "WAHO", name: "World Arabian Horse Organization", country: "INTL", url: null, species: Species.HORSE },
  { code: "IALHA", name: "International Andalusian and Lusitano Horse Association", country: "US", url: null, species: Species.HORSE },
  { code: "MHS_IN", name: "Marwari Horse Society (India)", country: "IN", url: null, species: Species.HORSE },
  { code: "SBT_BE", name: "Belgian Studbook (Draft)", country: "BE", url: null, species: Species.HORSE },
  { code: "ATAA", name: "Akhal-Teke Association of America", country: "US", url: null, species: Species.HORSE },

  { code: "AHHA_US", name: "American Holsteiner Horse Association", country: "US", url: null, species: Species.HORSE },
  { code: "ABCCC_BR", name: "Crioulo Association (Brazil)", country: "BR", url: null, species: Species.HORSE },
  { code: "CHBA", name: "Canadian Horse Breeders Association", country: "CA", url: null, species: Species.HORSE },
  { code: "AHS_US", name: "American Hanoverian Society", country: "US", url: null, species: Species.HORSE },
  { code: "ATA_US", name: "American Trakehner Association", country: "US", url: null, species: Species.HORSE },
  { code: "OS", name: "Oldenburg Registry (Alt Code)", country: null, url: null, species: Species.HORSE },

  { code: "IDHS_GB", name: "Irish Draught Horse Society (GB)", country: "GB", url: null, species: Species.HORSE },
  { code: "AHR_US", name: "American Haflinger Registry", country: "US", url: null, species: Species.HORSE },
  { code: "ACPS_US", name: "American Connemara Pony Society", country: "US", url: null, species: Species.HORSE },
  { code: "USIHC", name: "United States Icelandic Horse Congress", country: "US", url: null, species: Species.HORSE },
  { code: "NFHR_US", name: "Norwegian Fjord Horse Registry (US)", country: "US", url: null, species: Species.HORSE },
  { code: "TGCA_UK", name: "Traditional Gypsy Cob Association (UK)", country: "GB", url: null, species: Species.HORSE },
  { code: "AMHR", name: "American Miniature Horse Registry", country: "US", url: null, species: Species.HORSE },
  { code: "ICHO", name: "International Curly Horse Organization", country: null, url: null, species: Species.HORSE },

  // Goats
  { code: "ADGA", name: "American Dairy Goat Association", country: "US", url: null, species: Species.GOAT },
  { code: "AGS", name: "American Goat Society", country: "US", url: null, species: Species.GOAT },
  { code: "NPGA", name: "National Pygmy Goat Association", country: "US", url: null, species: Species.GOAT },
  { code: "ABGA_GOAT", name: "American Boer Goat Association", country: "US", url: null, species: Species.GOAT },
  { code: "IBGA", name: "International Boer Goat Association", country: null, url: null, species: Species.GOAT },
  { code: "MGR", name: "Myotonic Goat Registry", country: "US", url: null, species: Species.GOAT },
  { code: "MDGA", name: "Miniature Dairy Goat Association", country: "US", url: null, species: Species.GOAT },
  { code: "NAPgR", name: "North American Pygmy Goat Registry", country: "US", url: null, species: Species.GOAT },
  { code: "SCIGR", name: "Savanna Club International Goat Registry", country: null, url: null, species: Species.GOAT },
  { code: "KGBA", name: "Kiko Goat Breeders Association", country: "US", url: null, species: Species.GOAT },
  { code: "NDGA", name: "Nigerian Dwarf Goat Association", country: "US", url: null, species: Species.GOAT },


  // Sheep (US and common international orgs)
  // These are practical “breed registry” anchors used in seed data.
  // You can expand later with more regional bodies.
  { code: "ASI", name: "American Sheep Industry Association", country: "US", url: "https://www.sheepusa.org", species: Species.SHEEP },
  { code: "NSIP_SHEEP", name: "National Sheep Improvement Program", country: "US", url: "https://www.nsip.org", species: Species.SHEEP },
  { code: "SBA", name: "Sheep Breeders Association (UK)", country: "GB", url: null, species: Species.SHEEP },
  { code: "ISB", name: "International Stud Book (Sheep)", country: "INTL", url: null, species: Species.SHEEP },
  { code: "SHEEP_OTHER", name: "Sheep Breed Club / Other", country: null, url: null, species: Species.SHEEP },

  // Rabbits
  { code: "ARBA", name: "American Rabbit Breeders Association", country: "US", url: "https://arba.net", species: Species.RABBIT },
  { code: "BRC_UK", name: "British Rabbit Council", country: "GB", url: null, species: Species.RABBIT },
  { code: "RABBIT_OTHER", name: "Rabbit Breed Club / Other", country: null, url: null, species: Species.RABBIT },

  // Catch all
  { code: "OTHER", name: "Other / Misc", country: null, url: null, species: null },
];

function normCode(code: string) {
  return code.trim().toUpperCase();
}

async function main() {
  for (const r of REGISTRIES) {
    const code = normCode(r.code);

    const result = await prisma.registry.upsert({
      where: { code },
      update: {
        name: r.name,
        country: r.country,
        url: r.url,
        species: r.species,
      },
      create: {
        code,
        name: r.name,
        country: r.country,
        url: r.url,
        species: r.species,
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
