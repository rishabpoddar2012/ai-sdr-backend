/**
 * Competitor Defection Detector - Main Orchestrator
 * Coordinates scraping, detection, alerting, and pitch generation
 */

const G2Scraper = require('./scrapers/g2.scraper');
const CapterraScraper = require('./scrapers/capterra.scraper');
const DefectionDetector = require('./detector/defection.detector');
const AlertSystem = require('./alerts/alert.system');
const PitchGenerator = require('./pitches/pitch.generator');

class CompetitorDefectorDetector {
    constructor(config = {}) {
        this.supabaseUrl = config.supabaseUrl || process.env.SUPABASE_URL;
        this.supabaseKey = config.supabaseKey || process.env.SUPABASE_SERVICE_KEY;
        this.openaiKey = config.openaiKey || process.env.OPENAI_API_KEY;
        
        // Initialize scrapers
        this.g2Scraper = new G2Scraper({ delay: config.scrapeDelay || 2000 });
        this.capterraScraper = new CapterraScraper({ delay: config.scrapeDelay || 2000 });
        
        // Initialize detector
        this.detector = new DefectionDetector();
        
        // Initialize alert system
        this.alertSystem = new AlertSystem();
        
        // Initialize pitch generator
        this.pitchGenerator = new PitchGenerator({
            aiApiKey: this.openaiKey,
            companyName: config.companyName,
            companyValueProp: config.companyValueProp
        });
        
        // Initialize Supabase if credentials available
        if (this.supabaseUrl && this.supabaseKey) {
            this.initSupabase();
        }
    }

    /**
     * Initialize Supabase connections
     */
    initSupabase() {
        const { createClient } = require('@supabase/supabase-js');
        this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
        
        this.g2Scraper.initSupabase(this.supabaseUrl, this.supabaseKey);
        this.capterraScraper.initSupabase(this.supabaseUrl, this.supabaseKey);
        this.alertSystem.initSupabase(this.supabaseUrl, this.supabaseKey);
    }

    /**
     * Run full detection pipeline for a user's competitors
     * @param {string} userId - User UUID
     * @param {Object} options - { competitors: [], sources: ['g2', 'capterra'] }
     * @returns {Promise<Object>}
     */
    async runDetection(userId, options = {}) {
        console.log(`[Detector] Starting detection for user ${userId}`);
        
        const results = {
            scraped: 0,
            detected: 0,
            leads_created: 0,
            alerts_sent: 0,
            errors: []
        };
        
        try {
            // Get user's competitors to monitor
            const competitors = options.competitors || await this.getUserCompetitors(userId);
            
            if (competitors.length === 0) {
                console.log('[Detector] No competitors configured for user');
                return results;
            }
            
            // Scrape reviews for each competitor
            const sources = options.sources || ['g2', 'capterra'];
            
            for (const competitor of competitors) {
                console.log(`[Detector] Processing competitor: ${competitor.name}`);
                
                // G2 scraping
                if (sources.includes('g2') && competitor.g2_slug) {
                    try {
                        const g2Reviews = await this.g2Scraper.fetchReviews(
                            competitor.g2_slug,
                            competitor.id,
                            userId
                        );
                        
                        if (g2Reviews.length > 0) {
                            const saved = await this.g2Scraper.saveReviews(g2Reviews);
                            results.scraped += saved;
                            console.log(`[Detector] Saved ${saved} G2 reviews for ${competitor.name}`);
                        }
                    } catch (error) {
                        console.error(`[Detector] G2 scrape error for ${competitor.name}:`, error);
                        results.errors.push(`G2:${competitor.name}:${error.message}`);
                    }
                }
                
                // Capterra scraping
                if (sources.includes('capterra') && competitor.capterra_slug) {
                    try {
                        const capterraReviews = await this.capterraScraper.fetchReviews(
                            competitor.capterra_slug,
                            competitor.id,
                            userId
                        );
                        
                        if (capterraReviews.length > 0) {
                            const saved = await this.capterraScraper.saveReviews(capterraReviews);
                            results.scraped += saved;
                            console.log(`[Detector] Saved ${saved} Capterra reviews for ${competitor.name}`);
                        }
                    } catch (error) {
                        console.error(`[Detector] Capterra scrape error for ${competitor.name}:`, error);
                        results.errors.push(`Capterra:${competitor.name}:${error.message}`);
                    }
                }
                
                // Delay between competitors
                await this.sleep(3000);
            }
            
            // Process unprocessed reviews for defection signals
            const detectionResults = await this.processUnprocessedReviews(userId);
            results.detected = detectionResults.defectorsFound;
            results.leads_created = detectionResults.leadsCreated;
            results.alerts_sent = detectionResults.alertsSent;
            
        } catch (error) {
            console.error('[Detector] Error in detection pipeline:', error);
            results.errors.push(`Pipeline:${error.message}`);
        }
        
        console.log(`[Detector] Completed: ${JSON.stringify(results)}`);
        return results;
    }

