# CSV Import/Export Implementation Summary

## Overview
This document summarizes the CSV import/export functionality implemented for the BreederHQ platform, specifically for **Animals** data.

## ✅ Backend Implementation Complete

### Files Created

#### 1. CSV Import Library (`src/lib/csv-import/`)
- **`types.ts`** - TypeScript type definitions for import/export
  - `ParsedAnimalData` - Validated animal data structure
  - `ParsedRow` - Row with validation status (valid/warning/error)
  - `ImportPreviewResponse` - Preview API response
  - `ImportExecuteResponse` - Import execution result
  - `RowResolution` - User decisions for warning rows

- **`template.ts`** - CSV template generation
  - `ANIMAL_CSV_HEADERS` - Column definitions
  - `generateAnimalCsvTemplate()` - Generates downloadable template with examples
  - `FIELD_DOCUMENTATION` - Field specifications for users

- **`parser.ts`** - CSV parsing and validation
  - `parseAnimalCSV()` - Main parser function
  - Handles quoted CSV values with commas/newlines
  - Validates required fields (Name, Species, Sex)
  - Validates enum values (Species, Sex, Status)
  - Validates date formats (YYYY-MM-DD)
  - Returns rows with validation status

- **`index.ts`** - Module exports

#### 2. Import Service (`src/services/animal-import-service.ts`)
- **`findDuplicates()`** - Detects duplicate animals
  - Matches on: name + species + sex + birthDate
  - Returns existing animal details for user review

- **`findParentSuggestions()`** - Fuzzy matching for parent names
  - Uses Levenshtein distance for string similarity
  - Returns top 5 matches with scores

- **`enhanceWithDatabaseChecks()`** - Enriches parsed rows with DB checks
  - Duplicate detection
  - Parent (dam/sire) matching
  - Updates row status to "warning" if issues found

- **`executeImport()`** - Performs actual import
  - Creates animals with resolutions applied
  - Handles parent linking
  - Creates placeholder parents if requested
  - Creates/finds registry records
  - Returns detailed import summary

#### 3. API Endpoints (added to `src/routes/animals.ts`)

**GET `/api/animals/templates/csv`**
- Downloads CSV template with example rows
- Returns: `animals-import-template.csv`

**POST `/api/animals/import/preview`**
- Validates CSV without saving
- Body: `{ fileContent: base64_encoded_csv }`
- Returns: Validation summary with warnings/errors
- Response includes:
  - Summary counts (valid/warning/error rows)
  - Per-row validation details
  - Duplicate matches with existing animal details
  - Parent name suggestions with similarity scores

**POST `/api/animals/import`**
- Executes import with user resolutions
- Body: `{ fileContent: base64_encoded_csv, resolutions: RowResolution[] }`
- Returns: Import results
  - Imported animal IDs
  - Updated animal IDs
  - Skipped rows
  - Placeholder parents created

**GET `/api/animals/export/csv`**
- Exports animals to CSV
- Query params:
  - `includeExtended=true` - Include genetics provider
  - `species=DOG` - Filter by species
  - `status=ACTIVE` - Filter by status
- Returns: `animals-export-YYYY-MM-DD.csv`
- Includes:
  - Core animal data (ID, name, species, sex, birthdate, microchip, breed)
  - Parents (dam/sire names)
  - Status, registry numbers, owners
  - COI %, last updated, notes
  - Age calculation (human-readable)

---

## CSV Template Structure

### Import Template Columns

| Column | Required | Format | Example |
|--------|----------|--------|---------|
| Name | ✅ Yes | Text | Bella |
| Species | ✅ Yes | DOG/CAT/HORSE/GOAT/RABBIT/SHEEP | DOG |
| Sex | ✅ Yes | FEMALE/MALE | FEMALE |
| Birth Date | No | YYYY-MM-DD | 2023-05-15 |
| Microchip | No | 15 digits | 982000123456789 |
| Breed | No | Text | Golden Retriever |
| Dam Name | No | Text (must exist) | Daisy |
| Sire Name | No | Text (must exist) | Max |
| Registry Name | No | Text | AKC |
| Registry Number | No | Alphanumeric | WS12345678 |
| Status | No | ACTIVE/BREEDING/etc | BREEDING |
| Notes | No | Text | Champion bloodline |

