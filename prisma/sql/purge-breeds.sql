-- Drop all canonical breeds and reset their IDs.
TRUNCATE TABLE "Breed" RESTART IDENTITY CASCADE;
