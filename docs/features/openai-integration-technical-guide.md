# OpenAI Integration Technical Documentation

## Overview

This document provides technical details about the OpenAI GPT-3.5 Turbo integration for automated weekly summary generation in the ServiceBay PM application.

## Architecture

### Components

1. **OpenAI Service** (`server/src/services/openai.service.ts`)
   - Handles all interactions with OpenAI API
   - Implements retry logic and error handling
   - Validates responses and ensures type safety

2. **Weekly Summaries Service** (`server/src/summaries/service.ts`)
   - Orchestrates summary generation workflow
   - Manages database operations
   - Coordinates with OpenAI service

3. **Admin Settings Service** (`server/src/admin/settings.service.ts`)
   - Manages configuration storage
   - Validates settings using Zod schemas

4. **Email Service** (`server/src/lib/email.ts`)
   - Sends formatted HTML emails
   - Handles weekly summary email templates

5. **Scheduler** (`server/src/summaries/scheduler.ts`)
   - Automates weekly summary generation
   - Uses node-cron for scheduling
   - Dynamically adjusts based on admin settings

### Database Schema

```prisma
// Weekly summary container
model WeeklySummary {
  id             String              @id @default(uuid())
  weekStartDate  DateTime            @db.Date
  weekEndDate    DateTime            @db.Date
  generatedAt    DateTime            @default(now())
  emailSentAt    DateTime?
  memberSummaries MemberWeeklySummary[]

  @@unique([weekStartDate, weekEndDate])
}

// Individual member summaries
model MemberWeeklySummary {
  id               String        @id @default(uuid())
  weeklySummaryId  String
  userId           String
  summary          String        @db.Text
  impactLevel      ImpactLevel
  rawUpdates       Json

  weeklySummary    WeeklySummary @relation(...)
  user             User          @relation(...)

  @@unique([weeklySummaryId, userId])
}

// Admin configuration
model AdminSetting {
  id        String   @id @default(uuid())
  key       String   @unique
  value     String   @db.Text // JSON-encoded
  updatedBy String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// Impact levels
enum ImpactLevel {
  HIGH
  MEDIUM
  LOW
}
```

## OpenAI Integration

### Configuration

```typescript
// Environment Variables Required
OPENAI_API_KEY=your_openai_api_key_here
```

### Client Initialization

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 3,
  timeout: 60000, // 60 seconds
});
```

### Model Configuration

- **Model**: `gpt-3.5-turbo`
- **Temperature**: 0.7 (balanced creativity and consistency)
- **Max Tokens**: 500 (sufficient for 2-4 sentence summaries)
- **Response Format**: JSON object

### Prompt Engineering

The system prompt is carefully crafted to:
1. Define the AI's role as a work summary analyst
2. Specify the output format (2-4 sentences)
3. Define clear impact level criteria
4. Ensure JSON response structure

```typescript
const systemPrompt = `You are an AI assistant that analyzes team member work updates and creates concise summaries. Your task is to:
1. Summarize the week's work in 2-4 sentences, highlighting key achievements and progress
2. Assess the impact level (HIGH, MEDIUM, or LOW) based on:
   - HIGH: Major features completed, critical bugs fixed, significant milestones reached, high business value delivered
   - MEDIUM: Regular progress on features, moderate bug fixes, steady contribution to team goals
   - LOW: Minor updates, limited progress, mostly routine tasks, or minimal contributions
3. Provide reasoning for the impact assessment

Return your response in the following JSON format:
{
  "summary": "Your 2-4 sentence summary here",
  "impactLevel": "HIGH" | "MEDIUM" | "LOW",
  "reasoning": "Brief explanation for the impact level"
}`;
```

### Request Structure

```typescript
const response = await client.chat.completions.create({
  model: 'gpt-3.5-turbo',
  messages: [
    {
      role: 'system',
      content: systemPrompt,
    },
    {
      role: 'user',
      content: `Team member: ${memberName}\n\nWeekly updates:\n${updatesText}`,
    },
  ],
  temperature: 0.7,
  max_tokens: 500,
  response_format: { type: 'json_object' },
});
```

### Response Validation

```typescript
interface OpenAIResponse {
  summary: string;
  impactLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  reasoning: string;
}

