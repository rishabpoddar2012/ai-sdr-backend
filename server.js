require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const { body } = require('express-validator');

const db = require('./models');
const { authenticate } = require('./middleware/auth');

// Route controllers
const authController = require('./routes/auth');
const leadsController = require('./routes/leads');
const settingsController = require('./routes/settings');
const subscriptionController = require('./routes/subscription');
const nichesController = require('./routes/niches');
const { 
  authenticateApiKey, 
  getLeadsPublic, 
  getLeadPublic, 
  updateLeadPublic,
  getStatsPublic,
  receiveWebhook,
  getApiUsage
} = require('./routes/apiPublic');
const demoController = require('./routes/demo');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(helmet());
app.use(compression());
app.use(morgan('dev'));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    version: '2.0.0',
    timestamp: new Date().toISOString() 
  });
});

// ============ DEMO / PUBLIC ROUTES ============
// No authentication required - for landing page and demos

app.get('/demo/leads', demoController.getDemoLeads);
app.get('/demo/stats', demoController.getLiveStats);
app.get('/demo/niches', demoController.getNichePresets);
app.get('/demo/niches/:id', demoController.getNichePreset);
app.get('/demo/export/templates', demoController.getExportTemplates);
app.post('/demo/export', demoController.exportLeads);

// ============ PUBLIC API (v1) ============
// These routes use API key authentication for n8n/Make.com

app.get('/v1/leads', authenticateApiKey, getLeadsPublic);
app.get('/v1/leads/stats', authenticateApiKey, getStatsPublic);
app.get('/v1/leads/:id', authenticateApiKey, getLeadPublic);
app.put('/v1/leads/:id', authenticateApiKey, updateLeadPublic);
app.get('/v1/usage', authenticateApiKey, getApiUsage);
app.post('/v1/webhooks/leads', authenticateApiKey, receiveWebhook);

// ============ AUTHENTICATED API ============
// These routes use JWT authentication for web dashboard

// Auth routes (public)
app.post('/api/auth/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('firstName').optional().trim(),
  body('lastName').optional().trim()
], authController.register);

app.post('/api/auth/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').exists()
], authController.login);

// User routes (protected)
app.get('/api/user/profile', authenticate, authController.getMe);
app.put('/api/user/profile', authenticate, authController.updateProfile);

// Settings routes (protected)
app.get('/api/settings/ai', authenticate, settingsController.getAiSettings);
app.put('/api/settings/ai', authenticate, settingsController.updateAiSettings);
app.post('/api/settings/ai/test', authenticate, settingsController.testAiConnection);
app.get('/api/settings/api-credentials', authenticate, settingsController.getApiCredentials);
app.post('/api/settings/api-key/regenerate', authenticate, settingsController.regenerateApiKey);
app.put('/api/settings/webhook', authenticate, settingsController.updateWebhook);
app.get('/api/settings/integrations', authenticate, settingsController.getIntegrationTemplates);

// Leads routes (protected)
app.get('/api/leads', authenticate, leadsController.getLeads);
app.get('/api/leads/stats', authenticate, leadsController.getLeadStats);
app.get('/api/leads/:id', authenticate, leadsController.getLead);
app.put('/api/leads/:id', authenticate, leadsController.updateLead);

// Subscription routes (protected)
app.get('/api/subscription', authenticate, subscriptionController.getSubscription);
app.get('/api/subscription/plans', authenticate, subscriptionController.getPlans);
app.post('/api/subscription/checkout', authenticate, subscriptionController.createCheckoutSession);
app.post('/api/subscription/portal', authenticate, subscriptionController.createPortalSession);
app.post('/api/subscription/cancel', authenticate, subscriptionController.cancelSubscription);
app.post('/api/subscription/reactivate', authenticate, subscriptionController.reactivateSubscription);

// Stripe webhooks (public but signed)
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), subscriptionController.handleWebhook);

// Niche routes (protected)
app.get('/api/niches', authenticate, nichesController.getNiches);
app.get('/api/niches/:id', authenticate, nichesController.getNicheDetails);
app.get('/api/niches/current', authenticate, nichesController.getCurrentNiche);
app.post('/api/niches/apply', authenticate, nichesController.applyNiche);
app.post('/api/niches/custom', authenticate, nichesController.createCustomNiche);
app.put('/api/niches/keywords', authenticate, nichesController.updateKeywords);
app.put('/api/niches/sources', authenticate, nichesController.updateSources);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

// Start server
const startServer = async () => {
  try {
    await db.sequelize.authenticate();
    console.log('✅ Database connected');

    await db.sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
    console.log('✅ Models synchronized');

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📚 API Docs:`);
      console.log(`   - Dashboard API: /api/* (JWT auth)`);
      console.log(`   - Public API: /v1/* (API key auth)`);
      console.log(`   - Webhooks: /webhooks/*`);
    });
  } catch (error) {
    console.error('❌ Failed to start:', error);
    process.exit(1);
  }
};

startServer();
