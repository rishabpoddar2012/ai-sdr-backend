const sequelize = require('../config/database');
const User = require('./User');
const Lead = require('./Lead');

// Define relationships
User.hasMany(Lead, { foreignKey: 'userId', as: 'leads' });
Lead.belongsTo(User, { foreignKey: 'userId', as: 'user' });

const db = {
  sequelize,
  User,
  Lead
};

module.exports = db;
