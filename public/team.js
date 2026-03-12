let dashboardData = null;
let teamNumber = null;

// Initialize dashboard
async function init() {
  await checkAuth();
  await loadDashboard();
  setupFormHandlers();
}

// Check authentication - with localStorage caching
async function checkAuth() {
  try {
    // First check localStorage for cached auth state
    const cachedAuth = localStorage.getItem('auth');
    if (cachedAuth) {
      const auth = JSON.parse(cachedAuth);
      teamNumber = auth.teamNumber;
      document.getElementById('teamName').textContent = `Team ${teamNumber}`;
      return; // Use cached auth, skip server check
    }

    // If no cache, try to get session from server
    const response = await fetch('/api/auth/session');
    const data = await response.json();
    
    if (data.authenticated && data.role === 'team') {
      teamNumber = data.teamNumber;
      document.getElementById('teamName').textContent = `Team ${teamNumber}`;
      
      // Cache auth state in localStorage
      localStorage.setItem('auth', JSON.stringify({
        authenticated: true,
        role: data.role,
        teamNumber: data.teamNumber
      }));
    } else {
      // Only redirect if explicitly not authenticated and no cache
      window.location.href = '/';
    }
  } catch (error) {
    console.error('Auth check error:', error);
    // Don't redirect on error, use cached auth if available
    const cachedAuth = localStorage.getItem('auth');
    if (!cachedAuth) {
      window.location.href = '/';
    }
  }
}

// Logout
async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    // Clear cached auth state
    localStorage.removeItem('auth');
    window.location.href = '/';
  } catch (error) {
    console.error('Logout error:', error);
    // Clear cache anyway
    localStorage.removeItem('auth');
    window.location.href = '/';
  }
}

// Load dashboard data
async function loadDashboard() {
  try {
    const response = await fetch('/api/team/dashboard');
    dashboardData = await response.json();
    
    await updateDashboard();
    await loadHistory();
  } catch (error) {
    console.error('Error loading dashboard:', error);
  }
}

// Update dashboard display
async function updateDashboard() {
  const { simulationState, team, currentDecision, previousResults } = dashboardData;
  
  // Update company name
  document.getElementById('companyName').textContent = team.company_name;
  
  // Update stats
  document.getElementById('currentRound').textContent = simulationState.current_round;
  document.getElementById('cashBalance').textContent = '$' + formatNumber(team.cash);
  document.getElementById('totalEquity').textContent = '$' + formatNumber(team.equity);
  
  // Update round status
  const roundStatusEl = document.getElementById('roundStatus');
  if (simulationState.status === 'not_started') {
    roundStatusEl.textContent = 'Waiting to start';
  } else if (simulationState.status === 'in_progress') {
    roundStatusEl.textContent = currentDecision && currentDecision.submitted 
      ? 'Decisions submitted' 
      : 'Awaiting decisions';
  } else {
    roundStatusEl.textContent = 'Simulation completed';
  }
  
  // Update market share from previous results
  if (previousResults && previousResults.incomeStatement) {
    document.getElementById('marketShare').textContent = 
      previousResults.kpis.market.marketShare.toFixed(2) + '%';
  }
  
  // Show/hide decision form
  const decisionCard = document.getElementById('decisionCard');
  const bankruptMessage = document.getElementById('bankruptMessage');
  const waitingMessage = document.getElementById('waitingMessage');
  const decisionsForm = document.getElementById('decisionsForm');
  
  document.getElementById('decisionRound').textContent = simulationState.current_round;
  
  if (team.is_bankrupt) {
    bankruptMessage.style.display = 'block';
    decisionsForm.style.display = 'none';
    waitingMessage.style.display = 'none';
  } else if (simulationState.status === 'not_started') {
    waitingMessage.style.display = 'block';
    decisionsForm.style.display = 'none';
    bankruptMessage.style.display = 'none';
  } else if (simulationState.status === 'in_progress') {
    decisionsForm.style.display = 'block';
    bankruptMessage.style.display = 'none';
    waitingMessage.style.display = 'none';
    
    // Update form with team info
    document.getElementById('capacityInfo').textContent = formatNumber(team.production_capacity);
    document.getElementById('employeesInfo').textContent = team.employees;
    document.getElementById('stDebtInfo').textContent = formatNumber(team.short_term_debt);
    document.getElementById('ltDebtInfo').textContent = formatNumber(team.long_term_debt);
    
    // Load existing decision if available, otherwise load entry data from CSV
    if (currentDecision) {
      loadDecisionIntoForm(currentDecision);
    } else {
      await loadEntryDataIntoForm(simulationState.current_round);
    }
  } else {
    decisionsForm.style.display = 'none';
    waitingMessage.style.display = 'none';
    bankruptMessage.style.display = 'none';
  }
  
  // Show previous results if available
  if (previousResults && previousResults.incomeStatement) {
    document.getElementById('resultsCard').style.display = 'block';
    document.getElementById('resultsRound').textContent = simulationState.current_round - 1;
    displayResults(previousResults);
  }
}

