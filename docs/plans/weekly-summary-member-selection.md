# Weekly Summary Member Selection Feature - Implementation Plan

**Created:** 2025-10-23
**Feature:** Weekly Summary Member Selection
**Type:** Admin Configuration Feature
**Status:** Planning

## Overview

Add functionality to allow admins to selectively choose which team members are included in the weekly summary generation. Currently, all active users are automatically included in weekly summaries. This feature will add an admin-only configuration interface with checkboxes to select/deselect members.

## Requirements Analysis

### Functional Requirements
1. **Admin-Only Access:** Only users with ADMIN role can access and modify member selection
2. **Persistent Storage:** Selected member preferences must persist across sessions
3. **UI Interface:** Checkbox-based interface showing all team members
4. **Default Behavior:** All members should be included by default (opt-out model)
5. **Real-time Updates:** Changes should take effect for the next summary generation
6. **Visual Feedback:** Clear indication of who is included/excluded
7. **Integration:** Must integrate with existing weekly summary generation pipeline

### Non-Functional Requirements
1. **Security:** Proper authorization checks on all API endpoints
2. **Performance:** Minimal impact on summary generation performance
3. **Reliability:** Graceful handling of edge cases (no members selected, deleted users, etc.)
4. **Maintainability:** Clean code following existing patterns
5. **Testing:** Comprehensive unit tests

## Current System Analysis

### Existing Weekly Summary Flow
```
1. Admin triggers generation (manual or cron job)
   ↓
2. WeeklySummariesService.generateWeeklySummary()
   ├─ Get ALL active users (lines 62-70 in service.ts)
   ├─ Get daily updates for the week
   ├─ Group updates by user
   └─ Generate AI summaries for each user
   ↓
3. Store summaries in database
```

**Key File:** `server/src/summaries/service.ts` (lines 62-70)
```typescript
const users = await prisma.user.findMany({
  where: { isActive: true },  // Currently gets ALL active users
  select: { id: true, name: true, email: true, role: true },
});
```

### Existing Admin Settings System
- **Model:** AdminSetting (schema.prisma lines 378-388)
- **Service:** AdminSettingsService (admin/settings.service.ts)
- **Storage:** JSON-encoded values in TEXT column
- **Pattern:** Key-value store with typed schemas

Example: Weekly summary email config is stored as:
```typescript
{
  key: "weekly_summary_email",
  value: {
    enabled: boolean,
    recipientEmail: string,
    sendDay: string,
    sendTime: string
  }
}
```

## Technical Design

### 1. Database Schema Changes

**Option A: New AdminSetting Key (RECOMMENDED)**
- Leverage existing `AdminSetting` table
- Store as JSON: `{ includedUserIds: string[] }`
- Pros: No migration needed, follows existing pattern
- Cons: Slightly less normalized

**Option B: New Table**
- Create `WeeklySummaryMemberPreference` table
- Pros: More normalized, better for complex queries
- Cons: Requires migration, more complex

**Decision:** Use Option A (AdminSetting) for consistency with existing email config pattern.

#### Schema Addition
```typescript
// New setting key
export const SETTING_KEYS = {
  WEEKLY_SUMMARY_EMAIL: 'weekly_summary_email',
  WEEKLY_SUMMARY_MEMBERS: 'weekly_summary_members', // NEW
} as const;

// New schema
export const WeeklySummaryMembersConfigSchema = z.object({
  includedUserIds: z.array(z.string().uuid()),
  lastUpdatedBy: z.string().uuid(),
  lastUpdatedAt: z.string().datetime(),
});

export type WeeklySummaryMembersConfig = z.infer<typeof WeeklySummaryMembersConfigSchema>;
```

### 2. Backend Implementation

#### 2.1 Admin Settings Service Updates
**File:** `server/src/admin/settings.service.ts`

Add methods:
```typescript
async getWeeklySummaryMembersConfig(): Promise<WeeklySummaryMembersConfig | null>
async setWeeklySummaryMembersConfig(config: WeeklySummaryMembersConfig, userId: string)
```

#### 2.2 New API Endpoints
**File:** `server/src/admin/routes.ts`

```typescript
// GET /api/admin/settings/weekly-summary-members/config
// Returns: { includedUserIds: string[], lastUpdatedBy: string, lastUpdatedAt: string }

// PUT /api/admin/settings/weekly-summary-members/config
// Body: { includedUserIds: string[] }
// Returns: Updated config
```

