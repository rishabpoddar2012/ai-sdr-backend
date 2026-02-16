const { Op } = require('sequelize');
const { Lead, User } = require('../models');

// API key authentication middleware for public API
const authenticateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers.authorization?.replace('Bearer ', '') || 
                   req.query.api_key ||
                   req.headers['x-api-key'];

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: 'API key required'
      });
    }

    const user = await User.findOne({
      where: { apiKey, apiEnabled: true, isActive: true }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or disabled API key'
      });
    }

    // Rate limiting check
    // TODO: Implement proper rate limiting with Redis
    
    // Attach user to request
    req.user = user;
    req.isApiRequest = true;
    
    next();
  } catch (error) {
    console.error('API auth error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Get leads (public API version)
const getLeadsPublic = async (req, res) => {
  try {
    const { 
      status, 
      score, 
      source, 
      limit = 100, 
      offset = 0,
      since, // ISO date string
      format = 'json' // json or csv
    } = req.query;

    const where = { userId: req.user.id };

    if (status) where.status = status;
    if (score) where.score = score;
    if (source) where.source = source;
    if (since) {
      where.createdAt = { [Op.gte]: new Date(since) };
    }

    const { count, rows: leads } = await Lead.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']],
      attributes: {
        exclude: ['rawData', 'userId']
      }
    });

    // Track API usage
    req.user.apiCallsThisMonth += 1;
    await req.user.save();

    // Format response
    if (format === 'csv') {
      const csv = convertToCsv(leads);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=leads.csv');
      return res.send(csv);
    }

    res.json({
      success: true,
      data: {
        leads,
        meta: {
          total: count,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: count > parseInt(offset) + parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Public API get leads error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Get single lead (public API)
const getLeadPublic = async (req, res) => {
  try {
    const lead = await Lead.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id
      },
      attributes: { exclude: ['rawData', 'userId'] }
    });

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    res.json({
      success: true,
      data: { lead }
    });
  } catch (error) {
    console.error('Public API get lead error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Update lead status (public API)
const updateLeadPublic = async (req, res) => {
  try {
    const { status, notes, tags } = req.body;

    const lead = await Lead.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    });

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    if (status) lead.status = status;
    if (notes !== undefined) lead.notes = notes;
    if (tags) lead.tags = tags;

    await lead.save();

    res.json({
      success: true,
      message: 'Lead updated',
      data: { lead }
    });
  } catch (error) {
    console.error('Public API update lead error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Get lead stats (public API)
const getStatsPublic = async (req, res) => {
  try {
    const userId = req.user.id;

    const stats = await Lead.findAll({
      where: { userId },
      attributes: [
        'score',
        [Lead.sequelize.fn('COUNT', Lead.sequelize.col('score')), 'count']
      ],
      group: ['score']
    });

    const total = await Lead.count({ where: { userId } });
    const newLeads = await Lead.count({ where: { userId, status: 'new' } });

    // Last 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const last24h = await Lead.count({
      where: { userId, createdAt: { [Op.gte]: yesterday } }
    });

    res.json({
      success: true,
      data: {
        total,
        new: newLeads,
        last24h,
        byScore: stats
      }
    });
  } catch (error) {
    console.error('Public API stats error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Webhook receiver for n8n/Make.com
const receiveWebhook = async (req, res) => {
  try {
    // This could be used to receive leads from external sources
    // Or trigger workflows
    
    const { event, data } = req.body;
    
    // Log webhook for debugging
    console.log(`Webhook received from ${req.user.email}:`, event);

    res.json({
      success: true,
      message: 'Webhook received',
      received: { event, timestamp: new Date().toISOString() }
    });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Get API usage stats
const getApiUsage = async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        apiCallsThisMonth: req.user.apiCallsThisMonth,
        leadsCollectedThisMonth: req.user.leadsCollectedThisMonth,
        rateLimit: req.user.apiRateLimit,
        plan: req.user.plan
      }
    });
  } catch (error) {
    console.error('API usage error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Helper: Convert leads to CSV
const convertToCsv = (leads) => {
  if (leads.length === 0) return '';
  
  const headers = [
    'id', 'companyName', 'companyWebsite', 'contactName', 'contactEmail',
    'contactLinkedIn', 'score', 'status', 'source', 'intent', 'createdAt'
  ];
  
  const rows = leads.map(lead =>
    headers.map(h => {
      const val = lead[h];
      // Escape quotes and wrap in quotes if contains comma
      if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val || '';
    }).join(',')
  );
  
  return [headers.join(','), ...rows].join('\n');
};

module.exports = {
  authenticateApiKey,
  getLeadsPublic,
  getLeadPublic,
  updateLeadPublic,
  getStatsPublic,
  receiveWebhook,
  getApiUsage
};
