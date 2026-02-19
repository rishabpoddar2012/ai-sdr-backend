-- Buying Intent Radar - Database Schema
-- Run this in Supabase SQL Editor

-- Companies being tracked
CREATE TABLE IF NOT EXISTS tracked_companies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    linkedin_url VARCHAR(500),
    industry VARCHAR(100),
    employee_count INTEGER,
    funding_stage VARCHAR(50),
    total_funding DECIMAL(15,2),
    location VARCHAR(255),
    is_target BOOLEAN DEFAULT true,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_signal_at TIMESTAMP
);

-- Intent signals detected
CREATE TABLE IF NOT EXISTS intent_signals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES tracked_companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Signal details
    signal_type VARCHAR(50) NOT NULL, -- funding, hiring, tech_change, review, expansion, etc.
    signal_category VARCHAR(20) NOT NULL, -- hot, warm, cold
    
    -- Source info
    source VARCHAR(50) NOT NULL, -- crunchbase, linkedin, g2, indeed, etc.
    source_url TEXT,
    
    -- Signal content
    title TEXT NOT NULL,
    description TEXT,
    detected_at TIMESTAMP DEFAULT NOW(),
    
    -- Metadata
    confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
    is_read BOOLEAN DEFAULT false,
    is_actioned BOOLEAN DEFAULT false,
    
    -- Action tracking
    action_taken VARCHAR(50), -- emailed, called, linkedin, nothing
    action_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- User alert preferences
CREATE TABLE IF NOT EXISTS alert_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Alert channels
    email_alerts BOOLEAN DEFAULT true,
    slack_webhook_url TEXT,
    
    -- Signal filters
    min_signal_category VARCHAR(20) DEFAULT 'warm', -- only warm and above
    signal_types TEXT[] DEFAULT ARRAY['funding', 'hiring', 'tech_change'],
    
    -- Frequency
    digest_frequency VARCHAR(20) DEFAULT 'immediate', -- immediate, hourly, daily
    digest_time TIME DEFAULT '09:00',
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Competitor tracking
CREATE TABLE IF NOT EXISTS tracked_competitors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    g2_url VARCHAR(500),
    keywords TEXT[], -- to track mentions
    created_at TIMESTAMP DEFAULT NOW()
);

-- Competitor reviews/sentiment
CREATE TABLE IF NOT EXISTS competitor_sentiment (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    competitor_id UUID REFERENCES tracked_competitors(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    source VARCHAR(50) NOT NULL, -- g2, capterra, trustpilot, twitter
    review_text TEXT,
    sentiment VARCHAR(20), -- positive, negative, neutral
    sentiment_score DECIMAL(3,2), -- -1 to 1
    reviewer_company VARCHAR(255),
    review_url TEXT,
    reviewed_at TIMESTAMP,
    
    is_switching BOOLEAN DEFAULT false, -- detected intent to switch
    detected_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_tracked_companies_user ON tracked_companies(user_id);
CREATE INDEX idx_tracked_companies_domain ON tracked_companies(domain);
CREATE INDEX idx_intent_signals_company ON intent_signals(company_id);
CREATE INDEX idx_intent_signals_user ON intent_signals(user_id);
CREATE INDEX idx_intent_signals_type ON intent_signals(signal_type);
CREATE INDEX idx_intent_signals_category ON intent_signals(signal_category);
CREATE INDEX idx_intent_signals_detected ON intent_signals(detected_at);
CREATE INDEX idx_intent_signals_unread ON intent_signals(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_competitor_sentiment_competitor ON competitor_sentiment(competitor_id);
CREATE INDEX idx_competitor_sentiment_sentiment ON competitor_sentiment(sentiment);

-- Enable RLS
ALTER TABLE tracked_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE intent_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracked_competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_sentiment ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can only see own tracked companies" ON tracked_companies
    FOR ALL USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can only see own intent signals" ON intent_signals
    FOR ALL USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can only see own alert preferences" ON alert_preferences
    FOR ALL USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can only see own competitors" ON tracked_competitors
    FOR ALL USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can only see own sentiment data" ON competitor_sentiment
    FOR ALL USING (auth.uid()::text = user_id::text);

-- Function to get unread signal count
CREATE OR REPLACE FUNCTION get_unread_signal_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    count_val INTEGER;
BEGIN
    SELECT COUNT(*) INTO count_val
    FROM intent_signals
    WHERE user_id = p_user_id AND is_read = false;
    RETURN count_val;
END;
$$ LANGUAGE plpgsql;

-- Function to mark signals as read
CREATE OR REPLACE FUNCTION mark_signals_read(p_user_id UUID, p_signal_ids UUID[])
RETURNS VOID AS $$
BEGIN
    UPDATE intent_signals
    SET is_read = true
    WHERE user_id = p_user_id AND id = ANY(p_signal_ids);
END;
$$ LANGUAGE plpgsql;

-- Function to get hot leads this week
CREATE OR REPLACE FUNCTION get_hot_leads_this_week(p_user_id UUID)
RETURNS TABLE (
    company_name VARCHAR,
    signal_count BIGINT,
    latest_signal TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tc.name,
        COUNT(*) as signal_count,
        MAX(is_.detected_at) as latest_signal
    FROM intent_signals is_
    JOIN tracked_companies tc ON is_.company_id = tc.id
    WHERE is_.user_id = p_user_id
      AND is_.signal_category = 'hot'
      AND is_.detected_at > NOW() - INTERVAL '7 days'
    GROUP BY tc.name
    ORDER BY signal_count DESC, latest_signal DESC;
END;
$$ LANGUAGE plpgsql;

-- Seed data for testing
-- INSERT INTO tracked_companies (name, domain, industry, employee_count, funding_stage, user_id) VALUES
-- ('TechCorp', 'techcorp.com', 'SaaS', 150, 'Series B', 'user-uuid-here'),
-- ('GrowthCo', 'growthco.com', 'Marketing', 50, 'Series A', 'user-uuid-here');

-- INSERT INTO intent_signals (company_id, user_id, signal_type, signal_category, source, title, description, confidence_score) VALUES
-- ('company-uuid', 'user-uuid', 'funding', 'hot', 'crunchbase', 'Raised $10M Series B', 'Company raised fresh funding, likely has budget for new tools', 95),
-- ('company-uuid', 'user-uuid', 'hiring', 'warm', 'linkedin', 'Hiring 5 Sales Development Reps', 'Expanding sales team, likely need sales tools', 80);
