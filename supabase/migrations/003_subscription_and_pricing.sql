-- AI SDR Subscription & Pricing Migration

-- Add subscription fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(20) DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS leads_used_this_month INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS leads_limit INTEGER DEFAULT 10;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS scrape_frequency VARCHAR(20) DEFAULT 'daily';
ALTER TABLE users ADD COLUMN IF NOT EXISTS lead_types TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Create subscription_plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
    id SERIAL PRIMARY KEY,
    key VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price_monthly INTEGER NOT NULL,
    price_yearly INTEGER,
    leads_limit INTEGER NOT NULL,
    scrape_frequency VARCHAR(20) NOT NULL,
    sources_limit INTEGER,
    features JSONB DEFAULT '{}'::jsonb,
    stripe_price_id VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert pricing plans
INSERT INTO subscription_plans (key, name, description, price_monthly, leads_limit, scrape_frequency, sources_limit, features) VALUES
('free', 'Free', 'Perfect for trying out AI SDR', 0, 10, 'daily', 1, '{"api_access": false, "webhooks": false, "support": "community"}'::jsonb),
('pro', 'Pro', 'For growing sales teams', 2900, 500, 'hourly', NULL, '{"api_access": true, "webhooks": true, "support": "priority"}'::jsonb),
('enterprise', 'Enterprise', 'For large organizations', 9900, 999999, 'realtime', NULL, '{"api_access": true, "webhooks": true, "support": "dedicated", "custom_integration": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Create user_activity_logs table for tracking
CREATE TABLE IF NOT EXISTS user_activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    activity_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_subscription ON users(subscription_tier, subscription_status);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_id ON user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_type ON user_activity_logs(activity_type);

-- Function to reset free tier leads weekly
CREATE OR REPLACE FUNCTION reset_free_tier_leads()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE users 
    SET leads_used_this_month = 0,
        updated_at = NOW()
    WHERE subscription_tier = 'free'
    AND subscription_status = 'active';
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user can add lead
CREATE OR REPLACE FUNCTION can_user_add_lead(p_user_id UUID)
RETURNS TABLE(
    can_add BOOLEAN,
    current_usage INTEGER,
    limit_amount INTEGER,
    upgrade_required BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_tier VARCHAR(20);
    v_usage INTEGER;
    v_limit INTEGER;
    v_status VARCHAR(20);
BEGIN
    SELECT subscription_tier, leads_used_this_month, leads_limit, subscription_status
    INTO v_tier, v_usage, v_limit, v_status
    FROM users WHERE id = p_user_id;
    
    IF v_status != 'active' THEN
        RETURN QUERY SELECT FALSE, v_usage, v_limit, TRUE, 'Your subscription is not active. Please renew.'::TEXT;
        RETURN;
    END IF;
    
    IF v_usage >= v_limit THEN
        RETURN QUERY SELECT FALSE, v_usage, v_limit, TRUE, 
            CASE 
                WHEN v_tier = 'free' THEN 'You''ve reached your free limit. Upgrade to Pro for 500 leads/month!'
                WHEN v_tier = 'pro' THEN 'You''ve reached your Pro limit. Upgrade to Enterprise for unlimited leads!'
                ELSE 'You''ve reached your limit. Contact sales for more.'
            END::TEXT;
        RETURN;
    END IF;
    
    RETURN QUERY SELECT TRUE, v_usage, v_limit, FALSE, 'OK'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Function to increment lead usage
CREATE OR REPLACE FUNCTION increment_lead_usage(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE users 
    SET leads_used_this_month = leads_used_this_month + 1,
        updated_at = NOW()
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;
