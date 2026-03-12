let simulationState = null;
let teams = [];

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

// Initialize dashboard
async function init() {
  await checkAuth();
  await loadSimulationState();
  await loadTeamsOverview();
  updateControlPanel();
}

// Check authentication
async function checkAuth() {
  try {
    const cachedAuth = sessionStorage.getItem('auth');
    if (!cachedAuth) {
      window.location.href = '/';
      return;
    }

    const auth = JSON.parse(cachedAuth);
    if (auth.authenticated && auth.role === 'admin') {
      const response = await fetch('/api/auth/session');
      const sessionState = await response.json();

      if (sessionState.authenticated && sessionState.role === 'admin') {
        return;
      }
    }

    sessionStorage.removeItem('auth');
    window.location.href = '/';
  } catch (error) {
    console.error('Auth check error:', error);
    sessionStorage.removeItem('auth');
    window.location.href = '/';
  }
}

// Logout
async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    sessionStorage.removeItem('auth');
    window.location.href = '/';
  } catch (error) {
    console.error('Logout error:', error);
    sessionStorage.removeItem('auth');
    window.location.href = '/';
  }
}

// Load simulation state
async function loadSimulationState() {
  try {
    const response = await fetch('/api/admin/simulation-state');
    if (response.status === 401 || response.status === 403) {
      sessionStorage.removeItem('auth');
      window.location.href = '/';
      return;
    }

    simulationState = await response.json();
    
    updateSimulationStatus();
  } catch (error) {
    console.error('Error loading simulation state:', error);
  }
}

// Update simulation status display
function updateSimulationStatus() {
  const statusEl = document.getElementById('simStatus');
  const subtitleEl = document.getElementById('simSubtitle');
  const currentRoundEl = document.getElementById('currentRound');
  const totalRoundsEl = document.getElementById('totalRounds');
  
  let statusText = '';
  let statusClass = '';
  
  switch (simulationState.status) {
    case 'not_started':
      statusText = 'Not Started';
      subtitleEl.textContent = 'Ready to begin';
      break;
    case 'in_progress':
      statusText = 'In Progress';
      subtitleEl.textContent = 'Simulation running';
      break;
    case 'completed':
      statusText = 'Completed';
      subtitleEl.textContent = 'Simulation finished';
      break;
  }
  
  statusEl.textContent = statusText;
  currentRoundEl.textContent = simulationState.current_round;
  totalRoundsEl.textContent = simulationState.total_rounds;
  
  // Update results round selector
  updateResultsRoundSelector();
}

// Update control panel based on simulation state
function updateControlPanel() {
  const panel = document.getElementById('controlPanel');
  
  if (simulationState.status === 'not_started') {
    panel.innerHTML = `
      <div class="form-group">
        <label>Number of Teams:</label>
        <select id="teamsCountSelect">
          <option value="4" selected>4 Teams</option>
          <option value="5">5 Teams</option>
          <option value="6">6 Teams</option>
          <option value="7">7 Teams</option>
          <option value="8">8 Teams</option>
        </select>
      </div>
      <div class="action-buttons">
        <button class="btn btn-success" onclick="startSimulation()">Start Simulation</button>
      </div>
    `;
  } else if (simulationState.status === 'in_progress') {
    panel.innerHTML = `
      <div id="successMessage" class="success-message"></div>
      <div id="errorMessage" class="error-message"></div>
      <div class="action-buttons">
        <button class="btn btn-primary" onclick="advanceRound()">Process & Advance to Next Round</button>
        <button class="btn btn-warning" onclick="viewCurrentDecisions()">View Current Decisions</button>
        <button class="btn btn-secondary" onclick="exportData()">Export All Data</button>
        <button class="btn btn-danger" onclick="confirmReset()">Reset Simulation</button>
      </div>
    `;
    document.getElementById('decisionsCard').style.display = 'block';
    document.getElementById('resultsCard').style.display = 'block';
  } else if (simulationState.status === 'completed') {
    panel.innerHTML = `
      <div class="success-message">Simulation has been completed successfully!</div>
      <div class="action-buttons">
        <button class="btn btn-secondary" onclick="exportData()">Export All Data</button>
        <button class="btn btn-danger" onclick="confirmReset()">Reset Simulation</button>
      </div>
    `;
    document.getElementById('resultsCard').style.display = 'block';
  }
}