// Validation steps:
1. Check response exists
2. Parse JSON
3. Validate required fields
4. Verify impact level is valid
5. Return structured data
```

### Error Handling

The service handles multiple error scenarios:

```typescript
try {
  // API call
} catch (error) {
  if (error instanceof OpenAI.APIError) {
    if (error.status === 429) {
      throw new Error('OpenAI rate limit exceeded. Please try again later.');
    } else if (error.status === 401) {
      throw new Error('OpenAI API key is invalid. Please check your configuration.');
    } else if (error.status === 503) {
      throw new Error('OpenAI service is temporarily unavailable. Please try again later.');
    }
    throw new Error(`OpenAI API error: ${error.message}`);
  }

  if (error instanceof SyntaxError) {
    throw new Error('Failed to parse OpenAI response');
  }

  throw error;
}
```

## API Endpoints

### Weekly Summaries

```
POST   /api/summaries/generate           (Admin only)
GET    /api/summaries                    (All users)
GET    /api/summaries/:weekDate          (All users)
GET    /api/summaries/:weekDate/grouped  (All users)
POST   /api/summaries/:weekDate/send-email (Admin only)
DELETE /api/summaries/:id                (Admin only)
```

### Admin Settings

```
GET    /api/admin/settings                              (Admin only)
GET    /api/admin/settings/:key                         (Admin only)
PUT    /api/admin/settings/:key                         (Admin only)
DELETE /api/admin/settings/:key                         (Admin only)
GET    /api/admin/settings/weekly-summary-email/config  (Admin only)
PUT    /api/admin/settings/weekly-summary-email/config  (Admin only)
```

## Request/Response Examples

### Generate Weekly Summary

**Request:**
```http
POST /api/summaries/generate
Content-Type: application/json

{
  "weekDate": "2025-01-22"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "weekStartDate": "2025-01-20",
    "weekEndDate": "2025-01-26",
    "generatedAt": "2025-01-27T10:00:00Z",
    "memberSummaries": [
      {
        "id": "uuid",
        "userId": "uuid",
        "user": {
          "id": "uuid",
          "name": "John Doe",
          "email": "john@example.com",
          "role": "MEMBER"
        },
        "summary": "John made significant progress on the authentication system, implementing OAuth2 integration and fixing critical security vulnerabilities. He also optimized database queries, resulting in a 40% performance improvement.",
        "impactLevel": "HIGH",
        "rawUpdates": {
          "updates": [
            { "date": "2025-01-20", "content": "..." },
            { "date": "2025-01-21", "content": "..." }
          ],
          "reasoning": "Major features completed with high business value"
        }
      }
    ]
  },
  "message": "Weekly summary generated successfully"
}
```

### Update Email Configuration

**Request:**
```http
PUT /api/admin/settings/weekly-summary-email/config
Content-Type: application/json

{
  "enabled": true,
  "recipientEmail": "manager@example.com",
  "sendDay": "MONDAY",
  "sendTime": "09:00"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "key": "weekly_summary_email",
    "value": {
      "enabled": true,
      "recipientEmail": "manager@example.com",
      "sendDay": "MONDAY",
      "sendTime": "09:00"
    },
    "updatedBy": "admin-user-id",
    "updatedAt": "2025-01-27T10:30:00Z"
  },
  "message": "Email configuration updated successfully"
}
```

## Scheduler

### Cron Expression Generation

```typescript
// Convert day name and time to cron expression
const dayOfWeek = DAY_TO_CRON[emailConfig.sendDay]; // 0-6
const [hour, minute] = emailConfig.sendTime.split(':').map(Number);
const cronExpression = `${minute} ${hour} * * ${dayOfWeek}`;

// Example: "0 9 * * 1" = Every Monday at 9:00 AM
```

### Scheduler Lifecycle

```typescript
// Start server
startServer() {
  await startWeeklySummaryScheduler();
}

// Graceful shutdown
shutdown() {
  stopWeeklySummaryScheduler();
}

