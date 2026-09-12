// All projection math lives here. Rates are decimals (0.10 = 10%) unless a
// name ends in Pct. Settings values are stored as percents and converted here.

export const RATES = [7, 10, 15, 20, 25]
export const WINDOWS = [30, 90, 365]

// Monthly periodic rate. Never annual / 12.
export const monthlyRate = (annual) => Math.pow(1 + annual, 1 / 12) - 1

// Fisher conversion. Never subtraction.
export const realRate = (nominal, inflation) => (1 + nominal) / (1 + inflation) - 1

// Gross annual return -> the rate that actually compounds, after fee drag and
// (in real-dollars mode) inflation.
export function netAnnual(gross, s) {
  let r = gross - s.feeDragPct / 100
  if (s.realDollars) r = realRate(r, s.inflationPct / 100)
  return r
}

export const yearsToRetire = (s) => Math.max(0, Math.round(s.retireAge - s.currentAge))

/**
 * Monthly contribution for each projection year, from the current pace plus
 * age steps: from each step's age onward the contribution is that step's
 * amount, flat until the next step. Nothing compounds on its own.
 */
export function contributionSchedule(monthly, steps, s) {
  const n = yearsToRetire(s)
  const sorted = (steps || []).filter((st) => Number.isFinite(st.age) && Number.isFinite(st.monthly)).sort((a, b) => a.age - b.age)
  const out = new Array(n)
  for (let y = 0; y < n; y++) {
    const age = s.currentAge + y
    let amt = monthly
    for (const st of sorted) if (st.age <= age) amt = st.monthly
    out[y] = Math.max(0, amt)
  }
  return out
}

/**
 * Core engine. Walks month by month through `annualReturns` (one gross annual
 * return per year), compounding the balance and adding contributions.
 *
 * start     starting balance (current portfolio value)
 * basis     what has actually been put in so far (cost basis); used to split
 *           ending balance into "deposited" vs "growth"
 * schedule  monthly contribution per year (see contributionSchedule); falls
 *           back to a flat `monthly` when absent
 */
export function simulate({ start, basis, monthly = 0, schedule, annualReturns, s }) {
  let bal = start
  let contributed = basis
  const years = [{ year: 0, age: s.currentAge, balance: bal, contributed, growth: bal - contributed, monthly: schedule?.[0] ?? monthly }]
  for (let y = 0; y < annualReturns.length; y++) {
    const r = monthlyRate(netAnnual(annualReturns[y], s))
    const c = schedule ? (schedule[y] ?? schedule[schedule.length - 1] ?? 0) : monthly
    for (let m = 0; m < 12; m++) {
      bal = bal * (1 + r) + c
      contributed += c
    }
    years.push({ year: y + 1, age: s.currentAge + y + 1, balance: bal, contributed, growth: bal - contributed, monthly: c })
  }
  return { ending: bal, contributed, growth: bal - contributed, years }
}

// Constant-rate projection. `ratePct` is a gross annual percent, e.g. 10.
export function project(ratePct, ctx) {
  const n = yearsToRetire(ctx.s)
  return simulate({ ...ctx, annualReturns: new Array(n).fill(ratePct / 100) })
}

// Flat monthly contribution (no age steps) that reaches `target`.
// Ending balance is linear in that contribution: FV = A + c * S.
export function solveMonthlyForTarget(target, ratePct, ctx) {
  const flat = { ...ctx, schedule: undefined }
  const A = project(ratePct, { ...flat, monthly: 0 }).ending
  const S = project(ratePct, { ...flat, start: 0, basis: 0, monthly: 1 }).ending
  if (S <= 0) return { monthly: null, alreadyThere: A >= target }
  const c = (target - A) / S
  return { monthly: Math.max(0, c), alreadyThere: c <= 0 }
}

// Annual gross return (percent) needed to hit `target`. Monotonic in rate, so
// bisection is safe. Returns { ratePct, status: 'ok' | 'reached' | 'unreachable' }.
export function solveRateForTarget(target, ctx, { lo = -90, hi = 200 } = {}) {
  const f = (r) => project(r, ctx).ending - target
  if (f(lo) >= 0) return { ratePct: lo, status: 'reached' }
  if (f(hi) < 0) return { ratePct: hi, status: 'unreachable' }
  let a = lo
  let b = hi
  for (let i = 0; i < 80; i++) {
    const mid = (a + b) / 2
    if (f(mid) >= 0) b = mid
    else a = mid
  }
  return { ratePct: (a + b) / 2, status: 'ok' }
}

