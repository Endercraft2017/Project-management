# Pipeline Map

End-to-end processes users trigger. The app's navigation follows the same
order (Overview -> Plan & track -> Collaborate -> Report -> Admin); see
`client/src/components/layout/navigation.ts`.

## 1. Member onboarding

- **Trigger:** admin clicks Invite (top bar or Team view).
- **Stages:** Invites creates the invitation and emails a token link -> the
  invitee opens `?token=` -> AcceptInvitePage -> Auth (Google OAuth) -> Users
  activates the member.
- **Branches:** email case mismatch is handled case-insensitively; expired or
  used tokens stop at the accept page.
- **Terminal states:** member active; invitation pending; invitation revoked.

## 2. Plan and track work

- **Trigger:** a member creates a sprint or tasks, or imports a CSV.
- **Stages:** Sprints -> Tasks (create, nest under a parent task, assign) ->
  Task import (optional bulk path; validates rows, then hands off to Tasks) ->
  Sheets sync (optional) -> Dashboard and Gantt read the results.
- **Data:** tasks with parent/child hierarchy, assignee, dates, progress.
- **Branches:** import validation errors; sync conflicts go to
  ConflictResolutionModal.
- **Terminal states:** task completed; task deleted; import rejected.

## 3. Daily updates and reminders

- **Trigger:** a member posts a daily update (a schedule triggers reminders).
- **Stages:** Daily updates records the entry -> Admin's missing-updates
  scheduler detects gaps -> Chat notifications deliver `update_reminder` ->
  the app shell opens Daily updates with the missing dates highlighted.
- **Branches:** late updates for past days are accepted; notification cooldown
  prevents repeat reminders.
- **Terminal states:** update posted; reminder sent; reminder suppressed.

## 4. Weekly reporting

- **Trigger:** schedule or an admin clicks Generate.
- **Stages:** Weekly summaries gathers tasks and daily updates for the selected
  members -> OpenAI generates the recap -> stored -> optionally emailed.
- **Branches:** OpenAI failure; no data for the week; member selection.
- **Terminal states:** summary stored; summary emailed; generation failed.

## 5. Team communication

- **Trigger:** a member sends a message.
- **Stages:** Chat stores the message (threads, mentions, attachments via Drive
  files) -> Socket.IO broadcasts -> notification panel -> clicking a
  notification opens the conversation with the message highlighted.
- **Terminal states:** message delivered; attachment upload failed.
