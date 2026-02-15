const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { User } = require('../models');

const PLANS = {
  starter: {
    name: 'Starter',
    priceId: process.env.STRIPE_STARTER_PRICE_ID,
    leadsLimit: 200
  },
  growth: {
    name: 'Growth',
    priceId: process.env.STRIPE_GROWTH_PRICE_ID,
    leadsLimit: 1000
  },
  agency: {
    name: 'Agency',
    priceId: process.env.STRIPE_AGENCY_PRICE_ID,
    leadsLimit: 5000
  }
};

// Get subscription details
const getSubscription = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    
    res.json({
      success: true,
      data: {
        plan: user.plan,
        status: user.planStatus,
        leadsLimit: user.leadsLimit,
        leadsUsed: user.leadsUsedThisMonth,
        currentPeriodEnd: user.currentPeriodEnd
      }
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get available plans
const getPlans = async (req, res) => {
  res.json({
    success: true,
    data: {
      plans: [
        { id: 'free', name: 'Free', price: 0, leadsLimit: 50 },
        { id: 'starter', name: 'Starter', price: 49, leadsLimit: 200 },
        { id: 'growth', name: 'Growth', price: 149, leadsLimit: 1000 },
        { id: 'agency', name: 'Agency', price: 399, leadsLimit: 5000 }
      ]
    }
  });
};

// Create checkout session
const createCheckout = async (req, res) => {
  try {
    const { plan, billingPeriod = 'monthly' } = req.body;
    const planConfig = PLANS[plan];
    
    if (!planConfig) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan'
      });
    }

    const user = await User.findByPk(req.user.id);
    
    // Create Stripe customer if needed
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id }
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
      success_url: `${process.env.FRONTEND_URL}/billing?success=true`,
      cancel_url: `${process.env.FRONTEND_URL}/billing?canceled=true`,
      metadata: {
        userId: user.id,
        plan: plan
      }
    });

    res.json({
      success: true,
      data: { url: session.url }
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
      data: { url: session.url }
    });
  } catch (error) {
    console.error('Create portal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create portal session'
    });
  }
};

// Cancel subscription
const cancelSubscription = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    
    if (!user.stripeSubscriptionId) {
      return res.status(400).json({
        success: false,
        message: 'No active subscription'
      });
    }

    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true
    });

    user.planStatus = 'cancelled';
    await user.save();

    res.json({
      success: true,
      message: 'Subscription will cancel at period end'
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

    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: false
    });

    user.planStatus = 'active';
    await user.save();

    res.json({
      success: true,
      message: 'Subscription reactivated'
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
  getSubscription,
  getPlans,
  createCheckout,
  createPortal,
  cancelSubscription,
  reactivateSubscription
};
