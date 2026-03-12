const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const db = require('../data/database');

function getTabToken(req) {
  return req.get('x-tab-token') || req.body?.tabToken || req.query?.tabToken;
}

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const tabToken = getTabToken(req);

    if (!username || !password || !tabToken) {
      return res.status(400).json({ error: 'Username, password, and tab token are required' });
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

    // Set tab-scoped auth context in session
    req.session.tabAuth = req.session.tabAuth || {};
    req.session.tabAuth[tabToken] = {
      userId: user.id,
      username: user.username,
      role: user.role,
      teamNumber: user.team_number,
      updatedAt: Date.now()
    };

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
  const tabToken = getTabToken(req);

  if (!req.session) {
    return res.json({ success: true });
  }

  if (tabToken && req.session.tabAuth && req.session.tabAuth[tabToken]) {
    delete req.session.tabAuth[tabToken];
    const activeTabs = Object.keys(req.session.tabAuth).length;

    if (activeTabs === 0) {
      req.session.destroy((err) => {
        if (err) {
          return res.status(500).json({ error: 'Logout failed' });
        }
        res.clearCookie('connect.sid');
        res.json({ success: true });
      });
      return;
    }

    req.session.save((err) => {
      if (err) {
        return res.status(500).json({ error: 'Logout failed' });
      }
      res.json({ success: true });
    });
    return;
  }

  // Fallback: logout entire session if no tab token is provided
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
  const tabToken = getTabToken(req);
  const tabAuth = req.session?.tabAuth?.[tabToken];

  if (tabAuth && tabAuth.userId) {
    res.json({
      authenticated: true,
      role: tabAuth.role,
      username: tabAuth.username,
      teamNumber: tabAuth.teamNumber
    });
  } else {
    res.json({ authenticated: false });
  }
});

module.exports = router;
