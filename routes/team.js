const express = require('express');
const router = express.Router();
const db = require('../data/database');
const financials = require('../engine/financials');
const teamDataManager = require('../data/teamDataManager');

// Validate decisions helper function
function validateDecisions(decisions, team) {
  // Price validation
  if (decisions.price < 10 || decisions.price > 500) {
    return { valid: false, error: 'Price must be between $10 and $500' };
  }

  // Production volume validation
  if (decisions.productionVolume < 0 || decisions.productionVolume > team.production_capacity * 1.1) {
    return { valid: false, error: `Production volume cannot exceed ${Math.floor(team.production_capacity * 1.1)} units` };
  }

  // Non-negative validations
  const nonNegativeFields = [
    'advertising', 'salesForce', 'qualityInvestment', 'marketResearch',
    'capacityExpansion', 'trainingInvestment',
    'shortTermBorrow', 'longTermBorrow', 'shortTermRepay', 'longTermRepay', 'dividendPayout'
  ];

  for (const field of nonNegativeFields) {
    if (decisions[field] < 0) {
      return { valid: false, error: `${field} cannot be negative` };
    }
  }

  // Employee validation
  if (decisions.employeesHire < 0 || decisions.employeesFire < 0) {
    return { valid: false, error: 'Employee hire/fire numbers cannot be negative' };
  }

  const netEmployees = team.employees + decisions.employeesHire - decisions.employeesFire;
  if (netEmployees < 1) {
    return { valid: false, error: 'Company must have at least 1 employee' };
  }

  // Wage level validation
  if (decisions.wageLevel < 1500 || decisions.wageLevel > 10000) {
    return { valid: false, error: 'Monthly wage must be between $1,500 and $10,000' };
  }

  // Debt repayment validation
  if (decisions.shortTermRepay > team.short_term_debt) {
    return { valid: false, error: 'Cannot repay more short-term debt than exists' };
  }

  if (decisions.longTermRepay > team.long_term_debt) {
    return { valid: false, error: 'Cannot repay more long-term debt than exists' };
  }

  // Cash validation (rough estimate)
  const estimatedCashNeeded = 
    decisions.advertising + 
    decisions.salesForce + 
    decisions.qualityInvestment + 
    decisions.marketResearch +
    decisions.capacityExpansion + 
    decisions.trainingInvestment +
    decisions.shortTermRepay + 
    decisions.longTermRepay + 
    decisions.dividendPayout;

  const estimatedCashAvailable = 
    team.cash + 
    decisions.shortTermBorrow + 
    decisions.longTermBorrow;

  if (estimatedCashNeeded > estimatedCashAvailable * 2) {
    return { valid: false, error: 'Total expenditures may exceed available cash. Please review your decisions.' };
  }

  return { valid: true };
}

