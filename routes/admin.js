const { User, Lead } = require('../models');
const { Op } = require('sequelize');

// List all users (admin only)
const listUsers = async (req, res) => {
  try {
    const { page = 1, limit = 50, search } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (search) {
      where.email = { [Op.iLike]: `%${search}%` };
    }

    const { count, rows: users } = await User.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          total: count,
          page: parseInt(page),
          pages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get admin stats
const getStats = async (req, res) => {
  try {
    const totalUsers = await User.count();
    const activeUsers = await User.count({ where: { isActive: true } });
    const paidUsers = await User.count({ where: { plan: { [Op.ne]: 'free' } } });
    const totalLeads = await Lead.count();
    
    const usersByPlan = await User.findAll({
      attributes: ['plan', [User.sequelize.fn('COUNT', User.sequelize.col('plan')), 'count']],
      group: ['plan']
    });

    // Leads created in last 7 days
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const recentLeads = await Lead.count({
      where: { createdAt: { [Op.gte]: oneWeekAgo } }
    });

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          active: activeUsers,
          paid: paidUsers,
          byPlan: usersByPlan
        },
        leads: {
          total: totalLeads,
          recent: recentLeads
        }
      }
    });
  } catch (error) {
    console.error('Get admin stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Add leads to user manually
const addLeadsToUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;
    
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.leadsLimit += parseInt(amount);
    await user.save();

    res.json({
      success: true,
      message: `Added ${amount} leads to user`,
      data: { user: { id: user.id, leadsLimit: user.leadsLimit } }
    });
  } catch (error) {
    console.error('Add leads error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update user plan
const updateUserPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { plan, leadsLimit } = req.body;
    
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (plan) user.plan = plan;
    if (leadsLimit) user.leadsLimit = leadsLimit;
    await user.save();

    res.json({
      success: true,
      message: 'User plan updated',
      data: { user: { id: user.id, plan: user.plan, leadsLimit: user.leadsLimit } }
    });
  } catch (error) {
    console.error('Update user plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  listUsers,
  getStats,
  addLeadsToUser,
  updateUserPlan
};
