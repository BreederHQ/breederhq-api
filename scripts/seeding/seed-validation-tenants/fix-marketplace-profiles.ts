import '../../../prisma/seed/seed-env-bootstrap';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Storefront definitions for validation tenants
const STOREFRONTS: Record<string, {
  businessName: string;
  bio: string;
  city: string;
  state: string;
  country: string;
  breeds: Array<{ name: string; species: string; isPublic: boolean }>;
  programs: Array<{
    name: string;
    species: string;
    breedText: string;
    description: string;
    openWaitlist: boolean;
    acceptInquiries: boolean;
    comingSoon: boolean;
  }>;
}> = {
  'dev-rivendell': {
    businessName: 'Rivendell Breeders',
    bio: 'Premium breeding of German Shepherds, Arabian Horses, and Maine Coons in the heart of Middle Earth.',
    city: 'Rivendell',
    state: 'Middle Earth',
    country: 'US',
    breeds: [
      { name: 'German Shepherd', species: 'Dog', isPublic: true },
      { name: 'Arabian', species: 'Horse', isPublic: true },
      { name: 'Maine Coon', species: 'Cat', isPublic: true },
    ],
    programs: [
      { name: 'Elven Hound Program', species: 'DOG', breedText: 'German Shepherd', description: 'Noble companions bred with elven care.', openWaitlist: true, acceptInquiries: true, comingSoon: false },
      { name: 'Mearas Equestrian Program', species: 'HORSE', breedText: 'Arabian', description: 'Legendary horses of exceptional quality.', openWaitlist: true, acceptInquiries: true, comingSoon: false },
    ],
  },
  'dev-hogwarts': {
    businessName: 'Magical Creatures Breeding',
    bio: 'Specializing in magical companions - cats, rabbits, and the finest hounds of the wizarding world.',
    city: 'Hogsmeade',
    state: 'Scotland',
    country: 'GB',
    breeds: [
      { name: 'British Shorthair', species: 'Cat', isPublic: true },
      { name: 'Holland Lop', species: 'Rabbit', isPublic: true },
      { name: 'Beagle', species: 'Dog', isPublic: true },
    ],
    programs: [
      { name: 'Magical Companions - Cats', species: 'CAT', breedText: 'British Shorthair', description: 'Magical feline companions.', openWaitlist: true, acceptInquiries: true, comingSoon: false },
      { name: 'Enchanted Rabbit Program', species: 'RABBIT', breedText: 'Holland Lop', description: 'Enchanting rabbits for magical homes.', openWaitlist: true, acceptInquiries: true, comingSoon: false },
    ],
  },
  'dev-winterfell': {
    businessName: 'Seven Kingdoms Stables',
    bio: 'Northern-bred horses and direwolf-sized dogs for discerning nobility.',
    city: 'Winterfell',
    state: 'The North',
    country: 'US',
    breeds: [
      { name: 'Friesian', species: 'Horse', isPublic: true },
      { name: 'Alaskan Malamute', species: 'Dog', isPublic: true },
      { name: 'Nigerian Dwarf', species: 'Goat', isPublic: true },
    ],
    programs: [
      { name: 'Northern Direwolf Program', species: 'DOG', breedText: 'Alaskan Malamute', description: 'Direwolf-like companions for the North.', openWaitlist: true, acceptInquiries: true, comingSoon: false },
    ],
  },
  'prod-arrakis': {
    businessName: 'House Atreides Stables',
    bio: 'Desert-bred animals adapted to the harsh conditions of Arrakis.',
    city: 'Arrakeen',
    state: 'Arrakis',
    country: 'US',
    breeds: [
      { name: 'Saluki', species: 'Dog', isPublic: true },
      { name: 'Siamese', species: 'Cat', isPublic: true },
      { name: 'Akhal-Teke', species: 'Horse', isPublic: true },
    ],
    programs: [
      { name: 'Fremen Desert Hound Program', species: 'DOG', breedText: 'Saluki', description: 'Desert hounds bred for endurance.', openWaitlist: true, acceptInquiries: true, comingSoon: false },
      { name: 'Bene Gesserit Cat Program', species: 'CAT', breedText: 'Siamese', description: 'Intuitive feline companions.', openWaitlist: true, acceptInquiries: true, comingSoon: false },
    ],
  },
  'prod-starfleet': {
    businessName: 'Starfleet Academy Kennels',
    bio: 'Breeding exceptional service animals for Starfleet personnel.',
    city: 'San Francisco',
    state: 'CA',
    country: 'US',
    breeds: [
      { name: 'Belgian Malinois', species: 'Dog', isPublic: true },
      { name: 'Ragdoll', species: 'Cat', isPublic: true },
    ],
    programs: [
      { name: 'Starfleet Academy Service Dogs', species: 'DOG', breedText: 'Belgian Malinois', description: 'Elite service dogs for Starfleet.', openWaitlist: true, acceptInquiries: true, comingSoon: false },
      { name: 'Starfleet Feline Program', species: 'CAT', breedText: 'Ragdoll', description: 'Calm companions for deep space voyages.', openWaitlist: true, acceptInquiries: true, comingSoon: false },
    ],
  },
  'prod-richmond': {
    businessName: 'AFC Richmond Kennels',
    bio: 'Believe in the power of a good dog. Football may be life, but dogs are family.',
    city: 'Richmond',
    state: 'London',
    country: 'GB',
    breeds: [
      { name: 'English Bulldog', species: 'Dog', isPublic: true },
      { name: 'Thoroughbred', species: 'Horse', isPublic: true },
    ],
    programs: [
      { name: 'Diamond Dogs Breeding Program', species: 'DOG', breedText: 'English Bulldog', description: 'The most loyal companions in football.', openWaitlist: true, acceptInquiries: true, comingSoon: false },
    ],
  },
  'prod-zion': {
    businessName: 'Zion Breeding Collective',
    bio: 'Free your mind, find your companion. Breeding for the resistance.',
    city: 'Zion',
    state: 'Underground',
    country: 'US',
    breeds: [
      { name: 'Abyssinian', species: 'Cat', isPublic: true },
      { name: 'German Shorthaired Pointer', species: 'Dog', isPublic: true },
    ],
    programs: [
      { name: 'Resistance Feline Program', species: 'CAT', breedText: 'Abyssinian', description: 'Agile, aware, and alert.', openWaitlist: true, acceptInquiries: true, comingSoon: false },
      { name: 'Agent Tracker Dog Program', species: 'DOG', breedText: 'German Shorthaired Pointer', description: 'For those who need to stay one step ahead.', openWaitlist: true, acceptInquiries: true, comingSoon: false },
    ],
  },
};

