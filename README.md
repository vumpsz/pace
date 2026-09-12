# Pace — personal finance and investment tracker

A desktop app (Electron + React + Tailwind) that runs entirely on your computer. No accounts,
no sync, no price feeds. Data is stored locally in the app's own profile folder under a
versioned key (`{ schema: 2, ... }`) and can be exported/imported as JSON.

## Download

Windows installer and portable exe: [Releases](https://github.com/abdullaamer2019-maker/pace/releases/latest). The installer is unsigned, so
SmartScreen may ask you to click "More info" then "Run anyway" the first time.

## Run and build

```bash
npm install
npm run app:dev      # dev server + Electron window with hot reload
npm run app:start    # build the bundle and open it in Electron
npm run app:build    # build the Windows installer + portable exe
npm run dev          # browser only, http://localhost:5173
```

`app:build` writes `Pace-Setup-<version>.exe` (one-click, per-user install with Start menu and
desktop shortcuts) and `Pace-Portable-<version>.exe` to the folder named in `build.directories.output`
in `package.json`.

## Tabs

- **Overview** — net worth, this month's cash flow, top budgets, the next 30 days of recurring items,
  emergency-fund coverage, the balance that could fund your spending at your withdrawal rate and
  the age the projection crosses it, accounts (click a balance to set it), net worth by month, backup.
- **Spending** — income, expenses and transfers in one quick form (Enter submits, focus returns to
  the amount), monthly budgets with pace, transaction list per month with edit/delete, recurring
  bills and paydays that post themselves when due.
- **Investing** — the deposit ledger with core/speculative categories, optional "paid from" account,
  cost-basis vs current-value allocation with a target line.
- **Plan** — the "if I keep this pace" projection at 7/10/15/20/25%, date of birth with a
  self-updating age, fee drag, inflation, today's dollars, contribution steps by age (flat between
  steps, nothing compounds on its own), solve-for-contribution, the five risk numbers, and the
  block-bootstrap Monte Carlo with fan chart, shuffled-order view and insert-one-bad-year.
- **Debts & goals** — credit cards and loans with APR and minimums, avalanche/snowball payoff plan
  with total interest and debt-free date, and savings goals that can track an account balance.

## Math notes

- Monthly rate is `(1 + annual)^(1/12) - 1`; fee drag is subtracted before compounding;
  real return is `(1 + nominal) / (1 + inflation) - 1`; contribution steps are flat amounts by age.
- Debt interest is APR ÷ 12 on the running balance; freed minimums roll into the next target.
- Account balances are opening balance plus every logged flow. Setting a balance "as of today"
  adjusts the opening balance so history is preserved.

`src/lib/finance.js` holds the projection math (shared with the Monte Carlo worker),
`src/lib/money.js` the cash-flow, budget, debt and goal math, `src/lib/history.js` the historical returns.
