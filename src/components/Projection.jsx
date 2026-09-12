import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ComposedChart, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts'
import { RATES, FREQ_PER_YEAR, paceSeries, solveMonthlyForTarget, yearsToRetire } from '../lib/finance.js'
import { ageFrom } from '../lib/money.js'
import { today } from '../lib/storage.js'
import { fmtUSD, fmtCompact, fmtDateShort, plural } from '../lib/format.js'
import { AnimatedNumber, NumInput, Seg, Section, Stat, Labeled, Callout } from './ui.jsx'
import { C, GRAYS, axis, cursor, Frame, Tip } from './charts.jsx'

const DOLLAR_OPTS = [
  { value: false, label: 'Nominal' },
  { value: true, label: "Today's dollars" },
]

function rateColor(r, baseRate) {
  if (r === baseRate) return C.accent
  return GRAYS[RATES.indexOf(r)] ?? C.muted
}

/* ------------------------------------------------------------------ */
/* Hero: the one number that dominates the first screen                */
/* ------------------------------------------------------------------ */

export function Hero({ derived, settings, setSetting, entryCount }) {
  const { base, baseRate, results, pace, monthly } = derived
  const years = yearsToRetire(settings)
  const nonzero = pace.filter((p) => p.monthly > 0).map((p) => p.monthly)
  const disagree = nonzero.length >= 2 && Math.max(...nonzero) / Math.min(...nonzero) > 1.5
  const steps = [...(settings.contributionSteps || [])].sort((a, b) => a.age - b.age)
  const lastStep = steps.length ? steps[steps.length - 1] : null
  const noPace = !settings.overrideOn && monthly <= 0 && !lastStep

  return (
    <section id="top" className="pt-10 sm:pt-16 pb-10">
      <p className="text-sm text-muted">
        If you keep this pace from {settings.currentAge} until {settings.retireAge}
        <span className="text-dim"> · projection, {settings.realDollars ? "today's dollars" : 'nominal'}</span>
      </p>
      <div className="mt-2 text-5xl sm:text-7xl font-semibold tracking-tight text-accent leading-none">
        <AnimatedNumber value={base.ending} format={(v) => fmtUSD(v)} />
      </div>
      <p className="mt-3 text-sm text-muted tnum">
        {noPace ? (
          entryCount === 0 ? (
            <>Log a deposit below and this number comes alive.</>
          ) : (
            <>No net deposits in the selected window, so the pace is zero. Pick a longer window or set an override.</>
          )
        ) : (
          <>
            {fmtUSD(monthly)} a month{settings.overrideOn ? ' (override)' : ''}
            {lastStep ? `, rising in steps to ${fmtUSD(lastStep.monthly)} from ${lastStep.age}` : ''} · {baseRate}% a year assumed
            {settings.feeDragPct ? ` less ${settings.feeDragPct}% fees` : ''} · {plural(years, 'year')}
          </>
        )}
      </p>

      {/* pace windows */}
      <div className="mt-8 grid grid-cols-3 gap-2 sm:gap-4 max-w-xl">
        {pace.map((p) => {
          const on = p.window === settings.paceWindowDays
          return (
            <button
              key={p.window}
              type="button"
              aria-pressed={on}
              onClick={() => setSetting('paceWindowDays', p.window)}
              className={`text-left rounded-md border px-3 py-2.5 transition-colors ${on ? 'border-accent/60 bg-raised' : 'border-line hover:bg-raised/60'} ${settings.overrideOn ? 'opacity-60' : ''}`}
            >
              <div className="text-xs text-muted">Last {p.window} days</div>
              <div className={`tnum text-lg sm:text-xl font-medium ${on ? 'text-accent' : ''}`}>
                {fmtUSD(p.monthly)}
                <span className="text-xs text-muted font-normal">/mo</span>
              </div>
              <div className="text-[11px] text-dim tnum">
                {fmtUSD(p.sum)} in {plural(p.count, 'entry', 'entries')}
                {p.truncated ? ` · ${p.effectiveDays}d of history` : ''}
              </div>
            </button>
          )
        })}
      </div>
      {disagree && !settings.overrideOn && (
        <p className="mt-3 text-xs text-muted max-w-xl">
          Your windows disagree. A short window is mostly noise; the 365-day figure is the one that resembles a habit.
        </p>
      )}
      {settings.overrideOn && <p className="mt-3 text-xs text-muted">Pace windows are shown for reference; the manual override is driving the projection.</p>}

      {/* rate columns */}
      <div className="mt-8 grid grid-cols-5 gap-1 sm:gap-2">
        {RATES.map((r) => {
          const on = r === baseRate
          return (
            <button
              key={r}
              type="button"
              aria-pressed={on}
              onClick={() => setSetting('baseRate', r)}
              className={`text-left rounded-md px-2 sm:px-3 py-2 border transition-colors ${on ? 'border-accent/60 bg-raised' : 'border-transparent hover:bg-raised/60'}`}
            >
              <div className={`text-xs ${on ? 'text-accent' : 'text-muted'}`}>{r}%</div>
              <div className={`tnum text-sm sm:text-lg font-medium ${on ? '' : 'text-muted'}`}>{fmtCompact(results[r].ending)}</div>
            </button>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-dim">
        Ending balance at each assumed annual return. Historical U.S. stock returns average about 10% nominal before fees. The 20% and 25% columns
        are here to show how compounding behaves, not to be planned on.
      </p>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Full projection section                                             */
/* ------------------------------------------------------------------ */

function AgeEditor({ settings, setSetting }) {
  const s = settings
  const age = ageFrom(s.birthDate)
  return (
    <div className="col-span-2 grid grid-cols-2 gap-x-4 gap-y-5">
      <Labeled label="Date of birth" hint={age ? 'Age updates itself from this.' : 'Optional. Leave blank to type an age.'}>
        <input
          type="date"
          className="field"
          value={s.birthDate || ''}
          max={today()}
          onChange={(e) => {
            const v = e.target.value
            const a = ageFrom(v)
            setSetting('birthDate', a ? v : '')
          }}
        />
      </Labeled>
      <Labeled label="Current age" hint={age ? `${age.years} years, ${plural(age.months, 'month')} · next birthday ${fmtDateShort(age.nextBirthday)}` : 'Whole years.'}>
        {age ? (
          <div className="field flex items-center justify-between text-muted">
            <span className="tnum text-fg">{age.years}</span>
            <button type="button" className="text-xs hover:text-fg" onClick={() => setSetting('birthDate', '')}>
              edit manually
            </button>
          </div>
        ) : (
          <NumInput value={s.currentAge} min={0} max={120} onChange={(v) => setSetting('currentAge', Math.round(v))} />
        )}
      </Labeled>
    </div>
  )
}

/** Contribution by age: flat steps, nothing compounds on its own. */
function StepsEditor({ settings, setSetting }) {
  const s = settings
  const steps = [...(s.contributionSteps || [])].sort((a, b) => a.age - b.age)
  const save = (next) => setSetting('contributionSteps', next.filter((st) => Number.isFinite(st.age) && Number.isFinite(st.monthly)))
  const update = (i, patch) => {
    const next = steps.map((st, j) => (j === i ? { ...st, ...patch } : st))
    save(next)
  }
  const add = () => {
    const last = steps[steps.length - 1]
    const age = Math.min(s.retireAge - 1, Math.max(s.currentAge + 1, last ? last.age + 4 : s.currentAge + 3))
    const monthly = last ? Math.round(last.monthly * 1.5) : Math.max(100, Math.round((s.overrideOn ? s.overrideAmount : 200) * 2))
    save([...steps, { age, monthly }])
  }
  const preview = []
  if (steps.length) {
    preview.push(`${s.currentAge}–${steps[0].age - 1}: current pace`)
    steps.forEach((st, i) => {
      const end = i + 1 < steps.length ? steps[i + 1].age - 1 : null
      preview.push(`${st.age}${end != null ? `–${end}` : '+'}: ${fmtUSD(st.monthly)}/mo`)
    })
  }
  return (
    <div className="col-span-2 sm:col-span-4">
      <div className="flex items-baseline justify-between">
        <span className="label">Contribution by age</span>
        <span className="text-xs text-dim">Flat between steps. Nothing compounds on its own.</span>
      </div>
      {steps.length === 0 ? (
        <p className="text-sm text-muted mt-2">
          The current pace is assumed all the way to {s.retireAge}. Add a step to say what you expect to put in from a given age, for example a first job at 18 or a raise at 25.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {steps.map((st, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted">from age</span>
              <NumInput value={st.age} min={s.currentAge + 1} max={s.retireAge} className="w-20" onChange={(v) => update(i, { age: Math.round(v) })} aria-label="Step age" />
              <span className="text-muted">put in</span>
              <NumInput prefix="$" value={st.monthly} min={0} suffix="/mo" className="w-40" onChange={(v) => update(i, { monthly: v })} aria-label="Step monthly contribution" />
              <button type="button" className="btn btn-ghost btn-sm hover:text-warn" onClick={() => save(steps.filter((_, j) => j !== i))} aria-label="Remove step">
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-ghost btn-sm" onClick={add}>
          + Add age step
        </button>
        {preview.length > 0 && <span className="text-xs text-dim tnum">{preview.join(' · ')}</span>}
      </div>
    </div>
  )
}

function Inputs({ settings, setSetting }) {
  const s = settings
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-5">
      <AgeEditor settings={s} setSetting={setSetting} />
      <Labeled label="Retirement age">
        <NumInput value={s.retireAge} min={0} max={120} onChange={(v) => setSetting('retireAge', Math.round(v))} />
      </Labeled>
      <Labeled label="Fee drag" hint="Expense ratios, advisory fees. Subtracted before compounding.">
        <NumInput value={s.feeDragPct} min={0} max={10} step={0.01} suffix="%/yr" onChange={(v) => setSetting('feeDragPct', v)} />
      </Labeled>
      <Labeled label="Inflation" hint={s.realDollars ? 'Applied to returns and escalation.' : "Only used in today's-dollars mode."}>
        <NumInput value={s.inflationPct} min={0} max={30} step={0.1} suffix="%/yr" onChange={(v) => setSetting('inflationPct', v)} />
      </Labeled>
      <Labeled label="Withdrawal rate" hint="An assumption, not a rule.">
        <NumInput value={s.withdrawalRatePct} min={0} max={20} step={0.1} suffix="%/yr" onChange={(v) => setSetting('withdrawalRatePct', v)} />
      </Labeled>
      <div className="col-span-2">
        <span className="label block mb-1.5">Dollars</span>
        <Seg options={DOLLAR_OPTS} value={s.realDollars} onChange={(v) => setSetting('realDollars', v)} ariaLabel="Nominal or real dollars" />
        <span className="block mt-1 text-xs text-dim">
          {s.realDollars
            ? "Real return = (1 + nominal) / (1 + inflation) − 1. Contribution amounts below are read as today's dollars."
            : 'Future dollars, not adjusted for inflation.'}
        </span>
      </div>
      <StepsEditor settings={s} setSetting={setSetting} />
      <div className="col-span-2 sm:col-span-4 flex flex-wrap items-end gap-3 pt-1">
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none min-h-[42px]">
          <input type="checkbox" className="accent-accent w-4 h-4" checked={s.overrideOn} onChange={(e) => setSetting('overrideOn', e.target.checked)} />
          Override pace with a manual contribution
        </label>
        {s.overrideOn && (
          <>
            <NumInput prefix="$" value={s.overrideAmount} min={0} className="w-36" onChange={(v) => setSetting('overrideAmount', v)} aria-label="Override amount" />
            <select className="field w-36" value={s.overrideFrequency} onChange={(e) => setSetting('overrideFrequency', e.target.value)} aria-label="Override frequency">
              {Object.keys(FREQ_PER_YEAR).map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
    </div>
  )
}

function Split({ base, baseRate, settings }) {
  const { ending, contributed, growth } = base
  const depShare = ending > 0 ? Math.min(100, Math.max(0, (contributed / ending) * 100)) : 0
  const growShare = 100 - depShare
  const wr = settings.withdrawalRatePct / 100
  return (
    <div>
      <div className="grid grid-cols-3 gap-4">
        <Stat label={`Ending balance at ${baseRate}%`} value={<AnimatedNumber value={ending} format={fmtUSD} />} accent />
        <Stat label="You put in" value={<AnimatedNumber value={contributed} format={fmtUSD} />} sub={`${depShare.toFixed(0)}% of the total`} />
        <Stat label="Growth" value={<AnimatedNumber value={growth} format={fmtUSD} />} sub={`${growShare.toFixed(0)}% of the total`} warn={growth < 0} />
      </div>
      <div className="mt-4 flex h-2 rounded overflow-hidden" aria-hidden="true">
        <div className="h-full transition-[width] duration-700 ease-out" style={{ width: `${depShare}%`, background: C.dim }} />
        <div className="h-full transition-[width] duration-700 ease-out" style={{ width: `${growShare}%`, background: C.fg }} />
      </div>
      <p className="mt-4 note">
        At a {settings.withdrawalRatePct}% withdrawal rate, which is an assumption and not a promise, that balance would pay about{' '}
        <span className="tnum text-fg">{fmtUSD(ending * wr)}</span> a year, or <span className="tnum text-fg">{fmtUSD((ending * wr) / 12)}</span> a month
        {settings.realDollars ? " in today's dollars" : ' in future dollars'}.
      </p>
    </div>
  )
}

function SolveFor({ derived, settings, setSetting }) {
  const { ctx, baseRate, monthly } = derived
  const target = settings.solveTarget
  const sol = useMemo(() => solveMonthlyForTarget(target, baseRate, ctx), [target, baseRate, ctx])
  const diff = sol.monthly == null ? null : sol.monthly - monthly
  return (
    <div className="grid sm:grid-cols-[14rem_1fr] gap-4 items-start">
      <Labeled label="Target ending balance">
        <NumInput prefix="$" value={target} min={0} onChange={(v) => setSetting('solveTarget', v)} />
      </Labeled>
      <div>
        <div className="label">Flat monthly contribution required at {baseRate}%{settings.contributionSteps?.length ? ' (ignoring age steps)' : ''}</div>
        <div className="tnum text-2xl sm:text-3xl font-semibold tracking-tight mt-0.5">
          {sol.alreadyThere ? '$0' : <AnimatedNumber value={sol.monthly ?? 0} format={fmtUSD} />}
        </div>
        <p className="text-xs text-dim mt-1 tnum">
          {sol.alreadyThere
            ? 'The current balance alone gets there at this rate, if the rate holds.'
            : diff > 0
              ? `${fmtUSD(diff)} a month more than the current pace.`
              : `${fmtUSD(-diff)} a month less than the current pace.`}
        </p>
      </div>
    </div>
  )
}

function BalanceChart({ derived, settings }) {
  const { results, baseRate } = derived
  const [log, setLog] = useState(false)
  const data = useMemo(() => {
    const n = results[baseRate].years.length
    const out = []
    for (let i = 0; i < n; i++) {
      const row = { age: results[baseRate].years[i].age }
      for (const r of RATES) row[`r${r}`] = log ? Math.max(1, results[r].years[i].balance) : results[r].years[i].balance
      out.push(row)
    }
    return out
  }, [results, baseRate, log])
  if (data.length < 2) return null
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium">Balance to {settings.retireAge}, one line per assumed return</h3>
        <button type="button" className={`btn btn-ghost btn-sm ${log ? 'text-accent' : ''}`} aria-pressed={log} onClick={() => setLog((v) => !v)}>
          Log scale
        </button>
      </div>
      <Frame height={280}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <XAxis dataKey="age" {...axis} tickFormatter={(v) => `${v}`} minTickGap={24} />
          <YAxis {...axis} width={48} scale={log ? 'log' : 'auto'} domain={log ? ['auto', 'auto'] : [0, 'auto']} tickFormatter={fmtCompact} allowDataOverflow />
          <Tooltip
            cursor={cursor}
            content={
              <Tip
                title={(l) => `Age ${l}`}
                rows={(p) =>
                  [...p].reverse().map((x) => ({ label: `${x.dataKey.slice(1)}%`, value: fmtUSD(x.value), color: x.stroke, strong: x.dataKey === `r${baseRate}` }))
                }
              />
            }
          />
          {RATES.map((r) => (
            <Line key={r} type="monotone" dataKey={`r${r}`} stroke={rateColor(r, baseRate)} strokeWidth={r === baseRate ? 2.25 : 1.25} dot={false} isAnimationActive={false} />
          ))}
        </LineChart>
      </Frame>
    </div>
  )
}

function SplitChart({ derived, settings }) {
  const { base, baseRate } = derived
  const data = useMemo(() => base.years.map((y) => ({ age: y.age, contributed: y.contributed, growth: Math.max(0, y.growth), rawGrowth: y.growth })), [base])
  const crossover = useMemo(() => base.years.find((y) => y.year > 0 && y.growth > y.contributed), [base])
  if (data.length < 2) return null
  return (
    <div>
      <h3 className="text-sm font-medium mb-2">What you put in vs. what the market adds, at {baseRate}%</h3>
      <Frame height={240}>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <XAxis dataKey="age" {...axis} minTickGap={24} />
          <YAxis {...axis} width={48} tickFormatter={fmtCompact} />
          <Tooltip
            cursor={cursor}
            content={
              <Tip
                title={(l) => `Age ${l}`}
                rows={(p) => {
                  const row = p[0]?.payload
                  return [
                    { label: 'Put in', value: fmtUSD(row.contributed), color: C.dim },
                    { label: 'Growth', value: fmtUSD(row.rawGrowth), color: C.fg, strong: true },
                  ]
                }}
              />
            }
          />
          <Area type="monotone" dataKey="contributed" stackId="1" stroke="none" fill={C.dim} fillOpacity={0.9} isAnimationActive={false} />
          <Area type="monotone" dataKey="growth" stackId="1" stroke="none" fill={C.fg} fillOpacity={0.85} isAnimationActive={false} />
        </AreaChart>
      </Frame>
      <p className="note mt-2">
        {crossover ? (
          <>
            Around age <span className="text-fg tnum">{crossover.age}</span>, {plural(crossover.year, 'year')} from now, growth overtakes what you have put in. From
            there the market is contributing more than you are, if {baseRate}% holds.
          </>
        ) : (
          <>At {baseRate}%, growth never overtakes contributions before {settings.retireAge}. Your deposits are doing the work the whole way.</>
        )}
      </p>
    </div>
  )
}

function PaceChart({ entries, derived }) {
  const { paceMonthly, selectedPace } = derived
  const data = useMemo(() => paceSeries(entries, paceMonthly * 12), [entries, paceMonthly])
  if (data.length < 2) return null
  const fmtT = (t) => new Date(t).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  return (
    <div>
      <h3 className="text-sm font-medium mb-2">Actual cumulative deposits vs. the {selectedPace.window}-day pace line</h3>
      <Frame height={220}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} horizontal={false} />
          <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} {...axis} tickFormatter={fmtT} minTickGap={40} />
          <YAxis {...axis} width={48} tickFormatter={fmtCompact} />
          <Tooltip
            cursor={cursor}
            content={
              <Tip
                title={(l) => new Date(l).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                rows={(p) => {
                  const row = p[0]?.payload
                  return [
                    { label: 'Actual', value: fmtUSD(row.actual), color: C.fg, strong: true },
                    { label: 'Pace line', value: fmtUSD(row.pace), color: C.accent },
                  ]
                }}
              />
            }
          />
          <Line type="stepAfter" dataKey="actual" stroke={C.fg} strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line type="linear" dataKey="pace" stroke={C.accent} strokeWidth={1.25} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
        </ComposedChart>
      </Frame>
      <p className="text-xs text-dim mt-2">Actual includes every entry, even ones flagged as not your pace. The pace line is the selected window extended back to your first entry.</p>
    </div>
  )
}

export default function Projection({ derived, settings, setSetting, entries }) {
  const { base, baseRate } = derived
  const years = yearsToRetire(settings)
  return (
    <Section id="projection" title="Projection" lede="Straight-line compounding from the pace above. Every number here is a projection from the assumptions below, not a forecast.">
      <Inputs settings={settings} setSetting={setSetting} />
      {years === 0 && <Callout warn>Retirement age is not after current age, so there is nothing to project.</Callout>}
      <div className="rule my-10" />
      <Split base={base} baseRate={baseRate} settings={settings} />
      <div className="rule my-10" />
      <SolveFor derived={derived} settings={settings} setSetting={setSetting} />
      <div className="rule my-10" />
      <div className="space-y-12">
        <BalanceChart derived={derived} settings={settings} />
        <SplitChart derived={derived} settings={settings} />
        <PaceChart entries={entries} derived={derived} />
      </div>
    </Section>
  )
}
