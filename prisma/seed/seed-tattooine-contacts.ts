import './seed-env-bootstrap';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌵 Starting Tattooine tenant seed...');

  // Find the existing Tatooine tenant with Luke Skywalker user
  const lukeUser = await prisma.user.findFirst({
    where: { email: 'luke.skywalker@tester.local' }
  });

  if (!lukeUser) {
    console.log('❌ luke.skywalker@tester.local user not found!');
    console.log('Please create the Luke Skywalker user and tenant first.');
    process.exit(1);
  }

  // Find tenant through Luke's membership
  const lukeMembership = await prisma.tenantMembership.findFirst({
    where: { userId: lukeUser.id },
    include: { tenant: true }
  });

  if (!lukeMembership) {
    console.log('❌ Luke Skywalker has no tenant membership!');
    process.exit(1);
  }

  const tatooineTenant = lukeMembership.tenant;
  console.log(`✓ Found Luke's tenant: ${tatooineTenant.name} (ID: ${tatooineTenant.id}, slug: ${tatooineTenant.slug})`);
  console.log(`  Owner: ${lukeUser.firstName} ${lukeUser.lastName} (${lukeUser.email})`)

  const tenantId = tatooineTenant.id;

  // Create 5 Organizations with Parties
  console.log('\n📦 Creating organizations...');

  const organizations = [
    {
      name: 'Mos Eisley Cantina Breeders',
      email: 'info@moseisley.example.com',
      phone: '+1-555-0101',
      website: 'https://moseisley.example.com',
      street: '123 Cantina Boulevard',
      city: 'Mos Eisley',
      state: 'Tatooine',
      zip: '12345',
      country: 'US',
      programSlug: 'mos-eisley-breeders',
      isPublicProgram: true,
      programBio: 'Premier breeding program specializing in exotic species from across the galaxy.',
      publicContactEmail: 'contact@moseisley.example.com'
    },
    {
      name: 'Tosche Station Genetics',
      email: 'genetics@tosche.example.com',
      phone: '+1-555-0102',
      website: 'https://tosche.example.com',
      street: '456 Power Converter Lane',
      city: 'Anchorhead',
      state: 'Tatooine',
      zip: '12346',
      country: 'US',
      programSlug: 'tosche-genetics',
      isPublicProgram: true,
      programBio: 'Family-owned breeding operation focused on quality and tradition.',
      publicContactEmail: 'info@tosche.example.com'
    },
    {
      name: 'Jundland Wastes Breeding Co.',
      email: 'contact@jundland.example.com',
      phone: '+1-555-0103',
      street: '789 Sand Dune Road',
      city: 'Jundland',
      state: 'Tatooine',
      zip: '12347',
      country: 'US',
      isPublicProgram: false
    },
    {
      name: 'Lars Homestead Livestock',
      email: 'owen@larshomestead.example.com',
      phone: '+1-555-0104',
      street: '321 Moisture Farm Way',
      city: 'Great Chott Salt Flat',
      state: 'Tatooine',
      zip: '12348',
      country: 'US',
      programSlug: 'lars-livestock',
      isPublicProgram: true,
      programBio: 'Multi-generational moisture farmers with a passion for quality breeding.',
      publicContactEmail: 'beru@larshomestead.example.com'
    },
    {
      name: 'Jabba\'s Palace Exotics',
      email: 'exotic@jabbas.example.com',
      phone: '+1-555-0105',
      website: 'https://jabbas-exotics.example.com',
      street: '1 Palace Plaza',
      city: 'Dune Sea',
      state: 'Tatooine',
      zip: '12349',
      country: 'US',
      isPublicProgram: false
    }
  ];

  const createdOrgs = [];
  for (const orgData of organizations) {
    // Check if organization already exists
    let org = await prisma.organization.findFirst({
      where: {
        tenantId,
        name: orgData.name
      }
    });

    if (!org) {
      // Create in transaction: Party + Organization
      org = await prisma.$transaction(async (tx) => {
        // Create Party first
        const party = await tx.party.create({
          data: {
            tenantId,
            type: 'ORGANIZATION',
            name: orgData.name,
            email: orgData.email,
            phoneE164: orgData.phone,
            street: orgData.street,
            city: orgData.city,
            state: orgData.state,
            postalCode: orgData.zip,
            country: orgData.country,
            archived: false
          }
        });

        // Create Organization linked to Party
        const organization = await tx.organization.create({
          data: {
            tenantId,
            partyId: party.id,
            name: orgData.name,
            email: orgData.email,
            phone: orgData.phone,
            website: orgData.website,
            street: orgData.street,
            city: orgData.city,
            state: orgData.state,
            zip: orgData.zip,
            country: orgData.country,
            programSlug: orgData.programSlug,
            isPublicProgram: orgData.isPublicProgram,
            programBio: orgData.programBio,
            publicContactEmail: orgData.publicContactEmail,
            archived: false
          }
        });

        return organization;
      });
      console.log(`✓ Created organization: ${org.name} (ID: ${org.id})`);
    } else {
      console.log(`✓ Found existing organization: ${org.name} (ID: ${org.id})`);
    }

    createdOrgs.push(org);
  }

  // Create 5 Contacts (some affiliated with organizations, some independent)
  console.log('\n👤 Creating contacts...');

  const contacts = [
    {
      first_name: 'Luke',
      last_name: 'Skywalker',
      display_name: 'Luke Skywalker',
      email: 'luke@tatooine.example.com',
      phoneE164: '+1-555-0201',
      street: '321 Moisture Farm Way',
      city: 'Great Chott Salt Flat',
      state: 'Tatooine',
      zip: '12348',
      country: 'US',
      organizationId: createdOrgs.find(o => o.name === 'Lars Homestead Livestock')?.id
    },
    {
      first_name: 'Obi-Wan',
      last_name: 'Kenobi',
      nickname: 'Ben',
      display_name: 'Ben Kenobi',
      email: 'obiwan@jundland.example.com',
      phoneE164: '+1-555-0202',
      street: '42 Hermit\'s Hovel',
      city: 'Jundland Wastes',
      state: 'Tatooine',
      zip: '12350',
      country: 'US'
    },
    {
      first_name: 'Wuher',
      last_name: 'Bartender',
      display_name: 'Wuher',
      email: 'wuher@moseisley.example.com',
      phoneE164: '+1-555-0203',
      street: '123 Cantina Boulevard',
      city: 'Mos Eisley',
      state: 'Tatooine',
      zip: '12345',
      country: 'US',
      organizationId: createdOrgs.find(o => o.name === 'Mos Eisley Cantina Breeders')?.id
    },
    {
      first_name: 'Beru',
      last_name: 'Lars',
      display_name: 'Beru Lars',
      email: 'beru@larshomestead.example.com',
      phoneE164: '+1-555-0204',
      whatsappE164: '+1-555-0204',
      street: '321 Moisture Farm Way',
      city: 'Great Chott Salt Flat',
      state: 'Tatooine',
      zip: '12348',
      country: 'US',
      organizationId: createdOrgs.find(o => o.name === 'Lars Homestead Livestock')?.id
    },
    {
      first_name: 'Biggs',
      last_name: 'Darklighter',
      display_name: 'Biggs Darklighter',
      email: 'biggs@tosche.example.com',
      phoneE164: '+1-555-0205',
      street: '456 Power Converter Lane',
      city: 'Anchorhead',
      state: 'Tatooine',
      zip: '12346',
      country: 'US',
      organizationId: createdOrgs.find(o => o.name === 'Tosche Station Genetics')?.id
    }
  ];

  for (const contactData of contacts) {
    // Check if contact already exists
    let contact = await prisma.contact.findFirst({
      where: {
        tenantId,
        email: contactData.email
      }
    });

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          tenantId,
          ...contactData,
          archived: false
        }
      });
      console.log(`✓ Created contact: ${contact.display_name} (ID: ${contact.id})${contact.organizationId ? ` - ${organizations.find(o => createdOrgs.find(co => co.id === contact.organizationId))?.name}` : ''}`);
    } else {
      console.log(`✓ Found existing contact: ${contact.display_name} (ID: ${contact.id})`);
    }
  }

  console.log('\n🎉 Tattooine seed completed successfully!');
  console.log(`   Tenant: ${tatooineTenant.name} (${tatooineTenant.slug})`);
  console.log(`   Tenant ID: ${tenantId}`);
  console.log(`   Organizations: ${createdOrgs.length}`);
  console.log(`   Contacts: ${contacts.length}`);
  console.log(`\n💡 Login as luke.skywalker@tester.local to access the Tattooine tenant`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
