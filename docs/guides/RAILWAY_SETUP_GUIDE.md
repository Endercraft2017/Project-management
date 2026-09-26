# 🚀 Railway Deployment Setup Guide for ServiceBay PM

Complete step-by-step guide to deploy your ServiceBay PM application on Railway.

---

## 📋 Prerequisites

Before you start, you'll need:

1. ✅ Railway account (free at railway.app)
2. ✅ GitHub repository (already pushed - you have this!)
3. ✅ Google Cloud account for OAuth
4. ✅ Admin email addresses (@servicebay.ai)

---

## ℹ️ Note: Google Sheets Integration (Optional)

**Google Sheets sync is OPTIONAL.** All core features work without it:

- ✅ Authentication & User Management
- ✅ Sprint & Task Management
- ✅ Real-time Chat
- ✅ CSV/Excel Import/Export
- ✅ All Views (Tasks, Summary, Gantt, Chat)

**Skip Steps 2, 5, 6, 7** in Part 1 if you don't need Google Sheets sync.

---

## Part 1: Google Cloud Setup (10 minutes for OAuth only)

### Step 1: Create Google Cloud Project

1. Go to https://console.cloud.google.com
2. Click "New Project" (top left, dropdown)
3. Name: "ServiceBay PM"
4. Click "Create"
5. Wait for project creation (~30 seconds)

### Step 2: Enable Required APIs _(OPTIONAL - Only for Google Sheets)_

**Skip this step if you don't need Google Sheets sync.**

1. In left sidebar → "APIs & Services" → "Library"
2. Search for "Google Sheets API" → Click → "Enable"
3. Search for "Google Drive API" → Click → "Enable"

### Step 3: Configure OAuth Consent Screen

1. "APIs & Services" → "OAuth consent screen"
2. User type: **Internal** (for @servicebay.ai users only)
3. Click "Create"
4. Fill in:
   - App name: **ServiceBay PM**
   - User support email: Your @servicebay.ai email
   - Developer contact: Your @servicebay.ai email
5. Click "Save and Continue"
6. Scopes: Skip this step → "Save and Continue"
7. Summary: Click "Back to Dashboard"

### Step 4: Create OAuth Client ID

