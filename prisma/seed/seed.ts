// breederhq-api/prisma/seed.ts
import prisma from "../../src/prisma.js";
import { randomUUID } from "crypto";

async function main() {
    const DEV_ORG_ID = Number(process.env.DEFAULT_DEV_ORG_ID || 7);
    const DEV_USER_ID = String(process.env.DEFAULT_DEV_USER_ID || "dev-user-1");

    // Ensure Organization
    let org = await prisma.organization.findUnique({ where: { id: DEV_ORG_ID } });
    if (!org) {
        org = await prisma.organization.create({ data: { id: DEV_ORG_ID, name: "Dev Org" } });
        console.log("Created Organization", org);
    }

    // Ensure User (prefer existing by id; else by email; else create)
    const DEV_EMAIL = String(process.env.DEFAULT_DEV_EMAIL || "dev@local");

    let user = await prisma.user.findUnique({ where: { id: DEV_USER_ID } });
    if (!user) {
        user = await prisma.user.findUnique({ where: { email: DEV_EMAIL } });
    }
    if (!user) {
        user = await prisma.user.create({
            data: { id: DEV_USER_ID, email: DEV_EMAIL, name: "Dev User" },
        });
        console.log("Created User", user.id);
    } else {
        console.log("Using existing User", user.id, user.email);
    }

    // Ensure Membership
    await prisma.membership.upsert({
        where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
        update: {},
        create: { userId: user.id, organizationId: org.id, role: "ADMIN" },
    });

    // Seed a couple contacts (only if none)
    const count = await prisma.contact.count({ where: { organizationId: org.id } });
    if (count === 0) {
        await prisma.contact.createMany({
            data: [
                { firstName: "Alice", lastName: "Example", organizationId: org.id, status: "ACTIVE" as any },
                { firstName: "Bob", lastName: "Example", organizationId: org.id, status: "ACTIVE" as any },
            ],
        });
        console.log("Seeded 2 contacts in org", org.id);
    }

    console.log("Seed complete.");
}

main().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
