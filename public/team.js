let dashboardData = null;
let teamNumber = null;

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

function numberOr(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function intOr(value, fallback = 0) {
  const num = Number.parseInt(value, 10);
  return Number.isFinite(num) ? num : fallback;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomStep(min, max, step) {
  const count = Math.max(0, Math.floor((max - min) / step));
  return min + randomInt(0, count) * step;
}

function getInputNumber(id, fallback = 0) {
  const el = document.getElementById(id);
  if (!el) return fallback;
  return numberOr(el.value, fallback);
}

function getInputBool(id) {
  const el = document.getElementById(id);
  return !!(el && el.checked);
}

function collectTopaxFormData() {
  const prices = {
    exportMarket: {
      product1: getInputNumber('price', 100),
      product2: getInputNumber('priceP2', 100),
      product3: getInputNumber('priceP3', 100)
    },
    homeMarkets: {
      product1: getInputNumber('homePriceP1', 100),
      product2: getInputNumber('homePriceP2', 100),
      product3: getInputNumber('homePriceP3', 100)
    }
  };

  const promotionExpenditure = {
    tradePress: {
      product1: getInputNumber('tradePressP1', 0),
      product2: getInputNumber('tradePressP2', 0),
      product3: getInputNumber('tradePressP3', 0)
    },
    advertisingSupport: {
      product1: getInputNumber('advertising', 0),
      product2: getInputNumber('advertisingP2', 0),
      product3: getInputNumber('advertisingP3', 0)
    },
    merchandising: {
      product1: getInputNumber('merchandisingP1', 0),
      product2: getInputNumber('merchandisingP2', 0),
      product3: getInputNumber('merchandisingP3', 0)
    }
  };

  const makeAndDeliverProductsTo = {
    exportArea: {
      product1: getInputNumber('productionVolume', 0),
      product2: getInputNumber('exportUnitsP2', 0),
      product3: getInputNumber('exportUnitsP3', 0)
    },
    southArea: {
      product1: getInputNumber('southUnitsP1', 0),
      product2: getInputNumber('southUnitsP2', 0),
      product3: getInputNumber('southUnitsP3', 0)
    },
    westArea: {
      product1: getInputNumber('westUnitsP1', 0),
      product2: getInputNumber('westUnitsP2', 0),
      product3: getInputNumber('westUnitsP3', 0)
    },
    northArea: {
      product1: getInputNumber('northUnitsP1', 0),
      product2: getInputNumber('northUnitsP2', 0),
      product3: getInputNumber('northUnitsP3', 0)
    }
  };

  return {
    majorProductImprovements: {
      product1: getInputBool('improveP1'),
      product2: getInputBool('improveP2'),
      product3: getInputBool('improveP3')
    },
    prices,
    promotionExpenditure,
    makeAndDeliverProductsTo,
    rawMaterial: {
      unitsToOrder: getInputNumber('rawMaterialUnits', 0),
      supplierNumber: getInputNumber('supplierNumber', 1),
      numberOfDeliveries: getInputNumber('deliveryCount', 1)
    }
  };
}

// Build a canonical Topaz-shaped payload so we can persist full parity fields
// while the UI is still on the simplified form.
function buildTopaxPayload(decisions) {
  const round = dashboardData?.simulationState?.current_round || 1;
  const topaxForm = collectTopaxFormData();

  return {
    simulationData: {
      simulationCode: 'Bhutto',
      year: Math.floor((round - 1) / 4) + 1,
      quarter: ((round - 1) % 4) + 1
    },
    companyInformation: {
      groupNumber: 1,
      companyNumber: intOr(teamNumber, 1),
      identityNumber: 0,
      status: 2
    },
    decisionData: {
      majorProductImprovements: topaxForm.majorProductImprovements,
      prices: topaxForm.prices,
      promotionExpenditure: topaxForm.promotionExpenditure,
      assemblyTimeMinutes: { product1: 0, product2: 0, product3: 0 },
      dividendRatePencePerShare: numberOr(decisions.dividendPayout),
      daysCreditAllowed: 0,
      vans: { buy: 0, sell: 0 },
      informationWanted: {
        otherCompanies: false,
        marketShares: numberOr(decisions.marketResearch) > 0
      },
      makeAndDeliverProductsTo: topaxForm.makeAndDeliverProductsTo,
      researchExpenditure: numberOr(decisions.marketResearch),
      salespeopleAllocatedTo: { exportArea: 0, southArea: 0, westArea: 0, northArea: 0 },
      salespeopleRemuneration: {
        quarterlySalaryHundreds: 0,
        salesCommissionPercent: 0
      },
      assemblyWorkers: {
        hourlyWagePounds: Math.floor(numberOr(decisions.wageLevel) / 100),
        hourlyWagePence: Math.round(numberOr(decisions.wageLevel) % 100),
        shiftLevel: 1,
        recruit: intOr(decisions.employeesHire),
        dismiss: intOr(decisions.employeesFire),
        train: numberOr(decisions.trainingInvestment)
      },
      quarterlyManagementBudget: 0,
      contractMaintenanceHours: 0,
      machines: {
        toSell: 0,
        newToOrder: Math.floor(numberOr(decisions.capacityExpansion) / 30)
      },
      salespeoplePipeline: { recruit: 0, dismiss: 0, train: 0 },
      rawMaterial: {
        unitsToOrder: topaxForm.rawMaterial.unitsToOrder,
        supplierNumber: topaxForm.rawMaterial.supplierNumber,
        numberOfDeliveries: topaxForm.rawMaterial.numberOfDeliveries
      }
    }
  };
}

// Initialize dashboard
async function init() {
  await checkAuth();
  await loadDashboard();
  setupFormHandlers();
}

// Check authentication - with tab-scoped sessionStorage caching
async function checkAuth() {
  try {
    // Only trust sessionStorage for tab-scoped auth.
    const cachedAuth = sessionStorage.getItem('auth');
    if (!cachedAuth) {
      window.location.href = '/';
      return;
    }

    const auth = JSON.parse(cachedAuth);
    if (auth.authenticated && auth.role === 'team' && auth.teamNumber) {
      const response = await fetch('/api/auth/session');
      const sessionState = await response.json();

      if (sessionState.authenticated && sessionState.role === 'team') {
        teamNumber = auth.teamNumber;
        document.getElementById('teamName').textContent = `Team ${teamNumber}`;
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
    // Clear cached auth state
    sessionStorage.removeItem('auth');
    window.location.href = '/';
  } catch (error) {
    console.error('Logout error:', error);
    // Clear cache anyway
    sessionStorage.removeItem('auth');
    window.location.href = '/';
  }
}

// Load dashboard data
async function loadDashboard() {
  try {
    const response = await fetch('/api/team/dashboard');
    if (response.status === 401 || response.status === 403) {
      sessionStorage.removeItem('auth');
      window.location.href = '/';
      return;
    }

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
  document.getElementById('priceP2').value = decision.price || 100;
  document.getElementById('priceP3').value = decision.price || 100;
  document.getElementById('homePriceP2').value = decision.price || 100;
  document.getElementById('homePriceP3').value = decision.price || 100;
  document.getElementById('advertising').value = decision.advertising || 0;
  document.getElementById('advertisingP2').value = 0;
  document.getElementById('advertisingP3').value = 0;
  document.getElementById('salesForce').value = decision.sales_force || 0;
  document.getElementById('qualityInvestment').value = decision.quality_investment || 0;
  document.getElementById('marketResearch').value = decision.market_research || 0;
  
  document.getElementById('productionVolume').value = decision.production_volume || 0;
  document.getElementById('exportUnitsP2').value = 0;
  document.getElementById('exportUnitsP3').value = 0;
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
  document.getElementById('rawMaterialUnits').value = decision.production_volume || 0;
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
    document.getElementById('priceP2').value = entryData.price || 100;
    document.getElementById('priceP3').value = entryData.price || 100;
    document.getElementById('homePriceP1').value = entryData.price || 100;
    document.getElementById('homePriceP2').value = entryData.price || 100;
    document.getElementById('homePriceP3').value = entryData.price || 100;
    document.getElementById('advertising').value = entryData.advertising || 50000;
    document.getElementById('advertisingP2').value = 0;
    document.getElementById('advertisingP3').value = 0;
    document.getElementById('salesForce').value = entryData.sales_force || 30000;
    document.getElementById('qualityInvestment').value = entryData.quality_investment || 20000;
    document.getElementById('marketResearch').value = entryData.market_research || 10000;
    
    document.getElementById('productionVolume').value = entryData.production_volume || 8000;
    document.getElementById('exportUnitsP2').value = 0;
    document.getElementById('exportUnitsP3').value = 0;
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
    document.getElementById('rawMaterialUnits').value = entryData.production_volume || 8000;
    
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

function randomizeDecisions() {
  if (!dashboardData || !dashboardData.team) {
    return;
  }

  const team = dashboardData.team;
  const capacity = Math.max(100, numberOr(team.production_capacity, 8000));
  const employees = Math.max(1, intOr(team.employees, 50));
  const cash = Math.max(0, numberOr(team.cash, 100000));
  const shortDebt = Math.max(0, numberOr(team.short_term_debt, 0));
  const longDebt = Math.max(0, numberOr(team.long_term_debt, 0));

  // Keep total cash commitments conservative to reduce bankruptcy risk.
  const spendBudget = Math.max(15000, Math.floor(cash * 0.3));

  const price = randomStep(70, 170, 1);
  const priceP2 = Math.max(10, price + randomInt(-10, 10));
  const priceP3 = Math.max(10, price + randomInt(-10, 10));
  const homePrice = Math.max(10, price + randomInt(-5, 8));
  const homePriceP2 = Math.max(10, priceP2 + randomInt(-5, 8));
  const homePriceP3 = Math.max(10, priceP3 + randomInt(-5, 8));
  const productionVolume = randomStep(
    Math.floor(capacity * 0.45 / 100) * 100,
    Math.floor(capacity * 0.75 / 100) * 100,
    100
  );

  const advertising = randomStep(5000, Math.min(50000, Math.floor(spendBudget * 0.35)), 1000);
  const advertisingP2 = randomStep(1000, Math.min(20000, Math.floor(spendBudget * 0.2)), 1000);
  const advertisingP3 = randomStep(1000, Math.min(20000, Math.floor(spendBudget * 0.2)), 1000);
  const marketResearch = randomStep(1000, Math.min(15000, Math.floor(spendBudget * 0.12)), 1000);
  const trainingInvestment = randomStep(0, Math.min(8000, Math.floor(spendBudget * 0.08)), 500);
  const dividendPayout = randomStep(0, Math.min(3000, Math.floor(cash * 0.01)), 100);

  const maxMachines = cash > 120000 ? 2 : 1;
  const newMachines = randomInt(0, maxMachines);

  const maxHire = Math.max(0, Math.floor(employees * 0.1));
  const maxFire = Math.max(0, Math.floor((employees - 1) * 0.08));
  const employeesHire = randomInt(0, Math.min(8, maxHire));
  const employeesFire = randomInt(0, Math.min(5, maxFire));
  const wageLevel = randomStep(2200, 3200, 50);

  const exportUnits = randomInt(Math.floor(productionVolume * 0.2), Math.floor(productionVolume * 0.4));
  let remainingUnits = Math.max(0, productionVolume - exportUnits);
  const southUnits = Math.floor(remainingUnits * 0.45);
  remainingUnits -= southUnits;
  const westUnits = Math.floor(remainingUnits * 0.55);
  const northUnits = Math.max(0, remainingUnits - westUnits);

  // Default to no extra borrowing; allow a small buffer only when cash is low.
  const shortTermBorrow = cash < 25000 ? randomStep(0, 20000, 1000) : 0;
  const longTermBorrow = 0;
  const shortTermRepay = shortDebt > 0 && cash > 80000 ? randomStep(0, Math.min(10000, shortDebt), 1000) : 0;
  const longTermRepay = longDebt > 0 && cash > 120000 ? randomStep(0, Math.min(10000, longDebt), 1000) : 0;

  document.getElementById('price').value = price;
  document.getElementById('priceP2').value = priceP2;
  document.getElementById('priceP3').value = priceP3;
  const homePriceField = document.getElementById('homePriceP1');
  if (homePriceField) homePriceField.value = homePrice;
  const homePriceP2Field = document.getElementById('homePriceP2');
  const homePriceP3Field = document.getElementById('homePriceP3');
  if (homePriceP2Field) homePriceP2Field.value = homePriceP2;
  if (homePriceP3Field) homePriceP3Field.value = homePriceP3;

  document.getElementById('advertising').value = advertising;
  document.getElementById('advertisingP2').value = advertisingP2;
  document.getElementById('advertisingP3').value = advertisingP3;
  document.getElementById('marketResearch').value = marketResearch;
  document.getElementById('productionVolume').value = productionVolume;
  document.getElementById('exportUnitsP2').value = Math.floor(productionVolume * 0.2);
  document.getElementById('exportUnitsP3').value = Math.floor(productionVolume * 0.15);
  document.getElementById('newMachinesToOrder').value = newMachines;
  document.getElementById('employeesHire').value = employeesHire;
  document.getElementById('employeesFire').value = employeesFire;
  document.getElementById('trainingInvestment').value = trainingInvestment;
  document.getElementById('wageLevel').value = wageLevel;
  document.getElementById('dividendPayout').value = dividendPayout;

  const southField = document.getElementById('southUnitsP1');
  const westField = document.getElementById('westUnitsP1');
  const northField = document.getElementById('northUnitsP1');
  if (southField) southField.value = southUnits;
  if (westField) westField.value = westUnits;
  if (northField) northField.value = northUnits;
  document.getElementById('southUnitsP2').value = Math.floor(southUnits * 0.25);
  document.getElementById('southUnitsP3').value = Math.floor(southUnits * 0.2);
  document.getElementById('westUnitsP2').value = Math.floor(westUnits * 0.25);
  document.getElementById('westUnitsP3').value = Math.floor(westUnits * 0.2);
  document.getElementById('northUnitsP2').value = Math.floor(northUnits * 0.25);
  document.getElementById('northUnitsP3').value = Math.floor(northUnits * 0.2);
  document.getElementById('rawMaterialUnits').value = Math.floor(productionVolume * 1.5);

  // Keep compatibility fields in sync for current simulator validation.
  document.getElementById('salesForce').value = randomStep(5000, 20000, 1000);
  document.getElementById('qualityInvestment').value = randomStep(2000, 12000, 1000);
  document.getElementById('capacityExpansion').value = newMachines * 30;
  document.getElementById('shortTermBorrow').value = shortTermBorrow;
  document.getElementById('longTermBorrow').value = longTermBorrow;
  document.getElementById('shortTermRepay').value = shortTermRepay;
  document.getElementById('longTermRepay').value = longTermRepay;

  const successEl = document.getElementById('successMessage');
  const errorEl = document.getElementById('errorMessage');
  errorEl.textContent = '';
  successEl.textContent = 'Safe random decisions generated. Review and submit when ready.';
}

// Submit decisions
async function submitDecisions(submit) {
  const errorEl = document.getElementById('errorMessage');
  const successEl = document.getElementById('successMessage');
  
  errorEl.textContent = '';
  successEl.textContent = '';
  
  const newMachinesField = document.getElementById('newMachinesToOrder');
  const inferredCapacityExpansion = newMachinesField
    ? numberOr(newMachinesField.value, 0) * 30
    : parseFloat(document.getElementById('capacityExpansion').value);

  const topaxForm = collectTopaxFormData();
  const productPrices = [
    topaxForm.prices.exportMarket.product1,
    topaxForm.prices.exportMarket.product2,
    topaxForm.prices.exportMarket.product3
  ];
  const totalAdvertising =
    topaxForm.promotionExpenditure.advertisingSupport.product1 +
    topaxForm.promotionExpenditure.advertisingSupport.product2 +
    topaxForm.promotionExpenditure.advertisingSupport.product3;
  const totalDeliveryUnits = Object.values(topaxForm.makeAndDeliverProductsTo)
    .reduce((areaTotal, areaRow) => areaTotal + Object.values(areaRow).reduce((sum, units) => sum + units, 0), 0);
  const qualityFromImprovements = Object.values(topaxForm.majorProductImprovements).filter(Boolean).length * 5000;
  const qualityFromPromotionChannels =
    topaxForm.promotionExpenditure.tradePress.product1 +
    topaxForm.promotionExpenditure.tradePress.product2 +
    topaxForm.promotionExpenditure.tradePress.product3 +
    topaxForm.promotionExpenditure.merchandising.product1 +
    topaxForm.promotionExpenditure.merchandising.product2 +
    topaxForm.promotionExpenditure.merchandising.product3;

  const decisions = {
    price: productPrices.reduce((sum, p) => sum + p, 0) / productPrices.length,
    advertising: totalAdvertising,
    salesForce: parseFloat(document.getElementById('salesForce').value),
    qualityInvestment: Math.max(parseFloat(document.getElementById('qualityInvestment').value), qualityFromImprovements + qualityFromPromotionChannels),
    marketResearch: parseFloat(document.getElementById('marketResearch').value),
    
    productionVolume: totalDeliveryUnits,
    capacityExpansion: inferredCapacityExpansion,
    
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

  // Include canonical Topaz payload so backend stores full parity-shape data.
  decisions.topaxPayload = buildTopaxPayload(decisions);
  decisions.topaxPayloadVersion = 1;
  
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
        // Refresh dashboard data in-place without full page reload.
        await loadDashboard();
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

// Auto-refresh every 90 seconds when user is on this tab.
setInterval(() => {
  if (document.visibilityState === 'visible') {
    loadDashboard();
  }
}, 90000);

// Initialize on load
init();
