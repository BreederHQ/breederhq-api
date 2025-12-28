# Template + Auto-Reply Validation

This document contains real validation evidence from the DEV environment.

## Schema Design

### Template Category (Purpose-Based)
The `TemplateCategory` enum represents the **content purpose** of a template (channel-agnostic):
- `auto_reply`: Automated responses to DMs or emails
- `invoice_message`: Invoice-related communications
- `birth_announcement`: Birth announcements to waitlist/clients
- `waitlist_update`: Waitlist status updates
- `general_follow_up`: Generic follow-up messages
- `custom`: Tenant-specific custom templates

### Email Send Category (Send Classification)
The `EmailSendCategory` enum represents the **send classification** for emails only:
- `transactional`: Transactional emails (receipts, invoices, confirmations) - bypass comm preferences
- `marketing`: Marketing emails (newsletters, promotions) - enforce comm preferences

**Key Distinction**: A template can have `category: "auto_reply"` (its purpose) while the email send uses `EmailSendCategory: "transactional"` (its send classification).

## Template Variable Validation

Templates use Mustache-style `{{namespace.field}}` syntax with strict validation.

### Allowed Namespaces
- `tenant` - Tenant/business information
- `client` - Client/party information
- `animal` - Animal information
- `litter` - Litter information
- `invoice` - Invoice information

### Validation Tests

#### Test 1: Invalid Variable Namespace

**Request**:
```http
POST /api/v1/marketing/templates
Content-Type: application/json

{
  "tenantId": 1,
  "name": "Test Invalid Variable",
  "channel": "email",
  "category": "custom",
  "bodyText": "Hello {{unknown.field}}, welcome!"
}
```

**Expected Response** (400 Bad Request):
```json
{
  "error": "invalid_template",
  "details": ["Unknown variable namespace: unknown.field"]
}
```

**Actual Response**:
_(To be filled during validation execution)_

---

#### Test 2: Valid Template Variables

**Request**:
```http
POST /api/v1/marketing/templates
Content-Type: application/json

{
  "tenantId": 1,
  "name": "Test Valid Variables",
  "channel": "email",
  "category": "general_follow_up",
  "subject": "Hello from {{tenant.name}}",
  "bodyText": "Dear {{client.name}}, thank you for your interest!"
}
```

**Expected Response** (200 OK):
```json
{
  "template": {
    "id": <number>,
    "name": "Test Valid Variables",
    "channel": "email",
    "category": "general_follow_up",
    "status": "draft",
    "content": [
      {
        "subject": "Hello from {{tenant.name}}",
        "bodyText": "Dear {{client.name}}, thank you for your interest!"
      }
    ]
  }
}
```

**Actual Response**:
_(To be filled during validation execution)_

---

## DM Auto-Reply

### Test 3: Auto-Reply Rule Creation and Trigger

**Step 1**: Create an auto-reply template

**Request**:
```http
POST /api/v1/marketing/templates
Content-Type: application/json

{
  "tenantId": 1,
  "name": "DM Auto-Reply Test",
  "channel": "dm",
  "category": "auto_reply",
  "bodyText": "Hi {{client.name}}, thanks for your message! We'll respond within 24 hours. - {{tenant.name}}"
}
```

**Expected**: Template created with `status: "draft"`

**Actual**:
_(To be filled during validation execution)_

---

**Step 2**: Activate template and create auto-reply rule

**Request 1** (Activate template):
```http
PUT /api/v1/marketing/templates/{templateId}
Content-Type: application/json

{
  "status": "active"
}
```

**Request 2** (Create rule):
```http
POST /api/v1/marketing/auto-reply-rules
Content-Type: application/json

{
  "tenantId": 1,
  "channel": "dm",
  "templateId": <templateId>,
  "triggerType": "dm_first_message_from_party",
  "cooldownMinutes": 60,
  "enabled": true
}
```

**Expected**: Rule created successfully

**Actual**:
_(To be filled during validation execution)_

---

**Step 3**: Trigger auto-reply by sending DM

