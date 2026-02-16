const { User } = require('../models');
const { validationResult } = require('express-validator');

// Get current AI settings
const getAiSettings = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['aiProvider', 'aiModel', 'aiBaseUrl', 'apiKey', 'apiEnabled', 'apiWebhookUrl']
    });

    res.json({
      success: true,
      data: {
        aiProvider: user.aiProvider,
        aiModel: user.aiModel,
        aiBaseUrl: user.aiBaseUrl,
        hasApiKey: !!user.getAiApiKey(),
        apiKey: user.apiKey, // Their API key for n8n/Make.com
        apiEnabled: user.apiEnabled,
        apiWebhookUrl: user.apiWebhookUrl
      }
    });
  } catch (error) {
    console.error('Get AI settings error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Update AI settings
const updateAiSettings = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { aiProvider, aiApiKey, aiModel, aiBaseUrl } = req.body;
    const user = await User.findByPk(req.user.id);

    // Update provider
    if (aiProvider) {
      const validProviders = ['rule', 'openai', 'groq', 'together', 'anthropic', 'custom'];
      if (!validProviders.includes(aiProvider)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid provider. Choose: ' + validProviders.join(', ')
        });
      }
      user.aiProvider = aiProvider;
    }

    // Update API key (encrypted)
    if (aiApiKey !== undefined) {
      if (aiApiKey === '') {
        user.aiApiKey = null; // Clear key
      } else {
        await user.setAiApiKey(aiApiKey);
      }
    }

    // Update model
    if (aiModel !== undefined) {
      user.aiModel = aiModel;
    }

    // Update base URL (for custom/OpenAI-compatible endpoints)
    if (aiBaseUrl !== undefined) {
      user.aiBaseUrl = aiBaseUrl;
    }

    await user.save();

    res.json({
      success: true,
      message: 'AI settings updated successfully',
      data: {
        aiProvider: user.aiProvider,
        aiModel: user.aiModel,
        aiBaseUrl: user.aiBaseUrl,
        hasApiKey: !!user.getAiApiKey()
      }
    });
  } catch (error) {
    console.error('Update AI settings error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Test AI connection
const testAiConnection = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    const { scoreLead } = require('../services/aiScorer');

    const testText = "Looking for a marketing agency. Budget $50K. Need to start ASAP.";
    
    const result = await scoreLead(testText, user.aiProvider, {
      apiKey: user.getAiApiKey(),
      model: user.aiModel,
      baseUrl: user.aiBaseUrl
    });

    res.json({
      success: true,
      data: {
        testText,
        result,
        provider: user.aiProvider
      }
    });
  } catch (error) {
    console.error('Test AI connection error:', error);
    res.status(500).json({
      success: false,
      message: 'AI connection failed',
      error: error.message
    });
  }
};

// Get API credentials for n8n/Make.com
const getApiCredentials = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['apiKey', 'apiEnabled', 'apiRateLimit', 'apiWebhookUrl']
    });

    if (!user.apiEnabled) {
      return res.status(403).json({
        success: false,
        message: 'API access is disabled'
      });
    }

    res.json({
      success: true,
      data: {
        apiKey: user.apiKey,
        apiEndpoint: `${process.env.API_BASE_URL || 'https://api.aisdr.com'}/v1`,
        rateLimit: user.apiRateLimit,
        webhookUrl: user.apiWebhookUrl,
        documentation: 'https://docs.aisdr.com/api'
      }
    });
  } catch (error) {
    console.error('Get API credentials error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Regenerate API key
const regenerateApiKey = async (req, res) => {
  try {
    const crypto = require('crypto');
    const user = await User.findByPk(req.user.id);
    
    user.apiKey = `aisdr_${crypto.randomBytes(32).toString('hex')}`;
    await user.save();

    res.json({
      success: true,
      message: 'API key regenerated successfully',
      data: { apiKey: user.apiKey }
    });
  } catch (error) {
    console.error('Regenerate API key error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Update webhook URL
const updateWebhook = async (req, res) => {
  try {
    const { webhookUrl } = req.body;
    const user = await User.findByPk(req.user.id);

    // Validate URL if provided
    if (webhookUrl) {
      try {
        new URL(webhookUrl);
      } catch {
        return res.status(400).json({
          success: false,
          message: 'Invalid webhook URL'
        });
      }
    }

    user.apiWebhookUrl = webhookUrl || null;
    await user.save();

    res.json({
      success: true,
      message: 'Webhook URL updated',
      data: { webhookUrl: user.apiWebhookUrl }
    });
  } catch (error) {
    console.error('Update webhook error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Get n8n/Make.com integration templates
const getIntegrationTemplates = async (req, res) => {
  const baseUrl = process.env.API_BASE_URL || 'https://api.aisdr.com';
  
  res.json({
    success: true,
    data: {
      n8n: {
        name: 'n8n',
        description: 'Workflow automation',
        webhookNode: {
          method: 'POST',
          url: `${baseUrl}/v1/webhooks/leads`,
          headers: {
            'Authorization': 'Bearer YOUR_API_KEY',
            'Content-Type': 'application/json'
          }
        },
        httpRequest: {
          method: 'GET',
          url: `${baseUrl}/v1/leads`,
          headers: {
            'Authorization': 'Bearer YOUR_API_KEY'
          }
        },
        templateUrl: 'https://n8n.io/workflows/1234-ai-sdr-leads'
      },
      make: {
        name: 'Make (Integromat)',
        description: 'Visual automation',
        webhookModule: {
          url: `${baseUrl}/v1/webhooks/leads`,
          method: 'POST',
          headers: {
            'Authorization': 'Bearer YOUR_API_KEY'
          }
        },
        httpModule: {
          url: `${baseUrl}/v1/leads`,
          method: 'GET',
          headers: {
            'Authorization': 'Bearer YOUR_API_KEY'
          }
        },
        templateUrl: 'https://www.make.com/en/templates/ai-sdr'
      },
      zapier: {
        name: 'Zapier',
        description: 'Coming soon',
        status: 'beta',
        inviteUrl: 'https://zapier.com/developer/public-invite/1234'
      }
    }
  });
};

module.exports = {
  getAiSettings,
  updateAiSettings,
  testAiConnection,
  getApiCredentials,
  regenerateApiKey,
  updateWebhook,
  getIntegrationTemplates
};
