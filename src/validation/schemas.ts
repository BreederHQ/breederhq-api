import { z } from "zod";

export const ContactSchema = z.object({
  id: z.string().uuid().optional(),
  firstName: z.string().min(1, "firstName required"),
  lastName: z.string().min(1, "lastName required"),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

export const AnimalSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "name required"),
  species: z.enum(["dog", "cat", "horse"]).optional(), // adjust to your enums
  sex: z.enum(["male", "female", "unknown"]).optional(),
  birthDate: z.string().datetime().optional(), // ISO string
});

export const BreedingSchema = z.object({
  id: z.string().uuid().optional(),
  femaleId: z.string().min(1, "femaleId required"),
  maleId: z.string().optional(),
  status: z.enum(["planned", "bred", "whelped", "cancelled"]).default("planned"),
  plannedOvulationDate: z.string().datetime().optional(),
  plannedWhelpDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});
