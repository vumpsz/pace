// Monte Carlo off the main thread. Block bootstrap from historical annual
// returns (contiguous 3-5 year blocks) so autocorrelation and fat tails survive.
import { monthlyRate, netAnnual } from '../lib/finance.js'
import { SP500_TOTAL_RETURNS } from '../lib/history.js'

function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function bootstrapPath(rng, hist, n, bmin, bmax) {
  const out = new Array(n)
  let i = 0
  while (i < n) {
    const len = bmin + Math.floor(rng() * (bmax - bmin + 1))
    const start = Math.floor(rng() * (hist.length - len + 1))
    for (let k = 0; k < len && i < n; k++) out[i++] = hist[start + k]
  }
  return out
}

// Lean version of simulate(): returns per-year balances into `yearly` column p.
// `schedule` is the monthly contribution for each year (age steps applied).
function runPath(returns, start, schedule, s, yearly, p) {
  let bal = start
  if (yearly) yearly[0][p] = bal
  for (let y = 0; y < returns.length; y++) {
    const r = monthlyRate(netAnnual(returns[y], s))
    const c = schedule[y] ?? schedule[schedule.length - 1] ?? 0
    for (let m = 0; m < 12; m++) bal = bal * (1 + r) + c
    if (yearly) yearly[y + 1][p] = bal
  }
  return bal
}

const pct = (sorted, q) => {
  if (!sorted.length) return 0
  const i = (sorted.length - 1) * q
  const lo = Math.floor(i)
  const hi = Math.ceil(i)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo)
}

function shuffleInPlace(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const t = arr[i]
    arr[i] = arr[j]
    arr[j] = t
  }
  return arr
}

self.onmessage = (ev) => {
  const { id, params } = ev.data
  const { start, basis, monthly = 0, s, years, paths = 2000, blockMin = 3, blockMax = 5, seed = 1, shuffles = 1000, target = 0 } = params
  const schedule = Array.isArray(params.schedule) && params.schedule.length ? params.schedule : new Array(years).fill(monthly)
  const hist = SP500_TOTAL_RETURNS
  const rng = mulberry32(seed)

  // ---- block bootstrap ----
  const yearly = []
  for (let y = 0; y <= years; y++) yearly.push(new Float64Array(paths))
  const endings = new Float64Array(paths)
  const CHUNK = 250
  for (let p = 0; p < paths; p++) {
    const rets = bootstrapPath(rng, hist, years, blockMin, blockMax)
    endings[p] = runPath(rets, start, schedule, s, yearly, p)
    if ((p + 1) % CHUNK === 0) self.postMessage({ type: 'progress', id, done: p + 1, total: paths })
  }
  const bands = yearly.map((col, y) => {
    const sorted = Float64Array.from(col).sort()
    return { year: y, age: s.currentAge + y, p10: pct(sorted, 0.1), p25: pct(sorted, 0.25), p50: pct(sorted, 0.5), p75: pct(sorted, 0.75), p90: pct(sorted, 0.9) }
  })
  const sortedEnd = Float64Array.from(endings).sort()
  let sum = 0
  let hit = 0
  for (const e of endings) {
    sum += e
    if (e >= target) hit++
  }
  const terminal = {
    p10: pct(sortedEnd, 0.1),
    p25: pct(sortedEnd, 0.25),
    p50: pct(sortedEnd, 0.5),
    p75: pct(sortedEnd, 0.75),
    p90: pct(sortedEnd, 0.9),
    mean: sum / paths,
    min: sortedEnd[0],
    max: sortedEnd[sortedEnd.length - 1],
    probTarget: target > 0 ? hit / paths : null,
  }

  // ---- same CAGR, shuffled order ----
  const seq = years <= hist.length ? hist.slice(hist.length - years) : bootstrapPath(rng, hist, years, blockMin, blockMax)
  const cagr = years > 0 ? Math.exp(seq.reduce((a, b) => a + Math.log(1 + b), 0) / years) - 1 : 0
  const inOrder = runPath(seq, start, schedule, s, null, 0)
  const constant = runPath(new Array(years).fill(cagr), start, schedule, s, null, 0)
  const shuffled = new Float64Array(shuffles)
  const work = seq.slice()
  for (let i = 0; i < shuffles; i++) shuffled[i] = runPath(shuffleInPlace(work, rng), start, schedule, s, null, 0)
  const sortedSh = Float64Array.from(shuffled).sort()
  const bins = 24
  const lo = sortedSh[0]
  const hi = sortedSh[sortedSh.length - 1]
  const width = (hi - lo) / bins || 1
  const hist2 = new Array(bins).fill(0)
  for (const v of shuffled) hist2[Math.min(bins - 1, Math.floor((v - lo) / width))]++
  const shuffle = {
    years,
    fromHistory: years <= hist.length,
    cagr,
    inOrder,
    constant,
    p10: pct(sortedSh, 0.1),
    p50: pct(sortedSh, 0.5),
    p90: pct(sortedSh, 0.9),
    min: lo,
    max: hi,
    histogram: hist2.map((count, i) => ({ x0: lo + i * width, x1: lo + (i + 1) * width, count })),
  }

  self.postMessage({ type: 'result', id, result: { bands, terminal, shuffle, paths, basis } })
}
