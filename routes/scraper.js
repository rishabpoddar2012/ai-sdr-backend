const { User } = require('../models');

// Get scraper configuration
const getScraperConfig = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: [
        'scrapeFrequency', 'leadTypes', 'keywords', 'scrapeSources',
        'subscriptionTier', 'sourcesConfig'
      ]
    });

    res.json({
      success: true,
      data: {
        scrapeFrequency: user.scrapeFrequency,
        leadTypes: user.leadTypes,
        keywords: user.keywords,
        scrapeSources: user.scrapeSources,
        sourcesConfig: user.sourcesConfig,
        canChangeFrequency: user.subscriptionTier !== 'free'
      }
    });
  } catch (error) {
    console.error('Get scraper config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch scraper config'
    });
  }
};

// Update scraper configuration
const updateScraperConfig = async (req, res) => {
  try {
    const { scrapeFrequency, leadTypes, keywords, scrapeSources } = req.body;
    const user = await User.findByPk(req.user.id);

    // Validate scrape frequency based on subscription tier
    if (scrapeFrequency) {
      const validFrequencies = {
        free: ['daily'],
        pro: ['hourly', 'daily'],
        enterprise: ['hourly', 'daily', 'weekly', 'realtime']
      };
      
      if (!validFrequencies[user.subscriptionTier].includes(scrapeFrequency)) {
        return res.status(403).json({
          success: false,
          message: `Upgrade to ${user.subscriptionTier === 'free' ? 'Pro' : 'Enterprise'} for ${scrapeFrequency} scraping`
        });
      }
      
      user.scrapeFrequency = scrapeFrequency;
    }

    // Update lead types
    if (leadTypes && Array.isArray(leadTypes)) {
      const validTypes = [
        'hiring', 'budget_mentioned', 'complaint', 
        'feature_request', 'integration_request', 'competitor_mention'
      ];
      user.leadTypes = leadTypes.filter(type => validTypes.includes(type));
    }

    // Update keywords
    if (keywords && Array.isArray(keywords)) {
      user.keywords = keywords.slice(0, 20); // Max 20 keywords
    }

    // Update scrape sources
    if (scrapeSources && Array.isArray(scrapeSources)) {
      // Free tier limited to 1 source
      if (user.subscriptionTier === 'free' && scrapeSources.length > 1) {
        return res.status(403).json({
          success: false,
          message: 'Free tier limited to 1 source. Upgrade to Pro for unlimited sources.'
        });
      }
      user.scrapeSources = scrapeSources;
    }

    await user.save();

    res.json({
      success: true,
      message: 'Scraper configuration updated',
      data: {
        scrapeFrequency: user.scrapeFrequency,
        leadTypes: user.leadTypes,
        keywords: user.keywords,
        scrapeSources: user.scrapeSources
      }
    });
  } catch (error) {
    console.error('Update scraper config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update scraper config'
    });
  }
};

// Test scraper with current config
const testScraper = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    
    // Simulate a test scrape
    const testResults = {
      sources: user.scrapeSources,
      keywords: user.keywords,
      leadTypes: user.leadTypes,
      simulatedMatches: [
        {
          source: 'hackerNews',
          title: 'Looking for marketing agency',
          score: 'hot',
          reason: 'Budget mentioned, hiring intent'
        },
        {
          source: 'reddit',
          title: 'Need help scaling B2B sales',
          score: 'warm',
          reason: 'Growth intent, no explicit budget'
        }
      ],
      estimatedDailyLeads: Math.floor(Math.random() * 10) + 1
    };

    res.json({
      success: true,
      message: 'Test scrape completed',
      data: testResults
    });
  } catch (error) {
    console.error('Test scraper error:', error);
    res.status(500).json({
      success: false,
      message: 'Test failed'
    });
  }
};

// Get available lead types
const getLeadTypes = async (req, res) => {
  res.json({
    success: true,
    data: {
      leadTypes: [
        { key: 'hiring', name: 'Hiring/Recruiting', description: 'Companies looking to hire' },
        { key: 'budget_mentioned', name: 'Budget Mentioned', description: 'Posts mentioning specific budgets' },
        { key: 'complaint', name: 'Complaints', description: 'Users complaining about competitors' },
        { key: 'feature_request', name: 'Feature Requests', description: 'Users requesting features you might offer' },
        { key: 'integration_request', name: 'Integration Requests', description: 'Users looking for integrations' },
        { key: 'competitor_mention', name: 'Competitor Mentions', description: 'Mentions of your competitors' }
      ]
    }
  });
};

module.exports = {
  getScraperConfig,
  updateScraperConfig,
  testScraper,
  getLeadTypes
};
