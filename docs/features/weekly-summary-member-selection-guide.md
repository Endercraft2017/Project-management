# Weekly Summary Member Selection - User Guide

**Feature:** Weekly Summary Member Selection
**Version:** 1.0
**Last Updated:** 2025-10-23
**Audience:** Administrators

## Overview

The Weekly Summary Member Selection feature allows administrators to control which team members are included in the weekly summary generation process. This gives you flexibility to focus summaries on specific team members or exclude certain individuals as needed.

## Who Can Use This Feature?

This feature is **administrator-only**. Only users with the ADMIN role can access and modify member selection settings.

## How to Access

1. Navigate to the **Weekly Summaries** section in the application
2. Look for the **"Select Members"** button in the admin action toolbar
3. Click the button to open the member selection dialog

## Using the Member Selection Dialog

### Dialog Layout

The member selection dialog displays:
- **Header:** "Select Team Members"
- **Description:** Explains the purpose of the feature
- **Counter:** Shows how many members are currently selected (e.g., "3 of 5 selected")
- **Quick Actions:** "Select All" / "Deselect All" button
- **Member List:** Scrollable list of all active team members with checkboxes
- **Warning:** Displays if no members are selected
- **Action Buttons:** "Save Selection" and "Cancel"

### Selecting Members

1. **Individual Selection:**
   - Click on a member's checkbox or anywhere on their row to toggle selection
   - Selected members show a checkmark with a blue background
   - Unselected members show an empty checkbox

2. **Bulk Selection:**
   - Click **"Select All"** to select all active team members
   - Click **"Deselect All"** to clear all selections

3. **Member Information:**
   - Each member shows their name, email, and role
   - Admin users are marked with an "Admin" badge

### Saving Changes

1. Review your selections
2. Click **"Save Selection"** to apply the changes
3. A success message will confirm the update
4. The dialog will close automatically

### Canceling Changes

- Click **"Cancel"** or the X button to close without saving
- Your previous selections will remain unchanged

## How It Works

### Default Behavior

**When no configuration exists:**
- All active team members are automatically included in weekly summaries
- This ensures backwards compatibility with existing functionality

**After configuration:**
- Only selected members will be included in new weekly summaries
- Members can be added or removed at any time
- Changes take effect for the next summary generation

### Summary Generation

When a weekly summary is generated (manually or via scheduled job):

1. The system checks the member selection configuration
2. If members are selected:
   - Only those members' daily updates are processed
   - AI summaries are generated only for selected members
3. If no members are selected:
   - No summaries are generated (warning is shown in the dialog)
4. If no configuration exists:
   - All active members are included (default behavior)

## Use Cases

### Scenario 1: Excluding Part-Time Members
**Situation:** You have part-time team members who don't submit regular updates.

**Solution:**
1. Open the member selection dialog
2. Deselect part-time members
3. Save the configuration

**Result:** Weekly summaries focus only on full-time members with regular updates.

### Scenario 2: Project-Specific Summaries
**Situation:** You want summaries for only the core project team.

**Solution:**
1. Select only project team members
2. Deselect support or auxiliary team members
3. Save the configuration

**Result:** Summaries highlight only core project work.

### Scenario 3: Temporary Exclusion
**Situation:** A team member is on leave for a month.

**Solution:**
1. Deselect the team member during their leave
2. Re-select them when they return
3. Save each time you make changes

**Result:** Summaries exclude the absent member during their leave period.

## Important Notes

### Selection Persistence
- Selections are saved and persist across sessions
- Changes apply to **all future** summary generations
- Existing summaries are not modified

### Active Users Only
- Only active team members appear in the selection list
- Deactivated users are automatically excluded
- Invalid user IDs are filtered out when saving

### No Selection Warning
If you deselect all members:
- A warning message appears in the dialog
- You can still save this configuration
- **No summaries will be generated** until you select at least one member

### Permissions
- Only administrators can modify member selection
- Regular members cannot access this feature
- The "Select Members" button is hidden for non-admins

## Troubleshooting

### Problem: Button doesn't appear
**Solution:** Ensure you're logged in as an administrator. Only ADMIN users can see this button.

### Problem: Changes aren't saving
**Possible Causes:**
- Network connection issue
- Session expired (log in again)
- Server error (check with your technical team)

**Solution:** Try logging out and back in, then attempt to save again.

### Problem: A team member doesn't appear in the list
**Possible Causes:**
- The user account is deactivated
- The user was recently added (refresh the page)

**Solution:** Check the user's active status in the user management section.

### Problem: Summary still includes unselected members
**Possible Cause:** The summary was generated before you changed the selection.

**Solution:** Member selection only affects **new** summaries. Generate a new summary to see the changes.

## Tips and Best Practices

1. **Review Regularly:** Check your member selection monthly to ensure it reflects current team composition

2. **Document Changes:** Keep a note of why certain members are included/excluded for future reference

3. **Communicate Expectations:** Let team members know if they're included in weekly summaries so they submit daily updates

4. **Test First:** After changing selections, generate a test summary to verify the output

5. **Avoid Empty Selections:** Always have at least one member selected to maintain useful summaries

## Frequently Asked Questions

**Q: Can I select members from outside my team?**
A: No, only active team members in the system appear in the selection list.

**Q: Will historical summaries change if I update the selection?**
A: No, only new summaries generated after the change will reflect the updated selection.

**Q: Can regular members see who's selected?**
A: No, this is an admin-only feature. Selection configuration is private.

**Q: What happens if a selected member becomes inactive?**
A: They will automatically be excluded from future summaries, even if previously selected.

**Q: Can I create different selections for different weeks?**
A: No, the selection applies to all future weekly summaries. You'd need to manually change it each week if you want different selections.

**Q: Is there a limit to how many members I can select?**
A: No, you can select any number from 0 to all active team members.

## Related Features

- **Weekly Summaries:** The main feature this setting configures
- **Email Settings:** Configure when and where to send weekly summary emails
- **Daily Updates:** The data source for weekly summaries
- **User Management:** Manage team member accounts and active status

## Support

If you encounter issues or have questions:
1. Check this guide for troubleshooting steps
2. Verify your administrator permissions
3. Contact your technical support team
4. Report bugs through the appropriate channels

---

**Last Updated:** 2025-10-23
**Version:** 1.0
