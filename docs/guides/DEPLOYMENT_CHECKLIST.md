# OpenAI Weekly Summaries - Deployment Checklist

## Pre-Deployment

### 1. Environment Configuration ✅

- [ ] Set `OPENAI_API_KEY` in production environment
- [ ] Verify SMTP settings for email delivery
- [ ] Confirm `DATABASE_URL` is configured
- [ ] Set `NODE_ENV=production`

### 2. Database Migration ✅

```bash
# Generate Prisma client
npx prisma generate

# Run migration
npx prisma migrate deploy
```

Expected tables:
- `weekly_summaries`
- `member_weekly_summaries`
- `admin_settings`

### 3. Dependencies ✅

```bash
# Install production dependencies
npm ci --production

# Or if using npm install
npm install
```

New dependencies:
- `openai@^6.6.0`
- `node-cron@latest`

### 4. Build Application ✅

```bash
# Build server
cd server
npm run build

# Build client (when ready)
cd client
npm run build
```

## Post-Deployment

### 1. Verify Server Health ✅

```bash
# Check health endpoint
curl http://your-domain.com/health

# Expected response:
{
  "success": true,
  "status": "healthy",
  "timestamp": "2025-01-27T10:00:00.000Z",
  "environment": "production"
}
```

### 2. Check Logs ✅

Look for these startup messages:
```
✅ Database connected
✅ Socket.IO server initialized
⏰ Reminder scheduler active
📊 Weekly summary scheduler active
```

### 3. Test OpenAI Connection ✅

**As Admin**:
1. Log in to the application
2. Navigate to Weekly Summaries
3. Click "Generate Summary" for a test week
4. Verify summary generation completes successfully

### 4. Configure Email Settings ✅

1. Navigate to Admin Settings
2. Go to Weekly Summary Email Configuration
3. Set recipient email
4. Choose send day and time
5. Enable automated emails
6. Send a test email manually

### 5. Verify Scheduler ✅

Check server logs for:
```
[Scheduler] Starting weekly summary scheduler: 0 9 * * 1 (MONDAY at 09:00)
[Scheduler] Weekly summary scheduler started successfully
```

## Security Checklist

### API Key Security ✅

- [ ] API key stored in environment variable (not in code)
- [ ] API key not visible in logs
- [ ] API key not exposed to client
- [ ] Production and development keys are separate

### Authentication & Authorization ✅

- [ ] Admin endpoints require admin role
- [ ] Session-based authentication working
- [ ] Unauthorized access properly blocked
- [ ] Test all endpoints with non-admin users

### Rate Limiting ✅

- [ ] API rate limiter configured
- [ ] OpenAI retry logic working
- [ ] Timeout settings appropriate
- [ ] Error handling for rate limits tested

### Data Privacy ✅

- [ ] Privacy policy updated to mention OpenAI usage
- [ ] HTTPS enforced
- [ ] TLS for email delivery
- [ ] Data retention policy documented

## Testing in Production

### Test Cases

**1. Generate Weekly Summary** (Admin only)
```bash
POST /api/summaries/generate
{
  "weekDate": "2025-01-22"
}
# Expected: 200 OK with summary data
```

**2. View Summaries** (All users)
```bash
GET /api/summaries/2025-01-22
# Expected: 200 OK with summary
```

**3. Configure Email** (Admin only)
```bash
PUT /api/admin/settings/weekly-summary-email/config
{
  "enabled": true,
  "recipientEmail": "test@example.com",
  "sendDay": "MONDAY",
  "sendTime": "09:00"
}
# Expected: 200 OK with updated config
```

**4. Send Test Email** (Admin only)
```bash
POST /api/summaries/2025-01-22/send-email
# Expected: 200 OK, email received
```

**5. Unauthorized Access Test**
```bash
# As non-admin user
POST /api/summaries/generate
# Expected: 403 Forbidden
```

## Monitoring

### Metrics to Track

- [ ] OpenAI API response time
- [ ] Summary generation success rate
- [ ] Email delivery success rate
- [ ] Scheduler execution logs
- [ ] Error rates
- [ ] API costs

### Alerts to Configure

- [ ] OpenAI API errors
- [ ] Rate limit exceeded
- [ ] Email delivery failures
- [ ] Scheduler failures
- [ ] High API costs
- [ ] Database connection errors

### Log Locations

```bash
# Application logs
pm2 logs server

# Or direct logs
tail -f logs/application.log
```

## Rollback Plan

If issues occur:

### 1. Disable Feature
```bash
# Stop the scheduler
# As admin, disable email settings
PUT /api/admin/settings/weekly-summary-email/config
{
  "enabled": false,
  ...
}
```

### 2. Remove Environment Variable
```bash
# Temporarily remove OPENAI_API_KEY
# Service will handle gracefully with error message
```

### 3. Revert Database Migration
```bash
# Create rollback migration
npx prisma migrate resolve --rolled-back <migration-name>

# Run rollback
npx prisma migrate deploy
```

### 4. Revert Code
```bash
git revert <commit-hash>
git push
```

## Post-Launch Tasks

### Week 1

- [ ] Monitor logs daily
- [ ] Check API costs
- [ ] Review first automated email
- [ ] Gather user feedback
- [ ] Verify scheduler execution

### Week 2-4

- [ ] Review summary accuracy
- [ ] Adjust email schedule if needed
- [ ] Monitor API usage trends
- [ ] Address any issues reported
- [ ] Document lessons learned

### Monthly

- [ ] Review API costs
- [ ] Update dependencies
- [ ] Check for security updates
- [ ] Review error logs
- [ ] Optimize prompts if needed

### Quarterly

- [ ] Rotate API keys
- [ ] Review and update documentation
- [ ] Conduct security audit
- [ ] Evaluate GPT-4 upgrade
- [ ] Analyze cost vs. value

## Success Criteria

- [ ] Summaries generate successfully every week
- [ ] Emails deliver reliably
- [ ] API costs within budget
- [ ] No security incidents
- [ ] Positive user feedback
- [ ] Admin controls working properly
- [ ] Error rate < 1%
- [ ] Response time < 60 seconds

## Emergency Contacts

**OpenAI Support**:
- Dashboard: https://platform.openai.com
- Support: help.openai.com

**Internal Team**:
- Development Team: [contact]
- DevOps: [contact]
- Security: [contact]

## Documentation References

- [User Guide](./weekly-summaries-user-guide.md)
- [Technical Guide](../features/openai-integration-technical-guide.md)
- [Security Review](../features/openai-security-review.md)
- [Main README](../features/OPENAI_FEATURE_README.md)

---

**Deployment Date**: _____________
**Deployed By**: _____________
**Sign-off**: _____________
