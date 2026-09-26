# Case-Insensitive Email Handling

## Overview

The system now implements case-insensitive email handling throughout the invitation and authentication flows. This fix resolves the issue where invitations sent with mixed-case emails (e.g., "Kaduan@servicebay.ai") would fail when users authenticated via Google OAuth with lowercase emails (e.g., "kaduan@servicebay.ai").

## Problem Statement

Previously, the system stored and compared emails with exact case matching. This caused issues when:
1. An admin invited a user with a mixed-case email address
2. The user authenticated via Google OAuth, which normalized the email to lowercase
3. The system couldn't match the invitation to the OAuth email due to case differences
4. The invitation acceptance would fail with an error

## Solution

### Email Normalization

All emails are now normalized to lowercase before storage and comparison. This is handled by the `normalizeEmail()` utility function.

**Key Implementation Points:**

1. **Utility Functions** (`server/src/lib/email-utils.ts`):
   - `normalizeEmail(email: string)` - Converts email to lowercase and trims whitespace
   - `isValidDomain(email: string)` - Validates email domain (case-insensitive)
   - `emailsMatch(email1: string, email2: string)` - Compares emails case-insensitively

2. **Invitation Validation** ([validators.ts:17](server/src/invites/validators.ts#L17)):
   - Zod schema transforms incoming emails to lowercase automatically
   - Domain validation is case-insensitive

3. **Invitation Service** ([service.ts:29](server/src/invites/service.ts#L29)):
   - All email parameters are normalized before database operations
   - Database queries use Prisma's `mode: 'insensitive'` for case-insensitive lookups
   - Stored emails are always lowercase

4. **OAuth Authentication** ([passport-config.ts:58](server/src/auth/passport-config.ts#L58)):
   - Google OAuth emails are normalized immediately after retrieval
   - User lookups use case-insensitive queries
   - All new users are created with normalized (lowercase) emails

## Usage

### For Administrators

When inviting users, you can now enter emails in any case:
- `User@ServiceBay.ai`
- `USER@SERVICEBAY.AI`
- `user@servicebay.ai`

All variations will be stored as `user@servicebay.ai` and will match correctly when the user authenticates.

### For Developers

When working with emails in the codebase:

```typescript
import { normalizeEmail, isValidDomain, emailsMatch } from '@/lib/email-utils';

// Normalize an email
const email = normalizeEmail('User@Example.Com'); // returns 'user@example.com'

// Validate domain
const isValid = isValidDomain('user@servicebay.ai'); // returns true

// Compare emails
const match = emailsMatch('User@ServiceBay.ai', 'user@servicebay.ai'); // returns true
```

### Database Queries

When querying users or invitations by email, always use case-insensitive mode:

```typescript
// ✅ Correct - Case-insensitive
const user = await prisma.user.findFirst({
  where: {
    email: {
      equals: normalizeEmail(inputEmail),
      mode: 'insensitive',
    },
  },
});

// ❌ Incorrect - Case-sensitive (old way)
const user = await prisma.user.findUnique({
  where: { email: inputEmail },
});
```

## Technical Details

### Email Normalization Rules

1. **Lowercase Conversion**: All emails are converted to lowercase
2. **Whitespace Trimming**: Leading and trailing whitespace is removed
3. **Validation**: Empty strings and invalid types throw errors

### RFC 5321 Compliance

While RFC 5321 specifies that email local parts (before @) are technically case-sensitive, in practice:
- All major email providers (Gmail, Outlook, etc.) treat emails as case-insensitive
- This implementation follows industry best practices
- The approach prevents user confusion and authentication failures

### Database Considerations

- **Storage**: All emails are stored in lowercase format
- **Indexes**: Existing email indexes remain efficient
- **Queries**: Prisma's `mode: 'insensitive'` uses PostgreSQL's case-insensitive operators
- **Migration**: No database migration required; existing data is normalized on next login

## Testing

Comprehensive test suites have been added:

1. **Unit Tests** ([email-utils.test.ts](server/src/lib/__tests__/email-utils.test.ts)):
   - Email normalization edge cases
   - Domain validation
   - Email comparison

2. **Integration Tests** ([service.test.ts](server/src/invites/__tests__/service.test.ts)):
   - Invitation creation with mixed-case emails
   - Invitation acceptance with case mismatches
   - Real-world bug scenario reproduction

Run tests with:
```bash
npm test
```

## Security Considerations

1. **Email Validation**: Domain validation remains strict (`@servicebay.ai` only)
2. **SQL Injection**: Prisma ORM prevents SQL injection attacks
3. **Case-Insensitive Queries**: PostgreSQL's case-insensitive comparison is safe and performant
4. **Input Sanitization**: All emails are trimmed and validated before processing

## Migration Guide

### Existing Data

No immediate migration is required. Existing emails in the database will be normalized automatically on the user's next login or when their invitation is updated.

### For New Features

When adding new features that handle emails:

1. Import email utilities:
   ```typescript
   import { normalizeEmail } from '@/lib/email-utils';
   ```

2. Normalize emails before storage:
   ```typescript
   const normalizedEmail = normalizeEmail(inputEmail);
   ```

3. Use case-insensitive queries:
   ```typescript
   where: {
     email: {
       equals: normalizedEmail,
       mode: 'insensitive',
     },
   }
   ```

## Related Files

- [server/src/lib/email-utils.ts](server/src/lib/email-utils.ts) - Email utility functions
- [server/src/invites/validators.ts](server/src/invites/validators.ts) - Email validation schemas
- [server/src/invites/service.ts](server/src/invites/service.ts) - Invitation business logic
- [server/src/auth/passport-config.ts](server/src/auth/passport-config.ts) - OAuth authentication
- [server/src/lib/__tests__/email-utils.test.ts](server/src/lib/__tests__/email-utils.test.ts) - Unit tests
- [server/src/invites/__tests__/service.test.ts](server/src/invites/__tests__/service.test.ts) - Integration tests

## Troubleshooting

### Issue: User still can't accept invitation

**Solution**: Clear the browser cache and cookies, then try again. The session might have cached old authentication data.

### Issue: Tests failing

**Solution**: Ensure test database is clean and Prisma client is generated:
```bash
npm run prisma:generate
npm test
```

### Issue: TypeScript errors after update

**Solution**: Rebuild the project:
```bash
npm run build
```

## Support

For questions or issues related to email handling, please contact the development team or create an issue in the project repository.
