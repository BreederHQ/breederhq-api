# Data Import/Export API Documentation

**Status**: ✅ Production Ready
**Version**: 1.1.0
**Date**: 2026-02-10

## Overview

The Data Import/Export API enables breeders to:
- **Import** animal records from CSV files (with template support)
- **Export** animal data to CSV format for backup and analysis
- **Migrate** data from other platforms or spreadsheets

This system handles validation, duplicate detection, parent matching, and provides a user-friendly preview-before-import workflow.

---

## Table of Contents

1. [Architecture](#architecture)
2. [API Endpoints](#api-endpoints)
3. [CSV Template Format](#csv-template-format)
4. [Import Workflow](#import-workflow)
5. [Validation Rules](#validation-rules)
6. [Duplicate Detection](#duplicate-detection)
7. [Parent Matching](#parent-matching)
8. [Error Handling](#error-handling)
9. [Security](#security)
10. [Performance Considerations](#performance-considerations)

---

## Architecture

### Backend Components

```
src/
├── lib/
│   └── csv-import/
│       ├── types.ts           # Type definitions
│       ├── template.ts        # CSV template generator
│       ├── parser.ts          # CSV parser & validation
│       └── index.ts           # Module exports
├── services/
│   └── animal-import-service.ts  # Import business logic
└── routes/
    └── animals.ts             # API endpoints (CSV section)
```

### Key Services

**CSV Parser** (`lib/csv-import/parser.ts`)
- Parses CSV with proper quote handling
- Validates field types and formats
- Returns structured validation results

**Import Service** (`services/animal-import-service.ts`)
- Duplicate detection (fuzzy matching)
- Parent suggestion (Levenshtein distance)
- Import execution with transactions

---

## API Endpoints

### 1. Download CSV Template

**Endpoint**: `GET /api/animals/templates/csv`

**Description**: Downloads a pre-formatted CSV template with example rows.

**Authentication**: Required (session cookie)

**Response**:
- **Content-Type**: `text/csv`
- **Filename**: `animals-import-template.csv`

**Example**:
```http
GET /api/animals/templates/csv HTTP/1.1
Host: api.breederhq.com
Cookie: session=...

HTTP/1.1 200 OK
Content-Type: text/csv
Content-Disposition: attachment; filename="animals-import-template.csv"

Name,Species,Sex,Birth Date,Microchip,Breed,Dam Name,Sire Name,Registry Name,Registry Number,Status,Notes
Bella,DOG,FEMALE,2023-05-15,982000123456789,Golden Retriever,Daisy,Max,AKC,WS12345678,BREEDING,Champion bloodline
Duke,DOG,MALE,2024-01-20,982000987654321,Labrador Retriever,,,AKC,WS98765432,ACTIVE,
```

---

### 2. Preview Import

**Endpoint**: `POST /api/animals/import/preview`

**Description**: Validates CSV content without saving. Returns validation results, warnings, and errors.

**Authentication**: Required (session cookie)

**Request Body**:
```json
{
  "fileContent": "base64_encoded_csv_string"
}
```

**Response**: `ImportPreviewResponse`
```json
{
  "summary": {
    "totalRows": 50,
    "validRows": 45,
    "warningRows": 3,
    "errorRows": 2
  },
  "rows": [
    {
      "rowNumber": 1,
      "status": "valid",
      "data": {
        "name": "Bella",
        "species": "DOG",
        "sex": "FEMALE",
        "birthDate": "2023-05-15",
        "microchip": "982000123456789",
        "breed": "Golden Retriever",
        "damName": "Daisy",
        "sireName": "Max",
        "registryName": "AKC",
        "registryNumber": "WS12345678",
        "status": "BREEDING",
        "notes": "Champion bloodline"
      }
    },
    {
      "rowNumber": 5,
      "status": "warning",
      "warningType": "duplicate",
      "data": { "..." },
      "duplicateMatch": {
        "id": 123,
        "name": "Bella",
        "species": "DOG",
        "sex": "FEMALE",
        "birthDate": "2023-05-15T00:00:00.000Z",
        "breed": "Golden Retriever",
        "microchip": "982000123456789",
        "photoUrl": "https://...",
        "status": "BREEDING"
      }
    },
    {
      "rowNumber": 8,
      "status": "warning",
      "warningType": "parent_not_found",
      "parentField": "dam",
      "data": { "..." },
      "suggestions": [
        {
          "id": 145,
          "name": "Daisy Mae",
          "species": "DOG",
          "breed": "Golden Retriever",
          "birthDate": "2020-03-10T00:00:00.000Z",
          "matchScore": 0.85
        },
        {
          "id": 198,
          "name": "Daisy Duke",
          "species": "DOG",
          "breed": "Lab Mix",
          "birthDate": "2019-08-22T00:00:00.000Z",
          "matchScore": 0.72
        }
      ]
    },
    {
      "rowNumber": 12,
      "status": "error",
      "errors": [
        "Species 'DOGGO' is invalid. Must be one of: DOG, CAT, HORSE, GOAT, RABBIT, SHEEP",
        "Birth Date 'Jan 15 2023' is invalid. Use format: YYYY-MM-DD"
      ],
      "data": { "..." }
    }
  ]
}
```

**Status Codes**:
- `200 OK` - Preview generated successfully
- `400 Bad Request` - Invalid CSV format or missing fileContent
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - No access to tenant

---

### 3. Execute Import

**Endpoint**: `POST /api/animals/import`

**Description**: Executes the import with user-provided resolutions for warnings.

**Authentication**: Required (session cookie)

**Request Body**:
```json
{
  "fileContent": "base64_encoded_csv_string",
  "resolutions": [
    {
      "rowNumber": 5,
      "action": "update",
      "existingAnimalId": 123
    },
    {
      "rowNumber": 8,
      "parentField": "dam",
      "parentAction": "link",
      "selectedAnimalId": 145
    },
    {
      "rowNumber": 15,
      "parentField": "sire",
      "parentAction": "create_placeholder"
    }
  ]
}
```

**Resolution Types**:

**Duplicate Resolution**:
```json
{
  "rowNumber": 5,
  "action": "skip" | "update" | "create_new",
  "existingAnimalId": 123  // Required if action is "update"
}
```

**Parent Not Found Resolution**:
```json
{
  "rowNumber": 8,
  "parentField": "dam" | "sire",
  "parentAction": "link" | "skip" | "create_placeholder",
  "selectedAnimalId": 145  // Required if parentAction is "link"
}
```

**Response**: `ImportExecuteResponse`
```json
{
  "success": true,
  "summary": {
    "imported": 45,
    "updated": 3,
    "skipped": 2,
    "errors": 0
  },
  "importedAnimals": [
    { "rowNumber": 1, "animalId": 456, "name": "Bella" },
    { "rowNumber": 2, "animalId": 457, "name": "Duke" }
  ],
  "updatedAnimals": [
    { "rowNumber": 5, "animalId": 123, "name": "Bella" }
  ],
  "skippedRows": [12],
  "placeholdersCreated": [
    { "name": "Unknown Sire", "animalId": 458 }
  ]
}
```

**Status Codes**:
- `200 OK` - Import completed successfully
- `400 Bad Request` - Invalid request or missing resolutions
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - No access to tenant
- `500 Internal Server Error` - Import failed (database error)

---

### 4. Export Animals

**Endpoint**: `GET /api/animals/export/csv`

**Description**: Exports animals to CSV format with optional filters.

**Authentication**: Required (session cookie)

**Query Parameters**:
- `includeExtended` (boolean, optional) - Include genetics provider
- `species` (string, optional) - Filter by species (DOG, CAT, HORSE, etc.)
- `status` (string, optional) - Filter by status (ACTIVE, BREEDING, etc.)

**Response**:
- **Content-Type**: `text/csv`
- **Filename**: `animals-export-YYYY-MM-DD.csv`

**Example**:
```http
GET /api/animals/export/csv?species=DOG&status=BREEDING&includeExtended=true HTTP/1.1
Host: api.breederhq.com
Cookie: session=...

HTTP/1.1 200 OK
Content-Type: text/csv
Content-Disposition: attachment; filename="animals-export-2026-01-21.csv"

ID,Name,Species,Sex,Birth Date,Age,Microchip,Breed,Dam Name,Sire Name,Status,Registry Numbers,Owner(s),COI %,Last Updated,Notes,Genetics Provider
123,Bella,DOG,FEMALE,2023-05-15,2 years 8 months,982000123456789,Golden Retriever,Daisy,Max,BREEDING,AKC: WS12345678,John Smith,3.5,2026-01-20,Champion bloodline,Embark
```

**Status Codes**:
- `200 OK` - Export completed successfully
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - No access to tenant
- `500 Internal Server Error` - Export failed

---

### 5. Export for NSIP (Sheep Performance Data)

**Endpoint**: `GET /api/animals/export/nsip`

**Description**: Exports sheep performance data in Pedigree Master-compatible format for NSIP (National Sheep Improvement Program) submission.

**Authentication**: Required (session cookie)

**Query Parameters**:
- `birthDateFrom` (string, optional) - Filter offspring born after this date (ISO 8601 format)
- `birthDateTo` (string, optional) - Filter offspring born before this date (ISO 8601 format)
- `includeWeights` (boolean, optional, default: true) - Include birth, weaning, and post-weaning weights
- `includeParentage` (boolean, optional, default: true) - Include sire and dam IDs

**Response**:
- **Content-Type**: `text/tab-separated-values`
- **Filename**: `nsip-export-YYYY-MM-DD.txt`

**Exported Columns**:
| Column | Description | Always Included |
|--------|-------------|-----------------|
| Animal_ID | Scrapie tag, registration number, or internal ID | Yes |
| Birth_Date | Date of birth (YYYY-MM-DD) | Yes |
| Sex | M or F | Yes |
| Breed | Breed name | Yes |
| Birth_Type | Number of siblings (1=single, 2=twin, 3=triplet) | Yes |
| Rear_Type | Rearing type (same as birth type unless orphaned) | Yes |
| Birth_Wt_Lb | Birth weight in pounds | If includeWeights=true |
| Wean_Wt_Lb | Weaning weight (60-90 days) in pounds | If includeWeights=true |
| Post_Wean_Wt_Lb | Post-weaning weight (120+ days) in pounds | If includeWeights=true |
| Sire_ID | Sire's scrapie tag, registration number, or internal ID | If includeParentage=true |
| Dam_ID | Dam's scrapie tag, registration number, or internal ID | If includeParentage=true |

**Example**:
```http
GET /api/animals/export/nsip?birthDateFrom=2025-10-01&birthDateTo=2026-05-31 HTTP/1.1
Host: api.breederhq.com
Cookie: session=...

HTTP/1.1 200 OK
Content-Type: text/tab-separated-values
Content-Disposition: attachment; filename="nsip-export-2026-02-10.txt"

Animal_ID	Birth_Date	Sex	Breed	Birth_Type	Rear_Type	Birth_Wt_Lb	Wean_Wt_Lb	Post_Wean_Wt_Lb	Sire_ID	Dam_ID
US123456789	2025-11-15	F	Katahdin	2	2	8.5	45.2		US987654321	US456789123
US123456790	2025-11-15	M	Katahdin	2	2	9.1	48.6		US987654321	US456789123
```

**Animal ID Priority**:
1. Scrapie tag number (USDA compliance)
2. NSIP/ASI registry number
3. First available registry number
4. Internal animal ID

**Weaning Weight Calculation**:
- Looks for weight recorded at 60, 75, or 90 days (±7 days tolerance)
- Converts from ounces to pounds if stored in ounces

**Status Codes**:
- `200 OK` - Export completed successfully
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - No access to tenant
- `404 Not Found` - No sheep offspring found for the specified date range
- `500 Internal Server Error` - Export failed

**Notes**:
- Only exports SHEEP species offspring
- Data sourced from Offspring records and NeonatalCareEntries
- Compatible with Pedigree Master software import format
- Birth type calculated from siblings born on same date to same dam

---

## CSV Template Format

### Import Columns

| Column | Type | Required | Format | Max Length | Notes |
|--------|------|----------|--------|------------|-------|
| **Name** | String | ✅ Yes | Text | 255 | Animal's call name |
| **Species** | Enum | ✅ Yes | DOG, CAT, HORSE, GOAT, RABBIT, SHEEP | - | Case-insensitive |
| **Sex** | Enum | ✅ Yes | FEMALE, MALE | - | Case-insensitive |
| **Birth Date** | Date | No | YYYY-MM-DD | - | ISO format |
| **Microchip** | String | No | 15 digits | 255 | International standard |
| **Breed** | String | No | Text | 255 | Matched to canonical or custom |
| **Dam Name** | String | No | Text | 255 | Mother (must exist or fuzzy matched) |
| **Sire Name** | String | No | Text | 255 | Father (must exist or fuzzy matched) |
| **Registry Name** | String | No | Text | 255 | e.g., "AKC", "CKC" |
| **Registry Number** | String | No | Alphanumeric | 255 | Paired with Registry Name |
| **Status** | Enum | No | ACTIVE, BREEDING, UNAVAILABLE, RETIRED, DECEASED, PROSPECT | - | Default: ACTIVE |
| **Notes** | String | No | Text | 5000 | Free-form notes |

### Export Columns

**Standard Columns**:
- ID, Name, Species, Sex, Birth Date, Age (calculated)
- Microchip, Breed, Dam Name, Sire Name, Status
- Registry Numbers (formatted: "AKC: WS123, CKC: XY456")
- Owner(s) (comma-separated)
- COI %, Last Updated, Notes

**Extended Columns** (when `includeExtended=true`):
- Genetics Provider (e.g., "Embark")

---

## Import Workflow

### Step-by-Step Process

```
1. User Downloads Template
   ↓
2. User Fills CSV with Animal Data
   ↓
3. User Uploads CSV → POST /import/preview
   ↓
4. System Validates & Returns Preview
   ├─ Valid rows: Ready to import
   ├─ Warning rows: Need user resolution
   └─ Error rows: Cannot import (show errors)
   ↓
5. User Resolves Warnings
   ├─ Duplicates: Skip / Update / Create New
   └─ Parent Not Found: Link / Skip / Create Placeholder
   ↓
6. User Confirms → POST /import (with resolutions)
   ↓
7. System Imports Animals
   ├─ Creates new animals
   ├─ Updates existing animals
   ├─ Links parents
   ├─ Creates registries
   └─ Creates placeholder parents
   ↓
8. Success Summary Displayed
```

---

## Validation Rules

### Field-Level Validation

**Name**:
- Required
- Max 255 characters
- Trimmed of whitespace

**Species**:
- Required
- Must be one of: `DOG`, `CAT`, `HORSE`, `GOAT`, `RABBIT`, `SHEEP`
- Case-insensitive matching

**Sex**:
- Required
- Must be one of: `FEMALE`, `MALE`
- Case-insensitive matching

**Birth Date**:
- Optional
- Format: `YYYY-MM-DD` (ISO 8601)
- Cannot be in the future
- Example: `2023-05-15`

**Microchip**:
- Optional
- Typically 15 digits
- Stored as string (allows alphanumeric)

**Breed**:
- Optional
- Matched to `CanonicalBreed` or stored as custom breed

**Dam Name / Sire Name**:
- Optional
- Triggers parent matching if provided
- Must match existing animal or fuzzy match with user confirmation

**Registry Name / Registry Number**:
- Optional (both or neither)
- Registry Number requires Registry Name
- Registry auto-created if doesn't exist

**Status**:
- Optional (defaults to `ACTIVE`)
- Must be one of: `ACTIVE`, `BREEDING`, `UNAVAILABLE`, `RETIRED`, `DECEASED`, `PROSPECT`
- Case-insensitive matching

**Notes**:
- Optional
- Max 5000 characters

### Row-Level Validation

❌ **Error Status** (cannot import):
- Missing required fields (Name, Species, Sex)
- Invalid enum values
- Invalid date format
- Birth date in future
- Registry Number without Registry Name
- Field length violations

⚠️ **Warning Status** (needs user resolution):
- Duplicate animal detected
- Parent name not found or ambiguous

✅ **Valid Status** (ready to import):
- All validation passed
- Can be imported without user input

---

## Duplicate Detection

### Matching Algorithm

An animal is considered a duplicate if it matches an existing animal on:
- **Name** (case-insensitive)
- **Species** (exact match)
- **Sex** (exact match)
- **Birth Date** (exact match, if provided)

**OR**

- **Microchip** (exact match, if provided)

### User Resolution Options

When a duplicate is detected, the user must choose:

1. **Skip this row**
   - Don't import the animal
   - Existing animal unchanged

2. **Update existing animal**
   - Replace existing data with CSV values
   - Preserves animal ID and relationships
   - Updates: birthDate, microchip, breed, status, notes

3. **Import as separate new animal**
   - Create a new animal record
   - Treats as a different animal (e.g., same name in different litters)

---

## Parent Matching

### Fuzzy Matching Algorithm

Uses **Levenshtein distance** to find similar parent names:

```
Similarity Score = (longer.length - editDistance) / longer.length
```

**Example**:
- Input: "Daisy"
- Candidate: "Daisy Mae"
- Edit Distance: 4
- Similarity: (9 - 4) / 9 = **0.56** (56% match)

### Match Threshold

Only animals with similarity score > **0.6** (60%) are shown as suggestions.

### Matching Criteria

Parents are matched on:
- **Name** (fuzzy match)
- **Species** (exact match with import row)
- **Sex** (dam must be FEMALE, sire must be MALE)

### User Resolution Options

When parent not found, the user must choose:

1. **Link to suggested animal**
   - Select from top 5 suggestions
   - Shows similarity score, breed, birth date

2. **Skip - don't link parent**
   - Import animal without parent link
   - Parent field left null

3. **Create placeholder parent**
   - Creates new animal with provided name
   - Species: Same as offspring
   - Sex: FEMALE (dam) or MALE (sire)
   - Status: PROSPECT
   - Notes: "Created as placeholder during import"

---

## Error Handling

### Client-Side Errors

**Invalid CSV Format**:
```json
{
  "error": "parse_failed",
  "message": "CSV file must contain a header row and at least one data row"
}
```

**Missing Required Column**:
```json
{
  "error": "parse_failed",
  "message": "Missing required columns: Species, Sex"
}
```

### Server-Side Errors

**Authentication Error**:
```json
{
  "error": "unauthorized",
  "message": "Authentication required"
}
```

**Import Failed**:
```json
{
  "error": "import_failed",
  "message": "Database constraint violation"
}
```

### Validation Errors

Validation errors are returned in the preview response per row:

```json
{
  "rowNumber": 12,
  "status": "error",
  "errors": [
    "Species 'DOGGO' is invalid. Must be one of: DOG, CAT, HORSE, GOAT, RABBIT, SHEEP",
    "Birth Date 'Jan 15 2023' is invalid. Use format: YYYY-MM-DD"
  ],
  "data": { "..." }
}
```

---

## Security

### Authentication & Authorization

✅ **Session-based authentication** required for all endpoints
✅ **Tenant isolation** - All queries filtered by `tenantId`
✅ **Row-level security** - Users can only import/export their own animals

### Input Validation

✅ **CSV parsing** - Proper quote escaping prevents injection
✅ **Enum whitelisting** - Only valid species/sex/status accepted
✅ **Length limits** - Prevents buffer overflow attacks
✅ **Date validation** - Prevents invalid date injection
✅ **Parameterized queries** - Prisma prevents SQL injection

### Data Sanitization

✅ **CSV escaping** - Quotes, commas, newlines properly escaped
✅ **No raw SQL** - All queries use Prisma ORM
✅ **Base64 encoding** - File content safely transmitted

### Rate Limiting

⚠️ **Recommended**: Apply rate limiting to import endpoints
- Max 10 imports per hour per tenant
- Max 1000 rows per import

---

## Performance Considerations

### Import Performance

**Current Implementation**:
- Sequential processing (one row at a time)
- Safe: Uses transactions for atomicity
- Slow: ~10 rows/second

**Optimization Opportunities**:
- Batch inserts for valid rows (no warnings)
- Parallel processing with worker threads
- Background job queue for large imports (500+ animals)

### Export Performance

**Current Implementation**:
- Loads all animals into memory
- Generates CSV in single operation
- Fast for < 10,000 animals

**Optimization Opportunities**:
- Stream CSV generation for large datasets
- Cursor-based pagination
- Async export with download link notification

### Database Queries

**Indexes Used**:
- `Animal.tenantId` (tenant isolation)
- `Animal.species + sex` (parent matching)
- `Animal.name` (duplicate detection - consider GIN index)
- `Registry.name` (registry lookup)

**Recommendations**:
- Add GIN index on `Animal.name` for faster fuzzy matching
- Consider full-text search for parent matching at scale

---

## Future Enhancements

### Phase 2: Contacts Import
- Similar CSV structure for contacts
- Duplicate detection on email + phone
- Address validation

### Phase 3: Complete Data Package Export
- Full JSON export with all relationships
- Document pre-signed URLs (7-day expiration)
- ZIP archive with actual files
- Async background job

### Phase 4: Per-Animal Export
- Single animal + complete history
- Pedigree tree visualization
- All associated documents
- Buyer-friendly PDF summary

### Phase 5: Advanced Features
- Import validation rules (custom per tenant)
- Scheduled exports (daily/weekly backups)
- Auto-backup to cloud storage (S3, Google Drive)
- Import from other platforms (Breeders Assistant, etc.)
- Breed-specific field validation
- Import preview with row highlighting in spreadsheet

---

## Troubleshooting

### Common Issues

**Issue**: "Missing required columns" error

**Solution**: Ensure CSV has exact header names (case-sensitive):
```csv
Name,Species,Sex,Birth Date,Microchip,Breed,Dam Name,Sire Name,Registry Name,Registry Number,Status,Notes
```

---

**Issue**: "Birth Date 'X' is invalid" error

**Solution**: Use ISO format `YYYY-MM-DD`, not `MM/DD/YYYY` or other formats:
```
✅ Correct: 2023-05-15
❌ Wrong:   05/15/2023
❌ Wrong:   May 15, 2023
```

---

**Issue**: Parent not found with exact name

**Solution**: Check for:
- Extra spaces in name
- Case sensitivity (should work, but verify)
- Animal exists in same tenant
- Animal is correct sex (dam=FEMALE, sire=MALE)

---

**Issue**: Import succeeds but animals not showing

**Solution**: Check:
- Animals not archived (`archived=false`)
- Correct `tenantId` and `organizationId`
- Refresh browser cache
- Check usage quota not exceeded

---

## API Response Codes Reference

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Operation completed |
| 400 | Bad Request | Check request format |
| 401 | Unauthorized | Authenticate user |
| 403 | Forbidden | Check tenant access |
| 500 | Server Error | Check logs, retry |

---

## Changelog

### v1.1.0 (2026-02-10)
- ✅ Added NSIP export endpoint (`GET /api/animals/export/nsip`)
- ✅ Pedigree Master-compatible tab-delimited format
- ✅ Date range filtering for lambing seasons
- ✅ Optional weight data (birth, weaning, post-weaning)
- ✅ Optional parentage data (sire/dam IDs)
- ✅ Birth type calculation from sibling count

### v1.0.0 (2026-01-21)
- ✅ Initial release
- ✅ CSV import with preview
- ✅ Duplicate detection
- ✅ Parent fuzzy matching
- ✅ CSV export with filters
- ✅ Registry auto-creation
- ✅ Placeholder parent creation

---

## Support

For issues or questions:
- **GitHub**: https://github.com/breederhq/breederhq-api/issues
- **Docs**: See `docs/` folder for additional guides

---

**Document Version**: 1.1.0
**Last Updated**: 2026-02-10
**Author**: BreederHQ Engineering Team
