# Phase 4: @Mentions - Bug Fixes Documentation

## Overview
This document details the 6 critical issues discovered and fixed during Phase 4 @Mentions manual testing.

**Testing Date**: 2025-10-12
**Testing Environment**: Railway Production
**Testing Method**: Manual browser testing with Admin and Test accounts

---

## Issue #1: Chat Messages Not Sending

### Symptom
- Messages not appearing in chat
- No logs in server console
- Socket.IO connection established but messages failing silently

### User Report
> "Chat is not working, there are no message being sent logs in logs.md"

### Error in Logs
```
[Socket.IO] Error in join_conversation: Expected object, received string
```

### Root Cause
Socket.IO client was sending raw strings instead of objects. The Zod validator on the server expected structured objects:

**WRONG (Before)**:
```typescript
export function joinConversation(conversationId: string): void {
  emit('join_conversation', conversationId); // ❌ Sending string
}
```

**CORRECT (After)**:
```typescript
export function joinConversation(conversationId: string): void {
  emit('join_conversation', { conversationId }); // ✅ Sending object
}
```

### Fix Applied
Updated 4 Socket.IO emit functions:
- `joinConversation()`
- `leaveConversation()`
- `startTyping()`
- `stopTyping()`

### Files Changed
- [client/src/lib/socket.ts](../../client/src/lib/socket.ts) - Updated emit calls
- [client/src/types/index.ts](../../client/src/types/index.ts) - Updated SocketEvents interface

### Commit
`482af4f` - Fix Socket.IO event payload format

### Status
✅ FIXED - Deployed to Railway

---

## Issue #2: Mention Display Shows Raw Format

### Symptom
Input textarea displayed raw mention format: `@[85937c5d-d34e-4ac0-9a1e-3e993737af05](Test Account)` instead of styled chip like `@test`

### User Request
> "is there no way to actually show something like '@test' maybe hide the long id inside a ref link or something?"

### Initial Solution (Inadequate)
Added hint text: "✓ Mentions will be formatted after sending" - but user wanted better UX during input.

### Better Solution
Implemented contenteditable-based mention chip system:

**Display Format (User sees)**:
```html
<span class="mention-chip" data-user-id="userId">@UserName</span>
```

**Storage Format (Backend receives)**:
```
@[userId](userName)
```

### Implementation Details

#### New Component: `MentionInputV2.tsx`
- Uses `contenteditable` div instead of `<textarea>`
- Converts between display and storage formats dynamically
- Maintains cursor position during typing
- Supports keyboard shortcuts (Enter to submit, Shift+Enter for newline)

#### Format Conversion Functions

**Display Format (HTML)**:
```typescript
const getDisplayHTML = (text: string): string => {
  return text.replace(
    /@\[([a-f0-9-]{36})\]\(([^)]+)\)/g,
    '<span class="mention-chip" data-user-id="$1" contenteditable="false">@$2</span>'
  );
};
```

**Storage Format (Plain Text)**:
```typescript
const getStoredValue = (): string => {
  const clone = contentEditableRef.current.cloneNode(true) as HTMLElement;
  const mentionChips = clone.querySelectorAll('.mention-chip');
  mentionChips.forEach((chip) => {
    const userId = chip.getAttribute('data-user-id');
    const userName = chip.textContent?.replace('@', '') || '';
    const textNode = document.createTextNode(`@[${userId}](${userName})`);
    chip.parentNode?.replaceChild(textNode, chip);
  });
  return clone.textContent?.trim() || '';
};
```

### CSS Styling
```css
.mention-chip {
  @apply inline-flex items-center px-2 py-0.5 mx-0.5 rounded-md
         bg-primary/20 text-primary font-medium cursor-default select-none;
}

.mention-chip:hover {
  @apply bg-primary/30;
}
```

### Files Changed
- Created [client/src/components/chat/MentionInputV2.tsx](../../client/src/components/chat/MentionInputV2.tsx) - New component (230 lines)
- Updated [client/src/components/chat/MessageInput.tsx](../../client/src/components/chat/MessageInput.tsx) - Use MentionInputV2
- Updated [client/src/index.css](../../client/src/index.css) - Added mention chip styles

### Commit
`046620c` - Implement visual mention chips with contenteditable

### Status
✅ ENHANCED - Deployed to Railway

---

## Issue #3: Cursor Jumping to Start

### Symptom
Every keystroke caused cursor to jump to beginning of input field, making typing impossible.

### User Report
> "everytime I type a letter or anything the cursor goes back to the start so I need to move it back everytime I type a letter"

### Root Cause
The `useEffect` hook was updating `innerHTML` on every `value` change, including during user typing:

**WRONG (Before)**:
```typescript
useEffect(() => {
  const displayHTML = getDisplayHTML(value);
  contentEditableRef.current.innerHTML = displayHTML; // ❌ Always updates, resets cursor
}, [value]);
```

### Fix Applied
Only update `innerHTML` when field is NOT focused (i.e., when changes come from external props, not user typing):