    /**
     * Process unprocessed reviews for defection signals
     * @param {string} userId 
     * @returns {Promise<Object>}
     */
    async processUnprocessedReviews(userId) {
        console.log('[Detector] Processing unprocessed reviews...');
        
        const results = {
            defectorsFound: 0,
            leadsCreated: 0,
            alertsSent: 0
        };
        
        // Get unprocessed reviews
        const { data: reviews, error } = await this.supabase
            .from('competitor_reviews')
            .select('*, competitor:competitor_id(name)')
            .eq('user_id', userId)
            .is('processed_at', null);
        
        if (error) {
            console.error('[Detector] Error fetching unprocessed reviews:', error);
            return results;
        }
        
        console.log(`[Detector] Found ${reviews?.length || 0} unprocessed reviews`);
        
        if (!reviews || reviews.length === 0) {
            return results;
        }
        
        for (const review of reviews) {
            try {
                // Analyze review for defection signals
                const analysis = this.detector.analyze(review.review_content);
                
                // Update review with analysis
                await this.supabase
                    .from('competitor_reviews')
                    .update({
                        has_defection_signal: analysis.hasDefectionSignal,
                        defection_keywords: analysis.keywords,
                        sentiment_score: analysis.sentiment === 'negative' ? -0.5 : 
                                        analysis.sentiment === 'mixed_defection' ? 0 : 0.5,
                        processed_at: new Date().toISOString()
                    })
                    .eq('id', review.id);
                
                // If defection signal detected, create lead
                if (analysis.hasDefectionSignal) {
                    results.defectorsFound++;
                    
                    const lead = await this.createDefectorLead(review, analysis);
                    results.leadsCreated++;
                    
                    // Send alerts
                    const alert = await this.alertSystem.sendNewDefectorAlert(
                        lead,
                        review,
                        userId
                    );
                    
                    if (alert) results.alertsSent++;
                    
                    // Send high-intent alert if score is high
                    if (analysis.score >= 80) {
                        await this.alertSystem.sendHighIntentAlert(lead, review, userId);
                    }
                }
            } catch (error) {
                console.error(`[Detector] Error processing review ${review.id}:`, error);
            }
        }
        
        return results;
    }

    /**
     * Create defector lead from review
     * @param {Object} review 
     * @param {Object} analysis 
     * @returns {Promise<Object>}
     */
    async createDefectorLead(review, analysis) {
        const painPoints = this.detector.extractPainPoints(review.review_content);
        const desiredFeatures = this.detector.extractDesiredFeatures(review.review_content);
        const timeline = this.detector.detectTimeline(review.review_content);
        const stage = this.detector.detectStage(review.review_content);
        
        const leadData = {
            user_id: review.user_id,
            competitor_id: review.competitor_id,
            review_id: review.id,
            company_name: review.reviewer_company,
            contact_name: review.reviewer_name,
            reviewer_title: review.reviewer_title,
            defection_intent_score: analysis.score,
            defection_stage: stage,
            current_tool: review.competitor?.name,
            pain_points: painPoints,
            desired_features: desiredFeatures,
            timeline: timeline,
            status: 'new',
            priority: analysis.score >= 80 ? 'urgent' : analysis.score >= 60 ? 'high' : 'medium',
            company_size: review.reviewer_company_size,
            industry: review.reviewer_industry,
            raw_data: {
                review_excerpts: analysis.excerpts,
                keywords_matched: analysis.keywords,
                categories: analysis.categories
            }
        };
        
        // Check if lead already exists
        const { data: existing } = await this.supabase
            .from('defector_leads')
            .select('id')
            .eq('review_id', review.id)
            .single();
        
        if (existing) {
            console.log(`[Detector] Lead already exists for review ${review.id}`);
            return existing;
        }
        
        const { data, error } = await this.supabase
            .from('defector_leads')
            .insert(leadData)
            .select()
            .single();
        
        if (error) {
            console.error('[Detector] Error creating lead:', error);
            throw error;
        }
        
        console.log(`[Detector] Created defector lead: ${data.id}`);
        return data;
    }

