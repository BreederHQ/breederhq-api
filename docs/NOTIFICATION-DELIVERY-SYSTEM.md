# Notification Delivery System

This guide covers the BreederHQ notification system, including how notifications are generated, delivered, and how animal owners receive notifications.

## Overview

BreederHQ's notification system is a hybrid approach that:

1. **Scans for events** - Daily cron jobs detect upcoming breeding/health events
2. **Creates notifications** - Stores notifications in the database
3. **Delivers via email** - Sends email notifications to relevant recipients

## Architecture

```
┌──────────────────────┐
│  notification-scanner │  ← Cron job: Scans for events
└──────────┬───────────┘
           │ Creates notifications
           ▼
┌──────────────────────┐
│     Notification     │  ← Stored in database
│       (table)        │
└──────────┬───────────┘
           │ Triggers delivery
           ▼
┌──────────────────────┐
│ notification-delivery │  ← Sends emails
└──────────┬───────────┘
           │
     ┌─────┴─────┐
     ▼           ▼
┌─────────┐ ┌──────────────┐
│ Tenant  │ │Animal Owners │
│ Members │ │(external)    │
└─────────┘ └──────────────┘
```

## Notification Types

The scanner generates notifications for:

| Type | Description | Priority |
|------|-------------|----------|
| `vaccination_expiring` | Vaccination due within 30 days | MEDIUM |
| `vaccination_overdue` | Vaccination past due date | HIGH |
| `breeding_heat_cycle_expected` | Mare expected to enter heat | MEDIUM |
| `pregnancy_check_due` | Time for pregnancy check | HIGH |
| `foaling_approaching` | Mare due to foal soon | URGENT |
| `foaling_imminent` | Mare due within 7 days | URGENT |

## Recipients

Notifications are delivered to two groups:

### 1. Tenant Members

All active members of the tenant (`TenantMembership.membershipStatus = 'ACTIVE'`) receive notifications by default.

Controlled by `UserNotificationPreferences`:
- `emailEnabled` - Master toggle for email notifications
- `vaccinationExpiring` - Vaccination expiring alerts
- `vaccinationOverdue` - Overdue vaccination alerts
- `breedingTimeline` - Breeding schedule alerts
- `pregnancyCheck` - Pregnancy check reminders
- `foalingApproaching` - Foaling alerts
- `heatCycleExpected` - Heat cycle predictions

### 2. Animal Owners (External)

External owners (Contacts/Organizations linked via `AnimalOwner`) can receive notifications about their animals.

**Requirements for an owner to receive notifications:**

1. `AnimalOwner.receiveNotifications = true` - Owner opted into notifications
2. `Party.email` exists - Owner has an email address on file
3. `PartyCommPreference` allows EMAIL - Not blocked via communication preferences
4. Animal ID is in notification metadata - The notification references their animal

## How Owner Notifications Work

When a notification is created (e.g., for a breeding plan), the metadata includes relevant animal IDs:

```json
{
  "damId": 123,
  "sireId": 456,
  "animalId": 123,
  "breedingPlanId": 789
}
```

The `deliverToAnimalOwners()` function:

1. Extracts `damId`, `sireId`, `animalId` from metadata
2. Queries `AnimalOwner` for owners with `receiveNotifications = true`
3. Checks `PartyCommPreference` to ensure email isn't blocked
4. Sends notification email to each eligible owner
5. Deduplicates (same owner of dam and sire only gets one email)

## Configuration

### AnimalOwner Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `receiveNotifications` | Boolean | `true` | Owner receives notifications about this animal |
| `isPrimaryContact` | Boolean | `false` | Primary contact for animal-related matters |

### PartyCommPreference

External parties can block communication channels:

```typescript
// Check if a party can receive email
const canEmail = await canContactViaChannel(partyId, "EMAIL");
```

Channels: `EMAIL`, `SMS`, `PHONE`

## Email Template

Owner notification emails include:

- Priority badge (color-coded: URGENT/HIGH/MEDIUM/LOW)
- Notification title and message
- Deep link to relevant page (e.g., breeding plan)
- Tenant name (so owners know which breeding program sent it)
- Link to manage notification preferences

## Breeder Visibility (Owner Delivery Tracking)

When notifications are sent to animal owners, the delivery info is stored in the notification's metadata so breeders can see who was notified.

### Metadata Structure

After delivery, the notification metadata includes:

```json
{
  "animalId": 123,
  "damId": 456,
  "ownerDelivery": {
    "sentAt": "2026-01-27T10:30:00.000Z",
    "recipientCount": 2,
    "recipients": [
      { "name": "John Smith" },
      { "name": "ABC Breeding LLC" }
    ]
  }
}
```

### Frontend Display

The notification bell/panel should check for `ownerDelivery` in metadata:

