# Manual Test Checklist: Team Member Management

## Prerequisites
- Login as an ADMIN user
- Have at least one other member in the system

## Test 1: View Team Members
- [ ] Navigate to "Team" section in sidebar
- [ ] Verify "Team Members" section shows all active members
- [ ] Verify each member shows:
  - [ ] Avatar/Picture
  - [ ] Name
  - [ ] Email
  - [ ] Role badge (ADMIN/MEMBER)
  - [ ] Join date
- [ ] Verify current user shows "(You)" label
- [ ] Verify current user does NOT have "Remove" button

## Test 2: Error When Inviting Existing Member
- [ ] Click "Invite Members" button in header
- [ ] Enter email of an existing member (e.g., someone already in Team Members list)
- [ ] Select a role
- [ ] Click "Send Invitation"
- [ ] **Expected Result**: Toast notification appears with:
  - Title: "Member already exists" or "Failed to send invitation"
  - Description: Error message from backend (e.g., "User with this email already exists")
  - Variant: Error (red)

## Test 3: Remove Team Member
- [ ] In Team Members section, find a member (not yourself)
- [ ] Click "Remove" button
- [ ] **Expected**: Confirmation prompt appears with "Remove? Yes / No"
- [ ] Click "No"
  - [ ] **Expected**: Confirmation cancels, member still visible
- [ ] Click "Remove" again
- [ ] Click "Yes"
  - [ ] **Expected**:
    - Toast appears: "Member removed - {name} has been removed from the team"
    - Member disappears from the list
    - List refreshes automatically

## Test 4: Error Handling for Remove
- [ ] If using browser DevTools, block the DELETE request
- [ ] Try to remove a member
- [ ] **Expected**: Error toast appears with message

## Test 5: Invite New Member (Should Still Work)
- [ ] Click "Invite Members" button
- [ ] Enter a NEW email ending with @servicebay.ai
- [ ] Select a role
- [ ] Click "Send Invitation"
- [ ] **Expected**:
  - Success toast: "Invitation sent!"
  - Invite link appears in dialog
  - New invite appears in "Pending Invitations" section below

## Backend API Endpoints Being Used

1. **GET /api/users** - List all users
   - Used by: UsersList component
   - Returns: `{ success: true, data: { users: [], pagination: {} } }`

2. **DELETE /api/users/:id** - Deactivate/remove user
   - Used by: useDeactivateUser hook
   - Returns: 204 No Content on success

3. **POST /api/invites** - Create invitation
   - Used by: InviteUserDialog
   - Should return 400/409 error for existing users

## Code Review Checklist

### ✅ Verified Components:
- [x] UsersList.tsx - Shows users from `usersData?.data?.users`
- [x] useUsers hook - Returns correct structure matching backend
- [x] useDeactivateUser hook - Calls DELETE endpoint and invalidates cache
- [x] InviteUserDialog - Enhanced error handling for existing members
- [x] App.tsx - Integrates UsersList and passes currentUserId
- [x] TaskFilters/TaskForm - Updated to use `usersData?.data?.users`

### ✅ Type Safety:
- [x] TypeScript builds without errors (server and client)
- [x] Response structures match backend API

## Notes for Testing

**Important**: The actual email sending will NOT work unless SMTP credentials are configured in `server/.env`. However, the invite creation and error handling will still work - you just won't receive actual emails.

To test with SMTP (optional):
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=ServiceBay PM <noreply@servicebay.ai>
```