**CORRECT (After)**:
```typescript
useEffect(() => {
  if (!contentEditableRef.current) return;
  const displayHTML = getDisplayHTML(value);
  const currentHTML = contentEditableRef.current.innerHTML;

  // ✅ Only update if different AND not focused
  if (displayHTML !== currentHTML && !contentEditableRef.current.matches(':focus')) {
    contentEditableRef.current.innerHTML = displayHTML || '';
  }
}, [value]);
```

### Files Changed
- [client/src/components/chat/MentionInputV2.tsx](../../client/src/components/chat/MentionInputV2.tsx) - Added focus check

### Commit
`a59c111` - Fix cursor jumping in MentionInputV2

### Status
✅ FIXED - Deployed to Railway - User confirmed working

---

## Issue #4: Messages Not Persisting

### Symptom
- Messages sent but not appearing in chat
- No errors in client console
- Database check showed no messages being saved

### User Report
> "I still cannot see the sent and received messages and there are no errors on the logs either"

### Error in Logs
```
POST https://.../api/conversations/:id/messages 404 (Not Found)
```

### Root Cause
The REST API endpoint was **completely missing** from the backend! The route was never defined.

### Fix Applied

#### 1. Created Controller Function
Added `sendMessage()` to [server/src/chat/controller.ts](../../server/src/chat/controller.ts):

```typescript
/**
 * Send a message to a conversation (REST API endpoint)
 */
export async function sendMessage(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const conversationId = req.params.id;

    // Validate request body (only content, conversationId from URL)
    const data = sendMessageBodySchema.parse(req.body);

    // Verify user is a member
    const isMember = await conversationService.isMemberOfConversation(conversationId, userId);

    if (!isMember) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Not a member of this conversation',
      });
    }

    // Send message using message service
    const message = await messageService.sendMessage(conversationId, userId, data.content);

    console.log('[Chat] Message sent via REST API:', message.id);

    res.status(201).json({
      success: true,
      data: message,
    });
  } catch (error: any) {
    // ... error handling
  }
}
```

#### 2. Added Route Definition
Updated [server/src/chat/routes.ts](../../server/src/chat/routes.ts):

```typescript
/**
 * POST /api/conversations/:id/messages
 * Send a message to a conversation
 */
router.post('/:id/messages', isAuthenticated, chatController.sendMessage);
```

### Files Changed
- [server/src/chat/controller.ts](../../server/src/chat/controller.ts) - Added sendMessage function (66 lines)
- [server/src/chat/routes.ts](../../server/src/chat/routes.ts) - Added POST route

### Commit
`e54a0b2` - Add missing REST API endpoint for sending messages

### Status
✅ FIXED - Deployed to Railway

---

## Issue #5: Zod Validation Error

### Symptom
After fixing Issue #4, new error appeared:
```
POST .../messages 400 (Bad Request)
API Error: Required
```

### User Report
Provided logs showing 400 error after previous 404 was fixed.

### Root Cause
Used wrong Zod schema. The `sendMessageSchema` expected both fields in request body:

**WRONG Schema (Before)**:
```typescript
export const sendMessageSchema = z.object({
  conversationId: z.string().uuid(), // ❌ This comes from URL params, not body!
  content: z.string().min(1).max(10000).trim(),
});
```

But in REST API:
- `conversationId` comes from URL params: `/api/conversations/:id/messages`
- Only `content` is in request body

### Fix Applied

#### 1. Created New Schema
Added to [server/src/chat/validators.ts](../../server/src/chat/validators.ts):

```typescript
/**
 * Send message body schema (REST API)
 * For POST /api/conversations/:id/messages
 * conversationId comes from URL params, only content in body
 */
export const sendMessageBodySchema = z.object({
  content: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(10000, 'Message too long (max 10,000 characters)')
    .trim(),
});

export type SendMessageBody = z.infer<typeof sendMessageBodySchema>;
```

#### 2. Updated Controller
Changed [server/src/chat/controller.ts](../../server/src/chat/controller.ts):

```typescript
// Before:
const data = sendMessageSchema.parse(req.body); // ❌ Wrong schema

// After:
const data = sendMessageBodySchema.parse(req.body); // ✅ Correct schema
```

### Files Changed
- [server/src/chat/validators.ts](../../server/src/chat/validators.ts) - Added sendMessageBodySchema
- [server/src/chat/controller.ts](../../server/src/chat/controller.ts) - Use correct schema

### Commit
`4948308` - Fix Zod validation: Use sendMessageBodySchema for REST API

### Status
✅ FIXED - Deployed to Railway - User confirmed "The message is now being sent"

---

## Issue #6: Receiver UI Crashes

### Symptom
- Sender successfully sends message
- Receiver's UI crashes when opening chat tab
- TypeError in console

### User Report
> "The message is now being sent, but the UI breaks on the receiver when I pressed the chat tab"

### Error in Logs
```
TypeError: Cannot read properties of undefined (reading 'picture')
at k4e (index-uoq0IkYW.js:431:19194)
```

