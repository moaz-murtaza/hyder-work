const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');

// Get team number from command line argument
const teamNumber = parseInt(process.argv[2]) || 1;
const PORT = 3000 + teamNumber - 1; // Team 1 = 3000, Team 2 = 3001, etc.

const app = express();

// Initialize database
const db = require('./data/database');

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// Session configuration
app.use(session({
  secret: `business-simulation-team${teamNumber}-secret-key-2026`,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Authentication middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized. Please login.' });
  }
}

function requireTeam(req, res, next) {
  if (req.session && req.session.role === 'team') {
    // Ensure the user is accessing their own team server
    if (req.session.teamNumber === teamNumber) {
      next();
    } else {
      res.status(403).json({ error: 'Access denied. Wrong team server.' });
    }
  } else {
    res.status(403).json({ error: 'Forbidden. Team access required.' });
  }
}

// Import routes
const authRoutes = require('./routes/auth');
const teamRoutes = require('./routes/team');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/team', requireAuth, requireTeam, teamRoutes);

// Serve HTML pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login-team.html'));
});

app.get('/team', (req, res) => {
  if (req.session && req.session.role === 'team' && req.session.teamNumber === teamNumber) {
    res.sendFile(path.join(__dirname, 'public', 'team.html'));
  } else {
    res.redirect('/');
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// Start server
app.listen(PORT, () => {
  console.log(`═══════════════════════════════════════════════════════════`);
  console.log(`  Business Simulation Platform - TEAM ${teamNumber} SERVER`);
  console.log(`  Server running at: http://localhost:${PORT}`);
  console.log(`═══════════════════════════════════════════════════════════`);
  console.log(`  Team ${teamNumber} Login Credentials:`);
  console.log(`  Username: 'team${teamNumber}', Password: 'password'`);
  console.log(`═══════════════════════════════════════════════════════════`);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log(`\nShutting down Team ${teamNumber} server...`);
  process.exit(0);
});

module.exports = app;
