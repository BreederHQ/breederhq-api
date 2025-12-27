# Trait System & Document Linking - API Validation

This document provides validation commands and expected responses for the BreederHQ trait system and document linking prototype.

## Prerequisites

1. Get your tenant ID and create/identify a test DOG animal
2. Set environment variables:
```bash
export TENANT_ID=1
export ANIMAL_ID=123  # Replace with actual dog ID
export API_URL="https://your-api-url.com"
export AUTH_TOKEN="your-auth-token"
```

## Test Sequence

### 1. GET Traits for a Dog

**Request:**
```bash
curl -X GET "$API_URL/api/v1/animals/$ANIMAL_ID/traits" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "animalId": 123,
  "species": "DOG",
  "categories": [
    {
      "category": "Cardiac",
      "items": [
        {
          "traitKey": "dog.cardiac.exam",
          "displayName": "Cardiac Exam",
          "valueType": "ENUM",
          "enumValues": ["Normal", "Abnormal", "Pending"],
          "requiresDocument": false,
          "marketplaceVisibleDefault": true,
          "value": null,
          "status": null,
          "performedAt": null,
          "source": null,
          "verified": false,
          "verifiedAt": null,
          "marketplaceVisible": null,
          "notes": null,
          "traitValueId": null,
          "documents": []
        }
      ]
    },
    {
      "category": "Eyes",
      "items": [...]
    },
    {
      "category": "General",
      "items": [...]
    },
    {
      "category": "Genetic",
      "items": [...]
    },
    {
      "category": "Orthopedic",
      "items": [
        {
          "traitKey": "dog.hips.ofa",
          "displayName": "OFA Hips",
          "valueType": "ENUM",
          "enumValues": ["Excellent", "Good", "Fair", "Borderline", "Mild", "Moderate", "Severe", "Pending"],
          "requiresDocument": true,
          "marketplaceVisibleDefault": true,
          "value": null,
          "status": null,
          "performedAt": null,
          "source": null,
          "verified": false,
          "verifiedAt": null,
          "marketplaceVisible": null,
          "notes": null,
          "traitValueId": null,
          "documents": []
        }
      ]
    },
    {
      "category": "Reproductive",
      "items": [...]
    }
  ]
}
```

### 2. PUT OFA Hips Value

**Request:**
```bash
curl -X PUT "$API_URL/api/v1/animals/$ANIMAL_ID/traits" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "updates": [
      {
        "traitKey": "dog.hips.ofa",
        "status": "PROVIDED",
        "valueText": "Excellent",
        "performedAt": "2025-06-01T00:00:00.000Z",
        "source": "VET",
        "verified": false,
        "marketplaceVisible": true
      }
    ]
  }'
```

**Expected Response:**
Same format as GET, but now the OFA Hips item should show:
```json
{
  "traitKey": "dog.hips.ofa",
  "displayName": "OFA Hips",
  "valueType": "ENUM",
  "enumValues": ["Excellent", "Good", "Fair", "Borderline", "Mild", "Moderate", "Severe", "Pending"],
  "requiresDocument": true,
  "marketplaceVisibleDefault": true,
  "value": {
    "boolean": null,
    "number": null,
    "text": "Excellent",
    "date": null,
    "json": null
  },
  "status": "PROVIDED",
  "performedAt": "2025-06-01T00:00:00.000Z",
  "source": "VET",
  "verified": false,
  "verifiedAt": null,
  "marketplaceVisible": true,
  "notes": null,
  "traitValueId": 1,
  "documents": []
}
```

### 3. POST Document from Traits Tab for PennHIP

**Request:**
```bash
curl -X POST "$API_URL/api/v1/animals/$ANIMAL_ID/traits/dog.hips.pennhip/documents" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "PennHIP Report 2025",
    "originalFileName": "pennhip-report.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 123456,
    "visibility": "BUYERS"
  }'
```

