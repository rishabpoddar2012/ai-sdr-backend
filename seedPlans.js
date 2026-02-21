const { SubscriptionPlan } = require('./models');

const seedSubscriptionPlans = async () => {
  const plans = [
    {
      key: 'free',
      name: 'Free',
      description: 'Perfect for testing and small projects',
      priceMonthly: 0,
      priceYearly: 0,
      leadsLimit: 10,
      scrapeFrequency: 'daily',
      sourcesLimit: 1,
      isActive: true,
      features: {
        api_access: false,
        webhooks: false,
        support: 'community'
      }
    },
    {
      key: 'pro',
      name: 'Pro',
      description: 'For serious lead generation',
      priceMonthly: 4900,  // $49
      priceYearly: 47040,  // $49 * 12 * 0.8 (20% discount)
      stripePriceId: process.env.STRIPE_PRICE_PRO_MONTHLY || 'price_pro_monthly',
      stripePriceIdYearly: process.env.STRIPE_PRICE_PRO_YEARLY || 'price_pro_yearly',
      leadsLimit: 500,
      scrapeFrequency: 'hourly',
      sourcesLimit: null,  // unlimited
      isActive: true,
      features: {
        api_access: true,
        webhooks: true,
        support: 'email'
      }
    },
    {
      key: 'enterprise',
      name: 'Enterprise',
      description: 'For teams and high volume',
      priceMonthly: 19900,  // $199
      priceYearly: 191040,  // $199 * 12 * 0.8
      stripePriceId: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY || 'price_enterprise_monthly',
      stripePriceIdYearly: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY || 'price_enterprise_yearly',
      leadsLimit: 999999,  // unlimited
      scrapeFrequency: 'realtime',
      sourcesLimit: null,
      isActive: true,
      features: {
        api_access: true,
        webhooks: true,
        support: 'priority'
      }
    }
  ];

  try {
    for (const plan of plans) {
      await SubscriptionPlan.findOrCreate({
        where: { key: plan.key },
        defaults: plan
      });
      console.log(`✅ Plan "${plan.name}" seeded`);
    }
    console.log('\n🎉 All subscription plans seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding plans:', error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  require('dotenv').config();
  seedSubscriptionPlans();
}

module.exports = seedSubscriptionPlans;
