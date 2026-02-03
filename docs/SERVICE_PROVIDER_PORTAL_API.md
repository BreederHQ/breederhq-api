# Service Provider Portal API Documentation

**Status**: ✅ Complete
**Last Updated**: 2026-02-02
**Base Path**: `/api/v1/marketplace/providers`

---

## Overview

Complete API for the Service Provider Portal, enabling providers to:
- Manage transactions and bookings
- Communicate with clients via messaging
- Set up Stripe Connect for platform payments
- Track financial metrics and payouts

All endpoints require marketplace authentication unless noted otherwise.

---

## Authentication

All provider endpoints require:
1. Valid marketplace session cookie
2. User must be registered as a marketplace provider

Middleware: `requireProvider` - Validates provider status and attaches `req.marketplaceProvider`

---

## Endpoints

### Provider Profile

#### GET /me
Get current provider's profile.

**Response:**
```json
{
  "id": 1,
  "userId": 123,
  "providerType": "trainer",
  "businessName": "Acme Training",
  "businessDescription": "Professional dog training",
  "logoUrl": "https://cdn.example.com/logo.jpg",
  "publicEmail": "contact@acme.com",
  "publicPhone": "555-1234",
  "website": "https://acme.com",
  "city": "Austin",
  "state": "TX",
  "country": "US",
  "paymentMode": "stripe",
  "stripeConnectOnboardingComplete": true,
  "stripeConnectPayoutsEnabled": true,
  "averageRating": "4.5",
  "totalReviews": 12,
  "totalTransactions": 45,
  "completedTransactions": 40,
  "status": "active"
}
```

#### PATCH /me
Update provider profile.

**Body:**
```json
{
  "businessName": "New Name",
  "businessDescription": "Updated description",
  "publicEmail": "new@email.com",
  "city": "Dallas",
  "state": "TX"
}
```

---

### Transactions

#### GET /transactions
List provider's transactions with pagination and filtering.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status (pending, invoiced, paid, started, completed, cancelled, refunded) |
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20) |

**Response:**
```json
{
  "transactions": [
    {
      "id": 1,
      "clientId": 456,
      "listingId": 789,
      "serviceDescription": "Basic Training Package",
      "servicePriceCents": 15000,
      "platformFeeCents": 1500,
      "totalCents": 16500,
      "providerPayoutCents": 15000,
      "status": "paid",
      "createdAt": "2026-02-01T10:00:00Z",
      "paidAt": "2026-02-01T12:00:00Z",
      "client": {
        "id": 456,
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com"
      },
      "listing": {
        "id": 789,
        "title": "Basic Training",
        "slug": "basic-training"
      }
    }
  ],
  "total": 45,
  "page": 1,
  "limit": 20
}
```

---

### Messaging

#### GET /messages/threads
List all message threads for the provider.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by thread status |
| `type` | string | Filter by type: `inquiry` or `transaction` |
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20) |

**Response:**
```json
{
  "threads": [
    {
      "id": 1,
      "clientId": 456,
      "providerId": 1,
      "listingId": 789,
      "transactionId": null,
      "subject": "Question about services",
      "status": "open",
      "lastMessageAt": "2026-02-01T15:30:00Z",
      "unreadCount": 2,
      "threadType": "inquiry",
      "lastMessage": {
        "id": 10,
        "messageText": "Hi, I have a question...",
        "senderType": "client",
        "createdAt": "2026-02-01T15:30:00Z"
      },
      "client": {
        "id": 456,
        "firstName": "John",
        "lastName": "Doe"
      },
      "listing": {
        "id": 789,
        "title": "Basic Training"
      }
    }
  ],
  "total": 15,
  "page": 1,
  "limit": 20
}
```

#### GET /messages/threads/:id
Get thread with all messages.

**Response:**
```json
{
  "thread": {
    "id": 1,
    "clientId": 456,
    "subject": "Question about services",
    "status": "open",
    "threadType": "inquiry",
    "client": { "id": 456, "firstName": "John", "lastName": "Doe" },
    "listing": { "id": 789, "title": "Basic Training" }
  },
  "messages": [
    {
      "id": 1,
      "threadId": 1,
      "senderId": 456,
      "senderType": "client",
      "messageText": "Hi, I have a question about your training services.",
      "createdAt": "2026-02-01T10:00:00Z",
      "readAt": "2026-02-01T10:05:00Z"
    },
    {
      "id": 2,
      "threadId": 1,
      "senderId": 1,
      "senderType": "provider",
      "messageText": "Hi! Happy to help. What would you like to know?",
      "createdAt": "2026-02-01T10:10:00Z",
      "readAt": null
    }
  ]
}
```

#### POST /messages/threads/:id/messages
Send a message as the provider.

**Body:**
```json
{
  "messageText": "Thank you for reaching out!"
}
```

