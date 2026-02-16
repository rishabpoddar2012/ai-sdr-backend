# Worker Scheduling Options (Free Tier)

## The Problem
Render's free tier doesn't support Cron jobs. Here are free alternatives:

---

## Option 1: GitHub Actions (RECOMMENDED - FREE)

Already set up in `.github/workflows/worker.yml`

### Setup:
1. Go to your GitHub repo → Settings → Secrets
2. Add these secrets:
   - `DATABASE_URL` (from Render dashboard)
   - `JWT_SECRET` (from Render dashboard)
   - `LLM_PROVIDER` (set to `rule` for free)

3. The worker runs automatically every hour!

### Manual Trigger:
Go to Actions tab → "Lead Collection Worker" → "Run workflow"

---

## Option 2: Manual API Trigger

Trigger worker via API call:

```bash
curl -X POST https://ai-sdr-api.onrender.com/api/admin/trigger-worker \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## Option 3: Use Render Paid (Later)

When you have revenue, upgrade to Render Starter ($7/month):
- Uncomment the cron service in `render.yaml`
- Automatic scheduling

---

## Current Setup

Using **GitHub Actions (FREE)**:
- ✅ Runs every hour
- ✅ No cost
- ✅ Manual trigger available
- ✅ Same reliability

**No changes needed** - it's already configured!
