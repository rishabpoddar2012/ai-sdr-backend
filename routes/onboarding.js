const { User, ScrapeSource, UserScraperConfig } = require('../models');

// Get onboarding status
const getOnboardingStatus = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: [
        'id', 'onboardingCompleted', 'onboardingStep', 'companyName',
        'productDescription', 'targetMarket', 'customerLocations',
        'scrapeSources', 'industry', 'companySize'
      ]
    });

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('Get onboarding status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get available scrape sources
const getScrapeSources = async (req, res) => {
  try {
    const sources = await ScrapeSource.findAll({
      where: { isActive: true },
      order: [['category', 'ASC'], ['name', 'ASC']]
    });

    res.json({
      success: true,
      data: { sources }
    });
  } catch (error) {
    console.error('Get scrape sources error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Save onboarding data (step by step)
const saveOnboarding = async (req, res) => {
  try {
    const { step, data } = req.body;
    const userId = req.user.id;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update based on step
    switch (step) {
      case 1: // Company info
        if (data.companyName) user.companyName = data.companyName;
        if (data.productDescription) user.productDescription = data.productDescription;
        if (data.industry) user.industry = data.industry;
        if (data.companySize) user.companySize = data.companySize;
        break;

      case 2: // Target market
        if (data.targetMarket) user.targetMarket = data.targetMarket;
        if (data.customerLocations) user.customerLocations = data.customerLocations;
        break;

      case 3: // Scrape sources
        if (data.scrapeSources) {
          user.scrapeSources = data.scrapeSources;
          
          // Create scraper configs for selected sources
          for (const sourceKey of data.scrapeSources) {
            await UserScraperConfig.findOrCreate({
              where: { userId, sourceKey },
              defaults: {
                userId,
                sourceKey,
                isEnabled: true,
                keywords: user.keywords || []
              }
            });
          }
        }
        break;

      case 4: // Complete onboarding
        user.onboardingCompleted = true;
        user.onboardingStep = 4;
        
        // Trigger initial lead scrape for new users
        // This would be handled by a background worker
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid onboarding step'
        });
    }

    // Update current step if not completing
    if (step !== 4 && step > user.onboardingStep) {
      user.onboardingStep = step;
    }

    await user.save();

    res.json({
      success: true,
      message: 'Onboarding data saved',
      data: {
        step: user.onboardingStep,
        onboardingCompleted: user.onboardingCompleted
      }
    });
  } catch (error) {
    console.error('Save onboarding error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get user's scraper configurations
const getScraperConfigs = async (req, res) => {
  try {
    const configs = await UserScraperConfig.findAll({
      where: { userId: req.user.id },
      include: [{
        model: ScrapeSource,
        as: 'source',
        attributes: ['name', 'description', 'icon', 'category']
      }]
    });

    res.json({
      success: true,
      data: { configs }
    });
  } catch (error) {
    console.error('Get scraper configs error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update scraper configuration
const updateScraperConfig = async (req, res) => {
  try {
    const { sourceKey } = req.params;
    const { isEnabled, keywords, customFilters } = req.body;

    const config = await UserScraperConfig.findOne({
      where: { userId: req.user.id, sourceKey }
    });

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Scraper config not found'
      });
    }

    if (isEnabled !== undefined) config.isEnabled = isEnabled;
    if (keywords !== undefined) config.keywords = keywords;
    if (customFilters !== undefined) config.customFilters = customFilters;

    await config.save();

    res.json({
      success: true,
      message: 'Scraper config updated',
      data: { config }
    });
  } catch (error) {
    console.error('Update scraper config error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Skip onboarding (for testing)
const skipOnboarding = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    user.onboardingCompleted = true;
    user.onboardingStep = 4;
    await user.save();

    res.json({
      success: true,
      message: 'Onboarding skipped'
    });
  } catch (error) {
    console.error('Skip onboarding error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getOnboardingStatus,
  getScrapeSources,
  saveOnboarding,
  getScraperConfigs,
  updateScraperConfig,
  skipOnboarding
};
