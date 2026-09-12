import { useMemo, useState } from 'react'
import { Area, Bar, BarChart, ComposedChart, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts'
import { simulate, yearsToRetire } from '../lib/finance.js'
import { HIST_END_YEAR, HIST_START_YEAR, SP500_TOTAL_RETURNS, histStats } from '../lib/history.js'
import { fmtUSD, fmtCompact, fmtPct, plural } from '../lib/format.js'
import { useMonteCarlo } from '../hooks/useMonteCarlo.js'
import { AnimatedNumber, NumInput, Section, Stat, Labeled, Callout } from './ui.jsx'
import { C, axis, cursor, Frame, Tip } from './charts.jsx'

const PATHS = 2000
const SHUFFLES = 1000

function FanChart({ bands, det, retireAge }) {
  const [log, setLog] = useState(false)
  const data = useMemo(
    () =>
      bands.map((b, i) => {
        const f = (v) => (log ? Math.max(1, v) : v)
        return { age: b.age, band90: [f(b.p10), f(b.p90)], band50: [f(b.p25), f(b.p75)], p50: f(b.p50), det: f(det[i]?.balance ?? 0), raw: b, detRaw: det[i]?.balance ?? 0 }
      }),
    [bands, det, log],
  )
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium">Simulated balance to {retireAge}, with the straight line drawn on top</h3>
        <button type="button" className={`btn btn-ghost btn-sm ${log ? 'text-accent' : ''}`} aria-pressed={log} onClick={() => setLog((v) => !v)}>
          Log scale
        </button>
      </div>
      <Frame height={300}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <XAxis dataKey="age" {...axis} minTickGap={24} />
          <YAxis {...axis} width={48} scale={log ? 'log' : 'auto'} domain={log ? ['auto', 'auto'] : [0, 'auto']} tickFormatter={fmtCompact} allowDataOverflow />
          <Tooltip
            cursor={cursor}
            content={
              <Tip
                title={(l) => `Age ${l}`}
                rows={(p) => {
                  const r = p[0]?.payload
                  if (!r) return []
                  return [
                    { label: 'p90', value: fmtUSD(r.raw.p90), color: '#3a404b' },
                    { label: 'p75', value: fmtUSD(r.raw.p75), color: '#4d5460' },
                    { label: 'median', value: fmtUSD(r.raw.p50), color: C.fg, strong: true },
                    { label: 'p25', value: fmtUSD(r.raw.p25), color: '#4d5460' },
                    { label: 'p10', value: fmtUSD(r.raw.p10), color: '#3a404b' },
                    { label: 'straight line', value: fmtUSD(r.detRaw), color: C.accent },
                  ]
                }}
              />
            }
          />
          <Area type="monotone" dataKey="band90" stroke="none" fill="#2a2f39" fillOpacity={1} isAnimationActive={false} />
          <Area type="monotone" dataKey="band50" stroke="none" fill="#3d4450" fillOpacity={1} isAnimationActive={false} />
          <Line type="monotone" dataKey="p50" stroke={C.fg} strokeWidth={1.75} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="det" stroke={C.accent} strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
        </ComposedChart>
      </Frame>
      <p className="text-xs text-dim mt-2">Dark band: middle 80% of paths (p10 to p90). Lighter band: middle 50%. White line: median. Dashed: the deterministic projection at your base rate.</p>
    </div>
  )
}

