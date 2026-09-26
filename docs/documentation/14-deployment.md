# Feature 14: Railway Deployment Guide

**Status**: ✅ Completed
**Last Updated**: 2025-10-11

## Overview

Complete deployment guide for ServiceBay PM on Railway with PostgreSQL database.

## Prerequisites

- Railway account (railway.app)
- GitHub repository
- Google OAuth credentials
- Admin email addresses

## Deployment Steps

### 1. Create Railway Project

1. Go to railway.app
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository
5. Click "Deploy"

### 2. Add PostgreSQL Database

1. Click "+ New" in project
2. Select "Database"
3. Choose "PostgreSQL"
4. Railway auto-configures DATABASE_URL

### 3. Configure Environment Variables

Add these variables in Railway dashboard:

```bash
DATABASE_URL=<auto-configured>
NODE_ENV=production
PORT=3000
SESSION_SECRET=<generate-32-char-string>
GOOGLE_CLIENT_ID=<from-google-cloud>
GOOGLE_CLIENT_SECRET=<from-google-cloud>
GOOGLE_CALLBACK_URL=https://your-app.railway.app/auth/google/callback
ADMIN_EMAILS=admin@servicebay.ai
FRONTEND_URL=https://your-app.railway.app
GOOGLE_SHEETS_CLIENT_EMAIL=<service-account-email>
GOOGLE_SHEETS_PRIVATE_KEY=<service-account-key>
```

### 4. Run Database Migrations

Railway automatically runs:
```bash
npx prisma migrate deploy
```

### 5. Deploy Frontend (Options)

**Option A: Serve from Express**
- Build frontend: `cd client && npm run build`
- Serve static files from `server/public`

**Option B: Separate Deploy**
- Deploy frontend to Vercel/Netlify
- Update CORS settings

### 6. Configure Custom Domain (Optional)

1. Go to Settings > Domains
2. Add custom domain
3. Update DNS records
4. Update GOOGLE_CALLBACK_URL

## Configuration Files

### railway.json
```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "cd server && npm install && npx prisma generate"
  },
  "deploy": {
    "startCommand": "cd server && npx prisma migrate deploy && npm start"
  }
}
```

### CI/CD Pipeline
`.github/workflows/deploy.yml` - Auto-deploys on push to main

## Post-Deployment

1. **Test Authentication**: Visit `/auth/google`
2. **Create Admin User**: First login creates admin
3. **Create Sprint**: Add first sprint
4. **Create Tasks**: Test task management
5. **Test Chat**: Send messages
6. **Monitor Logs**: Check Railway logs

## Monitoring

- **Logs**: Railway dashboard > Logs tab
- **Metrics**: CPU, memory, network usage
- **Database**: Connection count, query performance

## Troubleshooting

### Database Connection Failed
- Check DATABASE_URL is set
- Verify PostgreSQL service is running

### OAuth Redirect Error
- Verify GOOGLE_CALLBACK_URL matches Railway domain
- Check Google Cloud Console authorized redirects

### Prisma Migration Failed
- Check database permissions
- Run migrations manually via Railway CLI

## Security Checklist

- [x] Environment variables configured
- [x] SESSION_SECRET is random 32+ characters
- [x] ADMIN_EMAILS restricted to @servicebay.ai
- [x] CORS configured for production domain
- [x] Rate limiting enabled
- [x] HTTPS enforced (automatic on Railway)

## Costs

- **Railway**: Free tier or ~$5-20/month
- **PostgreSQL**: Included in Railway plan
- **Domain**: Optional, ~$10-15/year

---

**End of Documentation**
