const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const db = require('../data/database');

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user
    const user = await db.get(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Set session
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;
    req.session.teamNumber = user.team_number;

    res.json({
      success: true,
      role: user.role,
      username: user.username,
      teamNumber: user.team_number
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout endpoint
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

// Check session endpoint
router.get('/session', (req, res) => {
  if (req.session && req.session.userId) {
    res.json({
      authenticated: true,
      role: req.session.role,
      username: req.session.username,
      teamNumber: req.session.teamNumber
    });
  } else {
    res.json({ authenticated: false });
  }
});

module.exports = router;