**Middleware Stack:**
1. `requireAuth` - Verify JWT token
2. `requireAdmin` - Verify ADMIN role
3. Validation - Zod schema validation

#### 2.3 Weekly Summaries Service Updates
**File:** `server/src/summaries/service.ts`

Update `generateWeeklySummary()` method:
```typescript
async generateWeeklySummary(weekDate: Date) {
  const { monday, sunday } = getWeekBounds(weekDate);

  // ... existing validation ...

  // NEW: Get member selection config
  const membersConfig = await adminSettingsService.getWeeklySummaryMembersConfig();

  // Get users based on config
  let users;
  if (membersConfig && membersConfig.includedUserIds.length > 0) {
    // Get only selected users
    users = await prisma.user.findMany({
      where: {
        id: { in: membersConfig.includedUserIds },
        isActive: true,
      },
      select: { id: true, name: true, email: true, role: true },
    });
  } else {
    // Default: Get all active users (backwards compatible)
    users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true, role: true },
    });
  }

  // ... rest of existing logic ...
}
```

### 3. Frontend Implementation

#### 3.1 New Component: MemberSelectionSettings
**File:** `client/src/components/summaries/MemberSelectionSettings.tsx`

**UI Design:**
```
┌──────────────────────────────────────────┐
│  Weekly Summary Member Selection         │
├──────────────────────────────────────────┤
│  Select team members to include:         │
│                                           │
│  ☑ John Doe (john@example.com)          │
│  ☑ Jane Smith (jane@example.com)        │
│  ☐ Bob Wilson (bob@example.com)         │
│  ☑ Alice Brown (alice@example.com)      │
│                                           │
│  [Cancel] [Save Changes]                 │
└──────────────────────────────────────────┘
```

**Component Structure:**
```tsx
export default function MemberSelectionSettings({ open, onClose }) {
  const { data: users } = useUsers(); // All active users
  const { data: config } = useWeeklySummaryMembersConfig();
  const updateConfigMutation = useUpdateWeeklySummaryMembersConfig();

  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Initialize with config or all users (default)
  useEffect(() => {
    if (config) {
      setSelectedUserIds(config.includedUserIds);
    } else if (users) {
      setSelectedUserIds(users.map(u => u.id)); // Default: all selected
    }
  }, [config, users]);

  const handleToggle = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSave = async () => {
    await updateConfigMutation.mutateAsync({
      includedUserIds: selectedUserIds
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      {/* Implementation */}
    </Dialog>
  );
}
```

#### 3.2 New Button Component: MemberSelectionButton
**File:** `client/src/components/summaries/MemberSelectionButton.tsx`

Add to admin actions in WeeklySummariesView:
```tsx
<MemberSelectionButton />
```

#### 3.3 Custom Hooks
**File:** `client/src/hooks/useSummaries.ts`

Add hooks:
```typescript
export function useWeeklySummaryMembersConfig() {
  return useQuery({
    queryKey: ['admin', 'settings', 'weekly-summary-members'],
    queryFn: () => get<WeeklySummaryMembersConfig>(
      '/api/admin/settings/weekly-summary-members/config'
    ),
  });
}

export function useUpdateWeeklySummaryMembersConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (config: { includedUserIds: string[] }) =>
      put('/api/admin/settings/weekly-summary-members/config', config),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin', 'settings', 'weekly-summary-members']);
      // Show success toast
    },
  });
}
```

#### 3.4 Integration with WeeklySummariesView
**File:** `client/src/components/summaries/WeeklySummariesView.tsx`

Add button to admin actions (line 122):
```tsx
{isAdmin && (
  <div className="flex items-center gap-2">
    <EmailSettingsButton />
    <MemberSelectionButton /> {/* NEW */}
    {summary && <SendEmailButton weekDate={selectedWeek} />}
    <GenerateSummaryButton weekDate={selectedWeek} />
  </div>
)}
```

### 4. Security Considerations

#### Authorization Checks
1. **API Endpoints:** Both GET and PUT must have `requireAuth` + `requireAdmin` middleware
2. **Frontend:** Hide UI elements from non-admin users
3. **Validation:** Ensure userIds in request exist and are valid UUIDs