**Expected Response:**
```json
{
  "id": 1,
  "tenantId": 1,
  "animalId": 123,
  "scope": "animal",
  "kind": "generic",
  "title": "PennHIP Report 2025",
  "originalFileName": "pennhip-report.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 123456,
  "visibility": "BUYERS",
  "status": "PLACEHOLDER",
  "storageKey": null,
  "externalUrl": null,
  "url": null,
  "sha256": null,
  "bytes": null,
  "data": null,
  "createdAt": "2025-12-27T...",
  "updatedAt": "2025-12-27T...",
  "linkedTraits": [
    {
      "traitKey": "dog.hips.pennhip",
      "displayName": "PennHIP",
      "category": "Orthopedic",
      "traitValueId": 2
    }
  ]
}
```

### 4. GET Traits Again - Confirm Document Appears

**Request:**
```bash
curl -X GET "$API_URL/api/v1/animals/$ANIMAL_ID/traits" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Result:**
The PennHIP item in the Orthopedic category should now show:
```json
{
  "traitKey": "dog.hips.pennhip",
  "displayName": "PennHIP",
  "valueType": "JSON",
  "enumValues": null,
  "requiresDocument": true,
  "marketplaceVisibleDefault": true,
  "value": null,
  "status": "PROVIDED",
  "performedAt": null,
  "source": null,
  "verified": false,
  "verifiedAt": null,
  "marketplaceVisible": null,
  "notes": null,
  "traitValueId": 2,
  "documents": [
    {
      "documentId": 1,
      "title": "PennHIP Report 2025",
      "status": "PLACEHOLDER",
      "visibility": "BUYERS",
      "mimeType": "application/pdf",
      "sizeBytes": 123456,
      "originalFileName": "pennhip-report.pdf"
    }
  ]
}
```

### 5. POST Document from Documents Tab with Link to CAER

**Request:**
```bash
curl -X POST "$API_URL/api/v1/animals/$ANIMAL_ID/documents" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "CAER Eye Exam 2025",
    "originalFileName": "caer-exam.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 98765,
    "visibility": "PUBLIC",
    "linkTraitKeys": ["dog.eyes.caer"]
  }'
```

**Expected Response:**
```json
{
  "id": 2,
  "tenantId": 1,
  "animalId": 123,
  "scope": "animal",
  "kind": "generic",
  "title": "CAER Eye Exam 2025",
  "originalFileName": "caer-exam.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 98765,
  "visibility": "PUBLIC",
  "status": "PLACEHOLDER",
  "storageKey": null,
  "externalUrl": null,
  "url": null,
  "sha256": null,
  "bytes": null,
  "data": null,
  "createdAt": "2025-12-27T...",
  "updatedAt": "2025-12-27T...",
  "linkedTraits": [
    {
      "traitKey": "dog.eyes.caer",
      "displayName": "CAER Eye Exam",
      "category": "Eyes",
      "traitValueId": 3
    }
  ]
}
```

### 6. GET Documents List

**Request:**
```bash
curl -X GET "$API_URL/api/v1/animals/$ANIMAL_ID/documents" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
[
  {
    "id": 2,
    "title": "CAER Eye Exam 2025",
    "mimeType": "application/pdf",
    "bytes": null,
    "sizeBytes": 98765,
    "originalFileName": "caer-exam.pdf",
    "visibility": "PUBLIC",
    "status": "PLACEHOLDER",
    "storageKey": null,
    "externalUrl": null,
    "url": null,
    "createdAt": "2025-12-27T...",
    "updatedAt": "2025-12-27T...",
    "linkedTraits": [
      {
        "traitKey": "dog.eyes.caer",
        "displayName": "CAER Eye Exam",
        "category": "Eyes",
        "traitValueId": 3
      }
    ]
  },
  {
    "id": 1,
    "title": "PennHIP Report 2025",
    "mimeType": "application/pdf",
    "bytes": null,
    "sizeBytes": 123456,
    "originalFileName": "pennhip-report.pdf",
    "visibility": "BUYERS",
    "status": "PLACEHOLDER",
    "storageKey": null,
    "externalUrl": null,
    "url": null,
    "createdAt": "2025-12-27T...",
    "updatedAt": "2025-12-27T...",
    "linkedTraits": [
      {
        "traitKey": "dog.hips.pennhip",
        "displayName": "PennHIP",
        "category": "Orthopedic",
        "traitValueId": 2
      }
    ]
  }
]
```

### 7. DELETE Document

**Request:**
```bash
curl -X DELETE "$API_URL/api/v1/animals/$ANIMAL_ID/documents/1" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