**Response:**
```json
{
  "message": {
    "id": 3,
    "threadId": 1,
    "senderId": 1,
    "senderType": "provider",
    "messageText": "Thank you for reaching out!",
    "createdAt": "2026-02-01T10:15:00Z",
    "readAt": null
  }
}
```

#### POST /messages/threads/:id/mark-read
Mark all client messages in thread as read.

**Response:**
```json
{
  "success": true
}
```

---

### Stripe Connect

#### POST /stripe-connect/onboarding
Start Stripe Connect Express onboarding.

**Body:**
```json
{
  "returnUrl": "https://marketplace.example.com/provider/stripe-connect?status=return",
  "refreshUrl": "https://marketplace.example.com/provider/stripe-connect?status=refresh"
}
```

**Response:**
```json
{
  "accountLinkUrl": "https://connect.stripe.com/setup/...",
  "accountId": "acct_1234567890"
}
```

#### GET /stripe-connect/status
Get Stripe Connect account status.

**Response (not connected):**
```json
{
  "connected": false,
  "accountId": null,
  "payoutsEnabled": false,
  "detailsSubmitted": false,
  "chargesEnabled": false
}
```

**Response (connected):**
```json
{
  "connected": true,
  "accountId": "acct_1234567890",
  "payoutsEnabled": true,
  "detailsSubmitted": true,
  "chargesEnabled": true
}
```

#### POST /stripe-connect/dashboard-link
Get link to Stripe Express Dashboard.

**Response:**
```json
{
  "dashboardUrl": "https://connect.stripe.com/express/..."
}
```

#### POST /stripe-connect/refresh
Refresh onboarding link if incomplete.

**Body:**
```json
{
  "returnUrl": "https://marketplace.example.com/provider/stripe-connect?status=return",
  "refreshUrl": "https://marketplace.example.com/provider/stripe-connect?status=refresh"
}
```

**Response:**
```json
{
  "accountLinkUrl": "https://connect.stripe.com/setup/..."
}
```

---

### Financials

#### GET /financials
Get provider's financial summary.

**Response:**
```json
{
  "totalRevenueCents": 450000,
  "pendingPayoutCents": 15000,
  "lifetimePayoutCents": 400000,
  "thisMonthRevenueCents": 75000,
  "lastMonthRevenueCents": 60000,
  "revenueByMonth": [
    { "month": "Sep 2025", "amountCents": 50000 },
    { "month": "Oct 2025", "amountCents": 55000 },
    { "month": "Nov 2025", "amountCents": 60000 },
    { "month": "Dec 2025", "amountCents": 65000 },
    { "month": "Jan 2026", "amountCents": 60000 },
    { "month": "Feb 2026", "amountCents": 75000 }
  ],
  "transactionSummary": {
    "total": 45,
    "completed": 40,
    "cancelled": 2,
    "refunded": 1,
    "pending": 2
  },
  "recentPayouts": [
    {
      "id": "po_123",
      "amountCents": 50000,
      "status": "paid",
      "createdAt": "2026-01-28T00:00:00Z",
      "arrivalDate": "2026-01-30T00:00:00Z"
    },
    {
      "id": "po_124",
      "amountCents": 15000,
      "status": "pending",
      "createdAt": "2026-02-01T00:00:00Z",
      "arrivalDate": null
    }
  ]
}
```

---

## Webhook Handlers

### Stripe Connect Account Updates

**Endpoint**: `POST /api/webhooks/stripe` (existing billing webhooks)
**Event**: `account.updated`

Handles Stripe Connect account status changes:
- Updates `stripeConnectPayoutsEnabled`
- Updates `stripeConnectDetailsSubmitted`
- Updates `stripeConnectOnboardingComplete`
- Auto-switches `paymentMode` to "stripe" when payouts enabled

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "error_code",
  "message": "Human-readable error message"
}
```

**Common Error Codes:**
| Code | HTTP Status | Description |
|------|-------------|-------------|
| `not_authenticated` | 401 | No valid session |
| `not_provider` | 403 | User is not a registered provider |
| `not_found` | 404 | Resource not found |
| `validation_error` | 400 | Invalid request body |
| `stripe_not_connected` | 400 | Stripe Connect not set up |

---

## Related Files

### Backend
- `src/routes/marketplace-providers.ts` - All provider routes
- `src/services/stripe-connect-service.ts` - Stripe Connect logic
- `src/services/marketplace-financials-service.ts` - Financial calculations

### Frontend
- `apps/marketplace/src/provider/features/transactions/` - Transactions tab
- `apps/marketplace/src/provider/features/messages/` - Messaging inbox
- `apps/marketplace/src/provider/features/stripe-connect/` - Stripe onboarding
- `apps/marketplace/src/provider/features/financials/` - Financial dashboard

---

## Environment Variables

```bash
# Required for Stripe Connect
STRIPE_SECRET_KEY=sk_live_xxx

# Webhook signing (for account.updated events)
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

---

**Document Version**: 1.0
**Created**: 2026-02-02