    /**
     * Get user's configured competitors
     * @param {string} userId 
     * @returns {Promise<Array>}
     */
    async getUserCompetitors(userId) {
        const { data, error } = await this.supabase
            .from('competitors')
            .select('*')
            .eq('user_id', userId)
            .eq('is_active', true);
        
        if (error) {
            console.error('[Detector] Error fetching competitors:', error);
            return [];
        }
        
        return data || [];
    }

    /**
     * Generate and save pitch for a lead
     * @param {string} leadId 
     * @param {string} pitchType 
     * @returns {Promise<Object>}
     */
    async generateLeadPitch(leadId, pitchType = 'email') {
        // Get lead with review data
        const { data: lead, error } = await this.supabase
            .from('defector_leads')
            .select('*, review:review_id(*)')
            .eq('id', leadId)
            .single();
        
        if (error || !lead) {
            throw new Error(`Lead not found: ${leadId}`);
        }
        
        // Generate pitch
        const pitch = await this.pitchGenerator.generatePitch(lead, lead.review, pitchType);
        
        // Save to database
        const savedPitch = await this.pitchGenerator.savePitch(
            pitch,
            leadId,
            lead.user_id,
            this.supabase
        );
        
        return savedPitch;
    }

    /**
     * Get leads needing pitches generated
     * @param {string} userId 
     * @param {number} limit 
     * @returns {Promise<Array>}
     */
    async getLeadsNeedingPitches(userId, limit = 10) {
        const { data, error } = await this.supabase
            .from('defector_leads')
            .select('*, review:review_id(*)')
            .eq('user_id', userId)
            .eq('status', 'new')
            .order('defection_intent_score', { ascending: false })
            .limit(limit);
        
        if (error) {
            console.error('[Detector] Error fetching leads:', error);
            return [];
        }
        
        return data || [];
    }

    /**
     * Get defector leads for a user
     * @param {string} userId 
     * @param {Object} filters 
     * @returns {Promise<Array>}
     */
    async getDefectorLeads(userId, filters = {}) {
        let query = this.supabase
            .from('defector_leads')
            .select('*, competitor:competitor_id(name), review:review_id(source, source_url)')
            .eq('user_id', userId);
        
        // Apply filters
        if (filters.status) {
            query = query.eq('status', filters.status);
        }
        if (filters.priority) {
            query = query.eq('priority', filters.priority);
        }
        if (filters.minScore) {
            query = query.gte('defection_intent_score', filters.minScore);
        }
        if (filters.competitorId) {
            query = query.eq('competitor_id', filters.competitorId);
        }
        
        query = query.order('defection_intent_score', { ascending: false });
        
        if (filters.limit) {
            query = query.limit(filters.limit);
        }
        
        const { data, error } = await query;
        
        if (error) {
            console.error('[Detector] Error fetching leads:', error);
            return [];
        }
        
        return data || [];
    }

    /**
     * Mark lead as contacted
     * @param {string} leadId 
     * @param {string} notes 
     * @returns {Promise<Object>}
     */
    async markLeadContacted(leadId, notes = '') {
        const { data, error } = await this.supabase
            .from('defector_leads')
            .update({
                status: 'contacted',
                last_contact_date: new Date().toISOString(),
                contact_count: this.supabase.rpc('increment_contact_count', { lead_id: leadId }),
                notes: notes
            })
            .eq('id', leadId)
            .select()
            .single();
        
        if (error) {
            console.error('[Detector] Error updating lead:', error);
            throw error;
        }
        
        return data;
    }

    /**
     * Add competitor for monitoring
     * @param {Object} competitor 
     * @returns {Promise<Object>}
     */
    async addCompetitor(competitor) {
        const { data, error } = await this.supabase
            .from('competitors')
            .insert(competitor)
            .select()
            .single();
        
        if (error) {
            console.error('[Detector] Error adding competitor:', error);
            throw error;
        }
        
        return data;
    }

    /**
     * Update alert configuration
     * @param {string} userId 
     * @param {Object} config 
     * @returns {Promise<Object>}
     */
    async updateAlertConfig(userId, config) {
        const { data, error } = await this.supabase
            .from('defector_alert_configs')
            .upsert({
                user_id: userId,
                ...config,
                updated_at: new Date().toISOString()
            })
            .select()
            .single();
        
        if (error) {
            console.error('[Detector] Error updating alert config:', error);
            throw error;
        }
        
        return data;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = CompetitorDefectorDetector;
