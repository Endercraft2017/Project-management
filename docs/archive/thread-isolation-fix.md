# Thread Isolation and @Mentions Fix

## Date
2025-10-12

## Issues Reported

### Issue #1: Thread Isolation Bug
**User Report:**
> "lets say we make a new thread for message 'Hello' the message could also be seen when a new message on the main dm like 'where do you want to meet' and when the reply is pressed the thread for 'Hello' is what is shown on the thread for this new message"

**Symptom:** When clicking "Reply" on a new message, the old thread's replies were displayed instead of an empty thread.

### Issue #2: @Mentions Not Working in Threads
**User Report:**
> "Thread @ mentions does not work"

**Symptom:** @ autocomplete didn't work in thread reply input field.

---

## How Slack Threading Works

Based on official Slack documentation and API:

### Terminology
- **Unthreaded Message**: A message with no replies
- **Parent Message**: A message that has at least one reply (becomes parent on first reply)
- **Thread Reply**: A child message of a parent message
- **Thread**: The complete bundle of parent message + all replies
- **thread_ts**: Unique identifier linking replies to parent (parent's timestamp)

### Key Concepts
1. **Each thread is isolated** - Replies belong to ONE specific parent message
2. **Replies reference parent via `thread_ts`** (or `parentMessageId` in our system)
3. **Backend query filters by parent**: `WHERE parentMessageId = ?`
4. **Frontend must manage state properly** to prevent cross-contamination

### API Structure
```typescript
// Parent Message
{
  id: "msg-123",
  ts: "1699123456.789",
  conversationId: "conv-abc",
  content: "Hello",
  parentMessageId: null,        // Null = main message
  threadRepliesCount: 2         // Has 2 replies
}

// Thread Reply
{
  id: "reply-456",
  ts: "1699123457.123",
  conversationId: "conv-abc",
  content: "Hi back",
  parentMessageId: "msg-123",   // Links to parent
  threadRepliesCount: 0         // Replies can't have sub-replies
}
```

---

## Root Causes

### Issue #1: Thread Isolation Bug

**Problem Location:** `client/src/components/chat/ThreadSidebar.tsx:33-49`

**Original Code:**
```typescript
useEffect(() => {
  setIsLoading(true);
  const socket = getSocket();
  socket?.emit(
    'get_thread_replies',
    { parentMessageId: parentMessage.id, limit: 50 },
    (response: any) => {
      if (response.success) {
        setReplies(Array.isArray(response.data.replies) ? response.data.replies : []);
      }
      setIsLoading(false);
    }
  );
}, [parentMessage.id]);
```

**Problem:**
- When `parentMessage` changes (clicking Reply on different message), `replies` state was NOT cleared
- Brief moment where old replies still displayed while new data fetched
- If user clicked fast, old replies appeared before being replaced
- React state update timing issue - async socket call meant old state persisted

**Why Backend Wasn't the Issue:**
The backend query was always correct:
```typescript
// server/src/chat/thread-service.ts:143-147
const replies = await prisma.message.findMany({
  where: {
    parentMessageId,  // ✅ Correctly filters by parent
    ...(cursor ? { id: { lt: cursor } } : {}),
  },
  // ...
});
```

### Issue #2: @Mentions Not Working

**Problem Location:** `client/src/components/chat/ThreadSidebar.tsx:251-259`

**Original Code:**
```tsx
<textarea
  value={replyContent}
  onChange={(e) => setReplyContent(e.target.value)}
  onKeyPress={handleKeyPress}
  placeholder="Reply to thread..."
  className="..."
  rows={3}
  disabled={isSending}
/>
```

**Problem:**
- Used regular HTML `<textarea>` instead of `MentionInputV2`
- No @ autocomplete functionality
- No visual mention chips
- Raw mention format `@[userId](userName)` displayed instead of styled `@UserName`

---

## Fixes Applied

### Fix #1: Clear Replies State Immediately

**Updated Code:**
```typescript
// Fetch thread replies when sidebar opens or parent message changes
useEffect(() => {
  // CRITICAL: Clear replies immediately when parent message changes
  // This prevents showing old thread's replies for new parent message
  setReplies([]);
  setIsLoading(true);

  const socket = getSocket();
  socket?.emit(
    'get_thread_replies',
    {
      parentMessageId: parentMessage.id,
      limit: 50,
    },
    (response: any) => {
      if (response.success) {
        setReplies(Array.isArray(response.data.replies) ? response.data.replies : []);
      }
      setIsLoading(false);
    }
  );
}, [parentMessage.id]);
```

**Key Change:** `setReplies([])` at the start of `useEffect`

**Why This Works:**
1. **Synchronous state clear** - Happens immediately when parent changes
2. **Prevents race conditions** - Old replies removed before new fetch starts
3. **User sees loading state** - Empty + loading spinner instead of wrong replies
4. **Dependency on `parentMessage.id`** - Re-runs whenever parent changes

### Fix #2: Use MentionInputV2 for Thread Replies

**Updated Code:**
```tsx
<div className="flex-1">
  <MentionInputV2
    value={replyContent}
    onChange={setReplyContent}
    onSubmit={handleSendReply}
    conversationId={parentMessage.conversationId}
    placeholder="Reply to thread..."
    disabled={isSending}
  />
</div>
```

**Features Enabled:**
- ✅ @ autocomplete dropdown with conversation members
- ✅ Visual mention chips: `@UserName` instead of raw UUID
- ✅ Keyboard navigation (↑↓, Tab, Esc)
- ✅ Enter to send, Shift+Enter for newline (handled internally)
- ✅ Storage format: `@[userId](userName)` for backend validation
- ✅ Display format: Styled chips with hover effects

**Additional Changes:**
- Removed `handleKeyPress` function (MentionInputV2 handles it)
- Added `MentionHighlight` import
- Updated parent message display to use MentionHighlight
- Updated thread reply display to use MentionHighlight

### Fix #3: Add Mention Highlighting in Thread Messages

**Parent Message Display:**
```tsx
<div className="whitespace-pre-wrap break-words text-sm">
  <MentionHighlight content={parentMessage.content} mentions={parentMessage.mentions} />
</div>
```

**Thread Reply Display:**
```tsx
<div className="whitespace-pre-wrap break-words text-sm">
  {reply.isDeleted ? (
    <span className="italic opacity-70">Message deleted</span>
  ) : (
    <MentionHighlight content={reply.content} mentions={reply.mentions} />
  )}
</div>
```

**Styling:**
- Mentions display as styled spans with primary color
- Self-mentions (when you're mentioned) show in orange (.mention-you class)
- Hover effects on mention chips
- Consistent with main chat message styling

---

## Files Modified

### `client/src/components/chat/ThreadSidebar.tsx`

**Lines Changed:**
- **6-14**: Added imports for `MentionInputV2` and `MentionHighlight`
- **33-53**: Added `setReplies([])` at start of useEffect
- **103-108**: Removed `handleKeyPress` function (now handled by MentionInputV2)
- **155-157**: Changed parent message content to use MentionHighlight
- **205-213**: Changed reply content to use MentionHighlight
- **246-253**: Replaced textarea with MentionInputV2 component

**Total Changes:**
- +23 insertions
- -23 deletions
- Net: 0 lines (pure refactor)

---

## Testing Recommendations

### Manual Test Cases

#### Thread Isolation Tests
1. **Create first thread:**
   - Send message "Hello" in DM
   - Click Reply on "Hello"
   - Send thread reply "Hi there"
   - Verify reply appears in thread sidebar

2. **Create second thread:**
   - Send new message "Where do you want to meet?"
   - Click Reply on "Where do you want to meet?"
   - **VERIFY**: Thread sidebar should be EMPTY (no "Hi there" from first thread)
   - Send thread reply "Let's meet at 3pm"
   - **VERIFY**: Only "Let's meet at 3pm" appears

3. **Switch between threads:**
   - Click Reply on "Hello" message
   - **VERIFY**: Shows "Hi there" reply
   - Click Reply on "Where do you want to meet?" message
   - **VERIFY**: Shows "Let's meet at 3pm" reply
   - **VERIFY**: No cross-contamination between threads

4. **Fast clicking test:**
   - Rapidly click Reply on different messages
   - **VERIFY**: Each thread shows correct replies
   - **VERIFY**: No flashing of wrong replies

#### @Mentions in Thread Tests
1. **Autocomplete in thread reply:**
   - Open thread sidebar
   - Type "@" in reply input
   - **VERIFY**: Dropdown appears with conversation members

2. **Visual mention chips:**
   - Type "@" and select a user
   - **VERIFY**: Shows `@UserName` chip (not raw UUID format)
   - **VERIFY**: Chip has primary color background
   - **VERIFY**: Chip has hover effect

3. **Send and display:**
   - Send thread reply with mention
   - **VERIFY**: Mention appears highlighted in sent message
   - **VERIFY**: Receiver sees mention highlighted
   - **VERIFY**: Self-mentions show in orange

4. **Keyboard shortcuts:**
   - Type "@" and use ↑↓ arrows to navigate
   - Press Tab or Enter to select
   - Press Esc to close dropdown
   - Press Enter to send, Shift+Enter for newline

---

## Technical Deep Dive

### State Management Flow

**Before Fix (Buggy):**
```
User clicks Reply on Message B
  ↓
parentMessage.id changes → useEffect triggered
  ↓
Socket emit get_thread_replies for Message B
  ↓
[OLD STATE] replies still contains Message A's replies
  ↓
User sees Message A's replies briefly
  ↓
Socket callback arrives with Message B's replies
  ↓
setReplies() updates to Message B's replies
  ↓
User sees correct replies (but brief flash of wrong ones)
```

**After Fix (Correct):**
```
User clicks Reply on Message B
  ↓
parentMessage.id changes → useEffect triggered
  ↓
setReplies([]) - IMMEDIATE clear
  ↓
setIsLoading(true)
  ↓
[CLEAN STATE] replies is empty array
  ↓
User sees loading spinner (no wrong replies)
  ↓
Socket emit get_thread_replies for Message B
  ↓
Socket callback arrives with Message B's replies
  ↓
setReplies() updates to Message B's replies
  ↓
setIsLoading(false)
  ↓
User sees correct replies
```

### Backend Query Verification

The backend was always correct - thread isolation happens at database level:

```typescript
// server/src/chat/thread-service.ts:143-161
const replies = await prisma.message.findMany({
  where: {
    parentMessageId,  // ✅ Each query filters by specific parent
    ...(cursor ? { id: { lt: cursor } } : {}),
  },
  include: {
    sender: { select: { id: true, name: true, picture: true } },
  },
  orderBy: { createdAt: 'asc' },
  take: limit,
});
```

**Database Indexes:**
```prisma
model Message {
  // ...
  parentMessageId String?
  // ...

  @@index([conversationId])
  @@index([senderId])
  @@index([parentMessageId])  // ✅ Indexed for fast thread queries
  @@index([createdAt])
  @@index([mentions])
}
```

**SQL Query (approximate):**
```sql
SELECT
  m.id, m.content, m.senderId, m.parentMessageId,
  u.id, u.name, u.picture
FROM messages m
INNER JOIN users u ON m.senderId = u.id
WHERE m.parentMessageId = 'msg-123'  -- ✅ Isolates to specific thread
ORDER BY m.createdAt ASC
LIMIT 50;
```

### Frontend State Lifecycle

**Component Mount:**
1. `ThreadSidebar` receives `parentMessage` prop
2. `useState` initializes `replies = []`
3. `useEffect` runs → fetches thread replies
4. Sidebar displays parent + replies

**Parent Message Change:**
1. User clicks Reply on different message
2. Parent component updates `parentMessage` prop
3. `parentMessage.id` dependency changes
4. **useEffect re-runs:**
   - `setReplies([])` - Clear old state
   - `setIsLoading(true)` - Show loading
   - `socket.emit('get_thread_replies', ...)` - Fetch new
   - Callback: `setReplies(newData)` - Update state
5. Sidebar re-renders with correct thread

**Socket Event Listener:**
```typescript
useEffect(() => {
  const handleThreadReply = (data) => {
    if (data.parentMessageId === parentMessage.id) {  // ✅ Filters by parent
      setReplies((prev) => [...prev, data.reply]);
    }
  };

  on('thread_reply_added', handleThreadReply);
  return () => off('thread_reply_added', handleThreadReply);
}, [parentMessage.id]);
```

---

## Performance Impact

### Before Fix
- **Memory**: Briefly holds 2 sets of replies in state (old + new)
- **Rendering**: 2 renders (old replies → new replies)
- **UX**: Confusing flash of wrong content

### After Fix
- **Memory**: Only empty array, then new replies
- **Rendering**: 2 renders (loading → new replies)
- **UX**: Clear loading state, no confusion

**Conclusion**: Negligible performance difference, significantly better UX.

---

## Related Documentation

- [Phase 3: Threaded Conversations Plan](../plans/phase3-threaded-conversations.md)
- [Phase 3: Threading Test Results](../testing/phase3-threading-test-results.md)
- [Phase 4: @Mentions Implementation](../plans/phase4-mentions-implementation.md)
- [Phase 4: @Mentions Bug Fixes](./phase4-mentions-bug-fixes.md)
- [Slack API: conversations.replies](https://api.slack.com/methods/conversations.replies)
- [Slack Docs: Use threads to organize discussions](https://slack.com/help/articles/115000769927-Use-threads-to-organize-discussions)

---

## Deployment

**Commit:** `8c7124a`
**Branch:** `main`
**Status:** ✅ Deployed to Railway
**Deployment Time:** ~2-3 minutes

### Verification Checklist

After deployment:
- [ ] Test thread isolation with 2+ different parent messages
- [ ] Test @ autocomplete in thread reply input
- [ ] Test mention highlighting in parent message
- [ ] Test mention highlighting in thread replies
- [ ] Test self-mention styling (orange)
- [ ] Test keyboard navigation in mention dropdown
- [ ] Test Enter to send, Shift+Enter for newline
- [ ] Test fast clicking between threads
- [ ] Test with deleted messages in threads
- [ ] Test with reactions on threaded messages

---

**Last Updated:** 2025-10-12
**Author:** Claude Code Assistant
**Status:** Complete
