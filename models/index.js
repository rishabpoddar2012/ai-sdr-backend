const sequelize = require('../config/database');
const User = require('./User');
const Lead = require('./Lead');
const ScrapeSource = require('./ScrapeSource');
const UserScraperConfig = require('./UserScraperConfig');
const SubscriptionPlan = require('./SubscriptionPlan');

// Define relationships
User.hasMany(Lead, { foreignKey: 'userId', as: 'leads' });
Lead.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(UserScraperConfig, { foreignKey: 'userId', as: 'scraperConfigs' });
UserScraperConfig.belongsTo(User, { foreignKey: 'userId', as: 'user' });

ScrapeSource.hasMany(UserScraperConfig, { foreignKey: 'sourceKey', as: 'userConfigs' });
UserScraperConfig.belongsTo(ScrapeSource, { foreignKey: 'sourceKey', as: 'source' });

const db = {
  sequelize,
  User,
  Lead,
  ScrapeSource,
  UserScraperConfig,
  SubscriptionPlan
};

module.exports = db;
