const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

const DB_PATH = path.join(__dirname, '../data/simulation.db');

class Database {
  constructor() {
    this.db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Error opening database:', err);
      } else {
        console.log('Database connected successfully');
        this.initializeTables();
      }
    });
  }

  initializeTables() {
    this.db.serialize(() => {
      // Users table (teams and admin)
      this.db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        team_number INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Simulation state table
      this.db.run(`CREATE TABLE IF NOT EXISTS simulation_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        current_round INTEGER DEFAULT 0,
        status TEXT DEFAULT 'not_started',
        total_rounds INTEGER DEFAULT 8,
        teams_count INTEGER DEFAULT 4,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Team data table (stores current state)
      this.db.run(`CREATE TABLE IF NOT EXISTS teams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_number INTEGER UNIQUE NOT NULL,
        company_name TEXT,
        cash REAL DEFAULT 500000,
        inventory REAL DEFAULT 0,
        fixed_assets REAL DEFAULT 300000,
        accumulated_depreciation REAL DEFAULT 0,
        short_term_debt REAL DEFAULT 0,
        long_term_debt REAL DEFAULT 200000,
        equity REAL DEFAULT 600000,
        shares_outstanding INTEGER DEFAULT 100000,
        employees INTEGER DEFAULT 50,
        production_capacity REAL DEFAULT 10000,
        product_quality_index REAL DEFAULT 100,
        current_round INTEGER DEFAULT 0,
        is_bankrupt BOOLEAN DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Decisions table (stores decisions for each round)
      this.db.run(`CREATE TABLE IF NOT EXISTS decisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_number INTEGER NOT NULL,
        round_number INTEGER NOT NULL,
        
        price REAL,
        advertising REAL,
        sales_force REAL,
        quality_investment REAL,
        market_research REAL,
        
        production_volume REAL,
        capacity_expansion REAL,
        
        employees_hire INTEGER,
        employees_fire INTEGER,
        wage_level REAL,
        training_investment REAL,
        
        short_term_borrow REAL,
        long_term_borrow REAL,
        short_term_repay REAL,
        long_term_repay REAL,
        dividend_payout REAL,
        
        submitted BOOLEAN DEFAULT 0,
        submitted_at DATETIME,
        
        UNIQUE(team_number, round_number)
      )`);

      // Topax-native payload table (stores full form payload for parity migration)
      this.db.run(`CREATE TABLE IF NOT EXISTS topax_decisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_number INTEGER NOT NULL,
        round_number INTEGER NOT NULL,
        payload_json TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        UNIQUE(team_number, round_number)
      )`);

      // Results table (stores calculated results after each round)
      this.db.run(`CREATE TABLE IF NOT EXISTS results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_number INTEGER NOT NULL,
        round_number INTEGER NOT NULL,
        
        market_demand REAL,
        market_share REAL,
        units_sold REAL,
        revenue REAL,
        cogs REAL,
        gross_profit REAL,
        operating_expenses REAL,
        ebit REAL,
        interest_expense REAL,
        tax REAL,
        net_income REAL,
        
        total_assets REAL,
        total_liabilities REAL,
        total_equity REAL,
        
        roi REAL,
        roe REAL,
        eps REAL,
        net_margin REAL,
        
        inventory_end REAL,
        cash_end REAL,
        
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE(team_number, round_number)
      )`);

      // Market conditions table
      this.db.run(`CREATE TABLE IF NOT EXISTS market_conditions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        round_number INTEGER UNIQUE NOT NULL,
        base_demand REAL DEFAULT 40000,
        economic_factor REAL DEFAULT 1.0,
        inflation_rate REAL DEFAULT 0.02,
        interest_rate REAL DEFAULT 0.05,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Initialize default users
      this.initializeDefaultUsers();
      
      // Initialize simulation state
      this.initializeSimulationState();
      
      // Initialize teams
      this.initializeTeams();
    });
  }

  initializeDefaultUsers() {
    const saltRounds = 10;
    
    // Admin user
    bcrypt.hash('admin123', saltRounds, (err, hash) => {
      if (err) {
        console.error('Error hashing admin password:', err);
        return;
      }
      this.db.run(
        `INSERT OR IGNORE INTO users (username, password, role, team_number) VALUES (?, ?, ?, ?)`,
        ['admin', hash, 'admin', null]
      );
    });

    // Team users
    bcrypt.hash('password', saltRounds, (err, hash) => {
      if (err) {
        console.error('Error hashing team password:', err);
        return;
      }
      for (let i = 1; i <= 8; i++) {
        this.db.run(
          `INSERT OR IGNORE INTO users (username, password, role, team_number) VALUES (?, ?, ?, ?)`,
          [`team${i}`, hash, 'team', i]
        );
      }
    });
  }

  initializeSimulationState() {
    this.db.run(
      `INSERT OR IGNORE INTO simulation_state (id, current_round, status, teams_count) VALUES (1, 0, 'not_started', 4)`
    );
  }

  initializeTeams() {
    for (let i = 1; i <= 8; i++) {
      this.db.run(
        `INSERT OR IGNORE INTO teams (team_number, company_name, cash, inventory, fixed_assets, 
         short_term_debt, long_term_debt, equity, shares_outstanding, employees, production_capacity, product_quality_index) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [i, `Company ${i}`, 500000, 0, 300000, 0, 200000, 600000, 100000, 50, 10000, 100]
      );
    }
  }

  query(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

module.exports = new Database();