// Settings updated
onSettingsChange() {
  await restartScheduler();
}
```

## Security Considerations

### API Key Management

- ✅ API keys stored in environment variables
- ✅ Never logged or exposed in error messages
- ✅ Validated on service initialization
- ✅ Not included in client-side code

### Authorization

- ✅ Admin-only endpoints protected with `isAdmin` middleware
- ✅ User context validated on every request
- ✅ Database queries scoped by user permissions

### Input Validation

- ✅ All inputs validated using Zod schemas
- ✅ Date formats strictly validated
- ✅ Email addresses validated
- ✅ User IDs verified against session

### Rate Limiting

- ✅ Built-in OpenAI SDK retry logic (3 attempts)
- ✅ Exponential backoff on rate limit errors
- ✅ Graceful degradation on API failures

### Data Privacy

- ✅ Updates sent to OpenAI are not used for training
- ✅ Responses stored in database for audit trail
- ✅ Raw updates preserved for transparency
- ✅ Email recipients configurable by admins

## Performance Optimization

### Batch Processing

```typescript
// Process all users in parallel where possible
const summaries = await Promise.allSettled(
  users.map(user => generateUserSummary(user))
);
```

### Caching

```typescript
// Check for existing summary before generating
const existing = await prisma.weeklySummary.findUnique({
  where: { weekStartDate_weekEndDate: { weekStartDate, weekEndDate } }
});
```

### Error Recovery

```typescript
// Continue processing even if one user fails
for (const user of users) {
  try {
    await generateSummary(user);
  } catch (error) {
    console.error(`Failed for ${user.name}:`, error);
    // Create fallback summary
    await createFallbackSummary(user);
  }
}
```

## Monitoring and Logging

### Key Metrics

- Summary generation time
- OpenAI API response time
- Success/failure rates
- Email delivery status
- Scheduler execution logs

### Log Levels

```typescript
console.log('[Scheduler] Starting weekly summary generation...');
console.log('[Scheduler] Summary generated successfully');
console.error('[Scheduler] Error generating summary:', error);
```

## Testing

### Unit Tests

- OpenAI service response validation
- Impact level assessment logic
- Date calculation functions
- Error handling scenarios

### Integration Tests

- Full summary generation workflow
- Email delivery
- Scheduler execution
- Admin settings management

### Manual Testing

```bash
# Test OpenAI connection
curl -X POST http://localhost:3000/api/summaries/generate \
  -H "Content-Type: application/json" \
  -d '{"weekDate": "2025-01-22"}'

# Test email configuration
curl -X PUT http://localhost:3000/api/admin/settings/weekly-summary-email/config \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "recipientEmail": "test@example.com",
    "sendDay": "MONDAY",
    "sendTime": "09:00"
  }'
```

## Deployment Checklist

- [ ] Set `OPENAI_API_KEY` environment variable
- [ ] Run database migrations: `npx prisma migrate deploy`
- [ ] Configure SMTP settings for email delivery
- [ ] Set up admin user accounts
- [ ] Configure weekly summary email settings
- [ ] Test summary generation manually
- [ ] Verify scheduler is running
- [ ] Monitor logs for errors
- [ ] Set up alerting for failures

## Troubleshooting

### Common Issues

**Issue: "OPENAI_API_KEY is not configured"**
- Solution: Set the environment variable in your deployment

**Issue: Rate limit errors**
- Solution: Implement request queuing or increase API tier

**Issue: Scheduler not running**
- Solution: Check admin settings, verify cron expression

**Issue: Emails not sending**
- Solution: Verify SMTP configuration, check spam folder

## Cost Estimation

### OpenAI API Costs (GPT-3.5 Turbo)

- Input: ~$0.0005 per 1K tokens
- Output: ~$0.0015 per 1K tokens
- Average per summary: ~500 tokens total
- Cost per summary: ~$0.0005
- Cost for 10 team members/week: ~$0.005
- Monthly cost (10 members, 4 weeks): ~$0.02

**Note**: Prices subject to change. Check OpenAI pricing page for current rates.

## Future Enhancements

- [ ] Custom impact level criteria
- [ ] Summary regeneration with different parameters
- [ ] Multi-language support
- [ ] Integration with GPT-4 for improved accuracy
- [ ] Trend analysis across weeks
- [ ] Team-wide insights and recommendations
- [ ] Export summaries to PDF or Word
- [ ] Slack/Teams integration for notifications

## References

- [OpenAI API Documentation](https://platform.openai.com/docs)
- [GPT-3.5 Turbo Model Details](https://platform.openai.com/docs/models/gpt-3-5-turbo)
- [OpenAI Node.js SDK](https://github.com/openai/openai-node)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Node-Cron Documentation](https://github.com/node-cron/node-cron)
