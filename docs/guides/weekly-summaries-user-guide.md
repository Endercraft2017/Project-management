# Weekly Summaries User Guide

## Overview

The Weekly Summaries feature uses AI (OpenAI GPT-3.5 Turbo) to automatically analyze team members' daily updates and generate concise, insightful summaries with impact assessments. This feature helps managers and stakeholders quickly understand team progress and contributions.

## Features

- **AI-Powered Summarization**: Automatically generates 2-4 sentence summaries of each team member's weekly work
- **Impact Assessment**: Classifies updates as HIGH (green), MEDIUM (yellow), or LOW (red) impact
- **Automated Email Reports**: Sends weekly summary emails automatically on a configured schedule
- **Manual Generation**: Admins can generate summaries on-demand for any week
- **Visual Dashboard**: View summaries organized by impact level with color-coded indicators

## How It Works

### 1. Daily Updates Collection

Team members submit their daily updates throughout the week using the existing Daily Updates feature. The AI will analyze these updates to create the weekly summary.

### 2. AI Analysis

At the configured time each week (or when manually triggered by an admin), the system:

1. Collects all daily updates for the previous week
2. Groups updates by team member
3. Sends each member's updates to OpenAI GPT-3.5 Turbo for analysis
4. Receives a summary and impact assessment

### 3. Impact Levels

The AI assesses each member's weekly contribution and assigns an impact level:

- 🟢 **HIGH Impact (Green)**
  - Major features completed
  - Critical bugs fixed
  - Significant milestones reached
  - High business value delivered

- 🟡 **MEDIUM Impact (Yellow)**
  - Regular progress on features
  - Moderate bug fixes
  - Steady contribution to team goals

- 🔴 **LOW Impact (Red)**
  - Minor updates
  - Limited progress
  - Mostly routine tasks
  - Minimal contributions

### 4. Viewing Summaries

#### For All Users (Members and Admins)

1. Navigate to the "Weekly Summaries" tab in the application
2. Select a week to view summaries for that period
3. Summaries are organized by impact level:
   - High Impact members appear first
   - Medium Impact members in the middle
   - Low Impact members at the bottom
4. Each summary shows:
   - Team member's name
   - AI-generated summary (2-4 sentences)
   - Colored dot indicating impact level
   - Statistics showing the distribution of impact levels

#### For Admins Only

Admins have additional capabilities:
- Generate summaries for any week manually
- Send summary emails on-demand
- Configure automated email settings
- Delete summaries if needed

## Admin Configuration

### Setting Up Automated Email Reports

1. Navigate to **Admin Settings** (admin access required)
2. Go to **Weekly Summary Email Configuration**
3. Configure the following settings:

   - **Enable/Disable**: Toggle automated emails on or off
   - **Recipient Email**: Email address to receive the summaries
   - **Send Day**: Which day of the week to send (e.g., Monday)
   - **Send Time**: What time to send (24-hour format, e.g., 09:00)

4. Click **Save Configuration**

The system will now automatically generate and send weekly summaries according to your schedule.

### Manually Generating a Summary

1. Navigate to **Weekly Summaries**
2. Click the **Generate Summary** button (admin only)
3. Select the week you want to generate a summary for
4. Click **Generate**
5. The AI will process all updates and create the summary (this may take a minute)

### Manually Sending an Email

1. Navigate to a specific weekly summary
2. Click the **Send Email** button (admin only)
3. The summary will be sent to the configured recipient email address

## Email Report Format

The automated email includes:

### Summary Header
- Week date range (e.g., "January 20, 2025 - January 26, 2025")
- Statistics showing impact distribution

### Impact Sections
Organized by impact level, each section shows:
- Section header with impact badge
- Team member name with colored indicator
- AI-generated summary
- Clean, professional formatting

### Footer
- Branding and source information
- Note that the summary was AI-generated

## Best Practices

### For Team Members

1. **Submit detailed daily updates**: The more context you provide in your daily updates, the better the AI can summarize your work
2. **Be specific**: Mention specific features, bug numbers, or deliverables
3. **Include outcomes**: Note the impact or results of your work
4. **Submit consistently**: Daily submissions lead to more accurate weekly summaries

### For Admins

1. **Review summaries before distributing**: While the AI is accurate, always review summaries before sending to stakeholders
2. **Set realistic schedules**: Choose a send day/time that works for your team's workflow
3. **Use impact levels as indicators**: Low impact doesn't always mean poor performance - it could indicate routine maintenance work
4. **Provide feedback**: If summaries seem inaccurate, ensure team members are providing detailed daily updates

## Troubleshooting

### No summaries appear for a week

**Possible causes:**
- No daily updates were submitted that week
- The summary hasn't been generated yet
- You don't have permission to view summaries

**Solution:**
- Ensure team members are submitting daily updates
- Ask an admin to manually generate the summary
- Contact your admin if you believe you should have access

### Email wasn't received

**Possible causes:**
- Automated emails are disabled in settings
- Wrong email address configured
- Email went to spam folder
- SMTP configuration issue

**Solution:**
- Verify email settings in Admin Settings
- Check spam/junk folder
- Ask admin to manually send the email
- Verify SMTP configuration (technical admin)

### Summary seems inaccurate

**Possible causes:**
- Insufficient detail in daily updates
- AI misinterpretation of technical content
- Updates were too brief or vague

**Solution:**
- Encourage team members to provide more detailed updates
- Manually review and regenerate if needed
- Provide context and specifics in daily updates

## Privacy and Security

- **API Key Security**: OpenAI API keys are stored securely in environment variables
- **Data Processing**: Your updates are sent to OpenAI for processing but are not used to train their models
- **Admin Access**: Only admins can generate summaries and configure email settings
- **View Permissions**: All authenticated users can view summaries, but only admins can manage them

## Costs and Limitations

- Uses OpenAI GPT-3.5 Turbo (cost-effective model)
- Rate limiting protects against excessive API usage
- Automatic retry logic handles temporary failures
- Maximum 3 retries per request with exponential backoff

## Support

If you encounter issues or have questions:
1. Check this documentation first
2. Contact your system administrator
3. Review the Technical Documentation for detailed implementation details

## FAQ

**Q: Can I edit the AI-generated summaries?**
A: Currently, summaries are generated automatically and cannot be manually edited. If a summary is inaccurate, regenerate it or provide more detailed daily updates.

**Q: How long does it take to generate a summary?**
A: Typically 30-60 seconds, depending on the number of team members and the complexity of their updates.

**Q: Can I generate summaries for past weeks?**
A: Yes, admins can manually generate summaries for any historical week that has daily updates.

**Q: What happens if someone didn't submit updates?**
A: The AI will generate a note indicating no updates were submitted, with a LOW impact classification.

**Q: Can I customize the impact level criteria?**
A: The criteria are built into the AI prompt and cannot be customized through the UI. Contact your technical team for custom modifications.

**Q: Is my data shared with OpenAI?**
A: Your updates are sent to OpenAI for processing but are not used to train their models according to OpenAI's data usage policy.
