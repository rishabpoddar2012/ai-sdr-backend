const { User } = require('../models');

// Get user settings
const getSettings = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['keywords', 'sourcesConfig', 'emailNotifications', 'webhookUrl']
    });

    res.json({
      success: true,
      data: { settings: user }
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update user settings
const updateSettings = async (req, res) => {
  try {
    const { emailNotifications, webhookUrl } = req.body;
    
    const user = await User.findByPk(req.user.id);
    
    if (emailNotifications !== undefined) user.emailNotifications = emailNotifications;
    if (webhookUrl !== undefined) user.webhookUrl = webhookUrl;
    
    await user.save();

    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: { settings: { emailNotifications: user.emailNotifications, webhookUrl: user.webhookUrl } }
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update sources configuration
const updateSources = async (req, res) => {
  try {
    const { sourcesConfig } = req.body;
    
    const user = await User.findByPk(req.user.id);
    user.sourcesConfig = { ...user.sourcesConfig, ...sourcesConfig };
    await user.save();

    res.json({
      success: true,
      message: 'Sources updated successfully',
      data: { sourcesConfig: user.sourcesConfig }
    });
  } catch (error) {
    console.error('Update sources error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update keywords
const updateKeywords = async (req, res) => {
  try {
    const { keywords } = req.body;
    
    if (!Array.isArray(keywords)) {
      return res.status(400).json({
        success: false,
        message: 'Keywords must be an array'
      });
    }
    
    const user = await User.findByPk(req.user.id);
    user.keywords = keywords;
    await user.save();

    res.json({
      success: true,
      message: 'Keywords updated successfully',
      data: { keywords: user.keywords }
    });
  } catch (error) {
    console.error('Update keywords error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get integrations
const getIntegrations = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['webhookUrl', 'crmConnections']
    });

    res.json({
      success: true,
      data: { integrations: user }
    });
  } catch (error) {
    console.error('Get integrations error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update webhook URL
const updateWebhook = async (req, res) => {
  try {
    const { webhookUrl } = req.body;
    
    const user = await User.findByPk(req.user.id);
    user.webhookUrl = webhookUrl;
    await user.save();

    res.json({
      success: true,
      message: 'Webhook updated successfully',
      data: { webhookUrl: user.webhookUrl }
    });
  } catch (error) {
    console.error('Update webhook error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Connect CRM
const connectCRM = async (req, res) => {
  try {
    const { type, apiKey } = req.body;
    
    // TODO: Implement actual CRM connection logic
    res.json({
      success: true,
      message: `${type} CRM connected successfully`
    });
  } catch (error) {
    console.error('Connect CRM error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Disconnect CRM
const disconnectCRM = async (req, res) => {
  try {
    const { type } = req.params;
    
    res.json({
      success: true,
      message: `${type} CRM disconnected`
    });
  } catch (error) {
    console.error('Disconnect CRM error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getSettings,
  updateSettings,
  updateSources,
  updateKeywords,
  getIntegrations,
  updateWebhook,
  connectCRM,
  disconnectCRM
};