async function createMarketplaceProfiles() {
  console.log('Creating marketplace-profile TenantSettings for validation tenants...\n');

  for (const [slug, storefront] of Object.entries(STOREFRONTS)) {
    // Find tenant
    const tenant = await prisma.tenant.findUnique({
      where: { slug }
    });

    if (!tenant) {
      console.log(`  ! Tenant not found: ${slug}`);
      continue;
    }

    // Check if already exists
    const existing = await prisma.tenantSetting.findUnique({
      where: {
        tenantId_namespace: {
          tenantId: tenant.id,
          namespace: 'marketplace-profile'
        }
      }
    });

    const profileData = {
      draft: buildProfileData(storefront),
      published: buildProfileData(storefront),
      publishedAt: new Date().toISOString(),
      draftUpdatedAt: new Date().toISOString(),
    };

    if (existing) {
      await prisma.tenantSetting.update({
        where: { id: existing.id },
        data: { data: profileData }
      });
      console.log(`  * Updated: ${slug} -> ${storefront.businessName}`);
    } else {
      await prisma.tenantSetting.create({
        data: {
          tenantId: tenant.id,
          namespace: 'marketplace-profile',
          data: profileData,
        }
      });
      console.log(`  + Created: ${slug} -> ${storefront.businessName}`);
    }
  }

  console.log('\nDone!');
}

function buildProfileData(storefront: typeof STOREFRONTS[string]) {
  return {
    businessName: storefront.businessName,
    bio: storefront.bio,
    showBusinessIdentity: true,
    address: {
      city: storefront.city,
      state: storefront.state,
      country: storefront.country,
      zip: '00000',
    },
    publicLocationMode: 'city_state',
    breeds: storefront.breeds,
    listedBreeds: storefront.breeds.map(b => b.name),
    listedPrograms: storefront.programs.map(p => ({
      name: p.name,
      species: p.species,
      breedText: p.breedText,
      description: p.description,
      openWaitlist: p.openWaitlist,
      acceptInquiries: p.acceptInquiries,
      comingSoon: p.comingSoon,
      showWaitTime: true,
      showWhatsIncluded: true,
      showCoverImage: true,
      acceptReservations: false,
      pricingTiers: null,
      programStory: null,
      coverImageUrl: null,
      mediaAssetIds: [],
      whatsIncluded: null,
      typicalWaitTime: '6-12 months',
    })),
    standardsAndCredentials: {
      registrations: ['AKC', 'OFA'],
      healthPractices: ['OFA Hip/Elbow', 'Genetic Testing'],
      breedingPractices: ['Health-tested parents only', 'Puppy Culture'],
      carePractices: ['Vet checked', 'First vaccinations', 'Microchipped'],
      registrationsNote: null,
      healthNote: null,
      breedingNote: null,
      careNote: null,
      showRegistrations: true,
      showHealthPractices: true,
      showBreedingPractices: true,
      showCarePractices: true,
    },
    placementPolicies: {
      showPolicies: true,
      requireApplication: true,
      requireInterview: true,
      requireContract: true,
      requireDeposit: true,
      depositRefundable: true,
      requireReservationFee: false,
      requireHomeVisit: false,
      requireVetReference: true,
      requireSpayNeuter: true,
      hasReturnPolicy: true,
      lifetimeTakeBack: true,
      offersSupport: true,
      note: 'Contract required for all placements',
    },
    showWebsite: false,
    showFacebook: false,
    showInstagram: false,
    websiteUrl: null,
    facebook: null,
    instagram: null,
    logoAssetId: null,
    logoUrl: null,
    bannerImageUrl: null,
    searchParticipation: {
      zipRadius: false,
      citySearch: true,
      distanceSearch: false,
    },
    updatedAt: new Date().toISOString(),
  };
}

createMarketplaceProfiles()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
