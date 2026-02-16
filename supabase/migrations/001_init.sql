-- Initialize AI SDR Database Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    company_name VARCHAR(200),
    role VARCHAR(20) DEFAULT 'user',
    plan VARCHAR(20) DEFAULT 'free',
    plan_status VARCHAR(20) DEFAULT 'active',
    api_key VARCHAR(255) UNIQUE,
    api_enabled BOOLEAN DEFAULT true,
    api_calls_this_month INTEGER DEFAULT 0,
    ai_provider VARCHAR(50) DEFAULT 'rule',
    ai_api_key TEXT,
    ai_model VARCHAR(100),
    ai_base_url VARCHAR(500),
    leads_used_this_month INTEGER DEFAULT 0,
    leads_limit INTEGER DEFAULT 50,
    keywords TEXT[] DEFAULT ARRAY['marketing agency', 'growth'],
    sources_config JSONB DEFAULT '{"hackerNews": true, "reddit": true}'::jsonb,
    api_webhook_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    source VARCHAR(50) NOT NULL,
    source_url TEXT,
    company_name VARCHAR(255),
    company_website VARCHAR(500),
    company_size VARCHAR(50),
    company_industry VARCHAR(100),
    contact_name VARCHAR(255),
    contact_title VARCHAR(255),
    contact_email VARCHAR(255),
    contact_linkedin VARCHAR(500),
    contact_phone VARCHAR(50),
    intent TEXT,
    description TEXT,
    score VARCHAR(20) DEFAULT 'warm',
    score_reason TEXT,
    ai_analysis JSONB,
    budget_signal VARCHAR(100),
    urgency_signal VARCHAR(100),
    status VARCHAR(20) DEFAULT 'new',
    is_favorite BOOLEAN DEFAULT false,
    notes TEXT,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    exported_to TEXT[] DEFAULT ARRAY[]::TEXT[],
    raw_data JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can only see own data" ON users;
DROP POLICY IF EXISTS "Users can only see own leads" ON leads;

-- Create RLS policies
CREATE POLICY "Users can only see own data" ON users
    FOR ALL USING (auth.uid() = id);

CREATE POLICY "Users can only see own leads" ON leads
    FOR ALL USING (
        user_id IN (
            SELECT id FROM users WHERE auth.uid() = id
        )
    );

-- Function to generate API key
CREATE OR REPLACE FUNCTION generate_api_key()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.api_key IS NULL THEN
        NEW.api_key := 'aisdr_' || encode(gen_random_bytes(32), 'hex');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate API key
DROP TRIGGER IF EXISTS trigger_generate_api_key ON users;
CREATE TRIGGER trigger_generate_api_key
    BEFORE INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION generate_api_key();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for timestamps
DROP TRIGGER IF EXISTS trigger_users_updated_at ON users;
CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_leads_updated_at ON leads;
CREATE TRIGGER trigger_leads_updated_at
    BEFORE UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Sample data for testing (optional)
-- INSERT INTO users (email, password, first_name) 
-- VALUES ('test@example.com', 'hashed_password', 'Test');
