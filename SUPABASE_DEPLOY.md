# Supabase Deployment Guide
## Easier Alternative to Render

Supabase provides: PostgreSQL + Serverless Functions + Auth in one platform

---

## 🚀 Step 1: Create Supabase Project

1. Go to https://supabase.com
2. Sign up with GitHub
3. Click "New Project"
4. Name: `ai-sdr`
5. Region: Choose closest (Singapore for India)
6. Plan: **Free Tier**
7. Create!

**Wait 2-3 minutes for database to be ready**

---

## 🗄️ Step 2: Run Database Migrations

1. In Supabase Dashboard, go to **SQL Editor**
2. Click **"New Query"**
3. Paste this SQL:

```sql
-- Create users table
CREATE TABLE users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    company_name VARCHAR(200),
    role VARCHAR(20) DEFAULT 'user',
    plan VARCHAR(20) DEFAULT 'free',
    api_key VARCHAR(255) UNIQUE,
    api_enabled BOOLEAN DEFAULT true,
    ai_provider VARCHAR(50) DEFAULT 'rule',
    ai_api_key TEXT,
    ai_model VARCHAR(100),
    leads_used_this_month INTEGER DEFAULT 0,
    leads_limit INTEGER DEFAULT 50,
    keywords TEXT[] DEFAULT ARRAY['marketing agency', 'growth'],
    sources_config JSONB DEFAULT '{"hackerNews": true, "reddit": true}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create leads table
CREATE TABLE leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    source VARCHAR(50) NOT NULL,
    company_name VARCHAR(255),
    company_website VARCHAR(500),
    contact_name VARCHAR(255),
    contact_email VARCHAR(255),
    contact_linkedin VARCHAR(500),
    intent TEXT,
    score VARCHAR(20) DEFAULT 'warm',
    score_reason TEXT,
    status VARCHAR(20) DEFAULT 'new',
    is_favorite BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_leads_user_id ON leads(user_id);
CREATE INDEX idx_leads_score ON leads(score);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_created ON leads(created_at);
CREATE INDEX idx_users_api_key ON users(api_key);

-- Enable RLS (Row Level Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can only see own data" ON users
    FOR ALL USING (auth.uid()::text = id::text);

CREATE POLICY "Users can only see own leads" ON leads
    FOR ALL USING (auth.uid()::text = user_id::text);
```

4. Click **"Run"**

---

## ⚡ Step 3: Deploy Edge Functions

1. Install Supabase CLI:
```bash
npm install -g supabase
```

2. Login:
```bash
supabase login
```

3. Link project:
```bash
supabase link --project-ref YOUR_PROJECT_REF
```
(Find project ref in Supabase dashboard URL)

4. Deploy functions:
```bash
supabase functions deploy
```

---

## 📋 Step 4: Environment Variables

In Supabase Dashboard → Settings → API:

Copy these values:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## 🎯 Why Supabase is Better:

| Feature | Render | Supabase |
|---------|--------|----------|
| Database | ✅ Free | ✅ Free (500MB) |
| Serverless API | ❌ Paid cron | ✅ Free edge functions |
| Auth | Custom code | ✅ Built-in |
| Real-time | ❌ | ✅ Built-in |
| Setup | Complex | Simple |

---

## 🔗 Quick Deploy Button

**Even Easier:** Use this one-click deploy

```bash
# Install dependencies
npm install

# Deploy to Supabase
npx supabase-bootstrap ai-sdr
```

---

**Want me to create the full Supabase setup files for you?** I can make it so you just run one command! 🚀
