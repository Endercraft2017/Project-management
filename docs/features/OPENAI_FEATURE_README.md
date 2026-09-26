# OpenAI Weekly Summaries Feature

## Overview

This feature adds AI-powered weekly summaries to the ServiceBay PM application. It uses OpenAI GPT-3.5 Turbo to automatically analyze team members' daily updates and generate concise summaries with impact assessments (HIGH/MEDIUM/LOW).

## What's Included

### Backend Implementation ✅

**Services**:
- [server/src/services/openai.service.ts](../server/src/services/openai.service.ts) - OpenAI GPT-3.5 Turbo integration
- [server/src/summaries/service.ts](../server/src/summaries/service.ts) - Weekly summary generation logic
- [server/src/admin/settings.service.ts](../server/src/admin/settings.service.ts) - Admin configuration management
- [server/src/summaries/scheduler.ts](../server/src/summaries/scheduler.ts) - Automated weekly scheduler

**API Routes**:
- [server/src/summaries/routes.ts](../server/src/summaries/routes.ts) - Weekly summaries endpoints
- [server/src/admin/routes.ts](../server/src/admin/routes.ts) - Admin settings endpoints

**Controllers**:
- [server/src/summaries/controller.ts](../server/src/summaries/controller.ts) - Request handlers
- [server/src/admin/controller.ts](../server/src/admin/controller.ts) - Admin handlers

**Validators**:
- [server/src/summaries/validators.ts](../server/src/summaries/validators.ts) - Input validation
- [server/src/admin/validators.ts](../server/src/admin/validators.ts) - Settings validation

**Email Templates**:
- Updated [server/src/lib/email.ts](../server/src/lib/email.ts) with weekly summary email template

**Database Schema**:
- Updated [server/prisma/schema.prisma](../server/prisma/schema.prisma) with new models:
  - `WeeklySummary`
  - `MemberWeeklySummary`
  - `AdminSetting`
  - `ImpactLevel` enum

### Testing ✅

**Unit Tests**:
- [server/src/services/__tests__/openai.service.test.ts](../server/src/services/__tests__/openai.service.test.ts)
- [server/src/summaries/__tests__/service.test.ts](../server/src/summaries/__tests__/service.test.ts)

### Documentation ✅

**User Guide**:
- [docs/weekly-summaries-user-guide.md](../guides/weekly-summaries-user-guide.md) - Complete user documentation

**Technical Documentation**:
- [docs/openai-integration-technical-guide.md](./openai-integration-technical-guide.md) - Technical implementation details

**Security Review**:
- [docs/openai-security-review.md](./openai-security-review.md) - Comprehensive security assessment

## Installation & Setup

### 1. Install Dependencies

```bash
cd server
npm install
```

**New Dependencies**:
- `openai` (^6.6.0) - Official OpenAI Node.js SDK
- `node-cron` (latest) - Job scheduler
- `@types/node-cron` (latest) - TypeScript types

### 2. Configure Environment

Add to your `.env` file:

```env
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
```