### Export CSV Columns

Standard columns:
- ID, Name, Species, Sex, Birth Date, Age, Microchip
- Breed, Dam Name, Sire Name, Status
- Registry Numbers, Owner(s), COI %, Last Updated, Notes

Extended columns (when `includeExtended=true`):
- Genetics Provider

---

## Import Workflow

### Step 1: User Downloads Template
```
GET /api/animals/templates/csv
→ Returns CSV with header + 2 example rows
```

### Step 2: User Fills Template
- Add animals to CSV
- Save as `.csv` file

### Step 3: Preview Import
```
POST /api/animals/import/preview
Body: { fileContent: "base64..." }
→ Returns validation results
```

**Preview Response Example:**
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
      "data": { "name": "Bella", "species": "DOG", ... }
    },
    {
      "rowNumber": 5,
      "status": "warning",
      "warningType": "duplicate",
      "data": { ... },
      "duplicateMatch": {
        "id": 123,
        "name": "Bella",
        "species": "DOG",
        "birthDate": "2023-05-15",
        ...
      }
    },
    {
      "rowNumber": 8,
      "status": "warning",
      "warningType": "parent_not_found",
      "parentField": "dam",
      "data": { ... },
      "suggestions": [
        { "id": 145, "name": "Daisy Mae", "matchScore": 0.85 },
        { "id": 198, "name": "Daisy Duke", "matchScore": 0.72 }
      ]
    },
    {
      "rowNumber": 12,
      "status": "error",
      "errors": ["Species 'DOGGO' is invalid"],
      "data": { ... }
    }
  ]
}
```

### Step 4: User Resolves Warnings
For each warning row, user decides:

**Duplicate Actions:**
- `skip` - Don't import this row
- `update` - Update existing animal with new data
- `create_new` - Import as separate animal

**Parent Not Found Actions:**
- `skip` - Don't link parent
- `link` - Link to one of suggested animals
- `create_placeholder` - Create placeholder parent

### Step 5: Execute Import
```
POST /api/animals/import
Body: {
  fileContent: "base64...",
  resolutions: [
    { rowNumber: 5, action: "update", existingAnimalId: 123 },
    { rowNumber: 8, parentField: "dam", parentAction: "link", selectedAnimalId: 145 }
  ]
}
→ Returns import results
```

**Import Response Example:**
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
    { "rowNumber": 1, "animalId": 456, "name": "Bella" }
  ],
  "updatedAnimals": [
    { "rowNumber": 5, "animalId": 123, "name": "Bella" }
  ],
  "skippedRows": [12],
  "placeholdersCreated": [
    { "name": "Unknown Dam", "animalId": 458 }
  ]
}
```

---

## Export Workflow

### Export All Animals
```
GET /api/animals/export/csv
→ Downloads animals-export-2026-01-21.csv
```

### Export with Filters
```
GET /api/animals/export/csv?species=DOG&status=BREEDING&includeExtended=true
→ Downloads filtered export
```

---

## Validation Rules

### Row-Level Validation
- **Name**: Required, max 255 chars
- **Species**: Must be one of: DOG, CAT, HORSE, GOAT, RABBIT, SHEEP (case-insensitive)
- **Sex**: Must be FEMALE or MALE (case-insensitive)
- **Birth Date**: Must be YYYY-MM-DD format, cannot be in future
- **Status**: Must be ACTIVE, BREEDING, UNAVAILABLE, RETIRED, DECEASED, or PROSPECT (default: ACTIVE)
- **Notes**: Max 5000 chars
- **Registry Number**: Requires Registry Name to be provided

### Database-Level Checks
- **Duplicate Detection**: Exact match on name + species + sex + birthDate (case-insensitive name)
- **Parent Matching**: Fuzzy match on name + species + sex
  - Dam: Must be FEMALE, same species
  - Sire: Must be MALE, same species
  - Match score > 0.6 threshold for suggestions

### Registry Handling
- Auto-creates Registry if name doesn't exist
- Links to Species on creation
- Creates AnimalRegistryIdentifier with registryId + identifier