1. "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Application type: **Web application**
4. Name: **ServiceBay PM Web Client**
5. Authorized redirect URIs:
   - Click "Add URI"
   - Add: `http://localhost:5000/api/auth/google/callback` (for local testing)
   - Click "Add URI" again
   - Add: `https://project-management-production-833f.up.railway.app/api/auth/google/callback`
   - (Replace YOUR-APP-NAME with your Railway domain - you'll update this later)

6. Click "Create"
7. **IMPORTANT**: Copy and save these values:
   - ✅ **Client ID** (looks like: 123456-abc.apps.googleusercontent.com)
   - 677389818661-ofd72sae80pktc42l3qbbho6fldhu536.apps.googleusercontent.com
   - ✅ **Client Secret** (looks like: GOCSPX-abc123...)
   - <your-google-client-secret>

### Step 5: Create Service Account _(OPTIONAL - Only for Google Sheets)_

**Skip this step if you don't need Google Sheets sync.**

1. "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "Service Account"
3. Name: **servicebay-pm-sheets**
4. Description: "Service account for Google Sheets sync"
5. Click "Create and Continue"
6. Role: Skip this → Click "Continue"
7. Click "Done"

### Step 6: Generate Service Account Key _(OPTIONAL - Only for Google Sheets)_

**Skip this step if you don't need Google Sheets sync.**

1. Click on the service account you just created
2. Go to "Keys" tab
3. Click "Add Key" → "Create new key"
4. Key type: **JSON**
5. Click "Create"
6. **JSON file downloads** - Save it securely!
7. Open the JSON file and copy:
   - ✅ **client_email** (looks like: servicebay-pm-sheets@project-id.iam.gserviceaccount.com)
   - ✅ **private_key** (starts with: -----BEGIN PRIVATE KEY-----)

### Step 7: Share Your Google Sheet _(OPTIONAL - Only for Google Sheets)_

**Skip this step if you don't need Google Sheets sync.**

1. Open your Google Sheet for task management
2. Click "Share" button (top right)
3. Paste the **client_email** from Step 6
4. Permission: **Editor**
5. **Uncheck** "Notify people"
6. Click "Share"

✅ **Google Cloud Setup Complete!**

---

## Part 2: Railway Deployment (10 minutes)

### Step 1: Create Railway Project

1. Go to https://railway.app
2. Sign in with GitHub
3. Click "New Project"
4. Select "Deploy from GitHub repo"
5. Find **Servicebay-app/Project-management** repository
6. Click on it to deploy

Railway will start building your app automatically.

### Step 2: Add PostgreSQL Database

1. In your Railway project, click "+ New"
2. Select "Database"
3. Choose "PostgreSQL"
4. Railway creates and auto-configures the database
5. ✅ **DATABASE_URL** is automatically set!

### Step 3: Get Your Railway App URL

1. Click on your service (not the database)
2. Go to "Settings" tab
3. Scroll to "Domains" section
4. Click "Generate Domain"
5. Railway creates: `https://your-app-name.up.railway.app`
6. **Copy this URL** - you'll need it for environment variables

### Step 4: Update Google OAuth Redirect URI

1. Go back to Google Cloud Console
2. "APIs & Services" → "Credentials"
3. Click on your OAuth Client ID
4. In "Authorized redirect URIs":
   - Add: `https://your-app-name.up.railway.app/api/auth/google/callback`
   - (Use the Railway URL from Step 3)
5. Click "Save"

---

## Part 3: Configure Environment Variables (5 minutes)

In Railway dashboard, click on your service → "Variables" tab

Add these environment variables:

### Required Variables (Copy & Paste, then fill in)

```bash
# Node Environment
NODE_ENV=production
PORT=5000

# Database (AUTO-CONFIGURED by Railway - Don't add this manually)
# DATABASE_URL is automatically set when you add PostgreSQL

# Session Secret (Generate a random 32-character string)
# You can use: https://www.random.org/strings/ or run in terminal: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=YOUR_RANDOM_32_CHAR_STRING_HERE
SESSION_SECRET=dbb02233be3f1506bf15f2e31c43c9c35e226c8501ad35ad23bfd4e7edfca89a

# Google OAuth (From Google Cloud Console - Step 4 above)
GOOGLE_CLIENT_ID=677389818661-ofd72sae80pktc42l3qbbho6fldhu536.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
GOOGLE_CALLBACK_URL=https://project-management-production-833f.up.railway.app/api/auth/google/callback

# Admin Configuration
# Replace with your admin email addresses (comma-separated)
ADMIN_EMAILS=kaduan@servicebay.ai,manager@servicebay.ai
ALLOWED_EMAIL_DOMAIN=@servicebay.ai

# Frontend/CORS Configuration
CLIENT_URL=https://project-management-production-833f.up.railway.app
CORS_ORIGIN=https://project-management-production-833f.up.railway.app
```

### Optional Variables (Only if using Google Sheets)

**Add these ONLY if you completed Steps 5, 6, 7 in Part 1:**

```bash
# Google Sheets API (From Service Account JSON - Step 6 above)
GOOGLE_SERVICE_ACCOUNT_EMAIL=servicebay-pm-sheets@project-id.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYourPrivateKeyHere\n-----END PRIVATE KEY-----\n"

# IMPORTANT: For GOOGLE_PRIVATE_KEY, make sure to:
# 1. Include the quotes around it
# 2. Keep the \n characters (newlines)
# 3. Copy the entire key from the JSON file
```

### How to Add Each Variable in Railway:

1. Click "New Variable"
2. Enter **Variable Name** (e.g., `SESSION_SECRET`)
3. Enter **Value**
4. Click "Add"
5. Repeat for all variables above

---

## Part 4: Environment Variables - Detailed Examples

### Example 1: SESSION_SECRET

**What it is**: A random secret key for encrypting session cookies

**How to generate**:

Option A - Online:

1. Go to https://www.random.org/strings/
2. Generate 1 string, 32 characters long
3. Use letters and numbers
4. Copy the result

Option B - Command line:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Example value**:

```
a3f8c9e2b1d4f6a8c2e5b7d9f1a3c5e7b9d1f3a5c7e9b2d4f6a8c1e3b5d7f9a1
```

### Example 2: GOOGLE_PRIVATE_KEY

**From your downloaded JSON file**, find this section:

```json
{
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQE...\n-----END PRIVATE KEY-----\n"
}
```

**Copy the entire value INCLUDING**:

- The quotes
- The `\n` characters
- `-----BEGIN PRIVATE KEY-----`
- `-----END PRIVATE KEY-----`

**In Railway, paste exactly as is**:

```
"-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQE...\n-----END PRIVATE KEY-----\n"
```

### Example 3: Complete Variable List

**Required Variables (Always needed):**

| Variable Name          | Example Value                                              |
| ---------------------- | ---------------------------------------------------------- |
| `NODE_ENV`             | `production`                                               |
| `PORT`                 | `5000`                                                     |
| `SESSION_SECRET`       | `a3f8c9e2b1d4f6a8...`                                      |
| `GOOGLE_CLIENT_ID`     | `123456789-abc.apps.googleusercontent.com`                 |
| `GOOGLE_CLIENT_SECRET` | `<your-google-client-secret>`                                      |
| `GOOGLE_CALLBACK_URL`  | `https://your-app.up.railway.app/api/auth/google/callback` |
| `ADMIN_EMAILS`         | `admin@servicebay.ai,manager@servicebay.ai`                |
| `ALLOWED_EMAIL_DOMAIN` | `@servicebay.ai`                                           |
| `CLIENT_URL`           | `https://your-app.up.railway.app`                          |
| `CORS_ORIGIN`          | `https://your-app.up.railway.app`                          |

**Optional Variables (Only if using Google Sheets):**

| Variable Name                  | Example Value                                          |
| ------------------------------ | ------------------------------------------------------ |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `servicebay-pm-sheets@project.iam.gserviceaccount.com` |
| `GOOGLE_PRIVATE_KEY`           | `"-----BEGIN PRIVATE KEY-----\n...`                    |

---

## Part 5: Deploy and Verify (5 minutes)

### Step 1: Trigger Deployment

After adding all environment variables:

1. Railway automatically redeploys
2. Watch the "Deployments" tab
3. Wait for "Success ✓" status (~3-5 minutes)

### Step 2: Check Logs

1. Click "View Logs" in Railway dashboard
2. Look for:
   - ✅ `Prisma migrations completed`
   - ✅ `Server listening on port 5000`
   - ❌ Any error messages (fix if needed)

### Step 3: Test Your App

1. Open your Railway URL: `https://your-app-name.up.railway.app`
2. You should see your React app
3. Click "Login with Google"
4. Should redirect to Google OAuth
5. Login with your @servicebay.ai account
6. Should redirect back and be logged in!

---

## Part 6: First-Time Setup in App (5 minutes)

### Step 1: Create First Admin User

1. Login with the email listed in `ADMIN_EMAILS`
2. You'll be created as an admin automatically

### Step 2: Create First Sprint

1. Go to "Tasks" tab
2. Click "New Sprint"
3. Fill in:
   - Sprint Name: "Sprint 1"
   - Start Date: Today
   - End Date: 2 weeks from now
4. Click "Create"

### Step 3: Create First Task

1. Click "New Task"
2. Fill in:
   - Task Name: "Test Task"
   - Sprint: "Sprint 1"
   - Assigned To: Yourself
   - Start Date: Today
   - Deadline: 1 week from now
   - Progress: 0%
3. Click "Create"

### Step 4: Test Google Sheets Sync _(OPTIONAL)_

**Skip this if you didn't set up Google Sheets integration.**

1. Click "Sync with Google Sheets" button
2. Select "Export to Sheets"
3. Check your Google Sheet - should see the task!

### Step 5: Test Chat

1. Go to "Chat" tab
2. Click "New Conversation"
3. Select a team member (or yourself for testing)
4. Send a message
5. Should appear instantly!

---

## Troubleshooting

### Issue: "Database connection failed"

**Solution**:

1. Check if PostgreSQL service is running in Railway
2. Verify `DATABASE_URL` is set (it's automatic)
3. Check logs for migration errors

### Issue: "OAuth redirect mismatch"

**Solution**:

1. Go to Google Cloud Console
2. Check "Authorized redirect URIs" matches your Railway URL exactly
3. Make sure `GOOGLE_CALLBACK_URL` matches exactly

### Issue: "Not authorized - email domain not allowed"

**Solution**:

1. Verify your email is `@servicebay.ai`
2. Check `ALLOWED_EMAIL_DOMAIN` is set to `@servicebay.ai`
3. Check `ADMIN_EMAILS` contains your email

### Issue: "Google Sheets sync failed"

**Solution** (Only if you set up Google Sheets):

1. Verify you shared the Google Sheet with service account email
2. Check `GOOGLE_PRIVATE_KEY` is properly formatted with `\n` characters
3. Ensure sheet has correct columns (see docs/documentation/06-google-sheets.md)
4. If you skipped Google Sheets setup, this feature won't work (use CSV upload instead)

### Issue: "Session expired immediately"

**Solution**:

1. Verify `SESSION_SECRET` is set and at least 32 characters
2. Check cookies are enabled in browser
3. Try clearing browser cookies

---

## Environment Variables Checklist

**Required (Always):**

- [ ] `NODE_ENV` = production
- [ ] `PORT` = 5000
- [ ] `SESSION_SECRET` = (32+ random characters)
- [ ] `GOOGLE_CLIENT_ID` = (from Google Cloud)
- [ ] `GOOGLE_CLIENT_SECRET` = (from Google Cloud)
- [ ] `GOOGLE_CALLBACK_URL` = (your Railway URL + /api/auth/google/callback)
- [ ] `ADMIN_EMAILS` = (comma-separated list)
- [ ] `ALLOWED_EMAIL_DOMAIN` = @servicebay.ai
- [ ] `CLIENT_URL` = (your Railway URL)
- [ ] `CORS_ORIGIN` = (your Railway URL)
- [ ] PostgreSQL database added (DATABASE_URL auto-configured)

**Optional (Only if using Google Sheets):**

- [ ] `GOOGLE_SERVICE_ACCOUNT_EMAIL` = (from JSON file)
- [ ] `GOOGLE_PRIVATE_KEY` = (from JSON file, with quotes and \n)

---

## Quick Reference: Where to Find Values

| Variable                       | Where to Find                                             |
| ------------------------------ | --------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`             | Google Cloud Console → Credentials → OAuth 2.0 Client IDs |
| `GOOGLE_CLIENT_SECRET`         | Same as above (shown once when created)                   |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Downloaded JSON file → "client_email" field               |
| `GOOGLE_PRIVATE_KEY`           | Downloaded JSON file → "private_key" field                |
| Railway URL                    | Railway Dashboard → Settings → Domains                    |

---

## Cost Estimate

- **Railway Hobby Plan**: $5/month (500 hours included)
- **PostgreSQL**: Included in Railway plan (512MB storage)
- **Google Cloud**: Free tier (plenty for 15 users)
- **Total**: ~$5/month

---

## Next Steps After Deployment

1. ✅ Invite team members (they auto-register on first login)
2. ✅ Create sprints for your projects
3. ✅ Import tasks from CSV/Excel
4. ✅ Setup Google Sheets sync _(optional)_
5. ✅ Start using chat for team collaboration
6. ✅ Monitor usage in Railway dashboard

---

## Support

If you encounter issues:

1. Check Railway logs for errors
2. Review this guide's troubleshooting section
3. Check `docs/documentation/` for feature-specific help
4. Verify all environment variables are set correctly

---

**Setup Time**:

- Without Google Sheets: ~20-25 minutes
- With Google Sheets: ~35-40 minutes

**Difficulty**: Medium
**Prerequisites**: Google account, Railway account

Good luck with your deployment! 🚀
