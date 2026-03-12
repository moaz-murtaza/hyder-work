const express = require('express');
const router = express.Router();
const db = require('../data/database');
const simulator = require('../engine/simulator');
const financials = require('../engine/financials');
const teamDataManager = require('../data/teamDataManager');

// Get simulation state
router.get('/simulation-state', async (req, res) => {
  try {
    const state = await db.get('SELECT * FROM simulation_state WHERE id = 1');
    res.json(state);
  } catch (error) {
    console.error('Error fetching simulation state:', error);
    res.status(500).json({ error: 'Failed to fetch simulation state' });
  }
});

// Initialize/Start simulation
router.post('/start-simulation', async (req, res) => {
  try {
    const { teamsCount } = req.body;
    
    await db.run(
      `UPDATE simulation_state SET 
        current_round = 1, 
        status = 'in_progress',
        teams_count = ?,
        updated_at = CURRENT_TIMESTAMP 
      WHERE id = 1`,
      [teamsCount || 4]
    );

    res.json({ success: true, message: 'Simulation started', currentRound: 1 });
  } catch (error) {
    console.error('Error starting simulation:', error);
    res.status(500).json({ error: 'Failed to start simulation' });
  }
});

// Reset simulation
router.post('/reset-simulation', async (req, res) => {
  try {
    // Reset simulation state
    await db.run(
      `UPDATE simulation_state SET 
        current_round = 0, 
        status = 'not_started',
        updated_at = CURRENT_TIMESTAMP 
      WHERE id = 1`
    );

    // Reset all teams to initial state
    const teams = await db.query('SELECT team_number FROM teams');
    
    for (const team of teams) {
      await db.run(
        `UPDATE teams SET 
          cash = 500000,
          inventory = 0,
          fixed_assets = 300000,
          accumulated_depreciation = 0,
          short_term_debt = 0,
          long_term_debt = 200000,
          equity = 600000,
          employees = 50,
          production_capacity = 10000,
          product_quality_index = 100,
          current_round = 0,
          is_bankrupt = 0,
          updated_at = CURRENT_TIMESTAMP
        WHERE team_number = ?`,
        [team.team_number]
      );
    }

    // Delete all decisions and results
    await db.run('DELETE FROM decisions');
    await db.run('DELETE FROM results');
    await db.run('DELETE FROM market_conditions');

    res.json({ success: true, message: 'Simulation reset successfully' });
  } catch (error) {
    console.error('Error resetting simulation:', error);
    res.status(500).json({ error: 'Failed to reset simulation' });
  }
});

// Advance to next round
router.post('/advance-round', async (req, res) => {
  try {
    const state = await db.get('SELECT * FROM simulation_state WHERE id = 1');
    
    if (state.status !== 'in_progress') {
      return res.status(400).json({ error: 'Simulation not in progress' });
    }

    const currentRound = state.current_round;

    // Check if all teams have submitted decisions
    const submittedCount = await db.get(
      'SELECT COUNT(*) as count FROM decisions WHERE round_number = ? AND submitted = 1',
      [currentRound]
    );

    if (submittedCount.count < state.teams_count) {
      return res.status(400).json({ 
        error: `Only ${submittedCount.count} of ${state.teams_count} teams have submitted decisions` 
      });
    }

    // Process the current round
    await simulator.processRound(currentRound);

    // Advance to next round
    const nextRound = currentRound + 1;
    
    if (nextRound > state.total_rounds) {
      // Simulation complete
      await db.run(
        `UPDATE simulation_state SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = 1`
      );
      res.json({ success: true, message: 'Simulation completed', status: 'completed' });
    } else {
      await db.run(
        `UPDATE simulation_state SET current_round = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1`,
        [nextRound]
      );
      res.json({ success: true, message: `Advanced to Round ${nextRound}`, currentRound: nextRound });
    }

  } catch (error) {
    console.error('Error advancing round:', error);
    res.status(500).json({ error: 'Failed to advance round', message: error.message });
  }
});

// Get all teams overview
router.get('/teams-overview', async (req, res) => {
  try {
    const state = await db.get('SELECT * FROM simulation_state WHERE id = 1');
    const teams = await db.query(
      'SELECT * FROM teams WHERE team_number <= ? ORDER BY team_number',
      [state.teams_count]
    );

    const teamsWithStatus = await Promise.all(teams.map(async (team) => {
      const decision = await db.get(
        'SELECT submitted FROM decisions WHERE team_number = ? AND round_number = ?',
        [team.team_number, state.current_round]
      );

      return {
        ...team,
        hasSubmitted: decision ? decision.submitted : false
      };
    }));

    res.json(teamsWithStatus);
  } catch (error) {
    console.error('Error fetching teams overview:', error);
    res.status(500).json({ error: 'Failed to fetch teams overview' });
  }
});

