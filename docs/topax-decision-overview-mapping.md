# Topax Decision Overview Mapping

This document captures the decision surface shown in the provided Topax fieldset and maps it to current Hyder Work coverage.

## 1) Decisions Visible In Topax Overview

### Product and Market Decisions
- Implement major improvement tick: Product 1, Product 2, Product 3
- Prices by product and region:
  - Export Market: P1, P2, P3
  - Home Markets: P1, P2, P3

### Promotion Decisions (per product)
- Trade Press spend
- Advertising Support spend
- Merchandising spend

### Product and Sales Policy
- Assembly time (minutes) per product
- Days credit allowed

### Finance and Assets
- Dividend rate (pence/share)
- Vans to buy
- Vans to sell
- New machines to order
- Machines to sell

### Information Purchase
- Research on other companies
- Market shares subscription
- Research expenditure

### Production and Distribution Scheduling
- Make and deliver by area and product:
  - Export Area: P1, P2, P3
  - South Area: P1, P2, P3
  - West Area: P1, P2, P3
  - North Area: P1, P2, P3

### Sales Force and HR
- Salespeople allocated by area: Export, South, West, North
- Salespeople remuneration:
  - Quarterly salary
  - Sales commission %
- Salespeople pipeline:
  - Recruit, Dismiss, Train
- Assembly workers policy:
  - Hourly wage (pounds/pence)
  - Recruit, Dismiss, Train

### Operations and Procurement
- Shift level
- Contract maintenance hours
- Raw material plan:
  - Units to order
  - Supplier number
  - Number of deliveries

### Management
- Quarterly management budget

## 2) Current Hyder Work Coverage (as of now)

Current model uses a simplified, aggregated single-product style decision set:
- price
- advertising
- sales_force
- quality_investment
- market_research
- production_volume
- capacity_expansion
- employees_hire, employees_fire
- wage_level
- training_investment
- short_term_borrow/repay
- long_term_borrow/repay
- dividend_payout

## 3) Key Parity Gaps

1. Missing multi-product structure (3 products)
2. Missing multi-region price and delivery matrix (4 regions)
3. Missing per-product promotion channels (trade press, support, merchandising)
4. Missing credit policy and information subscription toggles
5. Missing detailed HR channels (salespeople vs assembly workers, recruit/dismiss/train split)
6. Missing logistics assets (vans buy/sell) and machine order pipeline behavior
7. Missing operations controls (shift level, maintenance hours, supplier selection, delivery frequency)
8. Missing explicit implementation timing for major product improvements

## 4) Recommended Implementation Sequence

### Phase 1: Data Model Expansion (non-breaking)
- Extend decision storage to include Topax-native fields while keeping legacy fields.
- Add API support for Topax field payloads.
- Keep current simulator running via legacy fallback mapping.

### Phase 2: Translation Layer
- Build a deterministic mapping from Topax-native inputs to current aggregate simulator terms.
- Use this bridge to validate frontend and API before full simulator rewrite.

### Phase 3: Simulator Refactor
- Move from single aggregate demand model to product x area model.
- Add inventory, transport, and backlog/cancellation behavior by area.
- Add machine/vehicle and supplier dynamics.

### Phase 4: Financial Timing Parity
- Add Topax-style quarterly timing rules for dividends, tax timing, borrowing constraints, and asset installation lags.

### Phase 5: Calibration and Tests
- Replay known Topax scenarios and compare trend direction:
  - market share
  - profitability
  - cash stress and debt
  - stock/backlog dynamics

## 5) Immediate Next Coding Target

Implement Phase 1 first so the full Topax form can submit without losing data, even before full engine parity.