function ShuffleView({ shuffle }) {
  const first = HIST_END_YEAR - shuffle.years + 1
  const data = shuffle.histogram.map((b) => ({ x: (b.x0 + b.x1) / 2, x0: b.x0, x1: b.x1, count: b.count }))
  return (
    <div>
      <h3 className="text-sm font-medium mb-1">Same average return, shuffled order</h3>
      <p className="note mb-4">
        {shuffle.fromHistory ? (
          <>
            Take the actual S&P 500 returns from {first} to {HIST_END_YEAR}, {plural(shuffle.years, 'year')} with a compound annual growth rate of{' '}
            <span className="text-fg tnum">{fmtPct(shuffle.cagr * 100)}</span>.
          </>
        ) : (
          <>
            Take one bootstrapped sequence of {plural(shuffle.years, 'year')} with a compound annual growth rate of <span className="text-fg tnum">{fmtPct(shuffle.cagr * 100)}</span>.
          </>
        )}{' '}
        Every ordering below has exactly that average. Only the sequence differs.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <Stat label="Constant rate every year" value={fmtCompact(shuffle.constant)} sub="what a straight line assumes" />
        <Stat label="In the order it happened" value={fmtCompact(shuffle.inOrder)} />
        <Stat label={`Shuffled ${SHUFFLES.toLocaleString()} times, median`} value={fmtCompact(shuffle.p50)} sub={`p10 ${fmtCompact(shuffle.p10)} · p90 ${fmtCompact(shuffle.p90)}`} />
        <Stat label="Best vs. worst ordering" value={`${(shuffle.max / Math.max(1, shuffle.min)).toFixed(1)}×`} sub={`${fmtCompact(shuffle.min)} to ${fmtCompact(shuffle.max)}`} warn />
      </div>
      <Frame height={160}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} barCategoryGap={1}>
          <XAxis dataKey="x" {...axis} tickFormatter={fmtCompact} minTickGap={40} />
          <YAxis {...axis} width={32} allowDecimals={false} />
          <Tooltip cursor={{ fill: '#1a1e26' }} content={<Tip rows={(p) => [{ label: `${fmtCompact(p[0].payload.x0)} to ${fmtCompact(p[0].payload.x1)}`, value: `${p[0].value} orderings`, strong: true }]} />} />
          <Bar dataKey="count" fill={C.muted} isAnimationActive={false} />
        </BarChart>
      </Frame>
      <p className="text-xs text-dim mt-2">
        Distribution of ending balances across the orderings. Bad years late, when the balance is large, hurt far more than bad years early, when contributions
        still dominate. The average return cannot see this.
      </p>
    </div>
  )
}

function BadYear({ derived, settings }) {
  const { base, baseRate, ctx } = derived
  const years = yearsToRetire(settings)
  const minAge = settings.currentAge + 1
  const maxAge = settings.retireAge
  const [age, setAge] = useState(Math.min(maxAge, Math.max(minAge, settings.retireAge - 5)))
  const [ret, setRet] = useState(-40)
  const clampedAge = Math.min(maxAge, Math.max(minAge, age))

  const withBad = (a) => {
    const rets = new Array(years).fill(baseRate / 100)
    rets[a - settings.currentAge - 1] = ret / 100
    return simulate({ ...ctx, annualReturns: rets }).ending
  }
  const modified = useMemo(() => (years > 0 ? withBad(clampedAge) : 0), [clampedAge, ret, ctx, baseRate, years]) // eslint-disable-line react-hooks/exhaustive-deps
  const cost = base.ending - modified
  const byAge = useMemo(() => {
    const out = []
    for (let a = minAge; a <= maxAge; a++) out.push({ age: a, cost: base.ending - withBad(a) })
    return out
  }, [minAge, maxAge, ret, ctx, baseRate, base.ending]) // eslint-disable-line react-hooks/exhaustive-deps

  if (years <= 0) return null
  return (
    <div>
      <h3 className="text-sm font-medium mb-3">Insert one bad year</h3>
      <div className="grid grid-cols-2 sm:grid-cols-[8rem_8rem_1fr] gap-4 items-end">
        <Labeled label="At age">
          <NumInput value={clampedAge} min={minAge} max={maxAge} onChange={(v) => setAge(Math.round(v))} />
        </Labeled>
        <Labeled label="That year returns">
          <NumInput value={ret} min={-99} max={100} suffix="%" onChange={setRet} />
        </Labeled>
        <Stat label={`Cost at ${settings.retireAge}, vs. a straight ${baseRate}%`} value={<AnimatedNumber value={cost} format={fmtUSD} />} sub={base.ending > 0 ? `${fmtPct((cost / base.ending) * 100)} of the ending balance` : ''} warn={cost > 0} />
      </div>
      <div className="mt-5">
        <div className="text-xs text-muted mb-1">Cost of that same {ret}% year, by the age it lands</div>
        <Frame height={150}>
          <LineChart data={byAge} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <XAxis dataKey="age" {...axis} minTickGap={24} />
            <YAxis {...axis} width={48} tickFormatter={fmtCompact} />
            <Tooltip cursor={cursor} content={<Tip title={(l) => `Bad year at ${l}`} rows={(p) => [{ label: 'Cost at retirement', value: fmtUSD(p[0].value), color: C.warn, strong: true }]} />} />
            <Line type="monotone" dataKey="cost" stroke={C.warn} strokeWidth={1.75} dot={false} isAnimationActive={false} />
          </LineChart>
        </Frame>
      </div>
      <p className="note mt-2">
        One number the fan chart cannot give you: a specific crash at a specific age. The same percentage loss costs more the later it lands, because there is
        more balance to lose and less time to recover. The line above is the timing of your exposure.
      </p>
    </div>
  )
}