// Get team decisions for a round
router.get('/team-decisions/:teamNumber/:roundNumber', async (req, res) => {
  try {
    const { teamNumber, roundNumber } = req.params;
    
    const decision = await db.get(
      'SELECT * FROM decisions WHERE team_number = ? AND round_number = ?',
      [teamNumber, roundNumber]
    );

    if (!decision) {
      return res.status(404).json({ error: 'No decision found' });
    }

    res.json(decision);
  } catch (error) {
    console.error('Error fetching team decisions:', error);
    res.status(500).json({ error: 'Failed to fetch team decisions' });
  }
});

// Get all decisions for current round
router.get('/all-decisions', async (req, res) => {
  try {
    const state = await db.get('SELECT * FROM simulation_state WHERE id = 1');
    
    const decisions = await db.query(
      `SELECT d.*, t.company_name 
       FROM decisions d 
       JOIN teams t ON d.team_number = t.team_number 
       WHERE d.round_number = ? AND t.team_number <= ?
       ORDER BY d.team_number`,
      [state.current_round, state.teams_count]
    );

    res.json(decisions);
  } catch (error) {
    console.error('Error fetching all decisions:', error);
    res.status(500).json({ error: 'Failed to fetch decisions' });
  }
});

// Get team results
router.get('/team-results/:teamNumber/:roundNumber', async (req, res) => {
  try {
    const { teamNumber, roundNumber } = req.params;
    
    const report = await financials.generateCompleteReport(
      parseInt(teamNumber), 
      parseInt(roundNumber)
    );

    if (!report.incomeStatement) {
      return res.status(404).json({ error: 'No results found for this round' });
    }

    res.json(report);
  } catch (error) {
    console.error('Error fetching team results:', error);
    res.status(500).json({ error: 'Failed to fetch team results' });
  }
});

// Get comparative report for all teams
router.get('/comparative-report/:roundNumber', async (req, res) => {
  try {
    const { roundNumber } = req.params;
    
    const report = await financials.generateComparativeReport(parseInt(roundNumber));
    res.json(report);
  } catch (error) {
    console.error('Error generating comparative report:', error);
    res.status(500).json({ error: 'Failed to generate comparative report' });
  }
});

// Get market conditions
router.get('/market-conditions/:roundNumber', async (req, res) => {
  try {
    const { roundNumber } = req.params;
    
    const conditions = await db.get(
      'SELECT * FROM market_conditions WHERE round_number = ?',
      [roundNumber]
    );

    res.json(conditions || {});
  } catch (error) {
    console.error('Error fetching market conditions:', error);
    res.status(500).json({ error: 'Failed to fetch market conditions' });
  }
});

// Export all data (for reports)
router.get('/export-data', async (req, res) => {
  try {
    const state = await db.get('SELECT * FROM simulation_state WHERE id = 1');
    const teams = await db.query('SELECT * FROM teams WHERE team_number <= ?', [state.teams_count]);
    const decisions = await db.query('SELECT * FROM decisions ORDER BY round_number, team_number');
    const results = await db.query('SELECT * FROM results ORDER BY round_number, team_number');

    res.json({
      simulationState: state,
      teams: teams,
      decisions: decisions,
      results: results
    });
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// Update team settings
router.post('/update-team', async (req, res) => {
  try {
    const { teamNumber, companyName } = req.body;
    
    await db.run(
      'UPDATE teams SET company_name = ?, updated_at = CURRENT_TIMESTAMP WHERE team_number = ?',
      [companyName, teamNumber]
    );

    res.json({ success: true, message: 'Team updated successfully' });
  } catch (error) {
    console.error('Error updating team:', error);
    res.status(500).json({ error: 'Failed to update team' });
  }
});

// Get team entry data from CSV for a round
router.get('/team-entry-data/:roundNumber', async (req, res) => {
  try {
    const { roundNumber } = req.params;
    const roundData = teamDataManager.getRoundData(parseInt(roundNumber));

    if (roundData.length === 0) {
      return res.status(404).json({ error: 'No entry data found for this round' });
    }

    res.json({
      success: true,
      round: parseInt(roundNumber),
      data: roundData
    });
  } catch (error) {
    console.error('Error fetching entry data:', error);
    res.status(500).json({ error: 'Failed to fetch entry data' });
  }
});

// Get all team entry data
router.get('/all-entry-data', async (req, res) => {
  try {
    const teams = teamDataManager.getAllTeams();
    const allData = {};

    for (const teamNumber of teams) {
      const rounds = teamDataManager.getTeamRounds(teamNumber);
      allData[teamNumber] = rounds.map(round => 
        teamDataManager.getTeamData(teamNumber, round)
      );
    }

    res.json({
      success: true,
      data: allData
    });
  } catch (error) {
    console.error('Error fetching all entry data:', error);
    res.status(500).json({ error: 'Failed to fetch all entry data' });
  }
});

module.exports = router;
