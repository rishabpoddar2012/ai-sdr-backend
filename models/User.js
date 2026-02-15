const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  firstName: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  lastName: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  companyName: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  role: {
    type: DataTypes.ENUM('admin', 'user'),
    defaultValue: 'user'
  },
  plan: {
    type: DataTypes.ENUM('free', 'starter', 'growth', 'agency'),
    defaultValue: 'free'
  },
  planStatus: {
    type: DataTypes.ENUM('active', 'cancelled', 'past_due'),
    defaultValue: 'active'
  },
  stripeCustomerId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  stripeSubscriptionId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  leadsUsedThisMonth: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  leadsLimit: {
    type: DataTypes.INTEGER,
    defaultValue: 50 // Free tier
  },
  emailVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  emailVerificationToken: {
    type: DataTypes.STRING,
    allowNull: true
  },
  passwordResetToken: {
    type: DataTypes.STRING,
    allowNull: true
  },
  passwordResetExpires: {
    type: DataTypes.DATE,
    allowNull: true
  },
  lastLoginAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  sourcesConfig: {
    type: DataTypes.JSONB,
    defaultValue: {
      hackerNews: true,
      reddit: true,
      upwork: true,
      linkedin: false // Requires credentials
    }
  },
  keywords: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: ['marketing agency', 'growth', 'performance marketing']
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'users',
  timestamps: true,
  underscored: true
});

module.exports = User;