// Load decision into form
function loadDecisionIntoForm(decision) {
  document.getElementById('price').value = decision.price || 100;
  document.getElementById('advertising').value = decision.advertising || 0;
  document.getElementById('salesForce').value = decision.sales_force || 0;
  document.getElementById('qualityInvestment').value = decision.quality_investment || 0;
  document.getElementById('marketResearch').value = decision.market_research || 0;
  
  document.getElementById('productionVolume').value = decision.production_volume || 0;
  document.getElementById('capacityExpansion').value = decision.capacity_expansion || 0;
  
  document.getElementById('employeesHire').value = decision.employees_hire || 0;
  document.getElementById('employeesFire').value = decision.employees_fire || 0;
  document.getElementById('wageLevel').value = decision.wage_level || 2500;
  document.getElementById('trainingInvestment').value = decision.training_investment || 0;
  
  document.getElementById('shortTermBorrow').value = decision.short_term_borrow || 0;
  document.getElementById('longTermBorrow').value = decision.long_term_borrow || 0;
  document.getElementById('shortTermRepay').value = decision.short_term_repay || 0;
  document.getElementById('longTermRepay').value = decision.long_term_repay || 0;
  document.getElementById('dividendPayout').value = decision.dividend_payout || 0;
}

// Load entry data from CSV into form
async function loadEntryDataIntoForm(roundNumber) {
  try {
    const response = await fetch(`/api/team/entry-data/${roundNumber}`);
    if (!response.ok) {
      console.warn('No entry data found for this round, using defaults');
      return;
    }
    
    const data = await response.json();
    const entryData = data.data;
    
    // Populate form with entry values from CSV
    document.getElementById('price').value = entryData.price || 100;
    document.getElementById('advertising').value = entryData.advertising || 50000;
    document.getElementById('salesForce').value = entryData.sales_force || 30000;
    document.getElementById('qualityInvestment').value = entryData.quality_investment || 20000;
    document.getElementById('marketResearch').value = entryData.market_research || 10000;
    
    document.getElementById('productionVolume').value = entryData.production_volume || 8000;
    document.getElementById('capacityExpansion').value = entryData.capacity_expansion || 0;
    
    document.getElementById('employeesHire').value = entryData.employees_hire || 0;
    document.getElementById('employeesFire').value = entryData.employees_fire || 0;
    document.getElementById('wageLevel').value = entryData.wage_level || 2500;
    document.getElementById('trainingInvestment').value = entryData.training_investment || 5000;
    
    document.getElementById('shortTermBorrow').value = entryData.short_term_borrow || 0;
    document.getElementById('longTermBorrow').value = entryData.long_term_borrow || 0;
    document.getElementById('shortTermRepay').value = entryData.short_term_repay || 0;
    document.getElementById('longTermRepay').value = entryData.long_term_repay || 0;
    document.getElementById('dividendPayout').value = entryData.dividend_payout || 0;
    
    console.log('Loaded entry data from CSV for round', roundNumber);
  } catch (error) {
    console.error('Error loading entry data:', error);
  }
}

// Setup form handlers
function setupFormHandlers() {
  const form = document.getElementById('decisionsForm');
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await submitDecisions(true);
  });
}

// Save draft
async function saveDraft() {
  await submitDecisions(false);
}

// Submit decisions
async function submitDecisions(submit) {
  const errorEl = document.getElementById('errorMessage');
  const successEl = document.getElementById('successMessage');
  
  errorEl.textContent = '';
  successEl.textContent = '';
  
  const decisions = {
    price: parseFloat(document.getElementById('price').value),
    advertising: parseFloat(document.getElementById('advertising').value),
    salesForce: parseFloat(document.getElementById('salesForce').value),
    qualityInvestment: parseFloat(document.getElementById('qualityInvestment').value),
    marketResearch: parseFloat(document.getElementById('marketResearch').value),
    
    productionVolume: parseFloat(document.getElementById('productionVolume').value),
    capacityExpansion: parseFloat(document.getElementById('capacityExpansion').value),
    
    employeesHire: parseInt(document.getElementById('employeesHire').value),
    employeesFire: parseInt(document.getElementById('employeesFire').value),
    wageLevel: parseFloat(document.getElementById('wageLevel').value),
    trainingInvestment: parseFloat(document.getElementById('trainingInvestment').value),
    
    shortTermBorrow: parseFloat(document.getElementById('shortTermBorrow').value),
    longTermBorrow: parseFloat(document.getElementById('longTermBorrow').value),
    shortTermRepay: parseFloat(document.getElementById('shortTermRepay').value),
    longTermRepay: parseFloat(document.getElementById('longTermRepay').value),
    dividendPayout: parseFloat(document.getElementById('dividendPayout').value),
    
    submit: submit
  };
  
  try {
    const response = await fetch('/api/team/submit-decisions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(decisions)
    });
    
    const data = await response.json();
    
    if (response.ok) {
      successEl.textContent = data.message;
      if (submit) {
        setTimeout(() => location.reload(), 2000);
      }
    } else {
      errorEl.textContent = data.error;
    }
  } catch (error) {
    console.error('Error submitting decisions:', error);
    errorEl.textContent = 'Failed to submit decisions';
  }
}