### Root Cause
Message object returned from REST API had mismatched structure:

**Frontend Expected (TypeScript Interface)**:
```typescript
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  sender?: User; // ✅ Nested object with { id, name, picture }
  content: string;
  // ... more fields
}
```

**Backend Returned (Flattened Object)**:
```typescript
return {
  id: message.id,
  conversationId: message.conversationId,
  senderId: message.senderId,
  senderName: message.sender.name,      // ❌ Flattened
  senderAvatarUrl: message.sender.picture, // ❌ Flattened
  content: message.content,
  // ...
};
```

When `MessageItem` component tried to render `message.sender.picture`, it crashed because `sender` was `undefined`.

### Fix Applied
Updated `sendMessage()` in [server/src/chat/message-service.ts](../../server/src/chat/message-service.ts):

**Before (Flattened)**:
```typescript
return {
  id: message.id,
  conversationId: message.conversationId,
  senderId: message.senderId,
  senderName: message.sender.name,      // ❌ Flattened
  senderAvatarUrl: message.sender.picture, // ❌ Flattened
  content: message.content,
  mentions: message.mentions,
  isEdited: message.isEdited,
  isDeleted: message.isDeleted,
  createdAt: message.createdAt,
  updatedAt: message.updatedAt,
};
```

**After (Nested Object)**:
```typescript
return {
  id: message.id,
  conversationId: message.conversationId,
  senderId: message.senderId,
  sender: {                             // ✅ Nested object
    id: message.sender.id,
    name: message.sender.name,
    picture: message.sender.picture,
  },
  content: message.content,
  mentions: message.mentions,
  isEdited: message.isEdited,
  isDeleted: message.isDeleted,
  threadRepliesCount: 0,                // ✅ Required by frontend type
  createdAt: message.createdAt,
  updatedAt: message.updatedAt,
};
```

### Files Changed
- [server/src/chat/message-service.ts](../../server/src/chat/message-service.ts):67-83 - Return nested sender object

### Impact
- ✅ Aligns with frontend `Message` interface
- ✅ Prevents UI crashes on receiver side
- ✅ Sender avatar and name display correctly
- ✅ Compatible with existing `MessageItem` component

### Commit
Not yet committed - awaiting user verification

### Status
✅ FIXED - Deployed to Railway - **Awaiting user verification**

---

## Summary

### Total Issues Fixed: 6

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | Socket.IO event format mismatch | 🔴 Critical | ✅ Fixed |
| 2 | Raw mention format in input | 🟡 Medium | ✅ Enhanced |
| 3 | Cursor jumping to start | 🔴 Critical | ✅ Fixed |
| 4 | Missing REST API endpoint | 🔴 Critical | ✅ Fixed |
| 5 | Zod validation schema mismatch | 🔴 Critical | ✅ Fixed |
| 6 | Sender data missing in response | 🔴 Critical | ✅ Fixed |

### Commits
1. `482af4f` - Fix Socket.IO event payload format
2. `911c9b3` - Add mention format hint (superseded by #3)
3. `046620c` - Implement visual mention chips with contenteditable
4. `a59c111` - Fix cursor jumping in MentionInputV2
5. `e54a0b2` - Add missing REST API endpoint for sending messages
6. `4948308` - Fix Zod validation: Use sendMessageBodySchema for REST API
7. (Pending) - Fix sender data missing in message REST API response

### Files Modified
**Frontend**: 4 files
- `client/src/lib/socket.ts`
- `client/src/types/index.ts`
- `client/src/components/chat/MessageInput.tsx`
- `client/src/components/chat/MentionInputV2.tsx` (new)
- `client/src/index.css`

**Backend**: 4 files
- `server/src/chat/controller.ts`
- `server/src/chat/routes.ts`
- `server/src/chat/validators.ts`
- `server/src/chat/message-service.ts`

### Key Learnings

1. **Socket.IO Type Safety**: Always send structured objects matching Zod schemas, never raw primitives
2. **UX vs Storage Format**: User-facing display can differ from backend storage format using contenteditable
3. **Cursor Position Management**: Never update DOM innerHTML while user is actively typing (check `:focus`)
4. **REST vs WebSocket Schemas**: Different transports may need different validation schemas
5. **API Response Format**: Always align backend response structure with frontend TypeScript interfaces
6. **Testing Strategy**: Test both sender and receiver perspectives to catch data serialization issues

### Next Steps
1. ✅ All 6 issues fixed and deployed
2. ⏳ User verification required for Issue #6 fix
3. ⏳ Continue with remaining manual tests:
   - Keyboard navigation (↑↓, Tab, Esc)
   - Mention highlighting in messages
   - Self-mention styling (.mention-you)
   - Multiple mentions in one message
   - Thread reply mentions
   - Socket.IO notifications
   - Dark mode styling
   - Mobile responsiveness

---

**Documentation Date**: 2025-10-12
**Last Updated**: After Issue #6 fix deployed
**Status**: All critical bugs fixed, awaiting final verification
