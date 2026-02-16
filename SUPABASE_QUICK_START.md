# AI SDR - Supabase Quick Deploy

## 🚀 Easiest Deployment Option

Supabase = PostgreSQL + Serverless API + Auth (all free)

---

## 📋 Steps

### 1. Create Supabase Project (3 minutes)
1. Go to https://supabase.com
2. Sign up with GitHub
3. New Project → Name: `ai-sdr` → Region: Singapore → Free Plan
4. Wait 2 minutes for database

### 2. Run Database Setup (2 minutes)
1. In Supabase Dashboard → SQL Editor
2. New Query → Paste contents of `supabase/migrations/001_init.sql`
3. Click Run

### 3. Get API Keys (1 minute)
1. Settings → API
2. Copy:
   - `SUPABASE_URL` (Project URL)
   - `SUPABASE_ANON_KEY` (anon/public)
   - `SUPABASE_SERVICE_ROLE_KEY` (secret)

### 4. Deploy Frontend to Vercel (2 minutes)
Use this button:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/rishabpoddar2012/ai-sdr-app)

Environment variables:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

---

## ✅ Done!

Your API endpoint: `https://your-project.supabase.co/functions/v1/api`

Dashboard: `https://your-project.vercel.app`

---

## 💰 Costs

| Component | Cost |
|-----------|------|
| Database | $0 (500MB limit) |
| API (Edge Functions) | $0 (500K invocations/mo) |
| Auth | $0 (10K users/mo) |
| **Total** | **$0** ✅ |

---

## 🎯 Why Supabase Wins

| Feature | Render | Supabase |
|---------|--------|----------|
| Setup time | 30+ min | 5 min |
| Free Database | ✅ | ✅ |
| Free API | ❌ (paid cron) | ✅ (edge functions) |
| Built-in Auth | ❌ (custom) | ✅ |
| Real-time | ❌ | ✅ |
| Complexity | High | Low |

**Winner: Supabase!** 🏆
