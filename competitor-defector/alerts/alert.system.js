/**
 * Defection Alert System
 * Sends notifications when high-intent defectors are detected
 */

class AlertSystem {
    constructor(config = {}) {
        this.supabase = config.supabase || null;
        this.emailService = config.emailService || null;
        this.slackWebhook = config.slackWebhook || null;
        this.webhookUrl = config.webhookUrl || null;
    }

    /**
     * Initialize Supabase client
     */
    initSupabase(url, key) {
        const { createClient } = require('@supabase/supabase-js');
        this.supabase = createClient(url, key);
    }

    /**
     * Check if an alert should be sent based on user configuration
     * @param {Object} lead - Defector lead object
     * @param {Object} config - User alert configuration
     * @returns {boolean}
     */
    shouldAlert(lead, config) {
        if (!config) return true; // Default to alerting if no config
        
        // Check minimum score threshold
        if (lead.defection_intent_score < config.min_defection_score) {
            return false;
        }
        
        // Check industry filters
        if (config.target_industries && config.target_industries.length > 0) {
            if (!config.target_industries.includes(lead.industry)) {
                return false;
            }
        }
        
        // Check excluded industries
        if (config.exclude_industries && config.exclude_industries.length > 0) {
            if (config.exclude_industries.includes(lead.industry)) {
                return false;
            }
        }
        
        // Check company size
        if (config.min_company_size && lead.company_size) {
            const minSize = this.parseCompanySize(config.min_company_size);
            const leadSize = this.parseCompanySize(lead.company_size);
            if (leadSize < minSize) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * Parse company size string to numeric value
     * @param {string} sizeStr 
     * @returns {number}
     */
    parseCompanySize(sizeStr) {
        if (!sizeStr) return 0;
        
        const match = sizeStr.match(/(\d+)/);
        if (match) {
            return parseInt(match[1]);
        }
        
        // Handle ranges like "51-200"
        const rangeMatch = sizeStr.match(/(\d+)-\d+/);
        if (rangeMatch) {
            return parseInt(rangeMatch[1]);
        }
        
        return 0;
    }

    /**
     * Send alert for a new defector lead
     * @param {Object} lead - Defector lead
     * @param {Object} review - Source review
     * @param {string} userId - User ID
     * @returns {Promise<Object>}
     */
    async sendNewDefectorAlert(lead, review, userId) {
        // Get user alert configuration
        const config = await this.getAlertConfig(userId);
        
        if (!this.shouldAlert(lead, config)) {
            console.log(`[Alert] Lead ${lead.id} suppressed based on user config`);
            return null;
        }
        
        const alertData = {
            user_id: userId,
            defector_lead_id: lead.id,
            alert_type: 'new_defector',
            severity: this.getSeverity(lead.defection_intent_score),
            message: this.buildAlertMessage(lead, review)
        };
        
        // Save alert to database
        const { data: savedAlert, error } = await this.supabase
            .from('defector_alerts')
            .insert(alertData)
            .select()
            .single();
        
        if (error) {
            console.error('[Alert] Error saving alert:', error);
            return null;
        }
        
        // Send notifications
        const sentVia = [];
        
        if (config?.email_alerts !== false) {
            await this.sendEmailAlert(lead, review, userId);
            sentVia.push('email');
        }
        
        if (config?.slack_webhook_url) {
            await this.sendSlackAlert(lead, review, config.slack_webhook_url);
            sentVia.push('slack');
        }
        
        if (config?.webhook_url) {
            await this.sendWebhookAlert(lead, review, config.webhook_url);
            sentVia.push('webhook');
        }
        
        // Update alert with sent channels
        await this.supabase
            .from('defector_alerts')
            .update({ sent_via: sentVia })
            .eq('id', savedAlert.id);
        
        console.log(`[Alert] Sent new defector alert for ${lead.company_name} via: ${sentVia.join(', ')}`);
        
        return savedAlert;
    }

    /**
     * Send high-intent alert (for leads with score >= 80)
     * @param {Object} lead 
     * @param {Object} review 
     * @param {string} userId 
     * @returns {Promise<Object>}
     */
    async sendHighIntentAlert(lead, review, userId) {
        const alertData = {
            user_id: userId,
            defector_lead_id: lead.id,
            alert_type: 'high_intent',
            severity: 'critical',
            message: `🔥 HIGH INTENT DEFECTOR: ${lead.company_name} has a defection score of ${lead.defection_intent_score}/100. Immediate outreach recommended!`
        };
        
        const { data: savedAlert, error } = await this.supabase
            .from('defector_alerts')
            .insert(alertData)
            .select()
            .single();
        
        if (error) {
            console.error('[Alert] Error saving high-intent alert:', error);
            return null;
        }
        
        // Always notify for high-intent leads
        await this.sendEmailAlert(lead, review, userId, true);
        
        console.log(`[Alert] Sent HIGH INTENT alert for ${lead.company_name}`);
        
        return savedAlert;
    }

    /**
     * Send follow-up alert for leads needing contact
     * @param {Array} leads - Leads that haven't been contacted
     * @param {string} userId 
     * @returns {Promise<Object>}
     */
    async sendContactNeededAlert(leads, userId) {
        if (leads.length === 0) return null;
        
        const alertData = {
            user_id: userId,
            alert_type: 'contact_needed',
            severity: 'warning',
            message: `You have ${leads.length} high-intent defector leads that haven't been contacted yet.`
        };
        
        const { data: savedAlert, error } = await this.supabase
            .from('defector_alerts')
            .insert(alertData)
            .select()
            .single();
        
        if (error) {
            console.error('[Alert] Error saving contact-needed alert:', error);
            return null;
        }
        
        return savedAlert;
    }

    /**
     * Build alert message
     * @param {Object} lead 
     * @param {Object} review 
     * @returns {string}
     */
    buildAlertMessage(lead, review) {
        const lines = [
            `🎯 New Competitor Defector Detected!`,
            ``,
            `Company: ${lead.company_name || 'Unknown'}`,
            `Contact: ${lead.contact_name || 'Unknown'}`,
            `Industry: ${lead.industry || 'Unknown'}`,
            `Company Size: ${lead.company_size || 'Unknown'}`,
            ``,
            `Defection Score: ${lead.defection_intent_score}/100`,
            `Current Tool: ${lead.current_tool || review?.competitor_name || 'Unknown'}`,
            `Stage: ${lead.defection_stage || 'Unknown'}`,
            `Timeline: ${lead.timeline || 'Unknown'}`,
            ``,
            `Pain Points:`,
            ...(lead.pain_points || []).map(p => `  • ${p}`),
            ``,
            `Source: ${review?.source || 'Unknown'}`,
            `Review Date: ${review?.date_posted || 'Unknown'}`
        ];
        
        return lines.join('\n');
    }

    /**
     * Get severity level based on score
     * @param {number} score 
     * @returns {string}
     */
    getSeverity(score) {
        if (score >= 80) return 'critical';
        if (score >= 60) return 'warning';
        return 'info';
    }

    /**
     * Get user's alert configuration
     * @param {string} userId 
     * @returns {Promise<Object>}
     */
    async getAlertConfig(userId) {
        const { data, error } = await this.supabase
            .from('defector_alert_configs')
            .select('*')
            .eq('user_id', userId)
            .single();
        
        if (error && error.code !== 'PGRST116') {
            console.error('[Alert] Error fetching config:', error);
        }
        
        return data;
    }

    /**
     * Send email alert
     * @param {Object} lead 
     * @param {Object} review 
     * @param {string} userId 
     * @param {boolean} isHighIntent 
     */
    async sendEmailAlert(lead, review, userId, isHighIntent = false) {
        if (!this.emailService) {
            console.log('[Alert] No email service configured');
            return;
        }
        
        try {
            const subject = isHighIntent 
                ? `🔥 URGENT: High-Intent Defector - ${lead.company_name}`
                : `🎯 New Competitor Defector: ${lead.company_name}`;
            
            const html = this.buildEmailHtml(lead, review, isHighIntent);
            
            await this.emailService.send({
                to: userId, // Would lookup actual email
                subject,
                html
            });
            
            console.log('[Alert] Email sent successfully');
        } catch (error) {
            console.error('[Alert] Error sending email:', error);
        }
    }

    /**
     * Build email HTML
     * @param {Object} lead 
     * @param {Object} review 
 * @param {boolean} isHighIntent 
 * @returns {string}
 */
    buildEmailHtml(lead, review, isHighIntent) {
        const urgencyColor = isHighIntent ? '#dc3545' : '#fd7e14';
        const scoreColor = lead.defection_intent_score >= 80 ? '#dc3545' : 
                          lead.defection_intent_score >= 60 ? '#fd7e14' : '#ffc107';
        
        return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${urgencyColor}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; }
        .score { font-size: 24px; font-weight: bold; color: ${scoreColor}; }
        .section { margin: 15px 0; }
        .label { font-weight: bold; color: #666; }
        .pain-points { background: white; padding: 10px; border-left: 4px solid ${urgencyColor}; }
        .cta { background: ${urgencyColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin-top: 20px; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${isHighIntent ? '🔥 HIGH-INTENT DEFECTOR ALERT' : '🎯 New Competitor Defector Detected'}</h1>
        </div>
        <div class="content">
            <div class="section">
                <span class="score">Defection Score: ${lead.defection_intent_score}/100</span>
            </div>
            
            <div class="section">
                <span class="label">Company:</span> ${lead.company_name || 'Unknown'}<br>
                <span class="label">Contact:</span> ${lead.contact_name || 'Unknown'}<br>
                <span class="label">Industry:</span> ${lead.industry || 'Unknown'}<br>
                <span class="label">Size:</span> ${lead.company_size || 'Unknown'}
            </div>
            
            <div class="section">
                <span class="label">Current Tool:</span> ${lead.current_tool || 'Unknown'}<br>
                <span class="label">Stage:</span> ${lead.defection_stage || 'Unknown'}<br>
                <span class="label">Timeline:</span> ${lead.timeline || 'Unknown'}
            </div>
            
            <div class="section pain-points">
                <span class="label">Key Pain Points:</span>
                <ul>
                    ${(lead.pain_points || []).map(p => `<li>${p}</li>`).join('')}
                </ul>
            </div>
            
            <a href="https://app.aisdr.com/defectors/${lead.id}" class="cta">View Lead & Generate Pitch</a>
        </div>
        <div class="footer">
            AI SDR - Competitor Defection Detector
        </div>
    </div>
</body>
</html>
        `;
    }

    /**
     * Send Slack alert
     * @param {Object} lead 
     * @param {Object} review 
     * @param {string} webhookUrl 
     */
    async sendSlackAlert(lead, review, webhookUrl) {
        try {
            const payload = {
                attachments: [{
                    color: lead.defection_intent_score >= 80 ? 'danger' : 'warning',
                    title: `🎯 New Competitor Defector: ${lead.company_name}`,
                    fields: [
                        { title: 'Defection Score', value: `${lead.defection_intent_score}/100`, short: true },
                        { title: 'Current Tool', value: lead.current_tool || 'Unknown', short: true },
                        { title: 'Industry', value: lead.industry || 'Unknown', short: true },
                        { title: 'Company Size', value: lead.company_size || 'Unknown', short: true },
                        { title: 'Timeline', value: lead.timeline || 'Unknown', short: true },
                        { title: 'Source', value: review?.source || 'Unknown', short: true }
                    ],
                    actions: [{
                        type: 'button',
                        text: 'View Lead',
                        url: `https://app.aisdr.com/defectors/${lead.id}`
                    }]
                }]
            };
            
