# AI SDR - Free Deployment Guide

## Deploy to Render (Free Tier)

### 1. Backend + Database
1. Go to https://render.com
2. Sign up with GitHub
3. Click "New +" → "PostgreSQL"
   - Name: ai-sdr-db
   - Region: Choose closest to you
   - Plan: Free
   - Create Database
   - Copy the "Internal Database URL"

4. Click "New +" → "Web Service"
   - Connect GitHub repo: rishabpoddar2012/ai-sdr-backend
   - Name: ai-sdr-api
   - Region: Same as database
   - Branch: main
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Plan: Free
   
5. Add Environment Variables:
   ```
   NODE_ENV=production
   PORT=10000
   DATABASE_URL=<paste from PostgreSQL>
   JWT_SECRET=<generate random string>
   JWT_EXPIRES_IN=7d
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_PUBLISHABLE_KEY=pk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   FRONTEND_URL=https://ai-sdr-dashboard.vercel.app
   ```

6. Click "Create Web Service"

### 2. Frontend (Vercel)
1. Go to https://vercel.com
2. Import GitHub repo: rishabpoddar2012/ai-sdr-app
3. Framework: Vite
4. Build Command: `npm run build`
5. Output Directory: `dist`
6. Add Environment Variables:
   ```
   VITE_API_URL=https://ai-sdr-api.onrender.com
   ```
7. Deploy

### 3. Landing Page (Vercel)
1. Import GitHub repo: rishabpoddar2012/ai-sdr-landing
2. Framework: Other
3. Deploy

## Estimated Costs

| Service | Free Tier Limits | Cost |
|---------|-----------------|------|
| Render Web | 750 hours/month | $0 |
| Render PostgreSQL | 1GB storage | $0 |
| Vercel | 100GB bandwidth | $0 |
| OpenAI API | Pay per use | ~$0.01/lead |

**Monthly cost: ~$10-30** (only OpenAI usage)

## Testing After Deploy

1. Visit landing page
2. Click "Start Free Trial"
3. Sign up with email
4. Check dashboard shows 50 free leads
5. Test lead filtering
6. Upgrade flow (Stripe test mode)

## Cron Job for Lead Collection

On Render dashboard:
1. Go to "Cron Jobs"
2. Create new job:
   - Command: `npm run worker`
   - Schedule: `0 * * * *` (every hour)
   - Plan: Free

## Monitoring

- Render dashboard shows logs
- Vercel analytics for frontend
- Stripe dashboard for payments
