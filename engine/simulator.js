const db = require('../data/database');
const teamDataManager = require('../data/teamDataManager');

class SimulationEngine {
  constructor() {
    this.TAX_RATE = 0.30;
    this.BASE_UNIT_COST = 40;
    this.ANNUAL_DEPRECIATION_RATE = 0.10;
    this.INVENTORY_HOLDING_COST_RATE = 0.02;
    this.ANNUAL_SHORT_TERM_INTEREST_RATE = 0.08;
    this.ANNUAL_LONG_TERM_INTEREST_RATE = 0.06;
    this.TRAINING_PRODUCTIVITY_FACTOR = 0.0001;
    this.QUALITY_DECAY_RATE = 0.05;
    this.QUARTERS_PER_YEAR = 4;
    this.MONTHS_PER_QUARTER = 3;
  }

  // Main function to process a round
  async processRound(roundNumber) {
    try {
      console.log(`\n========== Processing Round ${roundNumber} ==========`);

      // Get simulation state
      const simState = await db.get('SELECT * FROM simulation_state WHERE id = 1');
      const teamsCount = simState.teams_count;

      // Get all team decisions for this round
      const decisions = await db.query(
        'SELECT * FROM decisions WHERE round_number = ? AND submitted = 1',
        [roundNumber]
      );

      if (decisions.length === 0) {
        throw new Error('No decisions submitted for this round');
      }

      // Get current team states
      const teams = await db.query(
        'SELECT * FROM teams WHERE team_number <= ? AND is_bankrupt = 0',
        [teamsCount]
      );

      // Get or create market conditions
      let marketConditions = await db.get(
        'SELECT * FROM market_conditions WHERE round_number = ?',
        [roundNumber]
      );

      if (!marketConditions) {
        // Generate base market conditions
        const economicFactor = 0.9 + Math.random() * 0.2; // 0.9 to 1.1
        const inflationRate = 0.01 + Math.random() * 0.04; // 1% to 5%
        
        await db.run(
          `INSERT INTO market_conditions (round_number, base_demand, economic_factor, inflation_rate, interest_rate) 
           VALUES (?, ?, ?, ?, ?)`,
          [roundNumber, 40000, economicFactor, inflationRate, this.ANNUAL_SHORT_TERM_INTEREST_RATE]
        );

        marketConditions = await db.get(
          'SELECT * FROM market_conditions WHERE round_number = ?',
          [roundNumber]
        );
      }

      // Get team-specific decision entry data for this round
      const teamEntryData = {};
      for (const decision of decisions) {
        const data = teamDataManager.getTeamData(decision.team_number, roundNumber);
        if (data) {
          teamEntryData[decision.team_number] = data;
        }
      }

      // Calculate market dynamics
      const marketData = this.calculateMarketDynamics(decisions, teams, marketConditions);

      // Process each team
      for (let i = 0; i < decisions.length; i++) {
        const decision = decisions[i];
        const team = teams.find(t => t.team_number === decision.team_number);
        
        if (!team || team.is_bankrupt) continue;

        const teamMarket = marketData.teams.find(t => t.teamNumber === decision.team_number);
        const entryData = teamEntryData[decision.team_number];
        
        const result = await this.processTeamRound(team, decision, teamMarket, marketConditions, entryData);
        
        // Save results
        await this.saveTeamResults(team.team_number, roundNumber, result);
        
        // Update team state
        await this.updateTeamState(team.team_number, result);

        console.log(`Team ${team.team_number}: Market Share ${(teamMarket.marketShare * 100).toFixed(2)}%, Revenue $${result.revenue.toFixed(0)}, Net Income $${result.netIncome.toFixed(0)}`);
      }

      console.log(`========== Round ${roundNumber} Complete ==========\n`);
      
      return { success: true, message: `Round ${roundNumber} processed successfully` };

    } catch (error) {
      console.error('Error processing round:', error);
      throw error;
    }
  }

