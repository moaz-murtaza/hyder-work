const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
const PORT = 5000;

// Initialize database
const db = require('./data/database');

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// Session configuration
app.use(session({
  secret: 'business-simulation-admin-secret-key-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false
  }
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

function getTabToken(req) {
  return req.get('x-tab-token') || req.body?.tabToken || req.query?.tabToken;
}

function getTabAuth(req) {
  if (!req.session || !req.session.tabAuth) return null;
  const tabToken = getTabToken(req);
  if (!tabToken) return null;
  return req.session.tabAuth[tabToken] || null;
}

// Authentication middleware
function requireAuth(req, res, next) {
  const auth = getTabAuth(req);
  if (auth && auth.userId) {
    req.auth = auth;
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized. Please login.' });
  }
}

function requireAdmin(req, res, next) {
  if (req.auth && req.auth.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Forbidden. Admin access required.' });
  }
}

// Import routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', requireAuth, requireAdmin, adminRoutes);

// Serve HTML pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login-admin.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// Start server
app.listen(PORT, () => {
  console.log(`═══════════════════════════════════════════════════════════`);
  console.log(`  Business Simulation Platform - ADMIN SERVER`);
  console.log(`  Server running at: http://localhost:${PORT}`);
  console.log(`═══════════════════════════════════════════════════════════`);
  console.log(`  Default Admin Credentials:`);
  console.log(`  Username: 'admin', Password: 'admin123'`);
  console.log(`═══════════════════════════════════════════════════════════`);
  console.log(`  Team servers should be running on ports 3000-3008`);
  console.log(`═══════════════════════════════════════════════════════════`);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down admin server...');
  process.exit(0);
});

module.exports = app;
