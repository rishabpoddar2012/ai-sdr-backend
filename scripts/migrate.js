const db = require('../models');

const migrate = async () => {
  try {
    console.log('Running migrations...');
    
    // Sync all models
    await db.sequelize.sync({ force: true });
    
    console.log('✅ Migrations completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

migrate();