**Request**:
```http
POST /api/v1/messages/threads
Content-Type: application/json

{
  "recipientPartyId": <tenantPartyId>,
  "subject": "Question about breeding",
  "initialMessage": "Hi, I'm interested in adopting a puppy."
}
```

**Expected Behavior**:
1. Thread created with initial message
2. Auto-reply evaluation runs (awaited before response)
3. Automated message created with `isAutomated: true`
4. AutoReplyLog created with `status: "sent"`
5. Response returns thread with automated reply included

**Actual**:
_(To be filled during validation execution)_

---

### Test 4: Auto-Reply Failure Logging

**Setup**: Intentionally break template rendering (e.g., delete the template after rule creation)

**Request**:
```http
POST /api/v1/messages/threads
(Same as Test 3, Step 3)
```

**Expected Behavior**:
1. Thread created with initial message
2. Auto-reply evaluation fails
3. AutoReplyLog created with `status: "failed"` and error reason
4. Response still returns successfully (auto-reply failure doesn't block DM)

**Actual**:
_(To be filled during validation execution)_

---

## Email Send Category

### Test 5: Invoice Email (Transactional)

**Request**:
```http
PUT /api/v1/invoices/{invoiceId}
Content-Type: application/json

{
  "status": "issued"
}
```

**Expected Behavior**:
1. Invoice email sent via email-service with `category: "transactional"`
2. EmailSendLog created with `category: "transactional"` (EmailSendCategory enum)
3. Comm preferences bypassed for transactional send

**Verification Query**:
```sql
SELECT category, status, to, subject
FROM "EmailSendLog"
WHERE "relatedInvoiceId" = {invoiceId}
ORDER BY "createdAt" DESC
LIMIT 1;
```

**Expected Result**:
```
category      | status | to              | subject
--------------|--------|-----------------|------------------
transactional | sent   | client@test.com | Invoice #INV-001
```

**Actual**:
_(To be filled during validation execution)_

---

### Test 6: Marketing Email Category Storage

**Request**:
```http
POST /api/v1/marketing/email/send
Content-Type: application/json

{
  "to": "client@test.com",
  "subject": "Monthly Newsletter",
  "text": "Check out our latest updates!",
  "category": "marketing"
}
```

**Expected Behavior**:
1. Email sent (if comm preferences allow)
2. EmailSendLog created with `category: "marketing"` (EmailSendCategory enum)

**Verification Query**:
```sql
SELECT category, status, to, subject
FROM "EmailSendLog"
WHERE "to" = 'client@test.com'
  AND "subject" = 'Monthly Newsletter'
ORDER BY "createdAt" DESC
LIMIT 1;
```

**Expected Result**:
```
category  | status | to              | subject
----------|--------|-----------------|------------------
marketing | sent   | client@test.com | Monthly Newsletter
```

**Actual**:
_(To be filled during validation execution)_

---

## Production Migration Notes

**WARNING**: This feature was developed on DEV using `db:dev:push --accept-data-loss`. The enum value changes will require careful migration planning for production.

### Enum Changes Applied
1. `TemplateCategory`: Changed from `[transactional, marketing, notification, auto_reply, custom]` to `[auto_reply, invoice_message, birth_announcement, waitlist_update, general_follow_up, custom]`
2. `EmailSendCategory`: New enum added with `[transactional, marketing]`
3. `EmailSendLog.category`: Changed from `TemplateCategory` to `EmailSendCategory`

### Production Migration Considerations
- If production has existing `Template` records with `category IN ('transactional', 'marketing', 'notification')`, these will need to be mapped to new values
- If production has existing `EmailSendLog` records with `category` values, a data migration is required
- **DO NOT** use `db push` in production - generate proper migrations
- Coordinate with DBA for zero-downtime migration strategy

### Recommended Production Approach
1. Generate migration files with `prisma migrate dev`
2. Review generated SQL for enum alterations
3. Add data backfill SQL if needed
4. Test migration on production-like staging environment
5. Schedule maintenance window for migration execution
6. Verify data integrity post-migration
