# Missing Daily Updates Tracker & Notification System

**Feature Type:** Admin Tool
**Version:** 1.0
**Created:** 2025-01-27
**Status:** ✅ Production-Ready

---

## Overview

The Missing Updates Tracker is an admin-only feature that allows administrators to:
- View which team members haven't submitted their daily updates
- See specific dates for missing updates
- Send personalized reminder notifications to users
- Configure tracking preferences and user inclusion

### Key Features

✅ **Smart Detection** - Automatically identifies missing updates based on configurable date ranges
✅ **Business Days Support** - Optional Monday-Friday only checking
✅ **Custom Date Ranges** - Flexible date range selection (current week, last 7/14/30 days, or custom)
✅ **Real-time Notifications** - WebSocket-based instant notifications with deep-linking
✅ **Cooldown Protection** - Prevents notification spam with 5-hour cooldown (admin bypass)
✅ **User Selection** - Choose specific users to track or track all active users
✅ **Admin-Only Access** - Secured with role-based access control

---

## User Guide

### For Administrators

#### Accessing the Feature

1. **Navigate to the Updates page** (`/updates`)
2. **Look for the "Missing Updates" button** in the header (admin-only)
3. **Click the button** to open the Missing Updates Modal

#### Viewing Missing Updates

The modal displays:

**Summary Statistics:**
- Date range being checked
- Number of users with missing updates
- Total missing days across all users

**User List:**
- Users sorted by number of missing days (most to least)
- Each user shows:
  - Name and email
  - List of missing dates with formatted display
  - "Send Reminder" button

#### Sending Reminders

1. Click the **"Send Reminder"** button next to a user
2. The system will:
   - Send a real-time WebSocket notification to the user
   - Show a success toast confirmation
   - Record the notification (cooldown tracking)
3. User receives notification with:
   - List of their missing dates
   - Deep-link to the Updates tab

#### Custom Date Ranges

1. Use the **Start Date** and **End Date** fields at the top of the modal
2. Click **"Reset to Default"** to use the configured default range
3. The list automatically refreshes when dates change

#### Configuring the Feature

1. Navigate to **Admin Settings** page
2. Find the **"Missing Updates Tracking"** card
3. Configure:
   - **Enable/Disable** - Turn tracking on/off
   - **Business Days Only** - Check only Monday-Friday
   - **Default Date Range** - Current week, last 7/14/30 days
   - **Include Users** - Select specific users or all active users
4. Click **"Save Configuration"**

### For Team Members

#### Receiving Reminders

When an admin sends you a reminder:

1. **Real-time notification** appears (if you're online)
2. **Notification shows:**
   - "Daily Update Reminder"
   - List of your missing dates (e.g., "Jan 20, Jan 21, Jan 22")
3. **Click the notification** to navigate directly to the Updates tab
4. Submit your missing updates

#### Viewing Your Updates

1. Go to the **Updates page**
2. Use the **day list sidebar** to navigate to missing dates
3. Submit updates for each missing day

---

## Technical Documentation

### Architecture

#### Backend Components

**Location:** `/server/src/admin/`

**Files:**
- `missing-updates.service.ts` - Missing updates detection logic
- `notification-cooldown.service.ts` - Notification rate limiting
- `settings.service.ts` - Configuration management (extended)
- `controller.ts` - HTTP request handlers (extended)
- `routes.ts` - API endpoint definitions (extended)
- `validators.ts` - Request validation schemas (extended)

#### Frontend Components

**Location:** `/client/src/`

**Files:**
- `hooks/useMissingUpdates.ts` - React Query hooks
- `components/admin/MissingUpdatesButton.tsx` - Button component
- `components/admin/MissingUpdatesModal.tsx` - Modal UI
- `components/admin/MissingUpdatesConfig.tsx` - Configuration UI
- `types/index.ts` - TypeScript type definitions (extended)

### API Endpoints

#### Configuration Endpoints

**GET** `/api/admin/settings/missing-updates/config`
Get missing updates configuration
**Auth:** Admin only
**Response:**
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "includedUserIds": ["user-1", "user-2"],
    "checkBusinessDaysOnly": true,
    "defaultDateRange": "current_week"
  }
}
```

**PUT** `/api/admin/settings/missing-updates/config`
Update configuration
**Auth:** Admin only
**Body:**
```json
{
  "enabled": true,
  "includedUserIds": ["user-1", "user-2"],
  "checkBusinessDaysOnly": true,
  "defaultDateRange": "current_week"
}
```

#### Missing Updates Endpoints

**GET** `/api/admin/updates/missing?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
Get users with missing updates
**Auth:** Admin only
**Query Params:** `startDate` (optional), `endDate` (optional)
**Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "userId": "abc123",
        "userName": "John Doe",
        "userEmail": "john@example.com",
        "missingDates": ["2025-01-20", "2025-01-21"]
      }
    ],
    "dateRange": {
      "startDate": "2025-01-20",
      "endDate": "2025-01-27"
    },
    "totalUsers": 1,
    "totalMissingDays": 2
  }
}
```

**POST** `/api/admin/updates/send-reminder`
Send reminder notification
**Auth:** Admin only
**Body:**
```json
{
  "userId": "abc123",
  "missingDates": ["2025-01-20", "2025-01-21"]
}
```

### WebSocket Events

**Event:** `update_reminder`
**Direction:** Server → Client
**Payload:**
```typescript
{
  type: 'update_reminder',
  title: 'Daily Update Reminder',
  message: 'You have missing daily updates for: Jan 20, Jan 21',
  missingDates: ['2025-01-20', '2025-01-21'],
  link: '/updates',
  timestamp: '2025-01-27T10:30:00Z'
}
```

### Database Schema

No new database tables required. Uses existing:
- `AdminSetting` - For configuration storage
- `DailyUpdate` - For update tracking
- `User` - For user information

**New Setting Key:** `missing_updates_config`

### Security Features

✅ **Admin-Only Access** - All endpoints protected by `isAdmin` middleware
✅ **Input Validation** - Zod schemas validate all requests
✅ **Rate Limiting** - 5-hour cooldown between auto-notifications
✅ **Admin Bypass** - Admins can send anytime, cooldown only affects auto-scheduler
✅ **Date Range Limits** - Maximum 90-day range
✅ **User Validation** - Only active, valid users can be included

### Notification Cooldown Logic

**Cooldown Period:** 5 hours

**Rules:**
1. **Admin Notifications** - Always bypass cooldown, always send
2. **Auto Notifications** (future) - Respect cooldown, won't send if recent notification exists
3. **Cooldown Check** - Checks only auto-sent notifications
4. **History Cleanup** - Automatically removes records older than 24 hours

**Example:**
- 9:00 AM - Admin sends notification ✅ (bypasses cooldown)
- 9:30 AM - Auto-scheduler tries to send ❌ (blocked by cooldown)
- 2:30 PM - Auto-scheduler sends ✅ (5+ hours passed)

---

## Integration Instructions

### Step 1: Add Button to Updates Page

**File:** `/client/src/components/updates/UpdatesView.tsx`

```tsx
import { MissingUpdatesButton } from '@/components/admin/MissingUpdatesButton';