#### Input Validation
```typescript
// Validator schema
export const updateWeeklySummaryMembersConfigSchema = z.object({
  includedUserIds: z.array(z.string().uuid()).min(0),
});
```

#### Edge Cases to Handle
1. **Empty Selection:** Allow empty array (no summaries generated)
2. **Invalid User IDs:** Filter out non-existent users before saving
3. **Deleted Users:** Handle users that are no longer active
4. **Concurrent Updates:** Last write wins (acceptable for this use case)

### 5. Error Handling

#### Backend Errors
```typescript
// Service validation
if (!Array.isArray(config.includedUserIds)) {
  throw new Error('includedUserIds must be an array');
}

// Filter to only existing users
const existingUsers = await prisma.user.findMany({
  where: { id: { in: config.includedUserIds } },
  select: { id: true },
});
const validUserIds = existingUsers.map(u => u.id);
```

#### Frontend Errors
```typescript
// Show error toast on mutation failure
onError: (error) => {
  toast.error('Failed to update member selection');
  console.error(error);
}
```

### 6. Testing Strategy

#### Unit Tests

**Backend Tests:** `server/src/admin/__tests__/settings.service.test.ts`
```typescript
describe('WeeklySummaryMembersConfig', () => {
  it('should save member selection config', async () => {
    const config = {
      includedUserIds: ['user-1', 'user-2'],
    };
    const result = await adminSettingsService.setWeeklySummaryMembersConfig(
      config,
      'admin-user-id'
    );
    expect(result.value.includedUserIds).toEqual(config.includedUserIds);
  });

  it('should retrieve member selection config', async () => {
    // Test retrieval
  });

  it('should handle empty selection', async () => {
    // Test empty array
  });

  it('should validate user IDs are UUIDs', async () => {
    // Test invalid UUIDs
  });
});
```

**Service Tests:** `server/src/summaries/__tests__/service.test.ts`
```typescript
describe('generateWeeklySummary with member selection', () => {
  it('should generate summaries for selected members only', async () => {
    // Mock config with selected users
    // Verify only those users get summaries
  });

  it('should generate summaries for all users when no config', async () => {
    // Test backwards compatibility
  });

  it('should handle empty member selection', async () => {
    // Verify graceful handling
  });
});
```

#### Integration Tests
1. Test full API flow: GET config → Update config → Generate summary
2. Verify authorization: Non-admin cannot access endpoints
3. Test UI: Selection persists across page refreshes

#### Manual Testing Checklist
- [ ] Admin can open member selection dialog
- [ ] All active users are displayed
- [ ] Checkboxes toggle correctly
- [ ] Changes persist after saving
- [ ] Weekly summary only includes selected members
- [ ] Non-admin users cannot access settings
- [ ] Edge case: Empty selection
- [ ] Edge case: All users deselected then reselected

## Implementation Steps

### Phase 1: Backend Foundation (Admin Settings)
1. Update `AdminSettingsService` with new schema and methods
2. Add validators in `admin/validators.ts`
3. Update `admin/controller.ts` with new endpoints
4. Add routes in `admin/routes.ts`
5. Write unit tests for settings service
6. Test API endpoints with Postman/curl

### Phase 2: Backend Integration (Weekly Summaries)
1. Update `WeeklySummariesService.generateWeeklySummary()` method
2. Add logic to filter users based on config
3. Handle backwards compatibility (no config = all users)
4. Write unit tests for filtered summary generation
5. Test integration with existing summary flow

### Phase 3: Frontend UI
1. Create `MemberSelectionSettings.tsx` component
2. Create `MemberSelectionButton.tsx` component
3. Add custom hooks in `useSummaries.ts`
4. Integrate into `WeeklySummariesView.tsx`
5. Add TypeScript types in `types/index.ts`
6. Test UI in development environment

### Phase 4: Testing & Documentation
1. Run all unit tests
2. Perform integration testing
3. Manual testing with checklist
4. Update user documentation
5. Update system guide
6. Security review

### Phase 5: Deployment
1. Build client and server
2. Run database health check (no migration needed)
3. Deploy to Railway
4. Verify in production
5. Monitor for errors

## File Changes Summary

### New Files
- `client/src/components/summaries/MemberSelectionSettings.tsx`
- `client/src/components/summaries/MemberSelectionButton.tsx`
- `docs/features/weekly-summary-member-selection-guide.md`

