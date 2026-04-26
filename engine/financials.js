const db = require('../data/database');

class FinancialStatements {
  
  async generateIncomeStatement(teamNumber, roundNumber) {
    const result = await db.get(
      'SELECT * FROM results WHERE team_number = ? AND round_number = ?',
      [teamNumber, roundNumber]
    );

    if (!result) {
      return null;
    }

    const derivedDepreciation = result.gross_profit - result.operating_expenses - result.ebit;

    return {
      roundNumber: roundNumber,
      revenue: result.revenue,
      costOfGoodsSold: result.cogs,
      grossProfit: result.gross_profit,
      operatingExpenses: result.operating_expenses,
      depreciation: derivedDepreciation,
      ebit: result.ebit,
      interestExpense: result.interest_expense,
      earningsBeforeTax: result.ebit - result.interest_expense,
      tax: result.tax,
      netIncome: result.net_income
    };
  }

  async generateBalanceSheet(teamNumber, roundNumber) {
    const result = await db.get(
      'SELECT * FROM results WHERE team_number = ? AND round_number = ?',
      [teamNumber, roundNumber]
    );

    const team = await db.get(
      'SELECT * FROM teams WHERE team_number = ?',
      [teamNumber]
    );

    if (!result || !team) {
      return null;
    }

    // Assets
    const cash = result.cash_end;
    const inventory = result.inventory_end * 40; // Approximate inventory value
    const netFixedAssets = team.fixed_assets - team.accumulated_depreciation;
    const totalAssets = result.total_assets;

    // Liabilities
    const shortTermDebt = team.short_term_debt;
    const longTermDebt = team.long_term_debt;
    const totalLiabilities = result.total_liabilities;

    // Equity
    const totalEquity = result.total_equity;

    return {
      roundNumber: roundNumber,
      assets: {
        cash: cash,
        inventory: inventory,
        netFixedAssets: netFixedAssets,
        totalAssets: totalAssets
      },
      liabilities: {
        shortTermDebt: shortTermDebt,
        longTermDebt: longTermDebt,
        totalLiabilities: totalLiabilities
      },
      equity: {
        totalEquity: totalEquity
      },
      totalLiabilitiesAndEquity: totalLiabilities + totalEquity
    };
  }

  async generateCashFlowStatement(teamNumber, roundNumber) {
    const currentResult = await db.get(
      'SELECT * FROM results WHERE team_number = ? AND round_number = ?',
      [teamNumber, roundNumber]
    );

    const previousResult = await db.get(
      'SELECT * FROM results WHERE team_number = ? AND round_number = ?',
      [teamNumber, roundNumber - 1]
    );

    if (!currentResult) {
      return null;
    }

    const beginningCash = previousResult ? previousResult.cash_end : 500000;
    const endingCash = currentResult.cash_end;
    const netChange = endingCash - beginningCash;

    // Get decision data for more accurate cash flow
    const decision = await db.get(
      'SELECT * FROM decisions WHERE team_number = ? AND round_number = ?',
      [teamNumber, roundNumber]
    );

    const derivedDepreciation = currentResult.gross_profit - currentResult.operating_expenses - currentResult.ebit;

    return {
      roundNumber: roundNumber,
      operatingActivities: {
        netIncome: currentResult.net_income,
        depreciation: derivedDepreciation,
        changesInInventory: previousResult ? 
          (previousResult.inventory_end - currentResult.inventory_end) * 40 : 0,
        netOperatingCashFlow: currentResult.net_income + derivedDepreciation
      },
      investingActivities: {
        capitalExpenditures: decision ? -decision.capacity_expansion : 0,
        netInvestingCashFlow: decision ? -decision.capacity_expansion : 0
      },
      financingActivities: {
        borrowings: decision ? (decision.short_term_borrow + decision.long_term_borrow) : 0,
        debtRepayments: decision ? -(decision.short_term_repay + decision.long_term_repay) : 0,
        dividendsPaid: decision ? -decision.dividend_payout : 0,
        netFinancingCashFlow: decision ? 
          (decision.short_term_borrow + decision.long_term_borrow - 
           decision.short_term_repay - decision.long_term_repay - 
           decision.dividend_payout) : 0
      },
      beginningCash: beginningCash,
      netChange: netChange,
      endingCash: endingCash
    };
  }

  async generateKPIs(teamNumber, roundNumber) {
    const result = await db.get(
      'SELECT * FROM results WHERE team_number = ? AND round_number = ?',
      [teamNumber, roundNumber]
    );

    if (!result) {
      return null;
    }

    return {
      roundNumber: roundNumber,
      profitability: {
        roi: result.roi,
        roe: result.roe,
        netMargin: result.net_margin,
        grossMargin: result.revenue > 0 ? (result.gross_profit / result.revenue) * 100 : 0
      },
      market: {
        marketShare: result.market_share * 100,
        revenue: result.revenue,
        unitsSold: result.units_sold
      },
      financial: {
        eps: result.eps,
        debtToEquity: result.total_equity > 0 ? result.total_liabilities / result.total_equity : 0,
        currentRatio: result.total_liabilities > 0 ? result.cash_end / result.total_liabilities : 0
      }
    };
  }

  async generateCompleteReport(teamNumber, roundNumber) {
    const [incomeStatement, balanceSheet, cashFlow, kpis, team] = await Promise.all([
      this.generateIncomeStatement(teamNumber, roundNumber),
      this.generateBalanceSheet(teamNumber, roundNumber),
      this.generateCashFlowStatement(teamNumber, roundNumber),
      this.generateKPIs(teamNumber, roundNumber),
      db.get('SELECT * FROM teams WHERE team_number = ?', [teamNumber])
    ]);

    return {
      teamNumber: teamNumber,
      companyName: team ? team.company_name : `Company ${teamNumber}`,
      roundNumber: roundNumber,
      incomeStatement: incomeStatement,
      balanceSheet: balanceSheet,
      cashFlowStatement: cashFlow,
      kpis: kpis,
      isBankrupt: team ? team.is_bankrupt : false
    };
  }

  async generateHistoricalData(teamNumber, startRound, endRound) {
    const results = await db.query(
      `SELECT * FROM results WHERE team_number = ? AND round_number BETWEEN ? AND ? ORDER BY round_number`,
      [teamNumber, startRound, endRound]
    );

    return results.map(r => ({
      round: r.round_number,
      revenue: r.revenue,
      netIncome: r.net_income,
      marketShare: r.market_share * 100,
      roi: r.roi,
      roe: r.roe,
      eps: r.eps
    }));
  }

  async generateComparativeReport(roundNumber) {
    const results = await db.query(
      `SELECT r.*, t.company_name, t.is_bankrupt 
       FROM results r 
       JOIN teams t ON r.team_number = t.team_number 
       WHERE r.round_number = ? 
       ORDER BY r.net_income DESC`,
      [roundNumber]
    );

    return results.map(r => ({
      teamNumber: r.team_number,
      companyName: r.company_name,
      revenue: r.revenue,
      netIncome: r.net_income,
      marketShare: r.market_share * 100,
      roi: r.roi,
      roe: r.roe,
      eps: r.eps,
      totalAssets: r.total_assets,
      isBankrupt: r.is_bankrupt
    }));
  }
}

module.exports = new FinancialStatements();
