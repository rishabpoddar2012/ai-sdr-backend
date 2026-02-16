require('dotenv').config();
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');

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
    validate: { isEmail: true }
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  firstName: DataTypes.STRING(100),
  lastName: DataTypes.STRING(100),
  companyName: DataTypes.STRING(200),
  
  // AI Provider Settings (User brings their own)
  aiProvider: {
    type: DataTypes.ENUM('rule', 'openai', 'groq', 'together', 'anthropic', 'custom'),
    defaultValue: 'rule'
  },
  aiApiKey: {
    type: DataTypes.TEXT, // Encrypted
    allowNull: true
  },
  aiModel: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  aiBaseUrl: {
    type: DataTypes.STRING(500), // For custom/OpenAI-compatible endpoints
    allowNull: true
  },
  
  // API Access for n8n/Make.com
  apiKey: {
    type: DataTypes.STRING(255),
    unique: true,
    allowNull: true
  },
  apiEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  apiRateLimit: {
    type: DataTypes.INTEGER,
    defaultValue: 1000 // requests per hour
  },
  apiWebhookUrl: {
    type: DataTypes.STRING(500), // For real-time lead notifications
    allowNull: true
  },
  
  // Usage tracking
  apiCallsThisMonth: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  leadsCollectedThisMonth: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  
  // Subscription (free for now)
  plan: {
    type: DataTypes.ENUM('free', 'pro', 'enterprise'),
    defaultValue: 'free'
  },
  
  // Feature flags
  features: {
    type: DataTypes.JSONB,
    defaultValue: {
      webDashboard: true,
      apiAccess: true,
      webhooks: true,
      n8nIntegration: true,
      makeIntegration: true,
      zapierIntegration: false // Coming soon
    }
  },
  
  // Sources config
  sourcesConfig: {
    type: DataTypes.JSONB,
    defaultValue: {
      hackerNews: true,
      reddit: true,
      upwork: true,
      linkedin: false
    }
  },
  
  keywords: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: ['marketing agency', 'growth']
  },
  
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'users',
  timestamps: true,
  underscored: true,
  hooks: {
    beforeCreate: async (user) => {
      // Generate API key for new users
      if (!user.apiKey) {
        const crypto = require('crypto');
        user.apiKey = `aisdr_${crypto.randomBytes(32).toString('hex')}`;
      }
    }
  }
});

// Instance method to encrypt AI API key
User.prototype.setAiApiKey = async function(key) {
  const crypto = require('crypto');
  const algorithm = 'aes-256-gcm';
  const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
  
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher(algorithm, secret);
  
  let encrypted = cipher.update(key, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  this.aiApiKey = JSON.stringify({
    iv: iv.toString('hex'),
    data: encrypted,
    tag: authTag.toString('hex')
  });
};

// Instance method to decrypt AI API key
User.prototype.getAiApiKey = function() {
  if (!this.aiApiKey) return null;
  
  try {
    const crypto = require('crypto');
    const algorithm = 'aes-256-gcm';
    const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
    
    const { iv, data, tag } = JSON.parse(this.aiApiKey);
    
    const decipher = crypto.createDecipher(algorithm, secret);
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    
    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (e) {
    console.error('Failed to decrypt API key:', e);
    return null;
  }
};

module.exports = User;
