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
  "scope": "offspring",
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
  "scope": "offspring",
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

### 2. Missing Title for Document
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

### 3. Animal Not Found
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
