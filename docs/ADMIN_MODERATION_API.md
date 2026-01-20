# Admin Moderation API - Implementation Guide

## Overview
This document provides implementation specifications for the admin moderation queue endpoints. These endpoints allow administrators to review and manage reported service listings.

---

## 1. Get Listing Reports

**Endpoint:** `GET /api/v1/marketplace/admin/listing-reports`

**Purpose:** Retrieve listing reports for admin moderation queue

**Authentication:** Requires admin role

**Query Parameters:**
- `status` (optional): Filter by status (PENDING, REVIEWED, ACTIONED, DISMISSED)
- `limit` (optional): Number of results (default: 25, max: 100)
- `offset` (optional): Pagination offset (default: 0)

**Implementation Details:**

```typescript
async function getListingReports(req, res) {
  const userId = req.session.userId;

  // === ADMIN AUTHORIZATION ===

  const user = await db
    .select('role', 'email')
    .from('users')
    .where('id', userId)
    .first();

  if (user.role !== 'ADMIN') {
    return res.status(403).json({
      error: 'forbidden',
      message: 'Admin access required'
    });
  }

  // === BUILD QUERY ===

  const { status, limit = 25, offset = 0 } = req.query;

  let query = db
    .select(
      'marketplace_listing_reports.*',
      'marketplace_listings.title as listing_title',
      'marketplace_listings.slug as listing_slug',
      'users.email as reporter_email',
      'reviewers.name as reviewed_by'
    )
    .from('marketplace_listing_reports')
    .leftJoin('marketplace_listings', 'marketplace_listing_reports.listing_id', 'marketplace_listings.id')
    .leftJoin('users', 'marketplace_listing_reports.reporter_user_id', 'users.id')
    .leftJoin('users as reviewers', 'marketplace_listing_reports.reviewed_by', 'reviewers.id');

  // Apply status filter
  if (status) {
    query = query.where('marketplace_listing_reports.status', status);
  }

  // Get total count
  const countQuery = query.clone();
  const [{ count: total }] = await countQuery.count('* as count');

  // Get paginated results
  const reports = await query
    .orderBy('marketplace_listing_reports.created_at', 'desc')
    .limit(Math.min(parseInt(limit), 100))
    .offset(parseInt(offset));

  // === MASK REPORTER EMAIL FOR PRIVACY ===

  const maskedReports = reports.map(report => ({
    id: report.id,
    listingId: report.listing_id,
    listingTitle: report.listing_title,
    listingSlug: report.listing_slug,
    reason: report.reason,
    description: report.description,
    status: report.status,
    reporterEmail: maskEmail(report.reporter_email),
    createdAt: report.created_at,
    reviewedAt: report.reviewed_at,
    reviewedBy: report.reviewed_by,
    reviewNotes: report.review_notes
  }));

  return res.json({
    reports: maskedReports,
    total: parseInt(total),
    limit: parseInt(limit),
    offset: parseInt(offset)
  });
}

function maskEmail(email: string): string {
  if (!email) return '***@***';
  const [user, domain] = email.split('@');
  return `${user[0]}***@${domain}`;
}
```

**Response 200:**
```json
{
  "reports": [
    {
      "id": 123,
      "listingId": 42,
      "listingTitle": "Equine Massage Therapy",
      "listingSlug": "equine-massage-therapy-austin-tx",
      "reason": "FRAUD",
      "description": "This listing is promoting a scam...",
      "status": "PENDING",
      "reporterEmail": "u***@example.com",
      "createdAt": "2026-01-16T10:00:00.000Z",
      "reviewedAt": null,
      "reviewedBy": null,
      "reviewNotes": null
    }
  ],
  "total": 15,
  "limit": 25,
  "offset": 0
}
```

**Response 403 (Not Admin):**
```json
{
  "error": "forbidden",
  "message": "Admin access required"
}
```

---

## 2. Update Report Status

**Endpoint:** `PUT /api/v1/marketplace/admin/listing-reports/:reportId`

**Purpose:** Update report status and add review notes

**Authentication:** Requires admin role

**Request Body:**
```json
{
  "status": "ACTIONED",
  "reviewNotes": "Listing removed for violating terms. Provider warned."
}
```

**Implementation Details:**

