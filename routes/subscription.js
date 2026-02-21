const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { User, SubscriptionPlan } = require('../models');

// Get subscription details
const getSubscription = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    
    // Get plan details
    const plan = await SubscriptionPlan.findOne({
      where: { key: user.subscriptionTier }
    });
    
    res.json({
      success: true,
      data: {
        tier: user.subscriptionTier,
        status: user.subscriptionStatus,
        leadsLimit: user.leadsLimit,
        leadsUsed: user.leadsUsedThisMonth,
        leadsRemaining: Math.max(0, user.leadsLimit - user.leadsUsedThisMonth),
        usagePercentage: Math.round((user.leadsUsedThisMonth / user.leadsLimit) * 100),
        subscriptionStartDate: user.subscriptionStartDate,
        subscriptionEndDate: user.subscriptionEndDate,
        stripeCustomerId: user.stripeCustomerId,
        plan: plan || null
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
  try {
    const plans = await SubscriptionPlan.findAll({
      where: { isActive: true },
      order: [['priceMonthly', 'ASC']]
    });
    
    res.json({
      success: true,
      data: { plans }
    });
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch plans'
    });
  }
};

// Create checkout session
const createCheckoutSession = async (req, res) => {
  try {
    const { planKey, billingPeriod = 'monthly' } = req.body;
    
    const plan = await SubscriptionPlan.findOne({
      where: { key: planKey, isActive: true }
    });
    
    if (!plan) {
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
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        metadata: { userId: user.id }
      });
      customerId = customer.id;
      user.stripeCustomerId = customerId;
      await user.save();
    }

    // Determine price based on billing period
    const priceId = billingPeriod === 'yearly' && plan.priceYearly 
      ? plan.stripePriceIdYearly 
      : plan.stripePriceId;

    if (!priceId) {
      // Free plan or no Stripe price configured
      return res.status(400).json({
        success: false,
        message: 'This plan cannot be purchased'
      });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1
      }],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/billing?success=true&plan=${planKey}`,
      cancel_url: `${process.env.FRONTEND_URL}/billing?canceled=true`,
      metadata: {
        userId: user.id,
        planKey: planKey,
        billingPeriod: billingPeriod
      }
    });

    res.json({
      success: true,
      data: { 
        url: session.url,
        sessionId: session.id
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
const createPortalSession = async (req, res) => {
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

    user.subscriptionStatus = 'cancelled';
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

    user.subscriptionStatus = 'active';
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

// Handle Stripe webhooks
const handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const { userId, planKey } = session.metadata;
        
        const user = await User.findByPk(userId);
        const plan = await SubscriptionPlan.findOne({ where: { key: planKey } });
        
        if (user && plan) {
          user.subscriptionTier = planKey;
          user.subscriptionStatus = 'active';
          user.leadsLimit = plan.leadsLimit;
          user.stripeCustomerId = session.customer;
          user.stripeSubscriptionId = session.subscription;
          user.subscriptionStartDate = new Date();
          await user.save();
          
          console.log(`User ${userId} upgraded to ${planKey}`);
        }
        break;
      }
      
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;
        
        const user = await User.findOne({
          where: { stripeSubscriptionId: subscriptionId }
        });
        
        if (user) {
          user.subscriptionStatus = 'active';
          await user.save();
        }
        break;
      }
      
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;
        
        const user = await User.findOne({
          where: { stripeSubscriptionId: subscriptionId }
        });
        
        if (user) {
          user.subscriptionStatus = 'past_due';
          await user.save();
        }
        break;
      }
      
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        
        const user = await User.findOne({
          where: { stripeSubscriptionId: subscription.id }
        });
        
        if (user) {
          // Downgrade to free plan
          const freePlan = await SubscriptionPlan.findOne({ where: { key: 'free' } });
          user.subscriptionTier = 'free';
          user.subscriptionStatus = 'active';
          user.leadsLimit = freePlan ? freePlan.leadsLimit : 10;
          user.stripeSubscriptionId = null;
          await user.save();
          
          console.log(`User ${user.id} downgraded to free`);
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
};

module.exports = {
  getSubscription,
  getPlans,
  createCheckoutSession,
  createPortalSession,
  cancelSubscription,
  reactivateSubscription,
  handleWebhook
};
