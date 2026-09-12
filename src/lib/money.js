// Personal-finance math: account balances, cash flow, budgets, recurring items,
// debt payoff, goals, emergency fund, FIRE number. Pure functions, no React.
import { isDebtType, isLiquidType, today } from './storage.js'
import { signed as investSigned } from './finance.js'

export const FREQ_MONTHS = { weekly: 12 / 52, biweekly: 12 / 26, monthly: 1, quarterly: 3, annual: 12 }
export const perMonth = (amount, freq) => amount / (FREQ_MONTHS[freq] ?? 1)

// ---------- dates ----------
export const monthOf = (iso) => iso.slice(0, 7)
export function addMonths(month, n) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
export function monthLabel(month, { short = false } = {}) {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: short ? '2-digit' : 'numeric' })
}
export function daysInMonth(month) {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}
export function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}
export function nextOccurrence(iso, frequency) {
  const [y, m, d] = iso.split('-').map(Number)
  if (frequency === 'weekly') return addDays(iso, 7)
  if (frequency === 'biweekly') return addDays(iso, 14)
  const months = frequency === 'quarterly' ? 3 : frequency === 'annual' ? 12 : 1
  const target = new Date(y, m - 1 + months, 1)
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  const dt = new Date(target.getFullYear(), target.getMonth(), Math.min(d, last))
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}
export const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000)

// ---------- balances ----------
/**
 * Signed balances: assets positive, debts negative. For debt accounts the
 * user enters the amount owed as a positive opening balance; flows then apply
 * uniformly (an expense on a credit card makes the signed balance more
 * negative, a transfer into it is a payment).
 */
export function accountBalances(accounts, transactions, entries) {
  const bal = new Map()
  for (const a of accounts) bal.set(a.id, isDebtType(a.type) ? -a.openingBalance : a.openingBalance)
  const add = (id, v) => {
    if (id != null && bal.has(id)) bal.set(id, bal.get(id) + v)
  }
  for (const t of transactions) {
    if (t.type === 'income') add(t.accountId, t.amount)
    else if (t.type === 'expense') add(t.accountId, -t.amount)
    else {
      add(t.accountId, -t.amount)
      add(t.toAccountId, t.amount)
    }
  }
  for (const e of entries) if (e.accountId) add(e.accountId, -investSigned(e))
  const out = new Map()
  for (const a of accounts) {
    const s = bal.get(a.id)
    out.set(a.id, { signed: s, display: isDebtType(a.type) ? -s : s })
  }
  return out
}

export function netWorth(accounts, balances, investmentsValue) {
  let assets = 0
  let liabilities = 0
  let liquid = 0
  for (const a of accounts) {
    if (!a.includeInNetWorth) continue
    const s = balances.get(a.id)?.signed ?? 0
    if (s >= 0) assets += s
    else liabilities += -s
    if (isLiquidType(a.type)) liquid += s
  }
  return { assets: assets + investmentsValue, cash: liquid, liabilities, investments: investmentsValue, netWorth: assets + investmentsValue - liabilities }
}

// ---------- cash flow ----------
export function monthSummary(transactions, entries, month) {
  let income = 0
  let expenses = 0
  let invested = 0
  const byCategory = new Map()
  const incomeByCategory = new Map()
  for (const t of transactions) {
    if (monthOf(t.date) !== month) continue
    if (t.type === 'income') {
      income += t.amount
      incomeByCategory.set(t.categoryId, (incomeByCategory.get(t.categoryId) ?? 0) + t.amount)
    } else if (t.type === 'expense') {
      expenses += t.amount
      byCategory.set(t.categoryId, (byCategory.get(t.categoryId) ?? 0) + t.amount)
    }
  }
  for (const e of entries) if (monthOf(e.date) === month) invested += investSigned(e)
  const net = income - expenses
  return {
    month,
    income,
    expenses,
    invested,
    net,
    savingsRate: income > 0 ? net / income : null,
    investedRate: income > 0 ? invested / income : null,
    byCategory,
    incomeByCategory,
  }
}

export function monthlySeries(transactions, entries, endMonth, months = 12) {
  const out = []
  for (let i = months - 1; i >= 0; i--) {
    const m = addMonths(endMonth, -i)
    const s = monthSummary(transactions, entries, m)
    out.push({ month: m, label: monthLabel(m, { short: true }), income: s.income, expenses: s.expenses, invested: s.invested, net: s.net })
  }
  return out
}

