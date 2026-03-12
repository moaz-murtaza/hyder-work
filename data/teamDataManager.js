const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');

const TEAM_DATA_PATH = path.join(__dirname, '../data/team_data.csv');

class TeamDataManager {
  constructor() {
    this.teamData = new Map(); // Map of team_number -> Map of rounds
    this.loadTeamData();
  }

  loadTeamData() {
    try {
      if (!fs.existsSync(TEAM_DATA_PATH)) {
        console.error(`Team data CSV not found at: ${TEAM_DATA_PATH}`);
        return;
      }

      const fileContent = fs.readFileSync(TEAM_DATA_PATH, 'utf-8');
      const records = csv.parse(fileContent, {
        columns: true,
        skip_empty_lines: true
      });

      // Organize data by team and round
      records.forEach(record => {
        const teamNumber = parseInt(record.team_number);
        const round = parseInt(record.round);

        if (!this.teamData.has(teamNumber)) {
          this.teamData.set(teamNumber, new Map());
        }

        this.teamData.get(teamNumber).set(round, {
          team_number: teamNumber,
          round: round,
          price: parseFloat(record.price),
          advertising: parseFloat(record.advertising),
          sales_force: parseFloat(record.sales_force),
          quality_investment: parseFloat(record.quality_investment),
          market_research: parseFloat(record.market_research),
          production_volume: parseFloat(record.production_volume),
          capacity_expansion: parseFloat(record.capacity_expansion),
          employees_hire: parseInt(record.employees_hire),
          employees_fire: parseInt(record.employees_fire),
          wage_level: parseFloat(record.wage_level),
          training_investment: parseFloat(record.training_investment),
          short_term_borrow: parseFloat(record.short_term_borrow),
          long_term_borrow: parseFloat(record.long_term_borrow),
          short_term_repay: parseFloat(record.short_term_repay),
          long_term_repay: parseFloat(record.long_term_repay),
          dividend_payout: parseFloat(record.dividend_payout)
        });
      });

      console.log(`Loaded team decision data for ${this.teamData.size} teams`);
    } catch (error) {
      console.error('Error loading team data:', error);
    }
  }

  /**
   * Get team decision data for a specific team and round
   */
  getTeamData(teamNumber, round) {
    if (!this.teamData.has(teamNumber)) {
      return null;
    }

    const teamRounds = this.teamData.get(teamNumber);
    return teamRounds.get(round) || null;
  }

  /**
   * Get all data for a specific round across all teams
   */
  getRoundData(round) {
    const roundData = [];
    for (const [teamNumber, rounds] of this.teamData) {
      if (rounds.has(round)) {
        roundData.push(rounds.get(round));
      }
    }
    return roundData;
  }

  /**
   * Get all teams that have data
   */
  getAllTeams() {
    return Array.from(this.teamData.keys()).sort((a, b) => a - b);
  }

  /**
   * Get all rounds for a specific team
   */
  getTeamRounds(teamNumber) {
    if (!this.teamData.has(teamNumber)) {
      return [];
    }
    return Array.from(this.teamData.get(teamNumber).keys()).sort((a, b) => a - b);
  }
}

module.exports = new TeamDataManager();
