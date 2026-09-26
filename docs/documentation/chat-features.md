# Chat System Features Documentation

## Overview
ServiceBay PM Chat is a comprehensive, real-time communication system designed for team collaboration, featuring direct messages, group conversations, threaded discussions, and modern chat UX patterns inspired by Slack and Microsoft Teams.

---

## Table of Contents
1. [Team Invitations](#1-team-invitations)
2. [Direct Messages (DM)](#2-direct-messages-dm)
3. [Group Conversations](#3-group-conversations)
4. [Threaded Conversations](#4-threaded-conversations)
5. [Message Reactions](#5-message-reactions)
6. [@Mentions](#6-mentions)
7. [Message Editing & Deletion](#7-message-editing--deletion)
8. [File Attachments](#8-file-attachments)
9. [Search](#9-search)
10. [Notifications](#10-notifications)
11. [Read Receipts](#11-read-receipts)
12. [Typing Indicators](#12-typing-indicators)
13. [Online/Offline Status](#13-onlineoffline-status)
14. [Keyboard Shortcuts](#14-keyboard-shortcuts)

---

## 1. Team Invitations

### Overview
Invite new team members via email with role-based access control. Similar to Slack's invitation system.

### Features

#### Sending Invitations (Admin Only)
- **Access**: Click "Invite Members" button in header
- **Required**: Valid @servicebay.ai email address
- **Roles**: Choose between Admin or Member
- **Expiry**: Invitations expire after 7 days
- **Status Tracking**: View pending, accepted, expired, and revoked invitations

#### Accepting Invitations
1. Recipient receives email with invitation link
2. Click link to open accept invitation page
3. Enter your name and optionally set a password
4. Alternatively, sign in with Google OAuth
5. Automatically logged in and added to team

#### Managing Invitations (Admin Only)
- **View All**: See list of all sent invitations with status
- **Resend**: Re-send invitation email for pending invites
- **Revoke**: Cancel pending invitation before acceptance
- **Filter**: Filter by status (Pending/Accepted/Expired/Revoked)

### Use Cases
- **Onboarding**: Invite new hires to join team workspace
- **Contractors**: Invite external collaborators with Member role
- **Admins**: Promote trusted members to Admin role during invitation

### Permissions
| Action | Admin | Member |
|--------|-------|--------|
| Send Invitation | ✅ | ❌ |
| View Invitations | ✅ | ❌ |
| Resend Invitation | ✅ | ❌ |
| Revoke Invitation | ✅ | ❌ |
| Accept Invitation | ✅ | ✅ |

---

## 2. Direct Messages (DM)

### Overview
Private one-on-one conversations between two team members.

### Features

#### Starting a DM
1. Click "New Message" button
2. Search and select a team member
3. Start typing your message

**Keyboard Shortcut**: `Cmd/Ctrl + N` for new message

#### DM Characteristics
- **Privacy**: Only you and the recipient can see messages
- **Persistence**: DM conversations are permanent (unless deleted by admin)
- **Unread Badges**: See unread message count in conversation list
- **Last Message Preview**: Preview last message in sidebar
- **Search**: Find specific messages using global search

### Use Cases
- **Quick Questions**: Ask colleague a quick question
- **Private Feedback**: Give private feedback on work
- **Sensitive Topics**: Discuss confidential matters
- **File Sharing**: Share documents privately

### Best Practices
- Use DMs for private conversations
- Switch to group chat if conversation involves 3+ people
- Use threads within DMs for topic organization
- Set status to "Do Not Disturb" during focus time

---

## 3. Group Conversations

### Overview
Multi-member conversations for team collaboration.

### Features

#### Creating a Group
1. Click "New Group" button
2. Enter group name (e.g., "Engineering Team")
3. Select 2-50 members to add
4. Click "Create Group"

**Member Limit**: 2-50 members per group

#### Managing Groups

**Adding Members**:
- Click group name → "Add Members"
- Select members from team directory
- Members see full conversation history after joining

**Removing Members**:
- Click group name → "Members" → Remove icon
- Removed members lose access immediately
- Conversation history remains for remaining members

**Group Admins**:
- Conversation creator is automatically an admin
- Admins can:
  - Add/remove members
  - Promote other members to admin
  - Delete messages from anyone
  - Archive/unarchive group

#### Leaving a Group
- Click group name → "Leave Group"
- You'll no longer receive messages from this group
- You can be re-added by a group admin

### Use Cases
- **Team Channels**: Engineering, Design, Marketing teams
- **Project Groups**: Specific project coordination
- **Announcements**: Company-wide announcements (large groups)
- **Social**: Watercooler, lunch plans, hobbies

### Group Naming Conventions
- **Department**: `#engineering`, `#design`, `#sales`
- **Project**: `#project-alpha`, `#website-redesign`
- **Topic**: `#random`, `#announcements`, `#help`
- **Location**: `#sf-office`, `#remote-team`

### Permissions in Groups
| Action | Admin | Member |
|--------|-------|--------|
| Send Message | ✅ | ✅ |
| Add Members | ✅ | ❌ |
| Remove Members | ✅ | ❌ |
| Edit Group Name | ✅ | ❌ |
| Delete Any Message | ✅ | ❌ |
| Delete Own Message | ✅ | ✅ |
| Leave Group | ✅ | ✅ |

---

## 4. Threaded Conversations

### Overview
Reply to specific messages in a side panel to keep conversations organized. Prevents main chat from getting cluttered with off-topic discussions.

### Features

#### Starting a Thread
- **Hover**: Hover over any message → Click "Reply in thread" button
- **Keyboard**: Select message → Press `T`
- Thread sidebar opens on the right side

#### Thread Sidebar
- **Parent Message**: Original message shown at top
- **Replies**: Chronological list of replies
- **Reply Count**: Shows total number of replies
- **Participants**: Avatars of users who replied
- **Infinite Scroll**: Load more replies as you scroll

#### Replying in Thread
1. Thread sidebar opens with parent message
2. Type your reply in the input at bottom
3. Press Enter or click Send
4. Reply appears in thread immediately
5. Other participants see real-time updates

#### Thread Notifications
- Get notified when someone replies to your thread
- Get notified when you're mentioned in a thread
- See unread indicator on messages with new thread replies

#### Thread Limitations
- **1-Level Only**: Cannot reply to a reply (prevents nested complexity)
- **Same Conversation**: Threads are tied to the conversation
- **Full History**: All thread replies are visible to conversation members

### Use Cases
- **Follow-up Questions**: Ask clarifying questions on a topic
- **Detailed Discussions**: Deep-dive into a specific topic
- **Keeping Context**: Organize related messages together
- **Reducing Noise**: Prevent side discussions from cluttering main chat

### Best Practices
- ✅ Use threads for follow-up questions
- ✅ Use threads for detailed discussions
- ✅ Use threads to keep main chat on-topic
- ❌ Don't use threads for urgent questions (use main chat)
- ❌ Don't start a thread if it's a new topic (use main chat)

### Thread Indicators
- **Reply Count Badge**: Blue bubble showing number of replies
- **Participant Avatars**: Show who's participating in thread
- **Last Reply Time**: "Last reply 5 minutes ago"
- **Unread Badge**: Blue dot for threads with unread replies
- **Following Badge**: Star icon if you're following the thread

### Example
```
Main Chat:
┌────────────────────────────────────┐
│ @John: What time is the meeting?   │
│ ↳ 3 replies                        │ ← Click to open thread
└────────────────────────────────────┘

Thread Sidebar:
┌──────────────────────────────────────┐
│ Parent Message:                      │
│ @John: What time is the meeting?     │
├──────────────────────────────────────┤
│ @Sarah: It's at 2pm                  │
│ @John: Thanks! Which room?           │
│ @Sarah: Conference Room A            │
└──────────────────────────────────────┘
```

---

## 5. Message Reactions

### Overview
React to messages with emoji without sending a message. Quick way to acknowledge, agree, or express emotion.

### Features

#### Adding a Reaction
- **Hover**: Hover over message → Click smile icon → Select emoji
- **Quick Reactions**: Click smile icon → Use quick reaction bar (👍 ❤️ 😂 😮 😢 🎉)
- **Emoji Picker**: Click "Show all" for full emoji picker with search
- **Multiple Reactions**: Add multiple different emojis to same message

#### Removing a Reaction
- Click an emoji you've already reacted with to toggle it off

#### Viewing Reactions
- Reactions appear below the message
- Number shows how many people reacted
- Hover to see who reacted with each emoji
- Your reactions are highlighted in blue

#### Reaction Limits
- Unlimited reactions per message
- Same emoji can be added by multiple users
- No limit on number of different emojis

### Use Cases
- **Quick Acknowledgment**: 👍 instead of "Okay"
- **Agreement**: ✅ to show you agree
- **Celebration**: 🎉 for achievements
- **Empathy**: ❤️ for support
- **Humor**: 😂 for funny messages
- **Task Completion**: ✅ to mark as done

### Common Reaction Meanings
| Emoji | Common Meaning |
|-------|----------------|
| 👍 | Agree / Acknowledged / Sounds good |
| ❤️ | Love / Support / Empathy |
| 😂 | Funny / LOL |
| 😮 | Surprised / Wow |
| 😢 | Sad / Condolences |
| 🎉 | Celebrate / Congratulations |
| ✅ | Done / Completed / Approved |
| 👀 | Looking into it / Watching |
| 🔥 | Hot take / On fire / Impressive |
| 💯 | Perfect / 100% agree |

### Reaction Etiquette
- ✅ Use reactions for quick responses
- ✅ React to show acknowledgment
- ✅ React to reduce notification noise
- ❌ Don't use offensive emojis
- ❌ Don't spam reactions
- ❌ Don't use reactions to replace important responses

---

## 6. @Mentions

### Overview
Tag specific team members in messages to get their attention and send them a notification.

### Features

#### Mentioning Someone
1. Type `@` in message
2. Member dropdown appears
3. Type name to filter list
4. Press Enter or click to select
5. Mention is inserted as `@John Doe`

**Keyboard Navigation**: Use ↑↓ arrows to navigate, Enter to select, Esc to close

#### Mention Formatting
- **Display**: `@John Doe` (highlighted in blue)
- **Your Mentions**: Highlighted in yellow when someone mentions you
- **Storage**: Internally stored as `@[user-id](John Doe)`

#### Mention Notifications
- Desktop notification: "John mentioned you in #engineering"
- In-app notification bell badge
- Email notification (if enabled in settings)
- Mentioned message highlighted in yellow

#### Search by Mentions
- Search: `has:mention` to find messages where you're mentioned
- Search: `from:john has:mention` to find John's mentions of you

### Use Cases
- **Get Attention**: Mention someone to ensure they see the message
- **Ask Directly**: Mention to direct question to specific person
- **Multiple People**: Mention multiple people in one message
- **Thread Discussions**: Mention to bring someone into a thread

### Mention Best Practices
- ✅ Mention when you need specific person's input
- ✅ Mention sparingly to avoid notification fatigue
- ✅ Use @channel carefully in large groups (notifies everyone)
- ❌ Don't mention unnecessarily
- ❌ Don't mention multiple people if not needed
- ❌ Don't abuse @channel in large groups

### Special Mentions (Future)
- `@channel` - Mention everyone in the conversation
- `@here` - Mention only online members
- `@team-engineering` - Mention entire team/department

---

## 7. Message Editing & Deletion

### Overview
Edit or delete sent messages within a time window.

### Features

#### Editing Messages
1. Hover over your message → Click "..." menu → "Edit"
2. Message becomes editable
3. Make changes
4. Press Enter or click "Save"
5. Message shows "(edited)" indicator

**Time Limit**: Can edit within 15 minutes of sending
**Keyboard Shortcut**: Click message → Press `E`

#### Deleting Messages
1. Hover over message → Click "..." menu → "Delete"
2. Confirm deletion
3. Message is soft-deleted (shows "Message deleted")
4. Admins can delete any message
5. Members can only delete own messages

**Admin Rights**: Admins can delete any message, anytime

#### Soft Delete
- Deleted messages show as "Message deleted"
- Original content is hidden but metadata preserved
- Maintains conversation flow and context
- Reactions and replies remain attached

### Permissions
| Action | Own Message | Others' Message (Member) | Others' Message (Admin) |
|--------|-------------|--------------------------|-------------------------|
| Edit | ✅ (15 min) | ❌ | ❌ |
| Delete | ✅ | ❌ | ✅ |
| View Edit History | ❌ | ❌ | ❌ |

### Use Cases
- **Typo Fix**: Fix spelling mistakes
- **Clarification**: Add more context to message
- **Mistake**: Remove accidentally sent message
- **Policy Violation**: Admin removes inappropriate content

### Best Practices
- ✅ Fix typos quickly
- ✅ Add clarification if message was unclear
- ✅ Delete if sent to wrong conversation
- ❌ Don't edit to change meaning after replies
- ❌ Don't delete to hide mistakes (own it instead)

---

## 8. File Attachments

### Overview
Share files directly in conversations. Supports documents, images, videos, and more.

### Features

#### Uploading Files
1. Click paperclip icon in message input
2. Select file(s) from computer
3. Add optional message
4. Press Enter or click Send
5. File uploads and appears in conversation

**Multiple Files**: Upload up to 10 files at once
**File Size Limit**: 50MB per file
**Total Message Size**: 100MB per message

#### Supported File Types
- **Documents**: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT
- **Images**: JPG, PNG, GIF, SVG, WEBP
- **Videos**: MP4, MOV, AVI, WEBM
- **Archives**: ZIP, RAR, 7Z
- **Code**: JS, TS, PY, JAVA, CPP, etc.
- **Other**: CSV, JSON, XML, MD

#### File Preview
- **Images**: Inline preview in chat
- **Videos**: Inline player with controls
- **Documents**: Download or open in new tab
- **Code**: Syntax-highlighted preview (future)

#### File Actions
- **Download**: Click to download file
- **Open**: Open in new tab (browser-supported formats)
- **Share**: Copy file link to share elsewhere
- **Delete**: Delete attachment (message sender or admin)

### Use Cases
- **Design Reviews**: Share mockups, screenshots
- **Code Reviews**: Share code snippets, logs
- **Documents**: Share specs, contracts, reports
- **Media**: Share videos, presentations
- **Data**: Share CSV, Excel files

### File Storage
- Files stored in S3-compatible storage
- Unique file IDs prevent name conflicts
- Files persist even if message deleted
- Admins can manage storage and quotas

### Security
- Files scanned for viruses before storage
- Access controlled by conversation membership
- Private files only accessible to conversation members
- Audit log of file uploads and downloads (admin)

---

## 9. Search

### Overview
Powerful search across all messages, conversations, and files you have access to.

### Features

#### Global Search
**Access**: Press `Cmd/Ctrl + K` or click search icon
**Scope**: Searches all conversations you're a member of

#### Search Filters

**By Content**:
- Plain text: `"project deadline"`
- Phrase search: `"exact phrase"`

**By Sender**:
- `from:john` - Messages from John
- `from:me` - Your own messages

**By Conversation**:
- `in:engineering` - Messages in #engineering
- `in:@john` - Messages in DM with John

**By Type**:
- `has:mention` - Messages where you're mentioned
- `has:reaction` - Messages with reactions
- `has:thread` - Messages with thread replies
- `has:file` - Messages with attachments

**By Date**:
- `after:2024-01-01` - Messages after date
- `before:2024-12-31` - Messages before date
- `on:2024-06-15` - Messages on specific date

**Combined Filters**:
```
from:john in:engineering after:2024-01-01 has:file
```
Find: Files shared by John in #engineering this year

#### Search Results
- **Relevance Sorted**: Most relevant results first
- **Context Preview**: See surrounding messages
- **Highlighting**: Search terms highlighted in yellow
- **Jump to Message**: Click result to navigate to message
- **Filters**: Filter results by type (Messages/Files/People)

#### Recent Searches
- Last 10 searches saved
- Click to run again
- Clear history button

### Search Tips
1. **Use Quotes**: For exact phrase matching
2. **Combine Filters**: Narrow down results
3. **Use Operators**: `from:`, `in:`, `has:`, `after:`, `before:`
4. **Recent Searches**: Access via dropdown
5. **Keyboard Navigation**: ↑↓ arrows, Enter to open

### Search Shortcuts
| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Open search |
| `↑` / `↓` | Navigate results |
| `Enter` | Open selected result |
| `Esc` | Close search |

---

## 10. Notifications

### Overview
Stay informed about important events without being overwhelmed.

### Notification Types

#### 1. Mentions
**Trigger**: Someone @mentions you in a message
**Where**: In-app bell icon, desktop notification, email (optional)
**Priority**: High

#### 2. Direct Messages
**Trigger**: New message in DM conversation
**Where**: In-app bell icon, desktop notification
**Priority**: High

#### 3. Thread Replies
**Trigger**: Someone replies to a thread you started or participated in
**Where**: In-app bell icon
**Priority**: Medium

#### 4. Reactions
**Trigger**: Someone reacts to your message
**Where**: In-app bell icon
**Priority**: Low (can be disabled)

#### 5. Added to Group
**Trigger**: You're added to a new group conversation
**Where**: In-app bell icon, desktop notification
**Priority**: Medium

### Notification Settings

**Access**: Click profile → Settings → Notifications

**Desktop Notifications**:
- Enable/disable browser notifications
- Requires browser permission
- Works when app is open or in background

**Email Notifications**:
- Receive digest of important notifications
- Configurable frequency (Real-time / Daily / Weekly)
- Can disable entirely

**Do Not Disturb**:
- Mute all notifications temporarily
- Set schedule (e.g., 10pm - 8am)
- Manual toggle or scheduled

**Per-Type Settings**:
- Mentions: Always / Never
- Direct Messages: Always / Never
- Thread Replies: Always / Never
- Reactions: Always / Never / Important only
- Group Activity: Always / Never

### Notification Center

**Access**: Click bell icon in header

**Features**:
- List of all notifications
- Unread count badge
- Mark as read (individual or all)
- Filter by type
- Navigate to source (message/conversation)

### Smart Batching
- Multiple notifications from same source are batched
- "John and 3 others reacted to your message"
- Reduces notification fatigue

### Best Practices
- Enable desktop notifications for mentions and DMs
- Use Do Not Disturb during focus time
- Disable reaction notifications if too noisy
- Set email digest for weekly recap
- Check notification center regularly

---

## 11. Read Receipts

### Overview
See when messages have been read by recipients.

### Features

#### Message Status Indicators
- **Single Gray Check** (✓): Sent
- **Double Gray Checks** (✓✓): Delivered
- **Double Blue Checks** (✓✓): Read by all recipients

#### Read Indicators in Groups
- Hover over checks to see "Read by" list
- Shows names and read timestamps
- "Read by John, Sarah, and 3 others"

#### Read Receipts in DMs
- Simple read/unread indicator
- "Seen by John at 2:35 PM"

#### Privacy Settings
**Access**: Settings → Privacy → Read Receipts

**Options**:
- Send and receive read receipts (default)
- Disable sending (you won't see others' receipts either)

**Impact of Disabling**:
- Your messages won't show read receipts
- You won't see when others read your messages
- Others won't see when you read their messages

### Automatic Read Marking
Messages automatically marked as read when:
- Message scrolls into view for 1+ seconds
- You click on the message
- You reply to the message
- You react to the message

### Use Cases
- **Confirmation**: Ensure urgent message was seen
- **Follow-up**: Know when to follow up on questions
- **Accountability**: Track message reads in important conversations

### Best Practices
- ✅ Check read receipts before sending follow-up
- ✅ Respect that read ≠ responded
- ❌ Don't pressure people based on read receipts
- ❌ Don't assume lack of read means ignoring

---

## 12. Typing Indicators

### Overview
See when others are composing messages in real-time.

### Features

#### Typing Display
- "John is typing..." appears at bottom of message list
- Multiple users: "John and Sarah are typing..."
- 3+ users: "John, Sarah, and 2 others are typing..."
- Animated dots (...) show activity

#### Smart Throttling
- Only shows if actively typing (not idle)
- Disappears after 3 seconds of inactivity
- Prevents "typing forever" scenarios

#### Privacy
- Typing indicators are automatic
- No way to disable (by design, for UX)
- Only shown to conversation participants

### Use Cases
- **Conversation Flow**: Know when to wait for response
- **Avoid Interruption**: See someone's composing before sending
- **Active Conversations**: Feel real-time presence

---

## 13. Online/Offline Status

### Overview
See who's currently online and available.

### Features

#### Status Indicators
- **Green Dot**: Online and active
- **Yellow Dot**: Away (idle 10+ minutes)
- **Gray Dot**: Offline

#### Status Display Locations
- Next to names in conversation list
- Next to avatars in messages
- In user profiles
- In member lists

#### Automatic Status Updates
- **Online**: Active in last 5 minutes
- **Away**: Idle 10-30 minutes
- **Offline**: Not active 30+ minutes or explicitly offline

#### Manual Status Setting
- Click profile → Set status
- Options: Online / Away / Do Not Disturb / Offline
- Add custom status message (e.g., "In a meeting")
- Set expiration (e.g., "Away for 1 hour")

### Custom Status Messages
Examples:
- "In a meeting until 3pm"
- "On vacation (back Monday)"
- "Focus time 🎧"
- "Working remotely today"

### Do Not Disturb Mode
- Shows as red dot
- Suppresses all notifications
- Shows "Do Not Disturb" in profile
- Can set schedule or manual

---

## 14. Keyboard Shortcuts

### Overview
Efficient navigation and actions via keyboard.

### General Shortcuts
| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Global search |
| `Cmd/Ctrl + /` | Show keyboard shortcuts |
| `Cmd/Ctrl + N` | New message / conversation |
| `Cmd/Ctrl + Shift + K` | Direct messages list |
| `Esc` | Close dialog / Cancel action |

### Navigation Shortcuts
| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + [` | Previous conversation |
| `Cmd/Ctrl + ]` | Next conversation |
| `↑` / `↓` | Navigate messages |
| `Alt + ↑` | Jump to first message |
| `Alt + ↓` | Jump to latest message |
| `Cmd/Ctrl + F` | Find in conversation |

### Message Actions
| Shortcut | Action |
|----------|--------|
| `Enter` | Send message |
| `Shift + Enter` | New line in message |
| `Cmd/Ctrl + B` | Bold text |
| `Cmd/Ctrl + I` | Italic text |
| `Cmd/Ctrl + Shift + C` | Code block |
| `Cmd/Ctrl + Z` | Undo |
| `Cmd/Ctrl + Shift + Z` | Redo |

### Message Management
| Shortcut | Action |
|----------|--------|
| `E` | Edit selected message (your own) |
| `Delete` | Delete selected message (your own) |
| `R` | Add reaction to selected message |
| `T` | Reply in thread to selected message |
| `Cmd/Ctrl + Shift + A` | Mark all as read |

### Conversation Management
| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + Shift + M` | Mute/unmute conversation |
| `Cmd/Ctrl + Shift + U` | Show unread conversations |
| `Cmd/Ctrl + Shift + T` | Show threads |

### Markdown Shortcuts (while typing)
| Type | Result |
|------|--------|
| `**text**` | **Bold text** |
| `*text*` | *Italic text* |
| `` `code` `` | `Inline code` |
| ``` ``` code ``` ``` | Code block |
| `> quote` | Block quote |
| `- item` | Bullet list |
| `1. item` | Numbered list |
| `[link](url)` | Hyperlink |

### Accessibility
All actions are keyboard accessible. Use `Tab` to navigate, `Enter` to activate, `Esc` to cancel.

---

## Additional Features

### 15. Message Formatting
- **Bold**: `**text**` or `Ctrl+B`
- **Italic**: `*text*` or `Ctrl+I`
- **Strikethrough**: `~~text~~`
- **Code**: `` `code` ``
- **Code Block**: ``` ```language\ncode\n``` ```
- **Quote**: `> quote`
- **Lists**: `- item` or `1. item`
- **Links**: `[text](url)` or paste URL

### 16. Emoji Support
- Type `:` to open emoji picker
- Type emoji name: `:smile:` → 😊
- Recent emojis saved
- Skin tone selector
- Search emojis by name

### 17. GIF Support (Future)
- Search and send GIFs via GIPHY integration
- Type `/giphy search term`
- Preview before sending
- Moderation filters

### 18. Voice Messages (Future)
- Record and send voice messages
- Max length: 5 minutes
- Playback with speed control
- Waveform visualization

### 19. Video Calls (Future)
- Start video call from conversation
- Screen sharing support
- Up to 50 participants
- Recording capability (admin only)

### 20. Message Pinning (Future)
- Pin important messages to top of conversation
- Up to 5 pinned messages per conversation
- Admin or member can pin
- Pinned messages section

---

## User Guide

### Getting Started
1. **Accept Invitation**: Accept email invitation or sign in with Google
2. **Set Up Profile**: Add profile picture and status
3. **Start Chatting**: Send first message or join existing conversations
4. **Explore Features**: Try reactions, threads, mentions
5. **Customize Settings**: Configure notifications, theme, preferences

### Daily Workflow
1. **Check Notifications**: Review notification bell for updates
2. **Read Messages**: Catch up on conversations
3. **Respond**: Reply, react, or start threads
4. **Search**: Find old messages or files
5. **Set Status**: Update status if away or in meeting

### Tips for Power Users
- Master keyboard shortcuts for speed
- Use search operators for precise results
- Create groups for projects and teams
- Use threads to keep main chat organized
- Set Do Not Disturb during focus time
- Customize notifications per your needs

---

## Admin Guide

### User Management
- Send team invitations
- View team member list
- Deactivate user accounts
- Manage user roles (Admin/Member)
- Reset user passwords

### Conversation Management
- View all conversations
- Archive inactive conversations
- Delete conversations
- Transfer group ownership
- Monitor conversation activity

### Content Moderation
- Delete any message
- View message edit history
- Review flagged content
- Export conversation archives
- Set retention policies

### Analytics & Reports
- User activity reports
- Message volume trends
- Feature adoption rates
- Storage usage
- Response time metrics

### Settings & Policies
- Configure invitation domains
- Set file upload limits
- Configure retention policies
- Set moderation rules
- Manage integrations

---

## Troubleshooting

### Messages Not Sending
1. Check internet connection
2. Refresh page
3. Check browser console for errors
4. Clear browser cache
5. Try different browser

### Notifications Not Working
1. Check notification settings in app
2. Grant browser notification permission
3. Check browser notification settings
4. Disable browser extensions
5. Try different device

### Can't Find Messages in Search
1. Check search filters
2. Verify conversation access
3. Check date range
4. Try different search terms
5. Contact admin if issue persists

### Thread Not Opening
1. Refresh page
2. Check browser console
3. Verify conversation membership
4. Check if thread was deleted
5. Report bug if persistent

### File Upload Failing
1. Check file size (<50MB)
2. Check file type (supported formats)
3. Check internet connection
4. Try different file
5. Contact admin for storage quota

---

## Support & Feedback

### Getting Help
- **In-App Help**: Click "?" icon → Help Center
- **Documentation**: docs.servicebay.ai/chat
- **Video Tutorials**: youtube.com/servicebay
- **Email Support**: support@servicebay.ai

### Reporting Bugs
1. Click "?" icon → Report Bug
2. Describe the issue
3. Include steps to reproduce
4. Attach screenshots if relevant
5. Submit report

### Feature Requests
- Click "?" icon → Request Feature
- Describe desired feature
- Explain use case
- Upvote existing requests
- Track request status

### Feedback
We value your feedback! Share your thoughts:
- Weekly satisfaction survey
- In-app feedback button
- Email: feedback@servicebay.ai
- Community forum: community.servicebay.ai

---

## Release Notes

### Version 2.0 (Current)
- ✨ Team invitations via email
- ✨ Threaded conversations
- ✨ Message reactions
- ✨ @Mentions with notifications
- ✨ Global search with filters
- ✨ Enhanced read receipts
- 🐛 Fixed Gantt chart initialization
- 🐛 Fixed WebSocket reconnection
- 🎨 Improved mobile responsiveness
- ⚡ Performance optimizations

### Version 1.0 (Initial Release)
- Direct messages (DM)
- Group conversations
- Message editing and deletion
- File attachments
- Typing indicators
- Online/offline status
- Basic notifications
- Dark mode theme

### Coming Soon (v2.1)
- Message pinning
- GIF support
- Voice messages
- Video calls
- Advanced user presence
- Message scheduling
- Conversation folders

---

## Glossary

**DM**: Direct Message - Private one-on-one conversation

**Thread**: Replies to a specific message in a side panel

**Mention**: Tagging a user with @ to get their attention

**Reaction**: Emoji response to a message

**Read Receipt**: Indicator showing when message was read

**Typing Indicator**: Shows when someone is composing a message

**Online Status**: Indicator showing user availability

**Conversation**: Generic term for DM or group chat

**Group**: Multi-member conversation (formerly called "channel")

**Admin**: User with elevated permissions

**Member**: Standard user role

**Notification**: Alert about new activity

**Do Not Disturb**: Mode that suppresses notifications

**Soft Delete**: Message deletion that preserves metadata

**Thread Parent**: Original message that thread replies attach to

**Unread Badge**: Visual indicator of unread messages

**Conversation List**: Sidebar showing all conversations

**Message List**: Main area showing conversation messages

**Thread Sidebar**: Right panel showing thread replies

---

*Last Updated: January 2025*
*Version: 2.0*
*Documentation maintained by ServiceBay PM Team*
