const TAB_TOKEN_KEY = 'tabToken';

function getOrCreateTabToken() {
  let token = sessionStorage.getItem(TAB_TOKEN_KEY);
  if (!token) {
    token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(TAB_TOKEN_KEY, token);
  }
  return token;
}

const originalFetch = window.fetch.bind(window);
window.fetch = (url, options = {}) => {
  const headers = new Headers(options.headers || {});
  headers.set('x-tab-token', getOrCreateTabToken());
  return originalFetch(url, { ...options, headers });
};

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const errorMessage = document.getElementById('errorMessage');
  
  errorMessage.textContent = '';
  
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      // Cache auth state per tab only
      sessionStorage.setItem('auth', JSON.stringify({
        authenticated: true,
        role: data.role,
        username: data.username,
        teamNumber: data.teamNumber
      }));
      
      // Redirect based on role
      if (data.role === 'admin') {
        window.location.href = '/admin';
      } else if (data.role === 'team') {
        window.location.href = '/team';
      }
    } else {
      errorMessage.textContent = data.error || 'Login failed';
    }
  } catch (error) {
    errorMessage.textContent = 'Connection error. Please try again.';
    console.error('Login error:', error);
  }
});

// Check if already logged in
async function checkSession() {
  try {
    // First check sessionStorage (tab-scoped)
    const cachedAuth = sessionStorage.getItem('auth');
    if (cachedAuth) {
      const auth = JSON.parse(cachedAuth);
      if (auth.authenticated) {
        if (auth.role === 'admin') {
          window.location.href = '/admin';
        } else if (auth.role === 'team') {
          window.location.href = '/team';
        }
      }
      return;
    }

    // Validate server-side tab session if any stale cache exists from prior runs.
    const response = await fetch('/api/auth/session');
    const data = await response.json();

    if (!data.authenticated) {
      sessionStorage.removeItem('auth');
    }
  } catch (error) {
    console.error('Session check error:', error);
  }
}

checkSession();
