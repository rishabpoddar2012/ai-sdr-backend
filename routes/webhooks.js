const crypto = require('crypto');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { User } = require('../models');

const PLANS = {
  [process.env.STRIPE_STARTER_PRICE_ID]: { plan: 'starter', leadsLimit: 200 },
  [process.env.STRIPE_GROWTH_PRICE_ID]: { plan: 'growth', leadsLimit: 1000 },
  [process.env.STRIPE_AGENCY_PRICE_ID]: { plan: 'agency', leadsLimit: 5000 }
};

// Stripe webhook handler
const stripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata.userId;
        const plan = session.metadata.plan;
        
        const user = await User.findByPk(userId);
        if (user) {
          user.plan = plan;
          user.planStatus = 'active';
          user.stripeSubscriptionId = session.subscription;
          user.leadsLimit = PLANS[session.line_items?.data[0]?.price?.id]?.leadsLimit || 200;
          await user.save();
          
          console.log(`✅ User ${user.email} upgraded to ${plan} plan`);
        }
        break;
      }
      
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        
        const user = await User.findOne({ where: { stripeCustomerId: customerId } });
        if (user) {
          user.planStatus = 'active';
          await user.save();
        }
        break;
      }
      
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        
        const user = await User.findOne({ where: { stripeCustomerId: customerId } });
        if (user) {
          user.planStatus = 'past_due';
          await user.save();
        }
        break;
      }
      
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        
        const user = await User.findOne({ where: { stripeCustomerId: customerId } });
        if (user) {
          user.plan = 'free';
          user.planStatus = 'active';
          user.leadsLimit = 50;
          user.stripeSubscriptionId = null;
          await user.save();
          
          console.log(`⚠️ User ${user.email} downgraded to free plan`);
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
};

module.exports = {
  stripeWebhook
};
