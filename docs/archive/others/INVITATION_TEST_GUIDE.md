# Invitation Flow Test Guide

## Quick Browser Console Test

Open your browser console (F12) on http://localhost:5173 while logged in as admin, and run this:

```javascript
// Test invitation flow for test@servicebay.ai
async function testInvitation() {
  console.log('🧪 Testing invitation flow...\n');

  // Step 1: Send invitation
  console.log('📤 Step 1: Sending invitation...');
  try {
    const inviteResponse = await fetch('/api/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        email: 'test@servicebay.ai',
        role: 'MEMBER'
      })
    });

    const inviteData = await inviteResponse.json();

    if (!inviteResponse.ok) {
      console.error('❌ Failed:', inviteData.message);
      return;
    }

    console.log('✅ Invitation sent!');
    console.log('   Email:', inviteData.data.email);
    console.log('   Role:', inviteData.data.role);
    console.log('   Status:', inviteData.data.status);

    if (inviteData.data.token) {
      console.log('   Token:', inviteData.data.token.substring(0, 30) + '...');
      console.log('   🔗 Invite Link:', window.location.origin + '/accept-invite?token=' + inviteData.data.token);
    } else {
      console.warn('   ⚠ No token (this might be a reactivation)');
    }

    // Step 2: Verify it appears in pending invites
    console.log('\n📋 Step 2: Checking pending invitations...');
    const invitesResponse = await fetch('/api/invites?status=PENDING', {
      credentials: 'include'
    });
    const invitesData = await invitesResponse.json();

    const testInvite = invitesData.data.find(inv => inv.email === 'test@servicebay.ai');

    if (testInvite) {
      console.log('✅ Found in pending invitations');
      console.log('   Status:', testInvite.status);
    } else {
      console.error('❌ NOT found in pending invitations!');
    }

    // Step 3: Verify user is NOT in active members
    console.log('\n👥 Step 3: Checking active members...');
    const usersResponse = await fetch('/api/users?isActive=true', {
      credentials: 'include'
    });
    const usersData = await usersResponse.json();

    const testUser = usersData.data.users.find(u => u.email === 'test@servicebay.ai');

    if (testUser) {
      console.error('❌ User SHOULD NOT be in active members yet!');
      console.error('   This means invitation system is NOT working');
    } else {
      console.log('✅ User correctly NOT in active members');
      console.log('   Waiting for invitation acceptance');
    }

    console.log('\n🎉 TEST COMPLETE!');
    console.log('\nNext: Have test@servicebay.ai user sign in via the invite link');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the test
testInvitation();
```

---

## Manual Testing Steps

### Part 1: Send Invitation (Admin)

1. **Login as Admin**
   - Go to http://localhost:5173
   - Sign in with your admin Google account

2. **Navigate to Team Tab**
   - Click "Team" in the left sidebar

3. **Send Invitation**
   - Click "Invite Members" button (top right)
   - Enter email: `test@servicebay.ai`
   - Select role: `MEMBER`
   - Click "Send Invitation"

4. **Verify Invitation Created**
   - ✅ Toast should say: "Invitation sent!" (or "Member reactivated!" if user existed before)
   - ✅ Check "Pending Invitations" section - should see test@servicebay.ai with status "Pending"
   - ❌ Check "Team Members" section - should NOT see test@servicebay.ai yet

### Part 2: Accept Invitation (New User)

5. **Get Invitation Link**
   - From the invite dialog, copy the invitation link
   - OR check server logs for the token
   - Link format: `http://localhost:5173/accept-invite?token=<TOKEN>`

6. **Open Invitation Link (New Browser/Incognito)**
   - Open the link in an incognito window or different browser
   - You should see the "Accept Invitation" page

7. **Sign In with Google**
   - Click "Sign in with Google"
   - Use test@servicebay.ai account
   - Complete Google OAuth

8. **Verify User Created**
   - Should be redirected to the main app
   - Should be logged in as test@servicebay.ai

### Part 3: Verify in Admin View

9. **Back to Admin Account**
   - Go back to admin browser/window
   - Refresh the Team page

10. **Verify Changes**
    - ✅ test@servicebay.ai should now be in "Team Members" section
    - ✅ test@servicebay.ai should be REMOVED from "Pending Invitations"
    - ✅ Invitation status should be "Accepted" in database

---

## Expected Results Summary

| Step | What Should Happen | What Should NOT Happen |
|------|-------------------|------------------------|
| After sending invite | Appears in "Pending Invitations" | Should NOT be in "Team Members" |
| Before acceptance | Email sent to user | User cannot login yet |
| After OAuth sign-in | User created from invite | Should match invite role |
| After acceptance | User in "Team Members" | Removed from "Pending Invitations" |

---

## Troubleshooting

### Issue: User appears in Team Members immediately
**Cause**: OAuth is still bypassing invitation system
**Check**: Look at server logs when user signs in
**Expected log**: `OAuth: Created new user from invitation: test@servicebay.ai with role: MEMBER`
**Bad log**: `OAuth: Created new user: test@servicebay.ai`

### Issue: Invitation says "User already exists"
**Cause**: User was previously added/removed
**Solution**: This is correct behavior - user is being reactivated instead

### Issue: User cannot sign in (No invitation found)
**Cause**: Invitation expired or was revoked
**Solution**: Send a new invitation

---

## Database Check (Optional)

If you want to verify at the database level:

```sql
-- Check pending invitations
SELECT email, role, status, "expiresAt", "createdAt"
FROM "TeamInvite"
WHERE email = 'test@servicebay.ai';

-- Check if user exists
SELECT email, role, "isActive", "createdAt"
FROM "User"
WHERE email = 'test@servicebay.ai';
```

---

## Test Script Alternative

If you prefer automated testing, ensure you're logged in first:

```bash
# Make sure server is running
npm run dev

# In another terminal, run test (while logged in to browser)
node test-invitation-flow.js
```

The script will check:
1. ✅ Your authentication status
2. ✅ If test user already exists
3. ✅ Send invitation
4. ✅ Verify invitation is pending
5. ✅ Verify user is NOT active yet

---

## Success Criteria

✅ **Test PASSES if:**
- Invitation appears in "Pending Invitations" after creation
- User does NOT appear in "Team Members" until they sign in
- User can sign in via invitation link
- After sign-in, user appears in "Team Members"
- Invitation status changes to "Accepted"

❌ **Test FAILS if:**
- User appears in "Team Members" immediately after invitation
- User can sign in without invitation
- Invitation stays "Pending" after user signs in