```typescript
async function updateReportStatus(req, res) {
  const userId = req.session.userId;
  const { reportId } = req.params;
  const { status, reviewNotes } = req.body;

  // === ADMIN AUTHORIZATION ===

  const user = await db
    .select('role', 'name')
    .from('users')
    .where('id', userId)
    .first();

  if (user.role !== 'ADMIN') {
    return res.status(403).json({
      error: 'forbidden',
      message: 'Admin access required'
    });
  }

  // === VALIDATION ===

  const validStatuses = ['PENDING', 'REVIEWED', 'ACTIONED', 'DISMISSED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      error: 'invalid_status',
      message: 'Invalid report status'
    });
  }

  if (!reviewNotes || reviewNotes.trim().length === 0) {
    return res.status(400).json({
      error: 'review_notes_required',
      message: 'Review notes are required'
    });
  }

  if (reviewNotes.length > 2000) {
    return res.status(400).json({
      error: 'review_notes_too_long',
      message: 'Review notes must be 2000 characters or less'
    });
  }

  // === CHECK REPORT EXISTS ===

  const report = await db
    .select('*')
    .from('marketplace_listing_reports')
    .where('id', reportId)
    .first();

  if (!report) {
    return res.status(404).json({
      error: 'report_not_found',
      message: 'Report not found'
    });
  }

  // === UPDATE REPORT ===

  await db
    .update({
      status,
      review_notes: reviewNotes.trim(),
      reviewed_by: userId,
      reviewed_at: new Date()
    })
    .from('marketplace_listing_reports')
    .where('id', reportId);

  // === LOG ADMIN ACTION ===

  await db.insert({
    admin_user_id: userId,
    action: 'UPDATE_REPORT_STATUS',
    entity_type: 'marketplace_listing_report',
    entity_id: reportId,
    details: JSON.stringify({
      old_status: report.status,
      new_status: status,
      review_notes: reviewNotes.trim()
    }),
    created_at: new Date()
  }).into('admin_action_logs');

  return res.json({ ok: true });
}
```

**Response 200:**
```json
{
  "ok": true
}
```

**Response 400 (Validation Error):**
```json
{
  "error": "review_notes_required",
  "message": "Review notes are required"
}
```

**Response 403 (Not Admin):**
```json
{
  "error": "forbidden",
  "message": "Admin access required"
}
```

**Response 404:**
```json
{
  "error": "report_not_found",
  "message": "Report not found"
}
```

---

## 3. Admin Action Logging

Create audit trail for all admin moderation actions:

```sql
CREATE TABLE admin_action_logs (
  id SERIAL PRIMARY KEY,
  admin_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id INTEGER,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_admin_logs_user ON admin_action_logs(admin_user_id);
CREATE INDEX idx_admin_logs_action ON admin_action_logs(action);
CREATE INDEX idx_admin_logs_created ON admin_action_logs(created_at DESC);
```

**Logged Actions:**
- `UPDATE_REPORT_STATUS` - Report status changed
- `DELETE_LISTING` - Listing removed
- `WARN_PROVIDER` - Provider warned
- `SUSPEND_PROVIDER` - Provider account suspended

---

## 4. Frontend Integration

The frontend ModerationQueuePage uses these endpoints:

**Load Reports:**
```typescript
const data = await getListingReports(statusFilter, limit, offset);
setReports(data.reports);
setTotal(data.total);
```

**Update Status:**
```typescript
await updateReportStatus(reportId, newStatus, reviewNotes);
await loadReports(); // Refresh list
```

---

## 5. Testing Checklist

- [ ] GET reports requires admin role
- [ ] GET reports returns 403 for non-admin
- [ ] Status filter works correctly
- [ ] Pagination works (limit/offset)
- [ ] Reporter email is masked
- [ ] UPDATE report requires admin role
- [ ] UPDATE validates status enum
- [ ] UPDATE requires review notes
- [ ] UPDATE returns 404 for invalid report ID
- [ ] Admin actions are logged to audit table

---

## 6. Security Considerations

1. **Role-Based Access Control**: Only users with `role = 'ADMIN'` can access these endpoints
2. **Email Masking**: Reporter emails are masked for privacy (e.g., `u***@example.com`)
3. **Audit Logging**: All actions logged with admin user ID, timestamp, and details
4. **Input Validation**: Status enum validated, review notes length checked
5. **CSRF Protection**: All mutating requests require CSRF token

---

## 7. API Endpoint Summary

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| GET | /api/v1/marketplace/admin/listing-reports | List reports | Admin |
| PUT | /api/v1/marketplace/admin/listing-reports/:id | Update status | Admin |

---

## 8. Future Enhancements

- [ ] Bulk actions (review multiple reports at once)
- [ ] Email notifications to reporters when report reviewed
- [ ] Admin dashboard with report metrics
- [ ] Automated moderation rules (ML-based fraud detection)
- [ ] Provider suspension workflow
- [ ] Appeal system for dismissed reports
