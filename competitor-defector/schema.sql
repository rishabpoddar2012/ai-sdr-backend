-- Competitor Defection Detector Schema
-- Add these tables to the existing AI SDR database

-- ============================================
-- COMPETITORS TABLE (Track competitors to monitor)
-- ============================================
CREATE TABLE IF NOT EXISTS competitors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    g2_slug VARCHAR(255),
    capterra_slug VARCHAR(255),
    website VARCHAR(500),
    industry VARCHAR(100),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- COMPETITOR REVIEWS TABLE (Raw reviews from G2/Capterra)
-- ============================================
CREATE TABLE IF NOT EXISTS competitor_reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    competitor_id UUID REFERENCES competitors(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    source VARCHAR(50) NOT NULL, -- 'g2' or 'capterra'
    source_review_id VARCHAR(255) UNIQUE,
    reviewer_name VARCHAR(255),
    reviewer_title VARCHAR(255),
    reviewer_company VARCHAR(255),
    reviewer_company_size VARCHAR(50),
    reviewer_industry VARCHAR(100),
    review_title TEXT,
    review_content TEXT NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    date_posted DATE,
    source_url VARCHAR(500),
    is_negative BOOLEAN DEFAULT false,
    has_defection_signal BOOLEAN DEFAULT false,
    defection_keywords TEXT[],
    sentiment_score DECIMAL(3,2), -- -1.0 to 1.0
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- DEFECTOR LEADS TABLE (High-intent defection prospects)
-- ============================================
CREATE TABLE IF NOT EXISTS defector_leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    competitor_id UUID REFERENCES competitors(id) ON DELETE CASCADE,
    review_id UUID REFERENCES competitor_reviews(id) ON DELETE SET NULL,
    
    -- Lead Information
    company_name VARCHAR(255),
    contact_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    linkedin_url VARCHAR(500),
    
    -- Defection Signals
    defection_intent_score INTEGER DEFAULT 0, -- 0-100
    defection_stage VARCHAR(50), -- 'researching', 'evaluating', 'decided', 'implemented'
    current_tool VARCHAR(255), -- What they're leaving
    pain_points TEXT[],
    desired_features TEXT[],
    timeline VARCHAR(100), -- e.g., 'Q1 2025', 'ASAP', '6 months'
    
    -- Status
    status VARCHAR(20) DEFAULT 'new', -- 'new', 'contacted', 'qualified', 'opportunity', 'closed_won', 'closed_lost'
    priority VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
    
    -- Enrichment Data
    company_size VARCHAR(50),
    company_revenue VARCHAR(100),
    company_website VARCHAR(500),
    industry VARCHAR(100),
    location VARCHAR(200),
    
    -- Engagement
    last_contact_date TIMESTAMP WITH TIME ZONE,
    contact_count INTEGER DEFAULT 0,
    notes TEXT,
    
    -- Metadata
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- DEFECTOR ALERTS TABLE (Alert history)
-- ============================================
CREATE TABLE IF NOT EXISTS defector_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    defector_lead_id UUID REFERENCES defector_leads(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL, -- 'new_defector', 'high_intent', 'contact_needed'
    severity VARCHAR(20) NOT NULL, -- 'info', 'warning', 'critical'
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    sent_via VARCHAR(50)[], -- ['email', 'slack', 'webhook']
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- COMPETITOR PITCHES TABLE (Generated outreach messages)
-- ============================================
CREATE TABLE IF NOT EXISTS competitor_pitches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    defector_lead_id UUID REFERENCES defector_leads(id) ON DELETE CASCADE,
    
    -- Pitch Content
    pitch_subject VARCHAR(500),
    pitch_body TEXT NOT NULL,
    pitch_type VARCHAR(50), -- 'email', 'linkedin', 'cold_call_script'
    
    -- Personalization
    personalization_points TEXT[], -- What was personalized
    pain_point_addressed VARCHAR(255),
    value_proposition TEXT,
    
    -- Performance
    is_sent BOOLEAN DEFAULT false,
    sent_at TIMESTAMP WITH TIME ZONE,
    opened BOOLEAN,
    clicked BOOLEAN,
    replied BOOLEAN,
    
    -- AI Metadata
    ai_model VARCHAR(100),
    ai_prompt TEXT,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ALERT CONFIGURATION TABLE (User alert preferences)
-- ============================================
CREATE TABLE IF NOT EXISTS defector_alert_configs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    
    -- Alert Thresholds
    min_defection_score INTEGER DEFAULT 70, -- Only alert if score >= this
    alert_on_new_defector BOOLEAN DEFAULT true,
    alert_on_high_intent BOOLEAN DEFAULT true,
    
    -- Notification Channels
    email_alerts BOOLEAN DEFAULT true,
    slack_webhook_url TEXT,
    slack_channel VARCHAR(100),
    webhook_url TEXT,
    
    -- Frequency
    digest_frequency VARCHAR(20) DEFAULT 'immediate', -- 'immediate', 'hourly', 'daily'
    
    -- Filters
    min_company_size VARCHAR(50), -- e.g., '50+'
    target_industries TEXT[],
    exclude_industries TEXT[],
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- KEYWORD PATTERNS TABLE (Track keyword effectiveness)
-- ============================================
CREATE TABLE IF NOT EXISTS defection_keywords (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    keyword VARCHAR(255) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL, -- 'switching', 'alternative', 'pain', 'timeline'
    weight INTEGER DEFAULT 1, -- Scoring weight
    is_active BOOLEAN DEFAULT true,
    match_count INTEGER DEFAULT 0,
    conversion_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_competitors_user_id ON competitors(user_id);
CREATE INDEX IF NOT EXISTS idx_competitors_name ON competitors(name);

CREATE INDEX IF NOT EXISTS idx_competitor_reviews_competitor_id ON competitor_reviews(competitor_id);
CREATE INDEX IF NOT EXISTS idx_competitor_reviews_user_id ON competitor_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_competitor_reviews_source ON competitor_reviews(source);
CREATE INDEX IF NOT EXISTS idx_competitor_reviews_has_defection ON competitor_reviews(has_defection_signal) WHERE has_defection_signal = true;
CREATE INDEX IF NOT EXISTS idx_competitor_reviews_created_at ON competitor_reviews(created_at);

CREATE INDEX IF NOT EXISTS idx_defector_leads_user_id ON defector_leads(user_id);
CREATE INDEX IF NOT EXISTS idx_defector_leads_competitor_id ON defector_leads(competitor_id);
CREATE INDEX IF NOT EXISTS idx_defector_leads_status ON defector_leads(status);
CREATE INDEX IF NOT EXISTS idx_defector_leads_priority ON defector_leads(priority);
CREATE INDEX IF NOT EXISTS idx_defector_leads_score ON defector_leads(defection_intent_score);
CREATE INDEX IF NOT EXISTS idx_defector_leads_created_at ON defector_leads(created_at);

CREATE INDEX IF NOT EXISTS idx_defector_alerts_user_id ON defector_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_defector_alerts_is_read ON defector_alerts(is_read);

CREATE INDEX IF NOT EXISTS idx_competitor_pitches_defector_lead_id ON competitor_pitches(defector_lead_id);
CREATE INDEX IF NOT EXISTS idx_competitor_pitches_is_sent ON competitor_pitches(is_sent);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE defector_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE defector_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_pitches ENABLE ROW LEVEL SECURITY;
ALTER TABLE defector_alert_configs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own competitor data
CREATE POLICY "Users can only see own competitors" ON competitors
    FOR ALL USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can only see own reviews" ON competitor_reviews
    FOR ALL USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can only see own defector leads" ON defector_leads
    FOR ALL USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can only see own alerts" ON defector_alerts
    FOR ALL USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can only see own pitches" ON competitor_pitches
    FOR ALL USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can only see own alert config" ON defector_alert_configs
    FOR ALL USING (auth.uid()::text = user_id::text);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
DROP TRIGGER IF EXISTS update_competitors_updated_at ON competitors;
CREATE TRIGGER update_competitors_updated_at
    BEFORE UPDATE ON competitors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_defector_leads_updated_at ON defector_leads;
CREATE TRIGGER update_defector_leads_updated_at
    BEFORE UPDATE ON defector_leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_defector_alert_configs_updated_at ON defector_alert_configs;
CREATE TRIGGER update_defector_alert_configs_updated_at
    BEFORE UPDATE ON defector_alert_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate defection score
CREATE OR REPLACE FUNCTION calculate_defection_score(
    p_keywords TEXT[],
    p_sentiment DECIMAL,
    p_rating INTEGER
) RETURNS INTEGER AS $$
DECLARE
    v_score INTEGER := 0;
    v_keyword_count INTEGER;
BEGIN
    -- Base score from sentiment (negative sentiment = higher score)
    v_score := v_score + GREATEST(0, CAST((-p_sentiment * 50) AS INTEGER));
    
    -- Score from keywords
    v_keyword_count := array_length(p_keywords, 1);
    IF v_keyword_count IS NOT NULL THEN
        v_score := v_score + (v_keyword_count * 10);
    END IF;
    
    -- Score from rating (lower rating = higher score)
    IF p_rating IS NOT NULL THEN
        v_score := v_score + ((5 - p_rating) * 10);
    END IF;
    
    -- Cap at 100
    RETURN LEAST(100, v_score);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SEED DATA - Default Defection Keywords
-- ============================================
INSERT INTO defection_keywords (keyword, category, weight) VALUES
    -- Switching intent
    ('switching', 'switching', 3),
    ('switch from', 'switching', 3),
    ('switching from', 'switching', 3),
    ('switched to', 'switching', 3),
    ('moved to', 'switching', 2),
    ('migrating to', 'switching', 3),
    ('migration', 'switching', 2),
    
    -- Alternative seeking
    ('alternative', 'alternative', 3),
    ('alternative to', 'alternative', 3),
    ('looking for alternative', 'alternative', 4),
    ('evaluating alternatives', 'alternative', 4),
    ('exploring options', 'alternative', 3),
    ('considering alternatives', 'alternative', 3),
    ('better alternative', 'alternative', 3),
    ('cheaper alternative', 'alternative', 3),
    
    -- Replacement intent
    ('replacement', 'replacement', 3),
    ('replace', 'replacement', 3),
    ('replacing', 'replacement', 3),
    ('looking to replace', 'replacement', 4),
    ('need to replace', 'replacement', 4),
    
    -- Pain/frustration
    ('tired of', 'pain', 4),
    ('frustrated with', 'pain', 4),
    ('fed up with', 'pain', 4),
    ('sick of', 'pain', 4),
    ('hate', 'pain', 3),
    ('terrible', 'pain', 2),
    ('awful', 'pain', 2),
    ('disappointing', 'pain', 2),
    ('unhappy with', 'pain', 3),
    ('dissatisfied', 'pain', 3),
    ('regret', 'pain', 3),
    ('waste of money', 'pain', 4),
    ('not worth', 'pain', 3),
    ('problems with', 'pain', 3),
    ('issues with', 'pain', 3),
    ('buggy', 'pain', 2),
    ('unreliable', 'pain', 3),
    ('slow', 'pain', 2),
    ('constantly crashes', 'pain', 3),
    ('poor support', 'pain', 3),
    ('terrible customer service', 'pain', 3),
    
    -- Leaving/Churn signals
    ('leaving', 'churn', 4),
    ('left', 'churn', 3),
    ('canceled', 'churn', 4),
    ('canceling', 'churn', 4),
    ('cancelled', 'churn', 4),
    ('cancellation', 'churn', 3),
    ('not renewing', 'churn', 4),
    ('won''t renew', 'churn', 4),
    ('subscription ending', 'churn', 3),
    ('moving away from', 'churn', 4),
    ('stop using', 'churn', 3),
    ('done with', 'churn', 3),
    
    -- Timeline urgency
    ('asap', 'timeline', 3),
    ('immediately', 'timeline', 3),
    ('urgent', 'timeline', 2),
    ('this quarter', 'timeline', 2),
    ('end of month', 'timeline', 2),
    ('next month', 'timeline', 2),
    ('this month', 'timeline', 2),
    ('soon', 'timeline', 1)
ON CONFLICT (keyword) DO NOTHING;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================
GRANT ALL ON competitors TO authenticated;
GRANT ALL ON competitor_reviews TO authenticated;
GRANT ALL ON defector_leads TO authenticated;
GRANT ALL ON defector_alerts TO authenticated;
GRANT ALL ON competitor_pitches TO authenticated;
GRANT ALL ON defector_alert_configs TO authenticated;
GRANT ALL ON defection_keywords TO authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
