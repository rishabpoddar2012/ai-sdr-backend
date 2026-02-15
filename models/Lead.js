const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Lead = sequelize.define('Lead', {
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
  source: {
    type: DataTypes.ENUM('hacker_news', 'reddit', 'upwork', 'linkedin', 'twitter', 'manual'),
    allowNull: false
  },
  sourceUrl: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  companyName: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  companyWebsite: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  companySize: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  companyIndustry: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  contactName: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  contactTitle: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  contactEmail: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  contactLinkedIn: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  contactPhone: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  intent: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  score: {
    type: DataTypes.ENUM('hot', 'warm', 'cold'),
    allowNull: false,
    defaultValue: 'warm'
  },
  scoreReason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  aiAnalysis: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  budgetSignal: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  urgencySignal: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('new', 'contacted', 'responded', 'qualified', 'closed', 'archived'),
    defaultValue: 'new'
  },
  isFavorite: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: []
  },
  exportedTo: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: []
  },
  rawData: {
    type: DataTypes.JSONB,
    allowNull: true
  }
}, {
  tableName: 'leads',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['score'] },
    { fields: ['status'] },
    { fields: ['created_at'] }
  ]
});

module.exports = Lead;
