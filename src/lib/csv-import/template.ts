/**
 * CSV Template Generator
 *
 * Generates downloadable CSV templates for animal imports
 */

/**
 * CSV header columns in order
 */
export const ANIMAL_CSV_HEADERS = [
  "Name",
  "Species",
  "Sex",
  "Birth Date",
  "Microchip",
  "Breed",
  "Dam Name",
  "Sire Name",
  "Registry Name",
  "Registry Number",
  "Status",
  "Notes",
] as const;

/**
 * Example rows for the template
 */
const EXAMPLE_ROWS = [
  {
    Name: "Bella",
    Species: "DOG",
    Sex: "FEMALE",
    "Birth Date": "2023-05-15",
    Microchip: "982000123456789",
    Breed: "Golden Retriever",
    "Dam Name": "Daisy",
    "Sire Name": "Max",
    "Registry Name": "AKC",
    "Registry Number": "WS12345678",
    Status: "BREEDING",
    Notes: "Champion bloodline",
  },
  {
    Name: "Duke",
    Species: "DOG",
    Sex: "MALE",
    "Birth Date": "2024-01-20",
    Microchip: "982000987654321",
    Breed: "Labrador Retriever",
    "Dam Name": "",
    "Sire Name": "",
    "Registry Name": "AKC",
    "Registry Number": "WS98765432",
    Status: "ACTIVE",
    Notes: "",
  },
];

/**
 * Escapes a CSV field value
 * Wraps in quotes if contains comma, newline, or quote
 */
function escapeCsvField(value: string): string {
  if (!value) return "";

  // If contains comma, newline, or quote, wrap in quotes and escape quotes
  if (value.includes(",") || value.includes("\n") || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

/**
 * Generates a CSV row from values
 */
function generateCsvRow(values: string[]): string {
  return values.map(escapeCsvField).join(",");
}

/**
 * Generates the complete CSV template with headers and example rows
 */
export function generateAnimalCsvTemplate(includeExamples = true): string {
  const rows: string[] = [];

  // Add header row
  rows.push(generateCsvRow(ANIMAL_CSV_HEADERS as unknown as string[]));

  // Add example rows if requested
  if (includeExamples) {
    for (const example of EXAMPLE_ROWS) {
      const rowValues = ANIMAL_CSV_HEADERS.map((header) => String(example[header] ?? ""));
      rows.push(generateCsvRow(rowValues));
    }
  }

  return rows.join("\n");
}

/**
 * Field documentation for users
 */
export const FIELD_DOCUMENTATION = {
  Name: {
    required: true,
    description: "Animal's call name",
    example: "Bella",
    maxLength: 255,
  },
  Species: {
    required: true,
    description: "Animal species (case-insensitive)",
    example: "DOG",
    validValues: ["DOG", "CAT", "HORSE", "GOAT", "RABBIT", "SHEEP"],
  },
  Sex: {
    required: true,
    description: "Biological sex (case-insensitive)",
    example: "FEMALE",
    validValues: ["FEMALE", "MALE"],
  },
  "Birth Date": {
    required: false,
    description: "Date of birth in ISO format",
    example: "2023-05-15",
    format: "YYYY-MM-DD",
  },
  Microchip: {
    required: false,
    description: "Microchip identification number (typically 15 digits)",
    example: "982000123456789",
  },
  Breed: {
    required: false,
    description: "Breed name (will be matched to existing breeds or created as custom)",
    example: "Golden Retriever",
  },
  "Dam Name": {
    required: false,
    description: "Mother's name (must already exist in your animals)",
    example: "Daisy",
    note: "If not found, you'll be prompted to resolve during import",
  },
  "Sire Name": {
    required: false,
    description: "Father's name (must already exist in your animals)",
    example: "Max",
    note: "If not found, you'll be prompted to resolve during import",
  },
  "Registry Name": {
    required: false,
    description: "Registry organization name",
    example: "AKC",
    note: "Examples: AKC, CKC, UKC, AQHA, APHA, etc.",
  },
  "Registry Number": {
    required: false,
    description: "Registration number with the registry",
    example: "WS12345678",
    note: "Must be paired with Registry Name",
  },
  Status: {
    required: false,
    description: "Animal's current status (case-insensitive, defaults to ACTIVE)",
    example: "BREEDING",
    validValues: ["ACTIVE", "BREEDING", "UNAVAILABLE", "RETIRED", "DECEASED", "PROSPECT"],
  },
  Notes: {
    required: false,
    description: "Free-form notes about the animal",
    example: "Champion bloodline",
    maxLength: 5000,
  },
} as const;