**Getting an OpenAI API Key**:
1. Sign up at [platform.openai.com](https://platform.openai.com)
2. Navigate to API Keys section
3. Create a new API key
4. Copy and paste into `.env` file

### 3. Run Database Migration

```bash
cd server
npx prisma generate
npx prisma migrate dev --name add-weekly-summaries-and-admin-settings
```

This creates the following tables:
- `weekly_summaries`
- `member_weekly_summaries`
- `admin_settings`

### 4. Start the Server

```bash
npm run dev
```

The weekly summary scheduler will start automatically.

## Configuration

### Admin Settings

1. Log in as an admin user
2. Navigate to Admin Settings
3. Configure Weekly Summary Email:
   - **Enable/Disable**: Toggle automated emails
   - **Recipient Email**: Where to send summaries
   - **Send Day**: Day of week (Monday-Sunday)
   - **Send Time**: Time in 24-hour format (e.g., 09:00)

### Example Configuration

```json
{
  "enabled": true,
  "recipientEmail": "manager@example.com",
  "sendDay": "MONDAY",
  "sendTime": "09:00"
}
```

## API Endpoints

### Weekly Summaries

```
POST   /api/summaries/generate                        (Admin only)
GET    /api/summaries                                 (All users)
GET    /api/summaries/:weekDate                       (All users)
GET    /api/summaries/:weekDate/grouped               (All users)
POST   /api/summaries/:weekDate/send-email            (Admin only)
DELETE /api/summaries/:id                             (Admin only)
```

### Admin Settings

```
GET    /api/admin/settings                                       (Admin only)
GET    /api/admin/settings/:key                                  (Admin only)
PUT    /api/admin/settings/:key                                  (Admin only)
DELETE /api/admin/settings/:key                                  (Admin only)
GET    /api/admin/settings/weekly-summary-email/config           (Admin only)
PUT    /api/admin/settings/weekly-summary-email/config           (Admin only)
```

## Usage Examples

### Generate a Weekly Summary (Admin)

```bash
curl -X POST http://localhost:3000/api/summaries/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "weekDate": "2025-01-22"
  }'
```

### Get Weekly Summary

```bash
curl -X GET http://localhost:3000/api/summaries/2025-01-22 \
  -H "Cookie: your-session-cookie"
```

### Configure Email Settings (Admin)

```bash
curl -X PUT http://localhost:3000/api/admin/settings/weekly-summary-email/config \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "enabled": true,
    "recipientEmail": "manager@example.com",
    "sendDay": "MONDAY",
    "sendTime": "09:00"
  }'
```

## Features

### AI-Powered Summarization

- Analyzes all daily updates for the week
- Generates 2-4 sentence summaries per team member
- Highlights key achievements and progress
- Uses GPT-3.5 Turbo for cost-effectiveness

### Impact Assessment

**HIGH (Green)**:
- Major features completed
- Critical bugs fixed
- Significant milestones reached
- High business value delivered

**MEDIUM (Yellow)**:
- Regular progress on features
- Moderate bug fixes
- Steady contribution to team goals

**LOW (Red)**:
- Minor updates
- Limited progress
- Routine tasks
- Minimal contributions

### Automated Email Reports

- Configurable schedule (day and time)
- Professional HTML email template
- Grouped by impact level
- Statistics and insights included

### Manual Controls

- Generate summaries on-demand
- Send emails manually
- Delete summaries if needed
- View historical summaries

## Architecture

```
┌─────────────────────────────────────────┐
│         Client Application              │
│  (Weekly Summaries Tab - To be built)   │
└──────────────┬──────────────────────────┘
               │ HTTP/REST
               ▼
┌─────────────────────────────────────────┐
│         Express Server                   │
│  ┌────────────────────────────────────┐ │
│  │  Routes & Controllers              │ │
│  │  - Authentication Middleware       │ │
│  │  - Input Validation (Zod)          │ │
│  │  - Error Handling                  │ │
│  └────────────┬───────────────────────┘ │
│               ▼                          │
│  ┌────────────────────────────────────┐ │
│  │  Services                          │ │
│  │  - Weekly Summaries Service        │ │
│  │  - OpenAI Service                  │ │
│  │  - Admin Settings Service          │ │
│  │  - Email Service                   │ │
│  └────────────┬───────────────────────┘ │
└───────────────┼──────────────────────────┘
                │
        ┌───────┼───────┐
        ▼       ▼       ▼
    ┌────┐  ┌────┐  ┌────┐
    │ DB │  │ AI │  │SMTP│
    └────┘  └────┘  └────┘
  PostgreSQL OpenAI  Email
```

## Security

### Authentication & Authorization

- Session-based authentication
- Admin-only endpoints protected
- User context validated on every request
- No public API access

### API Key Security

- Stored in environment variables
- Never logged or exposed
- Validated on startup
- Not transmitted over network

### Data Privacy

- OpenAI doesn't use data for training
- HTTPS for all external communication
- TLS for email delivery
- Audit trail maintained

### Input Validation

- Zod schemas for all inputs
- SQL injection protected (Prisma ORM)
- XSS protection
- Type-safe operations

**See [Security Review](./openai-security-review.md) for detailed analysis**

## Cost Estimation

### OpenAI API Costs (GPT-3.5 Turbo)

- **Per summary**: ~$0.0005 (0.05 cents)
- **10 members/week**: ~$0.005 (0.5 cents)
- **Monthly (10 members, 4 weeks)**: ~$0.02 (2 cents)
- **Yearly (10 members, 52 weeks)**: ~$0.26 (26 cents)

**For 50 members**:
- Weekly: ~$0.025
- Monthly: ~$0.10
- Yearly: ~$1.30

**Note**: Prices are approximate and subject to OpenAI pricing changes.

## Testing

### Run Tests

```bash
cd server
npm test
```

### Manual Testing

1. Create some daily updates for the current week
2. Generate a weekly summary (admin)
3. View the summary with impact assessments
4. Configure email settings
5. Send a test email
6. Verify email received with correct formatting

### Test Coverage

- OpenAI service response validation
- Impact level assessment logic
- Date calculation functions
- Error handling scenarios
- Input validation
- Authentication/authorization

## Troubleshooting

### Issue: "OPENAI_API_KEY is not configured"

**Solution**: Add the API key to your `.env` file.

### Issue: Rate limit errors

**Solutions**:
- Wait and retry (automatic with exponential backoff)
- Upgrade OpenAI tier if needed
- Reduce frequency of summary generation

### Issue: Scheduler not running

**Solutions**:
- Check admin settings configuration
- Verify email settings are enabled
- Check server logs for errors
- Restart the server

### Issue: Emails not sending

**Solutions**:
- Verify SMTP configuration in `.env`
- Check spam/junk folder
- Test email configuration with manual send
- Review email service logs

## Next Steps (Client Implementation)

The backend is complete. To finish this feature, you need to:

1. **Create Weekly Summaries Tab**
   - Component: `client/src/pages/WeeklySummaries.tsx`
   - Route: `/summaries`
   - Navigation: Add to main menu

2. **Build Summary View Component**
   - Display summaries grouped by impact level
   - Color-coded indicators (green/yellow/red)
   - Statistics dashboard
   - Date picker for week selection

3. **Admin Controls**
   - "Generate Summary" button (admin only)
   - "Send Email" button (admin only)
   - Settings page for email configuration
   - Summary deletion (admin only)

4. **API Integration**
   - Create API client functions
   - Handle loading states
   - Display error messages
   - Real-time updates (optional)

**See existing patterns in**:
- `client/src/pages/Updates.tsx` - Daily updates UI
- `client/src/pages/Notes.tsx` - Notes UI with admin features
- `client/src/api/*` - API client examples

## Documentation

- **User Guide**: [weekly-summaries-user-guide.md](../guides/weekly-summaries-user-guide.md)
- **Technical Guide**: [openai-integration-technical-guide.md](./openai-integration-technical-guide.md)
- **Security Review**: [openai-security-review.md](./openai-security-review.md)

## Support

For issues, questions, or contributions:

1. Review the documentation
2. Check the troubleshooting section
3. Contact the development team
4. Submit a GitHub issue (if applicable)

## License

This feature is part of the ServiceBay PM application and follows the same license.

---

**Last Updated**: January 27, 2025
**Version**: 1.0.0
**Status**: ✅ Backend Complete, Frontend Pending
