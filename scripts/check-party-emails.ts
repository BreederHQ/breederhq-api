import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkPartyEmails() {
  try {
    const tenantId = 33;

    // Find PartyEmail records
    const partyEmails = await prisma.partyEmail.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        fromEmail: true,
        toEmail: true,
        subject: true,
        createdAt: true,
        status: true,
        direction: true,
        party: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    console.log(`Found ${partyEmails.length} PartyEmail records in tenant 33:\n`);
    partyEmails.forEach((email, idx) => {
      console.log(`[${idx + 1}] PartyEmail ${email.id}:`);
      console.log(`    Direction: ${email.direction}`);
      console.log(`    From: ${email.fromEmail}`);
      console.log(`    To: ${email.toEmail}`);
      console.log(`    Subject: ${email.subject}`);
      console.log(`    Status: ${email.status}`);
      console.log(`    Party: ${email.party?.name} <${email.party?.email}>`);
      console.log(`    Created: ${email.createdAt}`);
      console.log();
    });
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

checkPartyEmails();
