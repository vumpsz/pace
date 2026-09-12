import { useMemo } from 'react'
import { RATES, basisByCategory, contributionSchedule, overrideMonthly, project, runRates } from '../lib/finance.js'
import { isDebtType, today, monthKey } from '../lib/storage.js'
import {
  accountBalances,
  netWorth as calcNetWorth,
  monthSummary,
  monthlySeries,
  avgMonthlyExpenses,
  budgetProgress,
  upcomingRecurring,
  recurringMonthly,
  debtPayoff,
  goalProgress,
  fireNumber,
  crossingAge,
} from '../lib/money.js'

/** Everything the rest of the app derives from the ledgers + settings, computed once. */
export function useDerived(state, viewMonth) {
  const { entries, categories, settings, accounts, spendCategories, transactions, recurring, goals } = state
  const todayIso = today()
  const month = viewMonth || monthKey(todayIso)

  // ---------- investments ----------
  const invest = useMemo(() => {
    const basisMap = basisByCategory(entries)
    const cats = categories.map((c) => {
      const basis = basisMap.get(c.id) ?? 0
      const usingCurrent = c.currentValue != null
      return { ...c, basis, value: usingCurrent ? c.currentValue : basis, usingCurrent }
    })
    const sum = (arr, k) => arr.reduce((a, c) => a + c[k], 0)
    const totals = { basis: sum(cats, 'basis'), value: sum(cats, 'value') }
    const byTag = {}
    for (const tag of ['core', 'speculative']) {
      const grp = cats.filter((c) => c.tag === tag)
      byTag[tag] = { basis: sum(grp, 'basis'), value: sum(grp, 'value') }
    }
    const currentCount = cats.filter((c) => c.usingCurrent).length

    const pace = runRates(entries)
    const selectedPace = pace.find((p) => p.window === settings.paceWindowDays) ?? pace[1]
    const paceMonthly = Math.max(0, selectedPace.monthly)
    const monthly = settings.overrideOn ? overrideMonthly(settings) : paceMonthly

    const schedule = contributionSchedule(monthly, settings.contributionSteps, settings)
    const ctx = { start: Math.max(0, totals.value), basis: Math.max(0, totals.basis), monthly, schedule, s: settings }
    const results = {}
    for (const r of RATES) results[r] = project(r, ctx)
    const baseRate = RATES.includes(settings.baseRate) ? settings.baseRate : 10
    const base = results[baseRate]
    return { cats, totals, byTag, currentCount, pace, selectedPace, paceMonthly, monthly, schedule, ctx, results, baseRate, base }
  }, [entries, categories, settings])

  // ---------- money ----------
  const money = useMemo(() => {
    const balances = accountBalances(accounts, transactions, entries)
    const accts = accounts.map((a) => ({ ...a, balance: balances.get(a.id)?.display ?? 0, signed: balances.get(a.id)?.signed ?? 0, isDebt: isDebtType(a.type) }))
    const nw = calcNetWorth(accounts, balances, Math.max(0, invest.totals.value))
    const thisMonth = monthSummary(transactions, entries, month)
    const series = monthlySeries(transactions, entries, month, 12)
    const avgExp = avgMonthlyExpenses(transactions, monthKey(todayIso), 3)
    const budgets = budgetProgress(spendCategories, thisMonth, month, todayIso)
    const upcoming = upcomingRecurring(recurring, todayIso, 30)
    const recMonthly = recurringMonthly(recurring)
    const debts = accts.filter((a) => a.isDebt && a.balance > 0).map((a) => ({ id: a.id, name: a.name, balance: a.balance, apr: a.apr, minPayment: a.minPayment }))
    const payoff = debtPayoff(debts, settings.debtExtraMonthly, settings.debtStrategy)
    const payoffMinOnly = debtPayoff(debts, 0, settings.debtStrategy)
    const goalRows = goals.map((g) => ({ goal: g, ...goalProgress(g, balances, todayIso) }))
    const emergency = {
      months: avgExp.avg > 0 ? nw.cash / avgExp.avg : null,
      target: settings.emergencyMonthsTarget,
      shortfall: avgExp.avg > 0 ? Math.max(0, settings.emergencyMonthsTarget * avgExp.avg - nw.cash) : null,
      avgExpenses: avgExp.avg,
      basisMonths: avgExp.months,
    }
    const annualExpenses = avgExp.avg * 12
    const fire = {
      number: annualExpenses > 0 ? fireNumber(annualExpenses, settings.withdrawalRatePct) : null,
      annualExpenses,
      crossAge: annualExpenses > 0 ? crossingAge(invest.base.years, fireNumber(annualExpenses, settings.withdrawalRatePct)) : null,
    }
    return { balances, accts, nw, thisMonth, series, avgExp, budgets, upcoming, recMonthly, debts, payoff, payoffMinOnly, goalRows, emergency, fire, month }
  }, [accounts, transactions, entries, recurring, spendCategories, goals, settings, invest, month, todayIso])

  return { ...invest, money, month }
}