### Modified Files
- `server/src/admin/settings.service.ts` - Add member selection methods
- `server/src/admin/validators.ts` - Add validation schema
- `server/src/admin/controller.ts` - Add endpoints
- `server/src/admin/routes.ts` - Add routes
- `server/src/summaries/service.ts` - Update user filtering logic
- `client/src/hooks/useSummaries.ts` - Add custom hooks
- `client/src/components/summaries/WeeklySummariesView.tsx` - Add button
- `client/src/types/index.ts` - Add TypeScript types
- `packages/api/src/CLAUDE_SYSTEM_GUIDE.md` - Document new feature
- `packages/api/src/CALL_PIPELINE_DOCUMENTATION.md` - Update if needed

## API Specification

### GET /api/admin/settings/weekly-summary-members/config

**Authorization:** Admin only

**Response:**
```json
{
  "success": true,
  "data": {
    "key": "weekly_summary_members",
    "value": {
      "includedUserIds": ["uuid1", "uuid2"],
      "lastUpdatedBy": "admin-uuid",
      "lastUpdatedAt": "2025-10-23T10:00:00Z"
    },
    "updatedBy": "admin-uuid",
    "updatedAt": "2025-10-23T10:00:00Z"
  }
}
```

**Response (Not Configured):**
```json
{
  "success": true,
  "data": null
}
```

### PUT /api/admin/settings/weekly-summary-members/config

**Authorization:** Admin only

**Request Body:**
```json
{
  "includedUserIds": ["uuid1", "uuid2", "uuid3"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "key": "weekly_summary_members",
    "value": {
      "includedUserIds": ["uuid1", "uuid2", "uuid3"],
      "lastUpdatedBy": "admin-uuid",
      "lastUpdatedAt": "2025-10-23T10:30:00Z"
    },
    "updatedBy": "admin-uuid",
    "updatedAt": "2025-10-23T10:30:00Z"
  },
  "message": "Member selection updated successfully"
}
```

**Error Response (Invalid UUIDs):**
```json
{
  "success": false,
  "message": "Invalid request data",
  "errors": [
    {
      "path": ["includedUserIds", 0],
      "message": "Invalid uuid"
    }
  ]
}
```

**Error Response (Not Admin):**
```json
{
  "success": false,
  "error": "Admin access required"
}
```

## Backwards Compatibility

**Behavior:** When no member selection config exists:
- Default to including ALL active users (current behavior)
- Ensures feature is opt-in and doesn't break existing functionality
- Admins must explicitly configure member selection

## Performance Considerations

1. **Database Queries:**
   - Single additional query to fetch config (cached by React Query)
   - User filtering uses indexed `id` and `isActive` columns
   - Minimal performance impact

2. **Frontend:**
   - Member list loaded once and cached
   - Checkbox updates use local state (no network calls until save)

3. **Optimization:**
   - Consider caching config in memory for cron jobs
   - Future: Add Redis caching if needed

## Rollback Plan

If issues arise post-deployment:
1. Feature is additive - no database migrations
2. Can disable by deleting admin setting record
3. System falls back to default behavior (all users)
4. No data loss or corruption risk

## Future Enhancements

1. **Bulk Actions:** Select all / Deselect all buttons
2. **Search/Filter:** Search users by name or email
3. **Role-based Defaults:** Auto-select based on role
4. **History:** Track changes to member selection over time
5. **Notifications:** Notify users when included/excluded
6. **Analytics:** Track which members are most frequently included

## Questions for Clarification

1. ✅ Should deselecting all members be allowed? (Decision: Yes, no summaries generated)
2. ✅ What happens to inactive users? (Decision: Filter them out, only show active users)
3. ✅ Should there be a confirmation dialog when saving? (Decision: Yes, confirm action)
4. ✅ Should members be notified when excluded? (Decision: No, admin decision only)

## Success Criteria

1. ✅ Admin can view list of all team members
2. ✅ Admin can select/deselect members via checkboxes
3. ✅ Selection persists across sessions
4. ✅ Weekly summaries only generated for selected members
5. ✅ Non-admin users cannot access settings
6. ✅ All tests pass
7. ✅ Documentation updated
8. ✅ Feature deployed to production without issues

---

**Next Steps:** Begin Phase 1 implementation after plan approval.
