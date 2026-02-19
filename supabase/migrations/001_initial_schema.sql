-- AI SDR Database Schema
-- Run this in Supabase SQL Editor

-- Create users table
CREATE TABLE IF NOT EXISTS users (
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
CREATE TABLE IF NOT EXISTS leads (
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

-- Create subscriptions table for Stripe
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    stripe_price_id VARCHAR(255),
    plan VARCHAR(20) DEFAULT 'free',
    status VARCHAR(50) DEFAULT 'incomplete',
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);

-- Enable RLS (Row Level Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Create policies for users table
CREATE POLICY "Users can only see own data" ON users
    FOR ALL USING (auth.uid()::text = id::text);

-- Create policies for leads table  
CREATE POLICY "Users can only see own leads" ON leads
    FOR ALL USING (auth.uid()::text = user_id::text);

-- Create policies for subscriptions table
CREATE POLICY "Users can only see own subscriptions" ON subscriptions
    FOR ALL USING (auth.uid()::text = user_id::text);

-- Create function to generate API key
CREATE OR REPLACE FUNCTION generate_api_key()
RETURNS TEXT AS $$
DECLARE
    key TEXT;
BEGIN
    key := 'ak_' || encode(gen_random_bytes(32), 'base64');
    RETURN key;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate API key on user insert
CREATE OR REPLACE FUNCTION set_api_key()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.api_key IS NULL THEN
        NEW.api_key := generate_api_key();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_api_key ON users;
CREATE TRIGGER trigger_set_api_key
    BEFORE INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION set_api_key();

-- Insert test user (optional - for testing)
-- INSERT INTO users (email, password, first_name, last_name, plan) 
-- VALUES ('demo@aisdr.com', 'hashed_password_here', 'Demo', 'User', 'starter');
