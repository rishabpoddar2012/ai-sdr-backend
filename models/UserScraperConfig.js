const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserScraperConfig = sequelize.define('UserScraperConfig', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  sourceKey: {
    type: DataTypes.STRING(50),
    allowNull: false,
    references: {
      model: 'scrape_sources',
      key: 'key'
    }
  },
  isEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  keywords: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: []
  },
  customFilters: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  lastScrapedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'user_scraper_configs',
  timestamps: true,
  underscored: true
});

module.exports = UserScraperConfig;