**Expected Response:**
- HTTP 204 No Content

After deletion, re-run GET traits to confirm the PennHIP document chip no longer appears.

## Error Cases to Test

### 1. Invalid Trait Key
```bash
curl -X PUT "$API_URL/api/v1/animals/$ANIMAL_ID/traits" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "updates": [
      {
        "traitKey": "dog.invalid.trait",
        "valueText": "test"
      }
    ]
  }'
```

**Expected:** HTTP 404
```json
{
  "error": "trait_not_found",
  "message": "Trait dog.invalid.trait not found for species DOG"
}
```

### 2. Value Type Mismatch (ENUM expects valueText)
```bash
curl -X PUT "$API_URL/api/v1/animals/$ANIMAL_ID/traits" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "updates": [
      {
        "traitKey": "dog.hips.ofa",
        "valueNumber": 123
      }
    ]
  }'
```

**Expected:** HTTP 400
```json
{
  "error": "value_type_mismatch",
  "message": "Trait dog.hips.ofa expects valueText (type: ENUM)"
}
```

### 3. Invalid ENUM Value
```bash
curl -X PUT "$API_URL/api/v1/animals/$ANIMAL_ID/traits" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "updates": [
      {
        "traitKey": "dog.hips.ofa",
        "valueText": "InvalidGrade"
      }
    ]
  }'
```

**Expected:** HTTP 400
```json
{
  "error": "invalid_enum_value",
  "message": "Invalid value \"InvalidGrade\" for dog.hips.ofa. Allowed: Excellent, Good, Fair, Borderline, Mild, Moderate, Severe, Pending"
}
```

### 4. Invalid PennHIP JSON Structure
```bash
curl -X PUT "$API_URL/api/v1/animals/$ANIMAL_ID/traits" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "updates": [
      {
        "traitKey": "dog.hips.pennhip",
        "valueJson": {"invalid": "structure"}
      }
    ]
  }'
```

**Expected:** HTTP 400
```json
{
  "error": "invalid_pennhip_json",
  "message": "PennHIP JSON must have shape: { di: number, notes?: string, side?: \"left\" | \"right\" | \"both\" }"
}
```

### 5. Trait Not Found for Species (Document Linking)
```bash
curl -X POST "$API_URL/api/v1/animals/$ANIMAL_ID/documents" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Document",
    "linkTraitKeys": ["cat.trait.notdog"]
  }'
```

**Expected:** HTTP 404
```json
{
  "error": "trait_not_found_for_species",
  "message": "Trait cat.trait.notdog not found for species DOG"
}
```

### 6. Missing Title for Document
```bash
curl -X POST "$API_URL/api/v1/animals/$ANIMAL_ID/documents" \
  -H "x-tenant-id": $TENANT_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "originalFileName": "test.pdf"
  }'
```

**Expected:** HTTP 400
```json
{
  "error": "title_required"
}
```

