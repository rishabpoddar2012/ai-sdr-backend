-- AI Sales Closer - Database Schema
-- Stores pitch templates, generated pitches, and objection handlers

-- Pitch templates for different scenarios
CREATE TABLE IF NOT EXISTS pitch_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Template details
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL, -- funding, hiring, expansion, competitor_switch, etc.
    
    -- Template content
    opening_line TEXT NOT NULL,
    value_proposition TEXT NOT NULL,
    social_proof TEXT,
    call_to_action TEXT NOT NULL,
    
    -- Personalization variables
    variables TEXT[] DEFAULT ARRAY[], -- ['company_name', 'funding_amount', 'hiring_count']
    
    -- Metadata
    is_default BOOLEAN DEFAULT false,
    usage_count INTEGER DEFAULT 0,
    success_rate DECIMAL(5,2), -- percentage
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Generated pitches for specific leads
CREATE TABLE IF NOT EXISTS generated_pitches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    
    -- Lead context used for generation
    lead_context JSONB NOT NULL, -- snapshot of lead data at generation time
    
    -- Generated content
    pitch_text TEXT NOT NULL,
    email_subject TEXT,
    talking_points TEXT[],
    points_to_avoid TEXT[],
    
    -- Objection handling
    objection_handlers JSONB, -- {objection: response}
    
    -- Timing recommendation
    recommended_time TIMESTAMP,
    recommended_channel VARCHAR(20), -- call, email, linkedin
    
    -- AI metadata
    ai_model VARCHAR(50) DEFAULT 'gpt-4',
    confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
    
    -- Usage tracking
    was_used BOOLEAN DEFAULT false,
    used_at TIMESTAMP,
    outcome VARCHAR(50), -- meeting_booked, no_response, not_interested, etc.
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Objection handling templates
CREATE TABLE IF NOT EXISTS objection_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Objection details
    objection_text TEXT NOT NULL, -- "We already have a vendor"
    category VARCHAR(50) NOT NULL, -- pricing, timing, competition, authority
    
    -- Response strategy
    response_template TEXT NOT NULL,
    follow_up_questions TEXT[],
    
    -- Effectiveness
    usage_count INTEGER DEFAULT 0,
    success_rate DECIMAL(5,2),
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Sales playbook configurations
CREATE TABLE IF NOT EXISTS sales_playbooks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Playbook settings
    name VARCHAR(255) NOT NULL,
    industry VARCHAR(100),
    
    -- Value propositions
    value_props TEXT[] NOT NULL, -- ['Save 10 hours/week', 'Reduce churn by 30%']
    
    -- Social proof
    case_studies JSONB[], -- [{company: 'X', result: 'Y'}]
    testimonials TEXT[],
    
    -- Competitive positioning
    competitors TEXT[],
    differentiation TEXT, -- Why us vs them
    
    -- Pricing
    pricing_tiers JSONB, -- {starter: 99, growth: 299, enterprise: 999}
    
    -- Talk tracks
    discovery_questions TEXT[],
    qualification_criteria TEXT[],
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Call/email scripts history
CREATE TABLE IF NOT EXISTS outreach_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    generated_pitch_id UUID REFERENCES generated_pitches(id) ON DELETE SET NULL,
    
    -- Outreach details
    channel VARCHAR(20) NOT NULL, -- email, call, linkedin, sms
    direction VARCHAR(10) NOT NULL, -- outbound, inbound
    
    -- Content
    message_content TEXT,
    ai_suggestions_used BOOLEAN DEFAULT false,
    
    -- Outcome
    outcome VARCHAR(50), -- sent, delivered, opened, replied, meeting_booked
    outcome_at TIMESTAMP,
    notes TEXT,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_generated_pitches_user ON generated_pitches(user_id);
CREATE INDEX idx_generated_pitches_lead ON generated_pitches(lead_id);
CREATE INDEX idx_generated_pitches_outcome ON generated_pitches(outcome);
CREATE INDEX idx_pitch_templates_user ON pitch_templates(user_id);
CREATE INDEX idx_pitch_templates_category ON pitch_templates(category);
CREATE INDEX idx_objection_templates_user ON objection_templates(user_id);
CREATE INDEX idx_objection_templates_category ON objection_templates(category);
CREATE INDEX idx_outreach_history_user ON outreach_history(user_id);
CREATE INDEX idx_outreach_history_lead ON outreach_history(lead_id);

-- Enable RLS
ALTER TABLE pitch_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_pitches ENABLE ROW LEVEL SECURITY;
ALTER TABLE objection_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can only see own pitch templates" ON pitch_templates
    FOR ALL USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can only see own generated pitches" ON generated_pitches
    FOR ALL USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can only see own objection templates" ON objection_templates
    FOR ALL USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can only see own sales playbooks" ON sales_playbooks
    FOR ALL USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can only see own outreach history" ON outreach_history
    FOR ALL USING (auth.uid()::text = user_id::text);