// Display results
function displayResults(results) {
  const container = document.getElementById('resultsContent');
  
  const { incomeStatement, balanceSheet, kpis } = results;
  
  let html = '<div class="financial-statements">';
  
  // Income Statement
  html += '<div><h3>Income Statement</h3><table>';
  html += `<tr><td>Revenue</td><td class="text-positive">$${formatNumber(incomeStatement.revenue)}</td></tr>`;
  html += `<tr><td>Cost of Goods Sold</td><td>$${formatNumber(incomeStatement.costOfGoodsSold)}</td></tr>`;
  html += `<tr><td><strong>Gross Profit</strong></td><td><strong>$${formatNumber(incomeStatement.grossProfit)}</strong></td></tr>`;
  html += `<tr><td>Operating Expenses</td><td>$${formatNumber(incomeStatement.operatingExpenses)}</td></tr>`;
  html += `<tr><td><strong>EBIT</strong></td><td><strong>$${formatNumber(incomeStatement.ebit)}</strong></td></tr>`;
  html += `<tr><td>Interest Expense</td><td>$${formatNumber(incomeStatement.interestExpense)}</td></tr>`;
  html += `<tr><td>Tax</td><td>$${formatNumber(incomeStatement.tax)}</td></tr>`;
  html += `<tr><td><strong>Net Income</strong></td><td class="${incomeStatement.netIncome >= 0 ? 'text-positive' : 'text-negative'}"><strong>$${formatNumber(incomeStatement.netIncome)}</strong></td></tr>`;
  html += '</table></div>';
  
  // Key Performance Indicators
  html += '<div><h3>Key Performance Indicators</h3><table>';
  html += `<tr><td>Market Share</td><td><strong>${kpis.market.marketShare.toFixed(2)}%</strong></td></tr>`;
  html += `<tr><td>Units Sold</td><td>${formatNumber(kpis.market.unitsSold)}</td></tr>`;
  html += `<tr><td>ROI</td><td>${kpis.profitability.roi.toFixed(2)}%</td></tr>`;
  html += `<tr><td>ROE</td><td>${kpis.profitability.roe.toFixed(2)}%</td></tr>`;
  html += `<tr><td>Net Margin</td><td>${kpis.profitability.netMargin.toFixed(2)}%</td></tr>`;
  html += `<tr><td>EPS</td><td>$${kpis.financial.eps.toFixed(2)}</td></tr>`;
  html += `<tr><td>Debt-to-Equity</td><td>${kpis.financial.debtToEquity.toFixed(2)}</td></tr>`;
  html += '</table></div>';
  
  html += '</div>';
  
  container.innerHTML = html;
}

// Load history
async function loadHistory() {
  try {
    const response = await fetch('/api/team/history');
    const history = await response.json();
    
    if (history.length === 0) {
      return;
    }
    
    document.getElementById('historyCard').style.display = 'block';
    
    let html = '<table><thead><tr>';
    html += '<th>Round</th><th>Revenue</th><th>Net Income</th><th>Market Share</th>';
    html += '<th>ROI</th><th>ROE</th><th>EPS</th>';
    html += '</tr></thead><tbody>';
    
    history.forEach(h => {
      html += `<tr>
        <td><strong>Round ${h.round}</strong></td>
        <td>$${formatNumber(h.revenue)}</td>
        <td class="${h.netIncome >= 0 ? 'text-positive' : 'text-negative'}">$${formatNumber(h.netIncome)}</td>
        <td>${h.marketShare.toFixed(2)}%</td>
        <td>${h.roi.toFixed(2)}%</td>
        <td>${h.roe.toFixed(2)}%</td>
        <td>$${h.eps.toFixed(2)}</td>
      </tr>`;
    });
    
    html += '</tbody></table>';
    
    document.getElementById('historyContent').innerHTML = html;
  } catch (error) {
    console.error('Error loading history:', error);
  }
}

// Format number helper
function formatNumber(num) {
  return Math.round(num).toLocaleString();
}

// Auto-refresh every 30 seconds
setInterval(() => {
  loadDashboard();
}, 30000);

// Initialize on load
init();