// Get team dashboard data
router.get('/dashboard', async (req, res) => {
  try {
    const teamNumber = req.session.teamNumber;
    
    const [state, team, currentDecision] = await Promise.all([
      db.get('SELECT * FROM simulation_state WHERE id = 1'),
      db.get('SELECT * FROM teams WHERE team_number = ?', [teamNumber]),
      db.get('SELECT * FROM decisions WHERE team_number = ? AND round_number = ?', 
        [teamNumber, await db.get('SELECT current_round FROM simulation_state WHERE id = 1')
          .then(s => s.current_round)])
    ]);

    // Get previous round results if available
    let previousResults = null;
    if (state.current_round > 1) {
      previousResults = await financials.generateCompleteReport(teamNumber, state.current_round - 1);
    }

    res.json({
      simulationState: state,
      team: team,
      currentDecision: currentDecision,
      previousResults: previousResults
    });

  } catch (error) {
    console.error('Error fetching team dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Get team entry values for a specific round (reference data from CSV)
router.get('/entry-data/:roundNumber', async (req, res) => {
  try {
    const teamNumber = req.session.teamNumber;
    const { roundNumber } = req.params;

    const entryData = teamDataManager.getTeamData(teamNumber, parseInt(roundNumber));

    if (!entryData) {
      return res.status(404).json({ error: 'No entry data found for this round' });
    }

    res.json({
      success: true,
      data: entryData
    });

  } catch (error) {
    console.error('Error fetching entry data:', error);
    res.status(500).json({ error: 'Failed to fetch entry data' });
  }
});

// Submit/Update decisions
router.post('/submit-decisions', async (req, res) => {
  try {
    const teamNumber = req.session.teamNumber;
    const state = await db.get('SELECT * FROM simulation_state WHERE id = 1');

    if (state.status !== 'in_progress') {
      return res.status(400).json({ error: 'Simulation not in progress' });
    }

    const team = await db.get('SELECT * FROM teams WHERE team_number = ?', [teamNumber]);
    
    if (team.is_bankrupt) {
      return res.status(400).json({ error: 'Your company is bankrupt and cannot make decisions' });
    }

    const {
      // Marketing
      price,
      advertising,
      salesForce,
      qualityInvestment,
      marketResearch,
      
      // Production
      productionVolume,
      capacityExpansion,
      
      // HR
      employeesHire,
      employeesFire,
      wageLevel,
      trainingInvestment,
      
      // Finance
      shortTermBorrow,
      longTermBorrow,
      shortTermRepay,
      longTermRepay,
      dividendPayout,
      
      submit
    } = req.body;

    // Validate decisions
    const validation = validateDecisions(req.body, team);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Insert or update decisions
    await db.run(
      `INSERT OR REPLACE INTO decisions (
        team_number, round_number,
        price, advertising, sales_force, quality_investment, market_research,
        production_volume, capacity_expansion,
        employees_hire, employees_fire, wage_level, training_investment,
        short_term_borrow, long_term_borrow, short_term_repay, long_term_repay, dividend_payout,
        submitted, submitted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        teamNumber, state.current_round,
        price, advertising, salesForce, qualityInvestment, marketResearch,
        productionVolume, capacityExpansion,
        employeesHire, employeesFire, wageLevel, trainingInvestment,
        shortTermBorrow, longTermBorrow, shortTermRepay, longTermRepay, dividendPayout,
        submit ? 1 : 0, submit ? new Date().toISOString() : null
      ]
    );

    res.json({ 
      success: true, 
      message: submit ? 'Decisions submitted successfully' : 'Decisions saved as draft'
    });

  } catch (error) {
    console.error('Error submitting decisions:', error);
    res.status(500).json({ error: 'Failed to submit decisions' });
  }
});



// Get team's decisions for a specific round
router.get('/decisions/:roundNumber', async (req, res) => {
  try {
    const teamNumber = req.session.teamNumber;
    const { roundNumber } = req.params;

    const decision = await db.get(
      'SELECT * FROM decisions WHERE team_number = ? AND round_number = ?',
      [teamNumber, roundNumber]
    );

    res.json(decision || {});
  } catch (error) {
    console.error('Error fetching decisions:', error);
    res.status(500).json({ error: 'Failed to fetch decisions' });
  }
});

// Get team's results for a specific round
router.get('/results/:roundNumber', async (req, res) => {
  try {
    const teamNumber = req.session.teamNumber;
    const { roundNumber } = req.params;

    const report = await financials.generateCompleteReport(teamNumber, parseInt(roundNumber));

    if (!report.incomeStatement) {
      return res.status(404).json({ error: 'No results available for this round' });
    }

    res.json(report);
  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

// Get historical performance data
router.get('/history', async (req, res) => {
  try {
    const teamNumber = req.session.teamNumber;
    const state = await db.get('SELECT * FROM simulation_state WHERE id = 1');

    if (state.current_round < 2) {
      return res.json([]);
    }

    const history = await financials.generateHistoricalData(
      teamNumber, 
      1, 
      state.current_round - 1
    );

    res.json(history);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Get team information
router.get('/info', async (req, res) => {
  try {
    const teamNumber = req.session.teamNumber;
    
    const team = await db.get('SELECT * FROM teams WHERE team_number = ?', [teamNumber]);
    
    res.json(team);
  } catch (error) {
    console.error('Error fetching team info:', error);
    res.status(500).json({ error: 'Failed to fetch team info' });
  }
});

// Update company name
router.post('/update-company-name', async (req, res) => {
  try {
    const teamNumber = req.session.teamNumber;
    const { companyName } = req.body;

    if (!companyName || companyName.trim().length === 0) {
      return res.status(400).json({ error: 'Company name is required' });
    }

    await db.run(
      'UPDATE teams SET company_name = ?, updated_at = CURRENT_TIMESTAMP WHERE team_number = ?',
      [companyName.trim(), teamNumber]
    );

    res.json({ success: true, message: 'Company name updated successfully' });
  } catch (error) {
    console.error('Error updating company name:', error);
    res.status(500).json({ error: 'Failed to update company name' });
  }
});

// Get market overview (comparative data without sensitive info)
router.get('/market-overview', async (req, res) => {
  try {
    const state = await db.get('SELECT * FROM simulation_state WHERE id = 1');
    
    if (state.current_round < 2) {
      return res.json({ message: 'No market data available yet' });
    }

    const previousRound = state.current_round - 1;
    
    const results = await db.query(
      `SELECT team_number, market_share, revenue, units_sold 
       FROM results 
       WHERE round_number = ? 
       ORDER BY market_share DESC`,
      [previousRound]
    );

    // Calculate market averages
    const avgRevenue = results.reduce((sum, r) => sum + r.revenue, 0) / results.length;
    const avgMarketShare = results.reduce((sum, r) => sum + r.market_share, 0) / results.length;

    res.json({
      roundNumber: previousRound,
      marketLeader: results[0],
      averages: {
        revenue: avgRevenue,
        marketShare: avgMarketShare * 100
      },
      rankings: results.map((r, index) => ({
        rank: index + 1,
        teamNumber: r.team_number,
        marketShare: r.market_share * 100
      }))
    });
  } catch (error) {
    console.error('Error fetching market overview:', error);
    res.status(500).json({ error: 'Failed to fetch market overview' });
  }
});

module.exports = router;