---

## Error Handling

### CSV Parse Errors
- Missing header row
- Missing required columns (Name, Species, Sex)
- Malformed CSV structure

### Validation Errors
- Invalid enum values (species, sex, status)
- Invalid date formats
- Missing required fields
- Field length violations

### Import Errors
- Database constraint violations
- Permission errors
- Missing resolutions for warning rows

---

## Next Steps: Frontend UI

### TODO: Data Management Settings Page
Location: Settings → Data Management

Components needed:
1. **DataManagementPage.tsx**
   - Import section with template download + upload
   - Export section with filters

2. **AnimalImportWizard.tsx**
   - Step 1: Upload CSV
   - Step 2: Preview & resolve warnings
   - Step 3: Execute & show results

3. **ImportPreviewTable.tsx**
   - Display rows with status indicators
   - Show validation errors inline

4. **ImportRowResolver.tsx**
   - Duplicate resolution UI (radio buttons)
   - Parent matching UI (searchable dropdown)

5. **AnimalExportDialog.tsx**
   - Export options (filters, extended data)
   - Download button

---

## Testing Recommendations

### Unit Tests
- CSV parser with various formats
- Validation logic for all field types
- Fuzzy matching algorithm

### Integration Tests
- Full import workflow with resolutions
- Export with various filters
- Registry creation/linking

### E2E Tests
- Upload → Preview → Resolve → Import
- Export → Download → Re-import

### Test Cases
- Empty CSV
- CSV with only headers
- Large CSV (1000+ rows)
- Special characters in names/notes
- All validation error types
- All warning resolution paths
- Duplicate microchip numbers
- Circular parent references (should be prevented)

---

## Performance Considerations

### Import Performance
- Current: Sequential processing (safe but slow)
- Improvement: Batch inserts for valid rows without warnings
- Consider: Background job for large imports (500+ animals)

### Export Performance
- Current: Loads all animals into memory
- Improvement: Stream CSV generation for large datasets
- Consider: Async export with download link

### Database Queries
- Duplicate detection: Uses index on tenantId + species + sex
- Parent matching: Consider adding GIN index for name similarity
- Registry lookup: Uses unique index on name

---

## Security Notes

### Input Validation
- ✅ CSV content is validated before parsing
- ✅ All enum values are whitelisted
- ✅ Date parsing prevents injection
- ✅ Field length limits enforced

### Authorization
- ✅ All endpoints check tenant ID
- ✅ Imports scoped to user's tenant
- ✅ Exports scoped to user's tenant
- ✅ Cannot access other tenants' data

### Data Sanitization
- ✅ CSV escaping for quotes/commas
- ✅ No raw SQL queries
- ✅ Prisma handles parameterization

---

## Future Enhancements

### Phase 2: Contacts Import
- Similar structure to animals
- Different fields (email, phone, address)
- Duplicate detection on email + phone

### Phase 3: Complete Data Package Export
- Full JSON export with relationships
- Document pre-signed URLs (7-day expiration)
- ZIP archive generation
- Async background job

### Phase 4: Per-Animal Export
- Single animal + history
- Includes pedigree tree
- Includes all documents
- Buyer-friendly format

### Phase 5: Advanced Features
- Import validation rules (custom per tenant)
- Import templates with pre-filled data
- Scheduled exports
- Auto-backup to cloud storage
- Import from other platforms (Breeders Assistant, etc.)

---

## API Documentation

Full API documentation should be added to your OpenAPI/Swagger docs with:
- Request/response schemas
- Example requests
- Error codes
- Authentication requirements

---

## Deployment Checklist

Before deploying to production:
- [ ] Run full test suite
- [ ] Test with real breeder data
- [ ] Verify CSV encoding (UTF-8)
- [ ] Test on Windows/Mac (line endings)
- [ ] Load test with 1000+ row CSV
- [ ] Verify quota enforcement integration
- [ ] Add monitoring/logging
- [ ] Document user-facing features
- [ ] Create help documentation
- [ ] Record demo video

---

**Implementation Date:** 2026-01-21
**Status:** ✅ Backend Complete, Frontend Pending
**Next:** Build Data Management UI