### 7. Animal Not Found
```bash
curl -X GET "$API_URL/api/v1/animals/999999/traits" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected:** HTTP 404
```json
{
  "error": "animal_not_found"
}
```

## Seed Verification

Verify that all 12 global DOG trait definitions are seeded with correct defaults:

### SQL Validation (Direct Database)

**Count all global DOG traits:**
```sql
SELECT count(*)
FROM "TraitDefinition"
WHERE "tenantId" IS NULL AND species='DOG';
```
**Expected:** 12

**List all global DOG traits with marketplace defaults:**
```sql
SELECT key, category, "valueType", "marketplaceVisibleDefault", "requiresDocument"
FROM "TraitDefinition"
WHERE "tenantId" IS NULL AND species='DOG'
ORDER BY "sortOrder", key;
```

**Expected result (12 rows):**
```
key                            | category     | valueType | marketplaceVisibleDefault | requiresDocument
-------------------------------+--------------+-----------+---------------------------+------------------
dog.hips.ofa                   | Orthopedic   | ENUM      | false                     | true
dog.hips.pennhip               | Orthopedic   | JSON      | false                     | true
dog.elbows.ofa                 | Orthopedic   | ENUM      | false                     | true
dog.patella.luxation           | Orthopedic   | ENUM      | false                     | false
dog.eyes.caer                  | Eyes         | ENUM      | false                     | true
dog.cardiac.exam               | Cardiac      | ENUM      | false                     | false
dog.genetics.panelCompleted    | Genetic      | BOOLEAN   | false                     | false
dog.genetics.summary           | Genetic      | JSON      | false                     | false
dog.repro.proven               | Reproductive | BOOLEAN   | false                     | false
dog.repro.semenAnalysis        | Reproductive | ENUM      | false                     | false
dog.id.microchip               | General      | BOOLEAN   | false                     | false
dog.registry.akcNumber         | General      | TEXT      | false                     | false
```

**Verify all have marketplaceVisibleDefault=false:**
```sql
SELECT count(*)
FROM "TraitDefinition"
WHERE "tenantId" IS NULL
  AND species='DOG'
  AND "marketplaceVisibleDefault" = true;
```
**Expected:** 0 (none should have true)

## Backfill: DocumentScope.ANIMAL Migration

### Context
The DocumentScope enum was extended to include "animal" value. Previously, animal documents were incorrectly created with scope="offspring". This backfill corrects existing data.

### Verification Query (Before Backfill)
Run this query to see how many documents need correction:

```sql
SELECT count(*) 
FROM "Document"
WHERE "animalId" IS NOT NULL 
  AND "scope" = 'offspring' 
  AND "offspringId" IS NULL;
```

**Expected before backfill:** May be > 0 if animal documents were created before the corrective commit.

### Running the Backfill

**Using psql:**
```bash
psql -h localhost -U your_user -d breederhq_dev -f prisma/sql/backfills/20251227_backfill_document_scope_animal.sql
```

**Or run manually:**
```sql
BEGIN;

UPDATE "Document"
SET "scope" = 'animal'
WHERE "animalId" IS NOT NULL
  AND "scope" = 'offspring'
  AND "offspringId" IS NULL;

COMMIT;
```

### Verification Query (After Backfill)
Run the same query again to confirm all documents are corrected:

```sql
SELECT count(*) 
FROM "Document"
WHERE "animalId" IS NOT NULL 
  AND "scope" = 'offspring' 
  AND "offspringId" IS NULL;
```

**Expected after backfill:** 0

### Safety Notes
- The backfill only affects documents with:
  - `animalId IS NOT NULL` (it's an animal document)
  - `scope = 'offspring'` (needs correction)
  - `offspringId IS NULL` (safety: not a genuine offspring document)
- Run this backfill once per environment after deploying the schema change that added DocumentScope.ANIMAL


## Summary

All endpoints:
- ✅ GET /api/v1/animals/:animalId/traits
- ✅ PUT /api/v1/animals/:animalId/traits
- ✅ GET /api/v1/animals/:animalId/documents
- ✅ POST /api/v1/animals/:animalId/documents
- ✅ POST /api/v1/animals/:animalId/traits/:traitKey/documents
- ✅ DELETE /api/v1/animals/:animalId/documents/:documentId

All return stable, predictable JSON structures suitable for UI prototyping.
Documents are metadata-only (no S3 integration in this phase).
Trait definitions are seeded globally (tenantId=null) for all DOG animals.
Document scope for animal uploads is "animal" (not "offspring").