// Start simulation
async function startSimulation() {
  const teamsCount = document.getElementById('teamsCountSelect').value;
  
  if (!confirm(`Start simulation with ${teamsCount} teams?`)) {
    return;
  }
  
  try {
    const response = await fetch('/api/admin/start-simulation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamsCount: parseInt(teamsCount) })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      alert('Simulation started successfully!');
      location.reload();
    } else {
      alert('Error: ' + data.error);
    }
  } catch (error) {
    console.error('Error starting simulation:', error);
    alert('Failed to start simulation');
  }
}

// Advance round
async function advanceRound() {
  if (!confirm('Process current round and advance to the next round?')) {
    return;
  }
  
  const errorEl = document.getElementById('errorMessage');
  const successEl = document.getElementById('successMessage');
  
  errorEl.textContent = '';
  successEl.textContent = '';
  
  try {
    const response = await fetch('/api/admin/advance-round', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      successEl.textContent = data.message;
      setTimeout(() => location.reload(), 2000);
    } else {
      errorEl.textContent = data.error;
    }
  } catch (error) {
    console.error('Error advancing round:', error);
    errorEl.textContent = 'Failed to advance round';
  }
}

// Load teams overview
async function loadTeamsOverview() {
  try {
    const response = await fetch('/api/admin/teams-overview');
    teams = await response.json();
    
    const submittedCount = teams.filter(t => t.hasSubmitted).length;
    document.getElementById('activeTeams').textContent = teams.filter(t => !t.is_bankrupt).length;
    document.getElementById('submittedCount').textContent = submittedCount;
    document.getElementById('requiredCount').textContent = simulationState.teams_count;
    
    displayTeamsOverview();
  } catch (error) {
    console.error('Error loading teams:', error);
  }
}

// Display teams overview
function displayTeamsOverview() {
  const container = document.getElementById('teamsOverview');
  
  if (teams.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No teams available</p></div>';
    return;
  }
  
  let html = '<table><thead><tr>';
  html += '<th>Team</th><th>Company Name</th><th>Cash</th><th>Equity</th>';
  html += '<th>Debt</th><th>Employees</th><th>Status</th><th>Round Status</th>';
  html += '</tr></thead><tbody>';
  
  teams.slice(0, simulationState.teams_count).forEach(team => {
    const statusBadge = team.is_bankrupt 
      ? '<span class="badge badge-danger">Bankrupt</span>' 
      : '<span class="badge badge-success">Active</span>';
    
    const submissionBadge = simulationState.status === 'in_progress' 
      ? (team.hasSubmitted 
        ? '<span class="badge badge-success">Submitted</span>' 
        : '<span class="badge badge-warning">Pending</span>')
      : '<span class="badge badge-info">-</span>';
    
    html += `<tr>
      <td><strong>Team ${team.team_number}</strong></td>
      <td>${team.company_name}</td>
      <td>$${formatNumber(team.cash)}</td>
      <td>$${formatNumber(team.equity)}</td>
      <td>$${formatNumber(team.short_term_debt + team.long_term_debt)}</td>
      <td>${team.employees}</td>
      <td>${statusBadge}</td>
      <td>${submissionBadge}</td>
    </tr>`;
  });
  
  html += '</tbody></table>';
  container.innerHTML = html;
}