/** Mean of the previous `months` full months of expenses; falls back to the current month. */
export function avgMonthlyExpenses(transactions, endMonth, months = 3) {
  const vals = []
  for (let i = 1; i <= months; i++) {
    const m = addMonths(endMonth, -i)
    const s = monthSummary(transactions, [], m)
    if (s.expenses > 0 || s.income > 0) vals.push(s.expenses)
  }
  if (vals.length) return { avg: vals.reduce((a, b) => a + b, 0) / vals.length, months: vals.length }
  const cur = monthSummary(transactions, [], endMonth)
  return { avg: cur.expenses, months: cur.expenses > 0 ? 0 : -1 }
}

// ---------- budgets ----------
export function budgetProgress(spendCategories, summary, month, todayIso = today()) {
  const inMonth = monthOf(todayIso) === month
  const dayFrac = inMonth ? Number(todayIso.slice(8, 10)) / daysInMonth(month) : monthOf(todayIso) > month ? 1 : 0
  const rows = spendCategories
    .filter((c) => c.kind === 'expense')
    .map((c) => {
      const spent = summary.byCategory.get(c.id) ?? 0
      const budget = c.budget
      const pct = budget ? spent / budget : null
      const expected = budget ? budget * dayFrac : null
      return {
        cat: c,
        spent,
        budget,
        pct,
        remaining: budget != null ? budget - spent : null,
        over: budget != null && spent > budget,
        aheadOfPace: budget != null && expected != null && spent > expected * 1.1 && spent <= budget,
      }
    })
    .sort((a, b) => (b.budget ?? -1) - (a.budget ?? -1) || b.spent - a.spent)
  const budgeted = rows.filter((r) => r.budget != null)
  const totalBudget = budgeted.reduce((a, r) => a + r.budget, 0)
  const totalSpentBudgeted = budgeted.reduce((a, r) => a + r.spent, 0)
  const unbudgeted = rows.filter((r) => r.budget == null && r.spent > 0).reduce((a, r) => a + r.spent, 0)
  return { rows, totalBudget, totalSpentBudgeted, unbudgeted, dayFrac }
}

// ---------- recurring ----------
export function dueOccurrences(rec, todayIso = today(), cap = 36) {
  const dates = []
  let d = rec.nextDate
  while (d <= todayIso && dates.length < cap) {
    dates.push(d)
    d = nextOccurrence(d, rec.frequency)
  }
  return { dates, nextDate: d }
}

