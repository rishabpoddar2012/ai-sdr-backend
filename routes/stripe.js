const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { User } = require('../models');

// Create setup intent for adding payment method
const createSetupIntent = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    
    // Create customer if needed
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

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId
    });

    res.json({
      success: true,
      data: { clientSecret: setupIntent.client_secret }
    });
  } catch (error) {
    console.error('Create setup intent error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create setup intent'
    });
  }
};

module.exports = {
  createSetupIntent
};