// Largest one-time loss (in dollars, taken from the current balance today)
// that still leaves `target` reachable at ratePct and the current pace.
export function maxAbsorbableLoss(target, ratePct, ctx) {
  const start = ctx.start
  const endingAfter = (L) => project(ratePct, { ...ctx, start: start - L, basis: Math.min(ctx.basis, start - L) }).ending
  if (endingAfter(0) < target) return { loss: 0, status: 'unreachable' }
  if (start <= 0 || endingAfter(start) >= target) return { loss: start, status: 'all' }
  let a = 0
  let b = start
  for (let i = 0; i < 80; i++) {
    const mid = (a + b) / 2
    if (endingAfter(mid) >= target) a = mid
    else b = mid
  }
  return { loss: a, status: 'ok' }
}

// Gain needed to recover from a loss: 1/(1-loss) - 1
export const recoveryGain = (loss) => 1 / (1 - loss) - 1

// ---------- ledger helpers ----------

export const signed = (e) => (e.kind === 'withdrawal' ? -e.amount : e.amount)

export function basisByCategory(entries) {
  const m = new Map()
  for (const e of entries) m.set(e.categoryId, (m.get(e.categoryId) ?? 0) + signed(e))
  return m
}

const DAY = 86400000
export const parseDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * Annualized net deposit pace over each window. History shorter than the
 * window is annualized over the days that actually exist (floored at 30),
 * so a first week of logging is not multiplied by 365/7.
 */
export function runRates(entries, now = new Date()) {
  const paced = entries.filter((e) => !e.excludeFromPace)
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let firstDay = null
  for (const e of paced) {
    const d = parseDate(e.date)
    if (d <= nowDay && (!firstDay || d < firstDay)) firstDay = d
  }
  const historyDays = firstDay ? Math.round((nowDay - firstDay) / DAY) + 1 : 0
  return WINDOWS.map((W) => {
    const cutoff = new Date(nowDay.getTime() - (W - 1) * DAY)
    let sum = 0
    let count = 0
    for (const e of paced) {
      const d = parseDate(e.date)
      if (d >= cutoff && d <= nowDay) {
        sum += signed(e)
        count++
      }
    }
    const effectiveDays = historyDays > 0 ? Math.max(30, Math.min(W, historyDays)) : W
    const annual = (sum * 365) / effectiveDays
    return {
      window: W,
      sum,
      count,
      effectiveDays,
      truncated: historyDays > 0 && historyDays < W,
      annual,
      monthly: annual / 12,
    }
  })
}

export const FREQ_PER_YEAR = { weekly: 52, biweekly: 26, monthly: 12, quarterly: 4, annual: 1 }
export const overrideMonthly = (s) =>
  ((Number(s.overrideAmount) || 0) * (FREQ_PER_YEAR[s.overrideFrequency] ?? 12)) / 12

// Projected cumulative deposits vs actual, on the same day axis.
export function paceSeries(entries, annualPace, now = new Date()) {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  if (!sorted.length) return []
  const first = parseDate(sorted[0].date)
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const days = Math.max(1, Math.round((nowDay - first) / DAY))
  const step = Math.max(1, Math.ceil(days / 120))
  const out = []
  let i = 0
  let cum = 0
  for (let d = 0; d <= days; d += step) {
    const day = new Date(first.getTime() + d * DAY)
    while (i < sorted.length && parseDate(sorted[i].date) <= day) {
      cum += signed(sorted[i])
      i++
    }
    out.push({ t: day.getTime(), actual: cum, pace: (annualPace / 365) * d })
  }
  if (out[out.length - 1].t !== nowDay.getTime()) {
    while (i < sorted.length) {
      cum += signed(sorted[i])
      i++
    }
    out.push({ t: nowDay.getTime(), actual: cum, pace: (annualPace / 365) * days })
  }
  return out
}