  // Calculate market dynamics and market share
  calculateMarketDynamics(decisions, teams, marketConditions) {
    const activeDecisions = decisions.filter(d => {
      const team = teams.find(t => t.team_number === d.team_number);
      return team && !team.is_bankrupt;
    });

    // Calculate average market price
    const avgPrice = activeDecisions.reduce((sum, d) => sum + d.price, 0) / activeDecisions.length;

    // Calculate total market demand
    const baseDemand = marketConditions.base_demand;
    const economicFactor = marketConditions.economic_factor;
    
    // Demand is influenced by average price (price elasticity = -1.5)
    const priceEffect = Math.pow(100 / avgPrice, 1.5);
    const totalMarketDemand = baseDemand * economicFactor * priceEffect;

    // Calculate attractiveness score for each team
    const teamScores = activeDecisions.map(decision => {
      const team = teams.find(t => t.team_number === decision.team_number);
      
      // Price attractiveness (inverse relationship)
      const priceScore = (avgPrice / decision.price) * 2.0;
      
      // Advertising effect (diminishing returns)
      const adScore = Math.sqrt(decision.advertising / 10000) * 1.5;
      
      // Sales force effect
      const salesScore = Math.sqrt(decision.sales_force / 10000) * 1.2;
      
      // Product quality effect
      const qualityScore = (team.product_quality_index / 100) * 1.3;
      
      // Total attractiveness
      const attractiveness = priceScore + adScore + salesScore + qualityScore;
      
      return {
        teamNumber: decision.team_number,
        attractiveness: attractiveness,
        price: decision.price,
        productionVolume: decision.production_volume
      };
    });

    // Calculate market shares based on attractiveness
    const totalAttractiveness = teamScores.reduce((sum, t) => sum + t.attractiveness, 0);
    
    const teamMarketData = teamScores.map(team => {
      const marketShare = team.attractiveness / totalAttractiveness;
      const potentialDemand = totalMarketDemand * marketShare;
      
      // Actual sales limited by production volume and inventory
      const teamData = teams.find(t => t.team_number === team.teamNumber);
      const availableUnits = team.productionVolume + (teamData ? teamData.inventory : 0);
      const unitsSold = Math.min(potentialDemand, availableUnits);
      
      return {
        teamNumber: team.teamNumber,
        marketShare: marketShare,
        potentialDemand: potentialDemand,
        unitsSold: unitsSold,
        revenue: unitsSold * team.price
      };
    });

    return {
      totalDemand: totalMarketDemand,
      avgPrice: avgPrice,
      teams: teamMarketData
    };
  }

  // Process individual team round
  async processTeamRound(team, decision, marketData, marketConditions, entryData = null) {
    const result = {};

    // Sales and Revenue
    result.unitsSold = marketData.unitsSold;
    result.revenue = marketData.revenue;
    result.marketShare = marketData.marketShare;
    result.marketDemand = marketData.potentialDemand;

    // Production and Inventory
    const beginningInventory = team.inventory;
    const production = decision.production_volume;
    const endingInventory = beginningInventory + production - result.unitsSold;
    result.inventoryEnd = Math.max(0, endingInventory);

    // Cost of Goods Sold
    const unitCost = this.calculateUnitCost(team, decision);
    result.cogs = result.unitsSold * unitCost;

    // Gross Profit
    result.grossProfit = result.revenue - result.cogs;

    // Operating Expenses
    const operatingExpenses = 
      decision.advertising +
      decision.sales_force +
      decision.quality_investment +
      decision.market_research +
      decision.training_investment +
      (team.employees * decision.wage_level * this.MONTHS_PER_QUARTER);

    result.operatingExpenses = operatingExpenses;

    // Depreciation
    const depreciation = team.fixed_assets * (this.ANNUAL_DEPRECIATION_RATE / this.QUARTERS_PER_YEAR);
    result.depreciation = depreciation;

    // EBIT (Earnings Before Interest and Tax)
    result.ebit = result.grossProfit - result.operatingExpenses - depreciation;

    // Interest Expense
    let newShortTermDebt = team.short_term_debt + decision.short_term_borrow - decision.short_term_repay;
    let newLongTermDebt = team.long_term_debt + decision.long_term_borrow - decision.long_term_repay;
    
    const avgShortTermDebt = (team.short_term_debt + newShortTermDebt) / 2;
    const avgLongTermDebt = (team.long_term_debt + newLongTermDebt) / 2;
    
    const interestExpense = 
      (avgShortTermDebt * (this.ANNUAL_SHORT_TERM_INTEREST_RATE / this.QUARTERS_PER_YEAR)) +
      (avgLongTermDebt * (this.ANNUAL_LONG_TERM_INTEREST_RATE / this.QUARTERS_PER_YEAR));
    
    result.interestExpense = interestExpense;

    // Earnings Before Tax
    const ebt = result.ebit - interestExpense;

    // Tax
    const tax = ebt > 0 ? ebt * this.TAX_RATE : 0;
    result.tax = tax;

    // Net Income
    result.netIncome = ebt - tax;

    // Inventory Holding Costs
    const inventoryHoldingCost = endingInventory > 0 ? endingInventory * unitCost * this.INVENTORY_HOLDING_COST_RATE : 0;

    // Cash Flow Calculation
    let cashFlow = team.cash;
    
    // Operating cash flow
    cashFlow += result.revenue;
    cashFlow -= result.cogs;
    cashFlow -= result.operatingExpenses;
    cashFlow -= tax;
    cashFlow -= inventoryHoldingCost;

    // Investing cash flow
    cashFlow -= decision.capacity_expansion;

    // Financing cash flow
    cashFlow += decision.short_term_borrow;
    cashFlow += decision.long_term_borrow;
    cashFlow -= decision.short_term_repay;
    cashFlow -= decision.long_term_repay;
    cashFlow -= decision.dividend_payout;
    cashFlow -= interestExpense;

    // Topaz-style behavior: negative cash is automatically funded by short-term borrowing.
    if (cashFlow < 0) {
      const autoOverdraft = -cashFlow;
      newShortTermDebt += autoOverdraft;
      result.autoOverdraft = autoOverdraft;
      cashFlow = 0;
    } else {
      result.autoOverdraft = 0;
    }

    result.cashEnd = cashFlow;

    // Update assets
    const newFixedAssets = team.fixed_assets + decision.capacity_expansion;
    const newAccumulatedDepreciation = team.accumulated_depreciation + depreciation;
    
    result.fixedAssets = newFixedAssets;
    result.accumulatedDepreciation = newAccumulatedDepreciation;
    result.netFixedAssets = newFixedAssets - newAccumulatedDepreciation;

    // Balance Sheet Items
    result.totalAssets = result.cashEnd + (result.inventoryEnd * unitCost) + result.netFixedAssets;
    result.totalLiabilities = newShortTermDebt + newLongTermDebt;
    
    // Equity calculation
    const newEquity = team.equity + result.netIncome - decision.dividend_payout;
    result.totalEquity = newEquity;

    // Update debt levels
    result.shortTermDebt = Math.max(0, newShortTermDebt);
    result.longTermDebt = Math.max(0, newLongTermDebt);

    // Update employees
    const newEmployees = team.employees + decision.employees_hire - decision.employees_fire;
    result.employees = Math.max(1, newEmployees);

    // Update production capacity
    const capacityIncrease = decision.capacity_expansion / 30; // $30 per unit of capacity
    result.productionCapacity = team.production_capacity + capacityIncrease;

    // Update product quality index
    const qualityIncrease = decision.quality_investment / 10000; // $10,000 investment = 1 point
    const qualityDecay = team.product_quality_index * this.QUALITY_DECAY_RATE;
    result.productQualityIndex = Math.max(50, Math.min(200, team.product_quality_index + qualityIncrease - qualityDecay));

    // Calculate KPIs
    result.roi = result.totalAssets > 0 ? (result.netIncome / result.totalAssets) * 100 : 0;
    result.roe = result.totalEquity > 0 ? (result.netIncome / result.totalEquity) * 100 : 0;
    result.eps = result.netIncome / team.shares_outstanding;
    result.netMargin = result.revenue > 0 ? (result.netIncome / result.revenue) * 100 : 0;

    // In Topaz, companies continue operating even when highly leveraged.
    result.isBankrupt = false;

    return result;
  }

