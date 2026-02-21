/**
 * Competitor Defector Detector API Routes
 * Express routes for the defection detection system
 * Updated to work with JWT authentication middleware
 */

const express = require('express');
const router = express.Router();
const CompetitorDefectorDetector = require('./detector');

// Initialize detector
const detector = new CompetitorDefectorDetector();

// Middleware to extract userId from JWT token
const extractUser = (req, res, next) => {
  req.userId = req.user?.id || req.user?.uuid || req.userId;
  next();
};

router.use(extractUser);

/**
 * @route   POST /api/competitor-defector/scrape
 * @desc    Trigger manual scrape for a user's competitors
 * @access  Private
 */
router.post('/scrape', async (req, res) => {
    try {
        const userId = req.userId;
        const { competitors, sources } = req.body;
        
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        const results = await detector.runDetection(userId, {
            competitors,
            sources: sources || ['g2', 'capterra']
        });
        
        res.json({
            success: true,
            message: 'Scrape completed successfully',
            results
        });
    } catch (error) {
        console.error('[API] Scrape error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   GET /api/competitor-defector/leads
 * @desc    Get defector leads for a user
 * @access  Private
 */
router.get('/leads', async (req, res) => {
    try {
        const userId = req.userId;
        const { status, priority, minScore, competitorId, limit } = req.query;
        
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        const filters = {
            status,
            priority,
            minScore: minScore ? parseInt(minScore) : undefined,
            competitorId,
            limit: limit ? parseInt(limit) : 50
        };
        
        const leads = await detector.getDefectorLeads(userId, filters);
        
        res.json({
            success: true,
            count: leads.length,
            leads
        });
    } catch (error) {
        console.error('[API] Get leads error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   GET /api/competitor-defector/leads/:id
 * @desc    Get single defector lead with details
 * @access  Private
 */
router.get('/leads/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const { data: lead, error } = await detector.supabase
            .from('defector_leads')
            .select(`
                *,
                competitor:competitor_id(*),
                review:review_id(*),
                pitches:competitor_pitches(*)
            `)
            .eq('id', id)
            .single();
        
        if (error || !lead) {
            return res.status(404).json({
                success: false,
                error: 'Lead not found'
            });
        }
        
        res.json({
            success: true,
            lead
        });
    } catch (error) {
        console.error('[API] Get lead error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   POST /api/competitor-defector/leads/:id/contact
 * @desc    Mark lead as contacted
 * @access  Private
 */
router.post('/leads/:id/contact', async (req, res) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;
        
        const lead = await detector.markLeadContacted(id, notes);
        
        res.json({
            success: true,
            message: 'Lead marked as contacted',
            lead
        });
    } catch (error) {
        console.error('[API] Contact lead error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   POST /api/competitor-defector/leads/:id/pitch
 * @desc    Generate pitch for a lead
 * @access  Private
 */
router.post('/leads/:id/pitch', async (req, res) => {
    try {
        const { id } = req.params;
        const { type } = req.body;
        
        const pitch = await detector.generateLeadPitch(id, type || 'email');
        
        res.json({
            success: true,
            message: 'Pitch generated successfully',
            pitch
        });
    } catch (error) {
        console.error('[API] Generate pitch error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   GET /api/competitor-defector/pitches
 * @desc    Get all pitches for a user
 * @access  Private
 */
router.get('/pitches', async (req, res) => {
    try {
        const userId = req.userId;
        const { limit } = req.query;
        
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        const { data: pitches, error } = await detector.supabase
            .from('competitor_pitches')
            .select('*, lead:defector_lead_id(company_name, contact_name)')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit ? parseInt(limit) : 50);
        
        if (error) {
            throw error;
        }
        
        res.json({
            success: true,
            count: pitches.length,
            pitches
        });
    } catch (error) {
        console.error('[API] Get pitches error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   GET /api/competitor-defector/alerts
 * @desc    Get alerts for a user
 * @access  Private
 */
router.get('/alerts', async (req, res) => {
    try {
        const userId = req.userId;
        const { unreadOnly, limit } = req.query;
        
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        let query = detector.supabase
            .from('defector_alerts')
            .select('*, lead:defector_lead_id(company_name, defection_intent_score)')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        
        if (unreadOnly === 'true') {
            query = query.eq('is_read', false);
        }
        
        if (limit) {
            query = query.limit(parseInt(limit));
        }
        
        const { data: alerts, error } = await query;
        
        if (error) {
            throw error;
        }
        
        res.json({
            success: true,
            count: alerts.length,
            alerts
        });
    } catch (error) {
        console.error('[API] Get alerts error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   POST /api/competitor-defector/alerts/:id/read
 * @desc    Mark alert as read
 * @access  Private
 */
router.post('/alerts/:id/read', async (req, res) => {
    try {
        const { id } = req.params;
        
        await detector.alertSystem.markAsRead(id);
        
        res.json({
            success: true,
            message: 'Alert marked as read'
        });
    } catch (error) {
        console.error('[API] Mark alert read error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   GET /api/competitor-defector/competitors
 * @desc    Get user's competitors
 * @access  Private
 */
router.get('/competitors', async (req, res) => {
    try {
        const userId = req.userId;
        
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        const competitors = await detector.getUserCompetitors(userId);
        
        res.json({
            success: true,
            count: competitors.length,
            competitors
        });
    } catch (error) {
        console.error('[API] Get competitors error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   POST /api/competitor-defector/competitors
 * @desc    Add competitor for monitoring
 * @access  Private
 */
router.post('/competitors', async (req, res) => {
    try {
        const userId = req.userId;
        const competitor = req.body;
        
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        if (!competitor.name) {
            return res.status(400).json({
                error: 'name is required'
            });
        }
        
        // Add user_id from token
        competitor.user_id = userId;
        
        const newCompetitor = await detector.addCompetitor(competitor);
        
        res.json({
            success: true,
            message: 'Competitor added successfully',
            competitor: newCompetitor
        });
    } catch (error) {
        console.error('[API] Add competitor error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   DELETE /api/competitor-defector/competitors/:id
 * @desc    Delete a competitor
 * @access  Private
 */
router.delete('/competitors/:id', async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;
        
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        const { error } = await detector.supabase
            .from('competitors')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);
        
        if (error) {
            throw error;
        }
        
        res.json({
            success: true,
            message: 'Competitor deleted successfully'
        });
    } catch (error) {
        console.error('[API] Delete competitor error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   GET /api/competitor-defector/config
 * @desc    Get alert configuration
 * @access  Private
 */
router.get('/config', async (req, res) => {
    try {
        const userId = req.userId;
        
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        const config = await detector.alertSystem.getAlertConfig(userId);
        
        res.json({
            success: true,
            config: config || {
                min_defection_score: 70,
                alert_on_new_defector: true,
                alert_on_high_intent: true,
                email_alerts: true,
                digest_frequency: 'immediate'
            }
        });
    } catch (error) {
        console.error('[API] Get config error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   POST /api/competitor-defector/config
 * @desc    Update alert configuration
 * @access  Private
 */
router.post('/config', async (req, res) => {
    try {
        const userId = req.userId;
        const config = req.body;
        
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        if (!config) {
            return res.status(400).json({
                error: 'config is required'
            });
        }
        
        const updatedConfig = await detector.updateAlertConfig(userId, config);
        
        res.json({
            success: true,
            message: 'Configuration updated',
            config: updatedConfig
        });
    } catch (error) {
        console.error('[API] Update config error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   GET /api/competitor-defector/stats
 * @desc    Get dashboard stats for a user
 * @access  Private
 */
router.get('/stats', async (req, res) => {
    try {
        const userId = req.userId;
        
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        // Get stats
        const [
            { count: totalLeads },
            { count: newLeads },
            { count: contactedLeads },
            { count: unreadAlerts },
            { count: totalReviews }
        ] = await Promise.all([
            detector.supabase
                .from('defector_leads')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId),
            detector.supabase
                .from('defector_leads')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .eq('status', 'new'),
            detector.supabase
                .from('defector_leads')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .eq('status', 'contacted'),
            detector.supabase
                .from('defector_alerts')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .eq('is_read', false),
            detector.supabase
                .from('competitor_reviews')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
        ]);
        
        // Get high-intent leads
        const { data: highIntentLeads } = await detector.supabase
            .from('defector_leads')
            .select('id, company_name, defection_intent_score')
            .eq('user_id', userId)
            .gte('defection_intent_score', 80)
            .eq('status', 'new')
            .order('defection_intent_score', { ascending: false })
            .limit(5);
        
        res.json({
            success: true,
            stats: {
                totalLeads,
                newLeads,
                contactedLeads,
                unreadAlerts,
                totalReviews,
                highIntentLeads: highIntentLeads || []
            }
        });
    } catch (error) {
        console.error('[API] Get stats error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
