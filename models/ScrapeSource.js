const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ScrapeSource = sequelize.define('ScrapeSource', {
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
  icon: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  category: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  config: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  tableName: 'scrape_sources',
  timestamps: true,
  underscored: true
});

module.exports = ScrapeSource;