// In the header section, add:
<div className="flex items-center gap-2">
  <MissingUpdatesButton />
  {/* ...other header buttons */}
</div>
```

### Step 2: Add Configuration to Admin Settings

**File:** `/client/src/pages/AdminSettings.tsx` (or similar)

```tsx
import { MissingUpdatesConfigCard } from '@/components/admin/MissingUpdatesConfig';

// In the settings page:
<MissingUpdatesConfigCard />
```

### Step 3: Handle Notifications in App

**File:** `/client/src/App.tsx` (or main layout)

```tsx
import { useEffect } from 'react';
import { useSocket } from '@/contexts/SocketContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/useToast';
import type { UpdateReminderNotification } from '@/types';

function App() {
  const { on, off } = useSocket();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    on('update_reminder', (notification: UpdateReminderNotification) => {
      toast({
        title: notification.title,
        description: notification.message,
        action: {
          label: 'View Updates',
          onClick: () => navigate(notification.link),
        },
      });
    });

    return () => {
      off('update_reminder');
    };
  }, [on, off, navigate, toast]);

  return (
    // ...app layout
  );
}
```

### Step 4: Database Migration (if needed)

The feature uses the existing `AdminSetting` table. No migration required.

---

## Testing

### Manual Testing Checklist

#### Configuration Testing
- [ ] Enable/disable tracking works
- [ ] Business days only setting works
- [ ] Date range selection works
- [ ] User selection works (individual and all)
- [ ] Configuration persists after save

#### Missing Updates Detection
- [ ] Correctly identifies users with missing updates
- [ ] Business days filter works (excludes weekends)
- [ ] Custom date range works
- [ ] Statistics are accurate

#### Notification System
- [ ] Notifications sent successfully
- [ ] User receives WebSocket notification
- [ ] Deep-link navigation works
- [ ] Toast confirmation shows
- [ ] Cooldown tracking works

#### Security Testing
- [ ] Non-admin users cannot access endpoints
- [ ] Non-admin users cannot see button
- [ ] Input validation prevents invalid data
- [ ] Date range limits enforced

### Unit Tests

**Backend Tests to Write:**

```typescript
// missing-updates.service.test.ts
describe('MissingUpdatesService', () => {
  it('should detect users with missing updates');
  it('should respect business days only setting');
  it('should calculate correct date ranges');
  it('should exclude weekends when configured');
});

// notification-cooldown.service.test.ts
describe('NotificationCooldownService', () => {
  it('should allow admin notifications to bypass cooldown');
  it('should block auto notifications within cooldown period');
  it('should clean up old records');
});
```

**Frontend Tests to Write:**

```typescript
// MissingUpdatesModal.test.tsx
describe('MissingUpdatesModal', () => {
  it('should display missing updates correctly');
  it('should allow sending reminders');
  it('should handle custom date ranges');
});

// MissingUpdatesConfig.test.tsx
describe('MissingUpdatesConfig', () => {
  it('should save configuration');
  it('should toggle users');
  it('should select/deselect all users');
});
```

---

## Future Enhancements

### Planned Features

1. **Automated Scheduler** ⏱️
   - Auto-send reminders at configurable times
   - Configurable frequency (daily, weekly)
   - Respects cooldown period

2. **Email Notifications** 📧
   - Optional email reminders
   - Email templates
   - Batch notifications

3. **Analytics Dashboard** 📊
   - Historical trends
   - User compliance rates
   - Missing update patterns

4. **Escalation Rules** 🔔
   - Multiple reminder levels
   - Notify managers
   - Automatic escalation after X days

5. **Custom Messages** ✏️
   - Personalize reminder messages
   - Template support
   - Multi-language support

---

## Troubleshooting

### Common Issues

**Issue:** Button not visible
**Solution:** Ensure user has ADMIN role and is authenticated

**Issue:** Notifications not received
**Solution:** Check WebSocket connection, ensure user is online, check browser console for errors

**Issue:** Configuration not saving
**Solution:** Check admin permissions, verify network requests, check server logs

**Issue:** Incorrect date range
**Solution:** Verify timezone settings, check business days configuration

---

## Support

For questions or issues:
1. Check this documentation
2. Review `/docs/3logs.md` for error logs
3. Contact development team

---

**Document Version:** 1.0
**Last Updated:** 2025-01-27
**Maintained By:** Development Team