export default function MonteCarlo({ derived, settings }) {
  const { ctx, base, baseRate } = derived
  const years = yearsToRetire(settings)
  const params = useMemo(
    () => ({
      start: ctx.start,
      basis: ctx.basis,
      monthly: ctx.monthly,
      schedule: ctx.schedule,
      s: settings,
      years,
      paths: PATHS,
      shuffles: SHUFFLES,
      seed: 7,
      target: settings.solveTarget,
      deterministic: base.ending,
    }),
    [ctx, settings, years, base.ending],
  )
  const mc = useMonteCarlo(params)
  const r = mc.result
  const stats = useMemo(() => histStats(SP500_TOTAL_RETURNS), [])

  return (
    <Section
      id="montecarlo"
      title="Sequence risk"
      lede="The projection above assumes returns arrive evenly. They do not, and the order matters more than the average. This is what that looks like."
    >
      <p className="note mb-6">
        {PATHS.toLocaleString()} paths, each built by stitching together random 3-to-5-year blocks of actual S&P 500 total returns from {HIST_START_YEAR} to{' '}
        {HIST_END_YEAR} (historical average {fmtPct(stats.mean * 100)}, compound {fmtPct(stats.cagr * 100)}, {stats.negative} losing years, worst {fmtPct(stats.worst * 100, 0)}). Blocks
        rather than single years so streaks and crashes survive the sampling. Your fee drag{settings.realDollars ? ', inflation' : ''} and contribution
        steps by age apply the same way they do above. Historical returns are not a forecast either.
      </p>

      {mc.status === 'error' && <Callout warn>The simulation could not run in this browser: {mc.error}</Callout>}
      {years <= 0 && <Callout>Nothing to simulate until retirement age is after current age.</Callout>}

      <div className={`transition-opacity duration-300 ${mc.status === 'running' && r ? 'opacity-60' : ''}`}>
        {mc.status === 'running' && (
          <div className="h-0.5 bg-line rounded overflow-hidden mb-6" role="progressbar" aria-valuenow={Math.round(mc.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-accent transition-[width] duration-200" style={{ width: `${Math.max(4, mc.progress * 100)}%` }} />
          </div>
        )}
        {r && (
          <div className="space-y-12">
            <div>
              <div className="grid grid-cols-3 gap-4">
                <Stat label="p10 · bad decade" value={<AnimatedNumber value={r.terminal.p10} format={fmtUSD} />} sub="1 in 10 paths end below this" warn />
                <Stat label="p50 · median" value={<AnimatedNumber value={r.terminal.p50} format={fmtUSD} />} sub="half end below, half above" big />
                <Stat label="p90 · good decade" value={<AnimatedNumber value={r.terminal.p90} format={fmtUSD} />} sub="1 in 10 paths end above this" />
              </div>
              <div className="mt-5 grid sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="label">Mean, for comparison</div>
                  <div className="tnum text-lg">{fmtUSD(r.terminal.mean)}</div>
                  <div className="text-xs text-dim">
                    {r.terminal.mean > r.terminal.p50
                      ? `${fmtPct(((r.terminal.mean - r.terminal.p50) / r.terminal.p50) * 100, 0)} above the median. A few huge paths pull it up; most paths never see it.`
                      : 'Close to the median.'}
                  </div>
                </div>
                <div>
                  <div className="label">Straight line at {baseRate}%</div>
                  <div className="tnum text-lg text-accent">{fmtUSD(base.ending)}</div>
                  <div className="text-xs text-dim">
                    {base.ending > r.terminal.p90
                      ? 'Above p90. Fewer than 1 in 10 simulated paths do this well.'
                      : base.ending > r.terminal.p50
                        ? 'Between the median and p90: an above-average outcome, presented as the plan.'
                        : base.ending > r.terminal.p10
                          ? 'Between p10 and the median.'
                          : 'Below p10. The historical record has been kinder than this assumption.'}
                  </div>
                </div>
                {r.terminal.probTarget != null && (
                  <div>
                    <div className="label">Paths reaching {fmtCompact(settings.solveTarget)}</div>
                    <div className={`tnum text-lg ${r.terminal.probTarget < 0.5 ? 'text-warn' : ''}`}>{fmtPct(r.terminal.probTarget * 100, 0)}</div>
                    <div className="text-xs text-dim">of {r.paths.toLocaleString()} simulated paths, at the current pace</div>
                  </div>
                )}
              </div>
            </div>
            <FanChart bands={r.bands} det={base.years} retireAge={settings.retireAge} />
            <ShuffleView shuffle={r.shuffle} />
          </div>
        )}
        {!r && mc.status === 'running' && <p className="note">Simulating {PATHS.toLocaleString()} paths…</p>}
      </div>

      <div className="rule my-12" />
      <BadYear derived={derived} settings={settings} />
    </Section>
  )
}
