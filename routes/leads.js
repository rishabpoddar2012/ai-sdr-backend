const { Op } = require('sequelize');
const { Lead } = require('../models');

// Get all leads for current user
const getLeads = async (req, res) => {
  try {
    const { 
      status, 
      score, 
      source, 
      isFavorite, 
      search,
      limit = 50, 
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;

    const where = { userId: req.user.id };

    // Apply filters
    if (status) where.status = status;
    if (score) where.score = score;
    if (source) where.source = source;
    if (isFavorite !== undefined) where.isFavorite = isFavorite === 'true';
    
    if (search) {
      where[Op.or] = [
        { companyName: { [Op.iLike]: `%${search}%` } },
        { contactName: { [Op.iLike]: `%${search}%` } },
        { intent: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows: leads } = await Lead.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sortBy, sortOrder]],
      attributes: { exclude: ['rawData'] }
    });

    res.json({
      success: true,
      data: {
        leads,
        pagination: {
          total: count,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: count > parseInt(offset) + parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get leads error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get single lead
const getLead = async (req, res) => {
  try {
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

    res.json({
      success: true,
      data: { lead }
    });
  } catch (error) {
    console.error('Get lead error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update lead status
const updateLead = async (req, res) => {
  try {
    const { status, notes, tags, isFavorite } = req.body;

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

    if (status !== undefined) lead.status = status;
    if (notes !== undefined) lead.notes = notes;
    if (tags !== undefined) lead.tags = tags;
    if (isFavorite !== undefined) lead.isFavorite = isFavorite;

    await lead.save();

    res.json({
      success: true,
      message: 'Lead updated successfully',
      data: { lead }
    });
  } catch (error) {
    console.error('Update lead error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get lead stats
const getLeadStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const totalLeads = await Lead.count({ where: { userId } });
    const hotLeads = await Lead.count({ where: { userId, score: 'hot' } });
    const warmLeads = await Lead.count({ where: { userId, score: 'warm' } });
    const coldLeads = await Lead.count({ where: { userId, score: 'cold' } });
    
    const newLeads = await Lead.count({ where: { userId, status: 'new' } });
    const contactedLeads = await Lead.count({ where: { userId, status: 'contacted' } });
    const qualifiedLeads = await Lead.count({ where: { userId, status: 'qualified' } });
    const closedLeads = await Lead.count({ where: { userId, status: 'closed' } });
    const favoriteLeads = await Lead.count({ where: { userId, isFavorite: true } });

    // Leads by source
    const leadsBySource = await Lead.findAll({
      where: { userId },
      attributes: ['source', [Lead.sequelize.fn('COUNT', Lead.sequelize.col('source')), 'count']],
      group: ['source']
    });

    // Leads this week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const leadsThisWeek = await Lead.count({
      where: {
        userId,
        createdAt: { [Op.gte]: oneWeekAgo }
      }
    });

    res.json({
      success: true,
      data: {
        overview: {
          total: totalLeads,
          hot: hotLeads,
          warm: warmLeads,
          cold: coldLeads,
          thisWeek: leadsThisWeek,
          favorites: favoriteLeads
        },
        byStatus: {
          new: newLeads,
          contacted: contactedLeads,
          qualified: qualifiedLeads,
          closed: closedLeads
        },
        bySource: leadsBySource
      }
    });
  } catch (error) {
    console.error('Get lead stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getLeads,
  getLead,
  updateLead,
  getLeadStats
};
