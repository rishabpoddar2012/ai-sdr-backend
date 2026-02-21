// Competitor Defector Routes Integration
// Add this to your main server.js file

const competitorDefectorRoutes = require('./competitor-defector/routes');

// ... after existing routes ...

// Competitor Defector routes (protected)
app.use('/api/competitor-defector', authenticate, competitorDefectorRoutes);
