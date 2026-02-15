const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { User } = require('../models');

const PLANS = {
  free: {
    id: 'free',
    name: 'Free Trial',
    price: 0,
    leadsLimit: 50,
    features: ['50 leads', '2 data sources', 'Basic scoring', 'Email support']
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    priceId: process.env.STRIPE_STARTER_PRICE_ID,
    price: 299,
    leadsLimit: 500,
    features: ['500 leads/month', '2 data sources', 'Basic enrichment', 'Email support', 'Airtable integration']
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    priceId: process.env.STRIPE_GROWTH_PRICE_ID,
    price: 799,
    leadsLimit: 2000,
    features: ['2,000 leads/month', 'All data sources', 'Advanced enrichment', 'Priority support', 'CRM integrations', 'Custom scoring']
  },
  agency: {
    id: 'agency',
    name: 'Agency',
    priceId: process.env.STRIPE_AGENCY_PRICE_ID,
    price: 2000,
    leadsLimit: 10000,
    features: ['Unlimited leads', 'Custom sources', 'White-label dashboard', 'Dedicated support', 'API access', 'Custom integrations']
  }
};

// Get all available plans
const getPlans = async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        plans: Object.values(PLANS).map(p => ({
          id: p.id,
          name: p.name,
          price: p.price,
          leadsLimit: p.leadsLimit,
          features: p.features
        }))
      }
    });
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch plans'
    });
  }
};

// Get current user's subscription
const getSubscription = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });

    const currentPlan = PLANS[user.plan] || PLANS.free;

    res.json({
      success: true,
      data: {
        subscription: {
          plan: user.plan,
          planStatus: user.planStatus,
          leadsLimit: user.leadsLimit,
          leadsUsedThisMonth: user.leadsUsedThisMonth,
          leadsRemaining: Math.max(0, user.leadsLimit - user.leadsUsedThisMonth),
          currentPeriodEnd: user.currentPeriodEnd,
          cancelAtPeriodEnd: user.cancelAtPeriodEnd,
          stripeCustomerId: user.stripeCustomerId,
          stripeSubscriptionId: user.stripeSubscriptionId
        },
        plan: currentPlan
      }
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscription'
    });
  }
};

// Create checkout session
const createCheckout = async (req, res) => {
  try {
    const { plan, billingPeriod = 'monthly' } = req.body;
    const planConfig = PLANS[plan];

    if (!planConfig || plan === 'free') {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan selected'
      });
    }

    const user = await User.findByPk(req.user.id);

    // Create Stripe customer if doesn't exist
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || undefined,
        metadata: {
          userId: user.id
        }
      });
      customerId = customer.id;
      user.stripeCustomerId = customerId;
      await user.save();
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{
        price: planConfig.priceId,
        quantity: 1
      }],
      mode: 'subscription',
      subscription_data: {
        trial_period_days: 7 // 7-day free trial
      },
      success_url: `${process.env.FRONTEND_URL}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/billing?canceled=true`,
      metadata: {
        userId: user.id,
        plan: plan
      }
    });

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        url: session.url
      }
    });
  } catch (error) {
    console.error('Create checkout error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create checkout session'
    });
  }
};

// Create customer portal session
const createPortal = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);

    if (!user.stripeCustomerId) {
      return res.status(400).json({
        success: false,
        message: 'No subscription found'
      });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL}/billing`
    });

    res.json({
      success: true,
      data: {
        url: session.url
      }
    });
  } catch (error) {
    console.error('Create portal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create portal session'
    });
  }
};

// Cancel subscription (at period end)
const cancelSubscription = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);

    if (!user.stripeSubscriptionId) {
      return res.status(400).json({
        success: false,
        message: 'No active subscription'
      });
    }

    // Cancel at period end
    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true
    });

    user.cancelAtPeriodEnd = true;
    await user.save();

    res.json({
      success: true,
      message: 'Subscription will cancel at end of billing period'
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel subscription'
    });
  }
};

// Reactivate subscription
const reactivateSubscription = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);

    if (!user.stripeSubscriptionId) {
      return res.status(400).json({
        success: false,
        message: 'No subscription to reactivate'
      });
    }

    // Remove cancel_at_period_end
    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: false
    });

    user.cancelAtPeriodEnd = false;
    await user.save();

    res.json({
      success: true,
      message: 'Subscription reactivated successfully'
    });
  } catch (error) {
    console.error('Reactivate subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reactivate subscription'
    });
  }
};

module.exports = {
  PLANS,
  getPlans,
  getSubscription,
  createCheckout,
  createPortal,
  cancelSubscription,
  reactivateSubscription
};
