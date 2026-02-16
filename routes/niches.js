const { NicheTemplates, getAvailableNiches, getNicheConfig, applyNicheToUser } = require('../services/niches');

// Get all available niches
const getNiches = async (req, res) => {
  try {
    const niches = getAvailableNiches();
    
    res.json({
      success: true,
      data: { niches }
    });
  } catch (error) {
    console.error('Get niches error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Get niche details
const getNicheDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const config = getNicheConfig(id);
    
    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Niche not found'
      });
    }

    res.json({
      success: true,
      data: {
        id,
        name: config.name,
        description: config.description,
        keywords: config.keywords,
        sources: config.sources,
        subreddits: config.subreddits
      }
    });
  } catch (error) {
    console.error('Get niche details error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Apply niche to user
const applyNiche = async (req, res) => {
  try {
    const { nicheId, customizations } = req.body;
    
    if (!nicheId) {
      return res.status(400).json({
        success: false,
        message: 'nicheId is required'
      });
    }

    const config = getNicheConfig(nicheId);
    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Niche not found'
      });
    }

    // Apply niche configuration to user
    applyNicheToUser(req.user, nicheId, customizations);
    await req.user.save();

    res.json({
      success: true,
      message: `Niche "${config.name}" applied successfully`,
      data: {
        nicheId,
        nicheName: config.name,
        keywords: req.user.keywords,
        sources: req.user.sourcesConfig
      }
    });
  } catch (error) {
    console.error('Apply niche error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Create custom niche
const createCustomNiche = async (req, res) => {
  try {
    const { name, description, keywords, sources, subreddits } = req.body;
    
    if (!name || !keywords || keywords.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Name and keywords are required'
      });
    }

    // Create custom niche for this user
    const customNicheId = `custom-${Date.now()}`;
    req.user.customNiche = {
      id: customNicheId,
      name,
      description: description || 'Custom niche',
      keywords,
      sources: sources || { hackerNews: true, reddit: true },
      subreddits: subreddits || [],
      createdAt: new Date()
    };

    // Apply to user
    req.user.keywords = keywords;
    req.user.sourcesConfig = sources || { hackerNews: true, reddit: true };
    req.user.nicheId = customNicheId;
    
    await req.user.save();

    res.json({
      success: true,
      message: 'Custom niche created successfully',
      data: { niche: req.user.customNiche }
    });
  } catch (error) {
    console.error('Create custom niche error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Get current niche settings
const getCurrentNiche = async (req, res) => {
  try {
    const { User } = require('../models');
    const user = await User.findByPk(req.user.id, {
      attributes: ['nicheId', 'keywords', 'sourcesConfig', 'customNiche']
    });

    let nicheDetails = null;
    
    if (user.nicheId && user.nicheId.startsWith('custom-')) {
      // Custom niche
      nicheDetails = user.customNiche;
    } else if (user.nicheId) {
      // Template niche
      nicheDetails = getNicheConfig(user.nicheId);
    }

    res.json({
      success: true,
      data: {
        currentNicheId: user.nicheId,
        keywords: user.keywords,
        sources: user.sourcesConfig,
        nicheDetails
      }
    });
  } catch (error) {
    console.error('Get current niche error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Update keywords
const updateKeywords = async (req, res) => {
  try {
    const { keywords } = req.body;
    
    if (!Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Keywords must be a non-empty array'
      });
    }

    req.user.keywords = keywords;
    await req.user.save();

    res.json({
      success: true,
      message: 'Keywords updated',
      data: { keywords: req.user.keywords }
    });
  } catch (error) {
    console.error('Update keywords error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Update sources
const updateSources = async (req, res) => {
  try {
    const { sources } = req.body;
    
    req.user.sourcesConfig = {
      ...req.user.sourcesConfig,
      ...sources
    };
    await req.user.save();

    res.json({
      success: true,
      message: 'Sources updated',
      data: { sources: req.user.sourcesConfig }
    });
  } catch (error) {
    console.error('Update sources error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = {
  getNiches,
  getNicheDetails,
  applyNiche,
  createCustomNiche,
  getCurrentNiche,
  updateKeywords,
  updateSources
};
