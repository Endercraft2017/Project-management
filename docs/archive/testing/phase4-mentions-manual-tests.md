# Phase 4: @Mentions - Manual Test Plan

## Test Environment
- **Browser**: Chrome/Firefox (latest)
- **Users**: 2-3 test accounts
- **Conversation**: DM or Group chat with multiple members

## Prerequisites
1. Server running on Railway or localhost
2. Client running on localhost:5173 or production
3. Multiple user accounts created
4. At least one conversation with 2+ members

---

## Test Suite

### Test 1: @ Autocomplete Trigger
**Objective**: Verify @ character triggers member autocomplete

**Steps**:
1. Log in as User 1
2. Open a conversation
3. Click on message input
4. Type `@`

**Expected Results**:
- ✅ Autocomplete dropdown appears above input
- ✅ Dropdown shows all conversation members
- ✅ Each member shows avatar, name, and email
- ✅ Dropdown is positioned correctly

**Status**: [ ] Pass [ ] Fail

**Notes**:

---

### Test 2: Autocomplete Search Filter
**Objective**: Verify search filters members as you type

**Steps**:
1. Type `@j` (or first letter of a member's name)
2. Continue typing more letters

**Expected Results**:
- ✅ Dropdown filters to show only matching members
- ✅ Filter is case-insensitive
- ✅ Shows "No results" or empty state if no matches

**Status**: [ ] Pass [ ] Fail

**Notes**:

---

### Test 3: Keyboard Navigation - Arrow Keys
**Objective**: Verify arrow keys navigate dropdown

**Steps**:
1. Type `@`
2. Press ↓ arrow key multiple times
3. Press ↑ arrow key
4. Press ↓ until last item
5. Press ↓ again (should not go beyond last)

**Expected Results**:
- ✅ ↓ moves selection down
- ✅ ↑ moves selection up
- ✅ Selected item highlighted with accent background
- ✅ Cannot select beyond first/last item
- ✅ Selected item scrolls into view

**Status**: [ ] Pass [ ] Fail

**Notes**:

---

### Test 4: Keyboard Navigation - Enter/Tab to Select
**Objective**: Verify Enter or Tab inserts selected mention

**Steps**:
1. Type `@`
2. Use arrow keys to select a member
3. Press Enter (or Tab)

**Expected Results**:
- ✅ Mention inserted in format: `@[userId](userName) `
- ✅ Autocomplete closes
- ✅ Cursor positioned after mention + space
- ✅ Can continue typing normally

**Status**: [ ] Pass [ ] Fail

**Notes**:

---

### Test 5: Keyboard Navigation - Escape to Close
**Objective**: Verify Escape closes autocomplete

**Steps**:
1. Type `@`
2. Press Escape key

**Expected Results**:
- ✅ Autocomplete closes
- ✅ @ character remains in input
- ✅ Cursor stays at position

**Status**: [ ] Pass [ ] Fail

**Notes**:

---

### Test 6: Click to Insert Mention
**Objective**: Verify clicking member inserts mention

**Steps**:
1. Type `@`
2. Click on a member in dropdown

**Expected Results**:
- ✅ Mention inserted in format: `@[userId](userName) `
- ✅ Autocomplete closes
- ✅ Cursor positioned after mention + space

**Status**: [ ] Pass [ ] Fail

**Notes**:

---

### Test 7: @ Only After Space or Start
**Objective**: Verify @ only triggers at valid positions

**Steps**:
1. Type `test@` (no space before @)
2. Observe behavior
3. Type `test @` (with space)
4. Observe behavior

**Expected Results**:
- ✅ `test@` does NOT trigger autocomplete
- ✅ `test @` DOES trigger autocomplete
- ✅ @ at start of input triggers autocomplete

**Status**: [ ] Pass [ ] Fail

**Notes**:

---

### Test 8: Send Message with Mention
**Objective**: Verify message with mention sends correctly

**Steps**:
1. Type `Hey @` and select a member
2. Complete the message: `Hey @[userId](UserName) can you review this?`
3. Press Enter or click Send

**Expected Results**:
- ✅ Message sends successfully
- ✅ Message appears in chat
- ✅ Mention is highlighted in message
- ✅ Storage format preserved in database

**Status**: [ ] Pass [ ] Fail

**Notes**:

---

### Test 9: Mention Display - Regular Mention
**Objective**: Verify mentions display with correct styling

**Steps**:
1. Send a message mentioning another user (not yourself)
2. Observe the sent message

**Expected Results**:
- ✅ Mention displays as `@UserName` (not full storage format)
- ✅ Mention has blue/primary background (.mention class)
- ✅ Mention is slightly elevated/highlighted
- ✅ Hover shows tooltip with username

**Status**: [ ] Pass [ ] Fail

**Notes**:

---

### Test 10: Mention Display - Self Mention
**Objective**: Verify current user's mentions are highlighted differently

**Steps**:
1. Log in as User 2 (the mentioned user from Test 8)
2. View the conversation
3. Look at the message that mentions you

**Expected Results**:
- ✅ Your mention has orange/warning background (.mention-you class)
- ✅ Your mention is more prominent than regular mentions
- ✅ Hover shows "You were mentioned" tooltip
- ✅ Different color from regular mentions

**Status**: [ ] Pass [ ] Fail

**Notes**:

---

### Test 11: Multiple Mentions in One Message
**Objective**: Verify multiple mentions work correctly

**Steps**:
1. Type `@` and select User A
2. Type ` and @` and select User B
3. Complete message and send

**Expected Results**:
- ✅ Both mentions inserted correctly
- ✅ Both mentions highlighted in sent message
- ✅ Both users stored in mentions array
- ✅ Both mentions display with correct styling

**Status**: [ ] Pass [ ] Fail

**Notes**:

---

### Test 12: Mention Validation - Non-Member
**Objective**: Verify non-members cannot be mentioned

**Steps**:
1. In a DM with User A
2. Try to manually paste mention of User C (not in DM)
3. Send message

**Expected Results**:
- ✅ Message sends (content not blocked)
- ✅ Invalid mention NOT stored in database
- ✅ Only valid member mentions saved
- ✅ Backend filters out invalid mentions

**Status**: [ ] Pass [ ] Fail

**Notes**:

---

### Test 13: Mentions in Thread Replies
**Objective**: Verify mentions work in thread replies

**Steps**:
1. Open a thread sidebar
2. Type `@` in thread reply input
3. Select a member and send

**Expected Results**:
- ✅ Autocomplete shows conversation members
- ✅ Mention inserts correctly
- ✅ Thread reply sends with mention
- ✅ Mention displays in thread sidebar

**Status**: [ ] Pass [ ] Fail

**Notes**:

---

### Test 14: Mention Notification (Socket.IO)
**Objective**: Verify mentioned users receive real-time notification

**Steps**:
1. Open browser with User 1 logged in
2. Open another browser/incognito with User 2 logged in
3. User 1 sends message mentioning User 2
4. Observe User 2's browser

**Expected Results**:
- ✅ User 2 receives mention_notification event
- ✅ Event includes messageId, senderId, senderName, content
- ✅ Notification appears in real-time
- ✅ User 1 does NOT receive notification for mentioning User 2

**Status**: [ ] Pass [ ] Fail

**Notes**:

---

### Test 15: Auto-resize Textarea
**Objective**: Verify textarea auto-resizes with content

**Steps**:
1. Type a long message with multiple lines
2. Type `@` and insert mention
3. Continue typing

**Expected Results**:
- ✅ Textarea height increases as content grows
- ✅ Max height respected (150px)
- ✅ Scrollbar appears if content exceeds max height
- ✅ Min height respected (44px)

**Status**: [ ] Pass [ ] Fail

**Notes**:

---

### Test 16: Emoji + Mention Combination
**Objective**: Verify emoji picker works with mentions

**Steps**:
1. Type `Hello @` and insert mention
2. Click emoji picker button
3. Select an emoji
4. Send message

**Expected Results**:
- ✅ Emoji inserted after mention
- ✅ Both emoji and mention work correctly
- ✅ Message sends with both
- ✅ Both display correctly in sent message

**Status**: [ ] Pass [ ] Fail

**Notes**:

---

### Test 17: Edit Message with Mention
**Objective**: Verify editing preserves mentions

**Steps**:
1. Send a message with mention
2. Click Edit button
3. Modify text (not the mention)
4. Save

**Expected Results**:
- ✅ Message edits successfully
- ✅ Mention storage format preserved
- ✅ Mention still displays correctly
- ✅ Edited message shows (edited) label

**Status**: [ ] Pass [ ] Fail

**Notes**:

---

### Test 18: Dark Mode Mention Styling
**Objective**: Verify mentions look good in dark mode

**Steps**:
1. Toggle to dark mode
2. View messages with mentions
3. View your own mentions

**Expected Results**:
- ✅ Regular mentions visible in dark mode
- ✅ Self mentions visible in dark mode
- ✅ Colors contrast well with dark background
- ✅ Hover states work in dark mode

**Status**: [ ] Pass [ ] Fail

**Notes**:

---

### Test 19: Mobile/Responsive Autocomplete
**Objective**: Verify autocomplete works on mobile viewport

**Steps**:
1. Resize browser to mobile width (375px)
2. Type `@`
3. Navigate and select mention

**Expected Results**:
- ✅ Autocomplete dropdown fits in viewport
- ✅ Touch interactions work
- ✅ Dropdown doesn't overflow screen
- ✅ Scrolling works on touch devices

**Status**: [ ] Pass [ ] Fail

**Notes**:

---

### Test 20: Network Error Handling
**Objective**: Verify graceful handling of API errors

**Steps**:
1. Open DevTools Network tab
2. Type `@` (triggers members fetch)
3. Simulate network offline or block API call
4. Observe behavior

**Expected Results**:
- ✅ No crash or white screen
- ✅ Autocomplete shows empty or error state
- ✅ User can still type and send message
- ✅ Console shows error (not user-facing)

**Status**: [ ] Pass [ ] Fail

**Notes**:

---

## Test Summary

**Total Tests**: 20
**Passed**: ___ / 20
**Failed**: ___ / 20

**Critical Issues Found**:
1.
2.
3.

**Minor Issues Found**:
1.
2.
3.

**Recommendations**:
1.
2.
3.

---

## Sign-off

**Tester**: _______________
**Date**: _______________
**Overall Status**: [ ] PASS [ ] FAIL
**Ready for Production**: [ ] YES [ ] NO

**Notes**:
