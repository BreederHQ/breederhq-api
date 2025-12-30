# Party Migration Step 5: Attachment Party - Test Plan

## Unit Test Specification

### Test: Party ID Resolution on Create

**Description**: When creating an attachment with a contactId, the system should automatically resolve and persist the attachmentPartyId.

**Test Cases**:

1. **Create attachment with valid contactId**
   - Input: Valid contactId that has a partyId
   - Expected: attachmentPartyId is set to Contact.partyId
   - Verify: contactId and attachmentPartyId both persisted

2. **Create attachment with contactId but contact has no partyId**
   - Input: Valid contactId where Contact.partyId is null
   - Expected: attachmentPartyId remains null
   - Verify: contactId persisted, attachmentPartyId is null

3. **Create attachment without contactId**
   - Input: No contactId provided
   - Expected: attachmentPartyId remains null
   - Verify: Both contactId and attachmentPartyId are null

4. **Create attachment with invalid contactId**
   - Input: contactId that doesn't exist in tenant
   - Expected: attachmentPartyId remains null
   - Verify: contactId persisted as-is, attachmentPartyId is null

## Integration Test Specification

### Integration Test 1: End-to-End Attachment Creation

**Setup**:
1. Create a Contact with partyId
2. Create an OffspringGroup

**Test**:
1. POST /offspring/:groupId/attachments with contactId
2. Verify response includes the created attachment
3. Query attachment from database
4. Verify attachmentPartyId matches Contact.partyId

**Expected Result**:
- API response unchanged (backward compatible)
- Database record contains both contactId and attachmentPartyId
- attachmentPartyId matches the Contact's partyId

### Integration Test 2: Read Operations Remain Unchanged

**Test**:
1. Create attachment as in Integration Test 1
2. GET /offspring/:groupId to retrieve group with attachments
3. Verify attachment in response

**Expected Result**:
- Response DTOs unchanged
- All existing API consumers continue to work
- No breaking changes to response format

## Manual Testing with curl

See VALIDATION_QUERIES.md for curl commands and SQL verification queries.

## Test Coverage Requirements

- ✅ Party ID resolution logic (dual-write)
- ✅ Backward compatibility of APIs
- ✅ Response DTOs unchanged
- ✅ Database constraints (foreign key to Party)
- ✅ Index performance on attachmentPartyId
- ✅ Null handling when contactId or partyId is null
- ✅ Tenant isolation maintained

## Automated Test Implementation (Future)

When a test framework is added to this project, implement:

```typescript
describe('Attachment Party Migration', () => {
  describe('Create Attachment', () => {
    it('should resolve attachmentPartyId from contactId', async () => {
      // Arrange
      const contact = await createContact({ partyId: 123 });
      const group = await createOffspringGroup();

      // Act
      const attachment = await createAttachment({
        offspringGroupId: group.id,
        contactId: contact.id,
        kind: 'photo',
        // ... other fields
      });

      // Assert
      expect(attachment.contactId).toBe(contact.id);
      expect(attachment.attachmentPartyId).toBe(123);
    });

    it('should handle null partyId gracefully', async () => {
      const contact = await createContact({ partyId: null });
      const group = await createOffspringGroup();

      const attachment = await createAttachment({
        offspringGroupId: group.id,
        contactId: contact.id,
        kind: 'photo',
      });

      expect(attachment.contactId).toBe(contact.id);
      expect(attachment.attachmentPartyId).toBeNull();
    });
  });
});
```

## Regression Testing

After deployment, verify:

1. All existing attachments remain accessible
2. No 404 or 500 errors on attachment endpoints
3. Performance metrics unchanged (or improved via index)
4. No data integrity violations