// View current decisions
async function viewCurrentDecisions() {
  try {
    const response = await fetch('/api/admin/all-decisions');
    const decisions = await response.json();
    
    const container = document.getElementById('decisionsOverview');
    
    if (decisions.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No decisions submitted yet</p></div>';
      return;
    }
    
    let html = '<table><thead><tr>';
    html += '<th>Team</th><th>Price</th><th>Advertising</th><th>Production</th>';
    html += '<th>Capacity Exp.</th><th>Employees</th><th>Submitted</th>';
    html += '</tr></thead><tbody>';
    
    decisions.forEach(d => {
      const submittedBadge = d.submitted 
        ? '<span class="badge badge-success">Yes</span>' 
        : '<span class="badge badge-warning">Draft</span>';
      
      html += `<tr>
        <td><strong>${d.company_name}</strong></td>
        <td>$${d.price}</td>
        <td>$${formatNumber(d.advertising)}</td>
        <td>${formatNumber(d.production_volume)} units</td>
        <td>$${formatNumber(d.capacity_expansion)}</td>
        <td>+${d.employees_hire} -${d.employees_fire}</td>
        <td>${submittedBadge}</td>
      </tr>`;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
    
  } catch (error) {
    console.error('Error loading decisions:', error);
  }
}

// Update results round selector
function updateResultsRoundSelector() {
  const select = document.getElementById('resultsRoundSelect');
  select.innerHTML = '<option value="">Select Round</option>';
  
  for (let i = 1; i < simulationState.current_round; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = `Round ${i}`;
    select.appendChild(option);
  }
}

// Load results for selected round
async function loadResults() {
  const round = document.getElementById('resultsRoundSelect').value;
  const container = document.getElementById('resultsDisplay');
  
  if (!round) {
    container.innerHTML = '';
    return;
  }
  
  container.innerHTML = '<div class="loading">Loading results...</div>';
  
  try {
    const response = await fetch(`/api/admin/comparative-report/${round}`);
    const results = await response.json();
    
    let html = '<h3>Round ' + round + ' Comparative Results</h3>';
    html += '<table><thead><tr>';
    html += '<th>Rank</th><th>Team</th><th>Revenue</th><th>Net Income</th>';
    html += '<th>Market Share</th><th>ROI</th><th>ROE</th><th>EPS</th>';
    html += '</tr></thead><tbody>';
    
    results.forEach((r, index) => {
      const rank = index + 1;
      const rankBadge = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
      
      html += `<tr>
        <td><strong>${rankBadge}</strong></td>
        <td>${r.companyName}</td>
        <td>$${formatNumber(r.revenue)}</td>
        <td class="${r.netIncome >= 0 ? 'text-positive' : 'text-negative'}">$${formatNumber(r.netIncome)}</td>
        <td>${r.marketShare.toFixed(2)}%</td>
        <td>${r.roi.toFixed(2)}%</td>
        <td>${r.roe.toFixed(2)}%</td>
        <td>$${r.eps.toFixed(2)}</td>
      </tr>`;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
    
  } catch (error) {
    console.error('Error loading results:', error);
    container.innerHTML = '<div class="error-message">Failed to load results</div>';
  }
}

// Export data
async function exportData() {
  try {
    const response = await fetch('/api/admin/export-data');
    const data = await response.json();
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `simulation-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    alert('Data exported successfully!');
  } catch (error) {
    console.error('Error exporting data:', error);
    alert('Failed to export data');
  }
}

// Confirm reset
function confirmReset() {
  if (confirm('WARNING: This will reset the entire simulation and delete all data. Are you sure?')) {
    if (confirm('This action cannot be undone. Continue?')) {
      resetSimulation();
    }
  }
}

// Reset simulation
async function resetSimulation() {
  try {
    const response = await fetch('/api/admin/reset-simulation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      alert('Simulation reset successfully!');
      location.reload();
    } else {
      alert('Error: ' + data.error);
    }
  } catch (error) {
    console.error('Error resetting simulation:', error);
    alert('Failed to reset simulation');
  }
}

// Format number helper
function formatNumber(num) {
  return Math.round(num).toLocaleString();
}

// Auto-refresh every 30 seconds
setInterval(() => {
  loadSimulationState();
  loadTeamsOverview();
}, 30000);

// Initialize on load
init();