-- Default pitch templates (seed data)
INSERT INTO pitch_templates (name, category, opening_line, value_proposition, social_proof, call_to_action, variables, is_default) VALUES
(
    'Post-Funding Outreach',
    'funding',
    'Hi {{name}}, congrats on the {{funding_round}}! I saw {{company_name}} just raised {{funding_amount}}. Most companies at your stage struggle with {{pain_point}} as they scale.',
    'We help {{industry}} companies like yours {{solution_benefit}} without the typical growing pains.',
    '{{similar_company}} used us to {{specific_result}} after their Series A.',
    'Worth a 10-minute call to see if we can help {{company_name}} avoid the same pitfalls?',
    ARRAY['name', 'company_name', 'funding_round', 'funding_amount', 'pain_point', 'industry', 'solution_benefit', 'similar_company', 'specific_result'],
    true
),
(
    'Hiring Spree Outreach',
    'hiring',
    'Hi {{name}}, noticed {{company_name}} is hiring {{hiring_count}} {{role_type}} roles. Growing pains are real!',
    'We help fast-growing teams {{solution_benefit}} so your new hires can be productive from day one.',
    '{{similar_company}} cut onboarding time by 50% using our platform while scaling from {{employee_count_before}} to {{employee_count_after}} employees.',
    'Can I show you how we helped them scale without the chaos?',
    ARRAY['name', 'company_name', 'hiring_count', 'role_type', 'solution_benefit', 'similar_company', 'employee_count_before', 'employee_count_after'],
    true
),
(
    'Competitor Switch Outreach',
    'competitor_switch',
    'Hi {{name}}, saw your post about frustrations with {{competitor_name}}. You''re not alone - we hear this daily.',
    'We built {{product_name}} specifically to solve {{competitor_pain_point}} without the {{common_complaint}}.',
    '{{similar_company}} switched from {{competitor_name}} last quarter and saw {{specific_improvement}} in their first month.',
    'Worth seeing if we''re a better fit? No migration headaches, I promise.',
    ARRAY['name', 'competitor_name', 'product_name', 'competitor_pain_point', 'common_complaint', 'similar_company', 'specific_improvement'],
    true
),
(
    'Expansion Outreach',
    'expansion',
    'Hi {{name}}, congrats on expanding to {{new_market}}! That''s a bold move.',
    'We help companies entering new markets {{solution_benefit}} so you can focus on growth instead of operational headaches.',
    '{{similar_company}} used us when they expanded to {{their_market}} and hit their revenue targets 2 months early.',
    'Want to see how we can support {{company_name}}''s expansion?',
    ARRAY['name', 'company_name', 'new_market', 'solution_benefit', 'similar_company', 'their_market'],
    true
),
(
    'General Cold Outreach',
    'general',
    'Hi {{name}}, reaching out because {{company_name}} fits the profile of companies we help best - {{company_description}}.',
    'We specialize in helping {{industry}} companies {{main_benefit}}.',
    'Recently helped {{similar_company}} achieve {{specific_result}} in just {{timeframe}}.',
    'Is {{pain_point}} something you''re dealing with at {{company_name}}?',
    ARRAY['name', 'company_name', 'company_description', 'industry', 'main_benefit', 'similar_company', 'specific_result', 'timeframe', 'pain_point'],
    true
);

-- Default objection handlers (seed data)
INSERT INTO objection_templates (objection_text, category, response_template, follow_up_questions) VALUES
(
    'We already have a vendor',
    'competition',
    'Totally understand - most companies we work with said the same thing. What they found was that switching actually {{benefit}}. Worth a 10-minute call just to compare? No pressure to switch, just want to show you what''s possible.',
    ARRAY['What do you like most about your current solution?', 'What would you change if you could?', 'When does your contract renew?']
),
(
    'We don''t have budget right now',
    'pricing',
    'I hear that a lot. Here''s the thing - our customers typically see ROI within {{roi_timeframe}}, so it pays for itself. Plus, we have a {{trial_offer}} that lets you test drive it risk-free. Worst case, you get some ideas you can use even with your current setup.',
    ARRAY['What''s your current budget cycle?', 'When are you typically planning next year''s budget?', 'What would need to happen to justify the investment?']
),
(
    'Send me an email with more info',
    'timing',
    'Absolutely, I''ll send that over. But honestly, email doesn''t do it justice - can we also grab a quick 15-minute call where I can show you exactly how this works? I think you''ll see the value immediately.',
    ARRAY['What''s the best time for a quick demo?', 'Who else should be on that call?', 'What''s the main thing you want to see?']
),
(
    'I''m not the decision maker',
    'authority',
    'No problem! Who would be the right person to loop in? I can tailor the conversation to what matters most to them. Also, it''d be great to have you on the call since you understand the day-to-day challenges best.',
    ARRAY['Who typically makes these decisions?', 'What''s their biggest priority right now?', 'Can you introduce us?']
),
(
    'We''re too busy right now',
    'timing',
    'I get it - you''re scaling fast and swamped. That''s actually WHY we should talk. {{product_name}} specifically helps busy teams like yours {{time_saving_benefit}}. 10 minutes now could save you {{hours_saved}} hours per week.',
    ARRAY['What''s taking up most of your time right now?', 'What would you automate if you could?', 'When would be a better time to connect?']
);

-- Functions
CREATE OR REPLACE FUNCTION get_pitch_success_rate(p_template_id UUID)
RETURNS DECIMAL AS $$
DECLARE
    rate DECIMAL;
BEGIN
    SELECT AVG(success_rate) INTO rate
    FROM generated_pitches
    WHERE template_id = p_template_id AND outcome IS NOT NULL;
    RETURN COALESCE(rate, 0);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_top_objection_handlers(p_user_id UUID, p_category VARCHAR)
RETURNS TABLE (
    id UUID,
    objection_text TEXT,
    response_template TEXT,
    success_rate DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ot.id,
        ot.objection_text,
        ot.response_template,
        ot.success_rate
    FROM objection_templates ot
    WHERE ot.user_id = p_user_id 
      AND ot.category = p_category
    ORDER BY ot.success_rate DESC NULLS LAST, ot.usage_count DESC
    LIMIT 3;
END;
$$ LANGUAGE plpgsql;
