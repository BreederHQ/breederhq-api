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

---

## EXECUTED VALIDATION (DEV Environment)

### Validation Date
2025-12-28

### Environment Status

**DEV Database**: Connected successfully
- Host: ep-empty-scene-ae29f2je.c-2.us-east-2.aws.neon.tech
- Database: bhq_dev

**DEV API Server**: Not operational
- Pre-existing import error in email-service.ts prevents server startup
- Error: `The requested module './comm-prefs-service.js' does not provide an export named 'canContactViaChannel'`
- Note: This import error exists in the codebase and is unrelated to the Template/AutoReply schema changes
- Runtime API validation deferred until import error is resolved

---

### 1. SCHEMA VALIDATION (EXECUTED)

#### 1.1 TemplateCategory Enum Values

**Command**:
```bash
psql -h ep-empty-scene-ae29f2je.c-2.us-east-2.aws.neon.tech -U bhq_app -d bhq_dev \
  -c "SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'TemplateCategory') ORDER BY enumsortorder;"
```

**Result**:
```
     enumlabel      
--------------------
 auto_reply
 invoice_message
 birth_announcement
 waitlist_update
 general_follow_up
 custom
(6 rows)
```

**Status**: ✅ PASS - TemplateCategory enum contains purpose-based values as designed

---

#### 1.2 EmailSendCategory Enum Values

**Command**:
```bash
psql -h ep-empty-scene-ae29f2je.c-2.us-east-2.aws.neon.tech -U bhq_app -d bhq_dev \
  -c "SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'EmailSendCategory') ORDER BY enumsortorder;"
```

**Result**:
```
   enumlabel   
---------------
 transactional
 marketing
(2 rows)
```

**Status**: ✅ PASS - EmailSendCategory enum created with correct send classification values

---

#### 1.3 EmailSendLog.category Column Type

**Command**:
```bash
psql -h ep-empty-scene-ae29f2je.c-2.us-east-2.aws.neon.tech -U bhq_app -d bhq_dev \
  -c "SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name = 'EmailSendLog' AND column_name = 'category';"
```

**Result**:
```
 column_name |  data_type   |     udt_name      
-------------+--------------+-------------------
 category    | USER-DEFINED | EmailSendCategory
(1 row)
```

**Status**: ✅ PASS - EmailSendLog.category correctly uses EmailSendCategory enum

---

#### 1.4 Template.category Column Type

**Command**:
```bash
psql -h ep-empty-scene-ae29f2je.c-2.us-east-2.aws.neon.tech -U bhq_app -d bhq_dev \
  -c "SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name = 'Template' AND column_name = 'category';"
```

**Result**:
```
 column_name |  data_type   |     udt_name     
-------------+--------------+------------------
 category    | USER-DEFINED | TemplateCategory
(1 row)
```

**Status**: ✅ PASS - Template.category correctly uses TemplateCategory enum

---

### 2. DATABASE STATE VERIFICATION (EXECUTED)

#### 2.1 Template Records

**Command**:
```bash
psql -h ep-empty-scene-ae29f2je.c-2.us-east-2.aws.neon.tech -U bhq_app -d bhq_dev \
  -c "SELECT COUNT(*) as template_count FROM \"Template\";"
```

**Result**:
```
 template_count 
----------------
              0
(1 row)
```

**Note**: No existing templates in DEV - clean slate for future validation

---

#### 2.2 EmailSendLog Records

**Command**:
```bash
psql -h ep-empty-scene-ae29f2je.c-2.us-east-2.aws.neon.tech -U bhq_app -d bhq_dev \
  -c "SELECT COUNT(*) as email_log_count FROM \"EmailSendLog\";"
```

**Result**:
```
 email_log_count 
-----------------
               0
(1 row)
```

**Note**: No existing email logs in DEV - clean slate for future validation

---

### 3. RUNTIME API VALIDATION (DEFERRED)

The following validation scenarios are documented and ready for execution once the API server import error is resolved:

#### 3.1 Template Save-Time Validation
- **Test A**: POST template with invalid variable `{{unknown.field}}` → Expect HTTP 400 with validation error
- **Test B**: POST template with valid variable `{{tenant.name}}` → Expect HTTP 200 with created template

#### 3.2 DM Auto-Reply Success Path
- Create active template with category `auto_reply`
- Create AutoReplyRule with trigger `dm_first_message_from_party`
- Send inbound DM from non-tenant party
- Verify automated message created with `isAutomated: true`
- Verify AutoReplyLog record with `status: 'sent'`

#### 3.3 DM Auto-Reply Failure Path
- Create AutoReplyRule with invalid templateId
- Send inbound DM
- Verify inbound message succeeds
- Verify AutoReplyLog record with `status: 'failed'` and reason populated

#### 3.4 Invoice Email Category Storage
- Issue invoice (PATCH status = issued)
- Verify EmailSendLog record with `category: 'transactional'`
- Verify invoice email idempotency (duplicate issue attempts rejected)

#### 3.5 Marketing Email Category Storage
- POST /api/v1/marketing/email/send with `category: 'marketing'`
- Verify EmailSendLog record with `category: 'marketing'`

---

### 4. VALIDATION SUMMARY

| Validation Type | Status | Evidence |
|----------------|--------|----------|
| TemplateCategory enum values | ✅ PASS | DB query confirms purpose-based values |
| EmailSendCategory enum creation | ✅ PASS | DB query confirms transactional/marketing values |
| EmailSendLog.category type | ✅ PASS | DB schema shows EmailSendCategory type |
| Template.category type | ✅ PASS | DB schema shows TemplateCategory type |
| Database state | ✅ CLEAN | No existing records, ready for validation |
| Runtime API validation | ⏸️ DEFERRED | Blocked by pre-existing import error |

**Conclusion**: Schema changes successfully applied to DEV database. Category split (TemplateCategory vs EmailSendCategory) is correctly implemented at the database level. Runtime API validation scenarios are documented and ready for execution once `canContactViaChannel` import is resolved in email-service.ts.

---

### 5. NEXT STEPS FOR RUNTIME VALIDATION

To complete runtime validation:

1. Resolve import error in src/services/email-service.ts
   - Either implement `canContactViaChannel` in comm-prefs-service.ts
   - Or remove/stub the comm preference check temporarily for validation

2. Start DEV server:
   ```bash
   npm run dev
   ```

3. Execute validation scenarios documented in Section 3

4. Update this document with actual curl commands and responses

5. Record psql query results for AutoReplyLog and EmailSendLog tables