export function upcomingRecurring(recurring, todayIso = today(), days = 30) {
  const end = addDays(todayIso, days)
  const out = []
  for (const r of recurring) {
    if (!r.active) continue
    let d = r.nextDate
    let guard = 0
    while (d <= end && guard++ < 12) {
      if (d >= todayIso) out.push({ rec: r, date: d, inDays: daysBetween(todayIso, d) })
      d = nextOccurrence(d, r.frequency)
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

export function recurringMonthly(recurring) {
  let income = 0
  let expenses = 0
  for (const r of recurring) {
    if (!r.active) continue
    const m = perMonth(r.amount, r.frequency)
    if (r.type === 'income') income += m
    else if (r.type === 'expense') expenses += m
  }
  return { income, expenses }
}

// ---------- debts ----------
/**
 * Month-by-month payoff. Minimums on everything, the rest of the budget
 * (sum of minimums + extra, held constant) goes to the target debt: highest
 * APR for avalanche, smallest balance for snowball. Freed minimums roll over.
 */
export function debtPayoff(debts, extraMonthly = 0, strategy = 'avalanche', { maxMonths = 600 } = {}) {
  const live = debts.filter((d) => d.balance > 0.005).map((d) => ({ ...d, bal: d.balance, interest: 0, paidOffMonth: null }))
  if (!live.length) return { months: 0, totalInterest: 0, totalPaid: 0, order: [], schedule: [], status: 'clear' }
  const budget = live.reduce((a, d) => a + Math.max(d.minPayment, 0), 0) + Math.max(0, extraMonthly)
  const schedule = [{ month: 0, balance: live.reduce((a, d) => a + d.bal, 0) }]
  let totalInterest = 0
  let totalPaid = 0
  let month = 0
  while (live.some((d) => d.bal > 0.005) && month < maxMonths) {
    month++
    // accrue
    for (const d of live) {
      if (d.bal <= 0.005) continue
      const i = (d.bal * (d.apr / 100)) / 12
      d.bal += i
      d.interest += i
      totalInterest += i
    }
    let remaining = budget
    // minimums
    for (const d of live) {
      if (d.bal <= 0.005) continue
      const p = Math.min(d.bal, Math.max(d.minPayment, 0), remaining)
      d.bal -= p
      remaining -= p
      totalPaid += p
    }
    // extra to the target, then cascade
    const open = () => live.filter((d) => d.bal > 0.005).sort((a, b) => (strategy === 'snowball' ? a.bal - b.bal : b.apr - a.apr || a.bal - b.bal))
    let targets = open()
    while (remaining > 0.005 && targets.length) {
      const t = targets[0]
      const p = Math.min(t.bal, remaining)
      t.bal -= p
      remaining -= p
      totalPaid += p
      targets = open()
    }
    for (const d of live) if (d.bal <= 0.005 && d.paidOffMonth == null) d.paidOffMonth = month
    schedule.push({ month, balance: live.reduce((a, d) => a + Math.max(0, d.bal), 0) })
    // payments not covering interest: bail out
    if (month > 24 && schedule[month].balance > schedule[month - 12].balance) {
      return { months: Infinity, totalInterest: Infinity, totalPaid: Infinity, order: [], schedule, status: 'never', budget }
    }
  }
  return {
    months: month,
    totalInterest,
    totalPaid,
    budget,
    status: month >= maxMonths ? 'never' : 'ok',
    order: live.sort((a, b) => (a.paidOffMonth ?? Infinity) - (b.paidOffMonth ?? Infinity)).map((d) => ({ id: d.id, name: d.name, paidOffMonth: d.paidOffMonth, interest: d.interest })),
    schedule,
  }
}

// ---------- goals ----------
export function goalProgress(goal, balances, todayIso = today()) {
  const saved = goal.accountId ? Math.max(0, balances.get(goal.accountId)?.signed ?? 0) : goal.saved
  const remaining = Math.max(0, goal.target - saved)
  const pct = goal.target > 0 ? Math.min(1, saved / goal.target) : 0
  let monthsLeft = null
  let requiredMonthly = null
  if (goal.deadline) {
    monthsLeft = Math.max(0, daysBetween(todayIso, goal.deadline) / 30.4375)
    requiredMonthly = monthsLeft > 0 ? remaining / monthsLeft : remaining
  }
  return { saved, remaining, pct, monthsLeft, requiredMonthly, done: remaining <= 0 }
}

// ---------- age ----------
/** Whole years, remaining months, and exact decimal age from a YYYY-MM-DD birth date. */
export function ageFrom(birthDate, todayIso = today()) {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null
  const [by, bm, bd] = birthDate.split('-').map(Number)
  const [ty, tm, td] = todayIso.split('-').map(Number)
  let years = ty - by
  let months = tm - bm
  if (td < bd) months -= 1
  if (months < 0) {
    years -= 1
    months += 12
  }
  if (years < 0) return null
  const exact = (new Date(ty, tm - 1, td) - new Date(by, bm - 1, bd)) / (365.2425 * 86400000)
  const next = new Date(ty + (tm > bm || (tm === bm && td >= bd) ? 1 : 0), bm - 1, bd)
  return { years, months, exact, nextBirthday: next.toISOString().slice(0, 10) }
}

/** Settings with currentAge derived from birthDate when one is set. */
export function withDerivedAge(settings, todayIso = today()) {
  const a = ageFrom(settings.birthDate, todayIso)
  if (!a) return settings
  return settings.currentAge === a.years ? settings : { ...settings, currentAge: a.years }
}

// ---------- retirement bridge ----------
export const fireNumber = (annualExpenses, withdrawalRatePct) => (withdrawalRatePct > 0 ? annualExpenses / (withdrawalRatePct / 100) : Infinity)
export function crossingAge(years, target) {
  const hit = years.find((y) => y.balance >= target)
  return hit ? hit.age : null
}
