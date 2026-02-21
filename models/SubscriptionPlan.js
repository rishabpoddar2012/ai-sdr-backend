const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SubscriptionPlan = sequelize.define('SubscriptionPlan', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  key: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  priceMonthly: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  priceYearly: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  leadsLimit: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  scrapeFrequency: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  sourcesLimit: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  features: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  stripePriceId: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'subscription_plans',
  timestamps: true,
  underscored: true
});

module.exports = SubscriptionPlan;
