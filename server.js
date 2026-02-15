require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');

const db = require('./models');
const { authenticate } = require('./middleware/auth');
const authController = require('./routes/auth');
const leadsController = require('./routes/leads');
const subscriptionController = require('./routes/subscription');
const stripeController = require('./routes/stripe');
const webhookController = require('./routes/webhooks');
const settingsController = require('./routes/settings');
const adminController = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 4000;

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

// Security middleware
app.use(helmet());
app.use(compression());
app.use(morgan('dev'));

// Stripe webhook needs raw body
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));

// CORS configuration
const corsOptions = {
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    process.env.LANDING_URL || 'http://localhost:5000',
    'https://ai-sdr.vercel.app',
    'https://ai-sdr-dashboard.vercel.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting for API
app.use('/api/', limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

// ========== PUBLIC ROUTES ==========

// Auth routes
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

app.post('/api/auth/forgot-password', [
  body('email').isEmail().normalizeEmail()
], authController.forgotPassword);

app.post('/api/auth/reset-password', [
  body('token').exists(),
  body('password').isLength({ min: 8 })
], authController.resetPassword);

// Stripe webhook (raw body, no auth)
app.post('/api/webhooks/stripe', webhookController.stripeWebhook);

// ========== PROTECTED ROUTES ==========

// User profile
app.get('/api/user/profile', authenticate, authController.getMe);
app.put('/api/user/profile', authenticate, authController.updateProfile);
app.put('/api/user/password', authenticate, [
  body('currentPassword').exists(),
  body('newPassword').isLength({ min: 8 })
], authController.updatePassword);

// Leads
app.get('/api/leads', authenticate, leadsController.getLeads);
app.get('/api/leads/stats', authenticate, leadsController.getLeadStats);
app.get('/api/leads/sources', authenticate, leadsController.getSources);
app.get('/api/leads/:id', authenticate, leadsController.getLead);
app.put('/api/leads/:id', authenticate, leadsController.updateLead);
app.delete('/api/leads/:id', authenticate, leadsController.deleteLead);
app.post('/api/leads/:id/favorite', authenticate, leadsController.toggleFavorite);
app.post('/api/leads/:id/export', authenticate, leadsController.exportLead);

// Settings
app.get('/api/settings', authenticate, settingsController.getSettings);
app.put('/api/settings', authenticate, settingsController.updateSettings);
app.put('/api/settings/sources', authenticate, settingsController.updateSources);
app.put('/api/settings/keywords', authenticate, settingsController.updateKeywords);

// Integrations
app.get('/api/integrations', authenticate, settingsController.getIntegrations);
app.post('/api/integrations/webhook', authenticate, settingsController.updateWebhook);
app.post('/api/integrations/crm', authenticate, settingsController.connectCRM);
app.delete('/api/integrations/crm/:type', authenticate, settingsController.disconnectCRM);

// Subscription & Billing
app.get('/api/subscription', authenticate, subscriptionController.getSubscription);
app.get('/api/subscription/plans', subscriptionController.getPlans);
app.post('/api/subscription/checkout', authenticate, [
  body('plan').isIn(['starter', 'growth', 'agency']),
  body('billingPeriod').optional().isIn(['monthly', 'yearly'])
], subscriptionController.createCheckout);
app.post('/api/subscription/portal', authenticate, subscriptionController.createPortal);
app.post('/api/subscription/cancel', authenticate, subscriptionController.cancelSubscription);
app.post('/api/subscription/reactivate', authenticate, subscriptionController.reactivateSubscription);

// Stripe setup intent (for adding payment method)
app.post('/api/stripe/setup-intent', authenticate, stripeController.createSetupIntent);

// Admin routes
app.get('/api/admin/users', authenticate, adminController.listUsers);
app.get('/api/admin/stats', authenticate, adminController.getStats);
app.post('/api/admin/users/:id/leads', authenticate, adminController.addLeadsToUser);
app.put('/api/admin/users/:id/plan', authenticate, adminController.updateUserPlan);

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
    // Test database connection
    await db.sequelize.authenticate();
    console.log('✅ Database connected successfully');

    // Sync models (in production, use migrations instead)
    await db.sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
    console.log('✅ Database models synchronized');

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📚 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