  calculateUnitCost(team, decision) {
    // Base cost adjusted for wage levels and productivity
    const laborCostFactor = decision.wage_level / 2500; // Base wage is $2500/month
    const productivityFactor = 1 + (decision.training_investment * this.TRAINING_PRODUCTIVITY_FACTOR);
    
    const unitCost = this.BASE_UNIT_COST * laborCostFactor / productivityFactor;
    
    return unitCost;
  }

  async saveTeamResults(teamNumber, roundNumber, result) {
    await db.run(
      `INSERT OR REPLACE INTO results (
        team_number, round_number, market_demand, market_share, units_sold, revenue,
        cogs, gross_profit, operating_expenses, ebit, interest_expense, tax, net_income,
        total_assets, total_liabilities, total_equity, roi, roe, eps, net_margin,
        inventory_end, cash_end
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        teamNumber, roundNumber, result.marketDemand, result.marketShare, result.unitsSold,
        result.revenue, result.cogs, result.grossProfit, result.operatingExpenses,
        result.ebit, result.interestExpense, result.tax, result.netIncome,
        result.totalAssets, result.totalLiabilities, result.totalEquity,
        result.roi, result.roe, result.eps, result.netMargin,
        result.inventoryEnd, result.cashEnd
      ]
    );
  }

  async updateTeamState(teamNumber, result) {
    await db.run(
      `UPDATE teams SET 
        cash = ?,
        inventory = ?,
        fixed_assets = ?,
        accumulated_depreciation = ?,
        short_term_debt = ?,
        long_term_debt = ?,
        equity = ?,
        employees = ?,
        production_capacity = ?,
        product_quality_index = ?,
        is_bankrupt = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE team_number = ?`,
      [
        result.cashEnd,
        result.inventoryEnd,
        result.fixedAssets,
        result.accumulatedDepreciation,
        result.shortTermDebt,
        result.longTermDebt,
        result.totalEquity,
        result.employees,
        result.productionCapacity,
        result.productQualityIndex,
        result.isBankrupt ? 1 : 0,
        teamNumber
      ]
    );
  }
}

module.exports = new SimulationEngine();
