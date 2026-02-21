-- AI SDR Onboarding & Google OAuth Migration

-- Add OAuth and onboarding fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_name VARCHAR(200);
ALTER TABLE users ADD COLUMN IF NOT EXISTS product_description TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS target_market VARCHAR(200);
ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_locations TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS scrape_sources TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS industry VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_size VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) DEFAULT 'email';

-- Update password to allow NULL for OAuth users
ALTER TABLE users ALTER COLUMN password DROP NOT NULL;

-- Create scrape_sources configuration table
CREATE TABLE IF NOT EXISTS scrape_sources (
    id SERIAL PRIMARY KEY,
    key VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    category VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert available scrape sources
INSERT INTO scrape_sources (key, name, description, icon, category) VALUES
('hackerNews', 'Hacker News', 'Tech-focused discussions and hiring posts', 'fab fa-hacker-news', 'community'),
('reddit', 'Reddit', 'Subreddits related to your industry', 'fab fa-reddit', 'community'),
('upwork', 'Upwork', 'Freelance job postings', 'fas fa-briefcase', 'freelance'),
('linkedin', 'LinkedIn', 'Professional network posts', 'fab fa-linkedin', 'social'),
('indeed', 'Indeed', 'Job postings and hiring alerts', 'fas fa-search', 'jobs'),
('productHunt', 'Product Hunt', 'Product launches and discussions', 'fab fa-product-hunt', 'community'),
('twitter', 'X/Twitter', 'Social media mentions and posts', 'fab fa-twitter', 'social')
ON CONFLICT (key) DO NOTHING;

-- Create user_scraper_configs table for per-user scraper settings
CREATE TABLE IF NOT EXISTS user_scraper_configs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    source_key VARCHAR(50) REFERENCES scrape_sources(key),
    is_enabled BOOLEAN DEFAULT true,
    keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
    custom_filters JSONB DEFAULT '{}'::jsonb,
    last_scraped_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, source_key)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_onboarding ON users(onboarding_completed);
CREATE INDEX IF NOT EXISTS idx_user_scraper_configs_user_id ON user_scraper_configs(user_id);

-- Enable RLS on new tables
ALTER TABLE scrape_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_scraper_configs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Scrape sources are readable by all" ON scrape_sources;
CREATE POLICY "Scrape sources are readable by all" ON scrape_sources
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage own scraper configs" ON user_scraper_configs;
CREATE POLICY "Users can manage own scraper configs" ON user_scraper_configs
    FOR ALL USING (
        user_id IN (SELECT id FROM users WHERE auth.uid() = id)
    );

-- Trigger for updated_at on user_scraper_configs
DROP TRIGGER IF EXISTS trigger_user_scraper_configs_updated_at ON user_scraper_configs;
CREATE TRIGGER trigger_user_scraper_configs_updated_at
    BEFORE UPDATE ON user_scraper_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