            const axios = require('axios');
            await axios.post(webhookUrl, payload);
            
            console.log('[Alert] Slack notification sent');
        } catch (error) {
            console.error('[Alert] Error sending Slack notification:', error);
        }
    }

    /**
     * Send webhook alert
     * @param {Object} lead 
     * @param {Object} review 
     * @param {string} webhookUrl 
     */
    async sendWebhookAlert(lead, review, webhookUrl) {
        try {
            const axios = require('axios');
            
            await axios.post(webhookUrl, {
                event: 'defector_detected',
                timestamp: new Date().toISOString(),
                lead: {
                    id: lead.id,
                    company_name: lead.company_name,
                    defection_score: lead.defection_intent_score,
                    current_tool: lead.current_tool,
                    stage: lead.defection_stage,
                    timeline: lead.timeline,
                    pain_points: lead.pain_points
                },
                source: {
                    platform: review?.source,
                    review_id: review?.source_review_id,
                    review_date: review?.date_posted
                }
            });
            
            console.log('[Alert] Webhook notification sent');
        } catch (error) {
            console.error('[Alert] Error sending webhook:', error);
        }
    }

    /**
     * Get unread alerts for a user
     * @param {string} userId 
     * @param {number} limit 
     * @returns {Promise<Array>}
     */
    async getUnreadAlerts(userId, limit = 20) {
        const { data, error } = await this.supabase
            .from('defector_alerts')
            .select('*, defector_lead:defector_lead_id(*)')
            .eq('user_id', userId)
            .eq('is_read', false)
            .order('created_at', { ascending: false })
            .limit(limit);
        
        if (error) {
            console.error('[Alert] Error fetching alerts:', error);
            return [];
        }
        
        return data;
    }

    /**
     * Mark alert as read
     * @param {string} alertId 
     */
    async markAsRead(alertId) {
        const { error } = await this.supabase
            .from('defector_alerts')
            .update({ is_read: true })
            .eq('id', alertId);
        
        if (error) {
            console.error('[Alert] Error marking alert as read:', error);
        }
    }
}

module.exports = AlertSystem;
