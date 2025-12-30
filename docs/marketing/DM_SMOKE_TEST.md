# Direct Messages API - Smoke Test

This document provides curl commands for manually testing the Direct Messages API endpoints.

## Prerequisites

1. API server running (default: `http://localhost:6001`)
2. Valid session cookie (`bhq_s`) - obtain from browser after logging in
3. Valid tenant ID (from your session or X-Tenant-Id header)
4. CSRF token (from `XSRF-TOKEN` cookie, passed in `X-CSRF-Token` header for mutations)

## Authentication

All requests require:
- Cookie: `bhq_s=<session_token>` (base64url encoded JSON with userId, tenantId, exp)
- Header: `X-Tenant-Id: <tenant_id>` (optional if tenantId is in session)
- Header: `X-CSRF-Token: <csrf_token>` (required for POST/PATCH/DELETE)

## Endpoints

### 1. List Threads (GET)

Lists all message threads for the current user's party.

```bash
curl -X GET "http://localhost:6001/api/v1/messages/threads" \
  -H "Cookie: bhq_s=<SESSION_TOKEN>" \
  -H "X-Tenant-Id: <TENANT_ID>"
```

**Expected Response (empty):**
```json
{ "threads": [] }
```

**Expected Response (with threads):**
```json
{
  "threads": [
    {
      "id": 1,
      "tenantId": 5,
      "subject": "Inquiry about puppies",
      "archived": false,
      "participants": [...],
      "messages": [...],
      "unreadCount": 2,
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-15T10:35:00.000Z"
    }
  ]
}
```

### 2. Create Thread (POST)

Creates a new thread with an initial message.

```bash
curl -X POST "http://localhost:6001/api/v1/messages/threads" \
  -H "Content-Type: application/json" \
  -H "Cookie: bhq_s=<SESSION_TOKEN>; XSRF-TOKEN=<CSRF_TOKEN>" \
  -H "X-Tenant-Id: <TENANT_ID>" \
  -H "X-CSRF-Token: <CSRF_TOKEN>" \
  -d '{
    "recipientPartyId": 123,
    "subject": "Question about available puppies",
    "initialMessage": "Hi! I saw your listing and wanted to ask about availability."
  }'
```

**Expected Response:**
```json
{
  "ok": true,
  "thread": {
    "id": 1,
    "tenantId": 5,
    "subject": "Question about available puppies",
    "participants": [
      { "id": 1, "partyId": 100, "party": { "id": 100, "name": "Breeder Name" } },
      { "id": 2, "partyId": 123, "party": { "id": 123, "name": "Client Name" } }
    ],
    "messages": [
      {
        "id": 1,
        "threadId": 1,
        "senderPartyId": 100,
        "senderParty": { "id": 100, "name": "Breeder Name" },
        "body": "Hi! I saw your listing and wanted to ask about availability.",
        "createdAt": "2025-01-15T10:30:00.000Z"
      }
    ]
  }
}
```

### 3. Get Thread Details (GET)

Fetches a single thread with all messages. Also marks the thread as read.

```bash
curl -X GET "http://localhost:6001/api/v1/messages/threads/<THREAD_ID>" \
  -H "Cookie: bhq_s=<SESSION_TOKEN>" \
  -H "X-Tenant-Id: <TENANT_ID>"
```

**Expected Response:**
```json
{
  "thread": {
    "id": 1,
    "tenantId": 5,
    "subject": "Question about available puppies",
    "participants": [...],
    "messages": [
      {
        "id": 1,
        "body": "Hi! I saw your listing...",
        "senderParty": { "id": 100, "name": "Breeder Name" },
        "createdAt": "2025-01-15T10:30:00.000Z"
      },
      {
        "id": 2,
        "body": "Thanks for reaching out!",
        "senderParty": { "id": 123, "name": "Client Name" },
        "createdAt": "2025-01-15T10:35:00.000Z"
      }
    ]
  }
}
```

### 4. Send Message (POST)

Sends a new message in an existing thread.

```bash
curl -X POST "http://localhost:6001/api/v1/messages/threads/<THREAD_ID>/messages" \
  -H "Content-Type: application/json" \
  -H "Cookie: bhq_s=<SESSION_TOKEN>; XSRF-TOKEN=<CSRF_TOKEN>" \
  -H "X-Tenant-Id: <TENANT_ID>" \
  -H "X-CSRF-Token: <CSRF_TOKEN>" \
  -d '{
    "body": "Thanks for your interest! We have 3 puppies available."
  }'
```

**Expected Response:**
```json
{
  "ok": true,
  "message": {
    "id": 2,
    "threadId": 1,
    "senderPartyId": 100,
    "senderParty": { "id": 100, "name": "Breeder Name" },
    "body": "Thanks for your interest! We have 3 puppies available.",
    "createdAt": "2025-01-15T10:35:00.000Z"
  }
}
```

## Error Codes

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `missing_tenant` | X-Tenant-Id header missing and not in session |
| 400 | `missing_required_fields` | Required body fields not provided |
| 400 | `user_has_no_party` | Current user not linked to a party |
| 401 | `unauthorized` | No valid session cookie |
| 403 | `forbidden` | User's party is not a participant in thread |
| 403 | `csrf_failed` | CSRF token mismatch on mutations |
| 404 | `not_found` | Thread does not exist |
| 500 | `internal_error` | Server error (check logs) |

## Full Smoke Test Sequence

```bash
# Set variables
API="http://localhost:6001"
SESSION="<your_session_token>"
TENANT="<your_tenant_id>"
CSRF="<your_csrf_token>"
RECIPIENT="<recipient_party_id>"

# 1. List threads (should be empty or show existing)
curl -s "$API/api/v1/messages/threads" \
  -H "Cookie: bhq_s=$SESSION" \
  -H "X-Tenant-Id: $TENANT" | jq .

# 2. Create a new thread
THREAD_RESPONSE=$(curl -s -X POST "$API/api/v1/messages/threads" \
  -H "Content-Type: application/json" \
  -H "Cookie: bhq_s=$SESSION; XSRF-TOKEN=$CSRF" \
  -H "X-Tenant-Id: $TENANT" \
  -H "X-CSRF-Token: $CSRF" \
  -d "{\"recipientPartyId\": $RECIPIENT, \"subject\": \"Test thread\", \"initialMessage\": \"Hello!\"}")
echo "$THREAD_RESPONSE" | jq .

# 3. Extract thread ID and fetch it
THREAD_ID=$(echo "$THREAD_RESPONSE" | jq -r '.thread.id')
curl -s "$API/api/v1/messages/threads/$THREAD_ID" \
  -H "Cookie: bhq_s=$SESSION" \
  -H "X-Tenant-Id: $TENANT" | jq .

# 4. Send a follow-up message
curl -s -X POST "$API/api/v1/messages/threads/$THREAD_ID/messages" \
  -H "Content-Type: application/json" \
  -H "Cookie: bhq_s=$SESSION; XSRF-TOKEN=$CSRF" \
  -H "X-Tenant-Id: $TENANT" \
  -H "X-CSRF-Token: $CSRF" \
  -d '{"body": "This is a follow-up message."}' | jq .

# 5. Verify the message appears in thread
curl -s "$API/api/v1/messages/threads/$THREAD_ID" \
  -H "Cookie: bhq_s=$SESSION" \
  -H "X-Tenant-Id: $TENANT" | jq '.thread.messages'
```

## Notes

- The `unreadCount` field tracks messages sent by others since `lastReadAt`
- Opening a thread (GET /threads/:id) automatically marks it as read
- Auto-replies may be triggered when a non-tenant party sends a message