```typescript
// In notification display component
const notification = /* from API */;
const metadata = notification.metadata as Record<string, unknown>;
const ownerDelivery = metadata?.ownerDelivery as {
  recipientCount: number;
  recipients: { name: string | null }[];
} | undefined;

if (ownerDelivery && ownerDelivery.recipientCount > 0) {
  // Show "Also sent to 2 co-owners" or list names
  const names = ownerDelivery.recipients
    .map(r => r.name)
    .filter(Boolean)
    .join(", ");

  return (
    <div className="text-xs text-secondary mt-1">
      Also sent to: {names || `${ownerDelivery.recipientCount} co-owner(s)`}
    </div>
  );
}
```

### Example UI

```
┌─────────────────────────────────────────────────┐
│ 🚨 URGENT                                       │
│ Foaling Imminent - Starlight                    │
│ Mare is due within 7 days                       │
│                                                 │
│ Also sent to: John Smith, ABC Breeding LLC      │
│                                        2h ago   │
└─────────────────────────────────────────────────┘
```

## Code Reference

### Key Files

| File | Purpose |
|------|---------|
| `src/services/notification-scanner.ts` | Scans for events, creates notifications |
| `src/services/notification-delivery.ts` | Delivers notifications via email |
| `src/services/comm-prefs-service.ts` | Communication preference checks |
| `src/services/email-service.ts` | Core email sending |

### Key Functions

```typescript
// Deliver a single notification to all recipients
await deliverNotification(notificationId);

// Deliver to animal owners specifically
await deliverToAnimalOwners(notification);

// Check if party can receive email
const allowed = await canContactViaChannel(partyId, "EMAIL");

// Send notification email
await sendNotificationEmail(notification, email, tenantName);
```

## Default Behavior

When a new animal is created:

```typescript
await prisma.animalOwner.create({
  data: {
    animalId: animal.id,
    partyId: defaultOwner.partyId,
    percent: 100,
    isPrimary: true,
    role: "SOLE_OWNER",
    effectiveDate: new Date(),
    isPrimaryContact: true,
    receiveNotifications: true,  // Default: opted in
  },
});
```

New owners are opted into notifications by default. They can opt out via:
1. `AnimalOwner.receiveNotifications = false` (per-animal)
2. `PartyCommPreference` blocking EMAIL (all communications)

## Testing

### Send Test Notification

```typescript
import { deliverNotification } from "./services/notification-delivery.js";

// Create a test notification
const notification = await prisma.notification.create({
  data: {
    tenantId: 1,
    type: "vaccination_expiring",
    title: "Test Vaccination Alert",
    message: "This is a test notification",
    priority: "MEDIUM",
    status: "UNREAD",
    metadata: { animalId: 123 }, // Links to animal owner
  },
});

// Deliver it
const result = await deliverNotification(notification.id);
console.log(result); // { sent: 2, failed: 0 }
```

### Verify Owner Delivery

Check logs for owner delivery:

```
[notification-delivery] Sent to animal owner: owner@example.com (party 45)
[notification-delivery] Animal owner delivery for notification 123: 2 sent, 0 failed, 1 skipped
```

### Check PartyCommPreference

```sql
SELECT p.name, p.email, pcp.channel, pcp.status
FROM "Party" p
LEFT JOIN "PartyCommPreference" pcp ON p.id = pcp."partyId"
WHERE p.id IN (
  SELECT "partyId" FROM "AnimalOwner" WHERE "receiveNotifications" = true
);
```

## Troubleshooting

### Owner Not Receiving Notifications

1. **Check `receiveNotifications`**:
   ```sql
   SELECT * FROM "AnimalOwner"
   WHERE "partyId" = <party_id> AND "receiveNotifications" = true;
   ```

2. **Check Party has email**:
   ```sql
   SELECT id, name, email FROM "Party" WHERE id = <party_id>;
   ```

3. **Check PartyCommPreference**:
   ```sql
   SELECT * FROM "PartyCommPreference"
   WHERE "partyId" = <party_id> AND channel = 'EMAIL';
   ```
   If status is `UNSUBSCRIBED`, emails are blocked.

4. **Check notification metadata**:
   ```sql
   SELECT metadata FROM "Notification" WHERE id = <notification_id>;
   ```
   Ensure `animalId`, `damId`, or `sireId` matches owner's animal.

### Duplicate Emails

The system deduplicates by email address. If an owner owns both the dam and sire in a breeding plan, they receive only one email per notification.

## Related Documentation

- [EMAIL-SETUP.md](./EMAIL-SETUP.md) - Email configuration and dev safeguards
- [SUBSCRIPTION-SYSTEM.md](./SUBSCRIPTION-SYSTEM.md) - Quota and subscription info

---

**Last Updated**: 2026-01-27
