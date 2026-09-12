import { useState } from 'react'
import { Bar, BarChart, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts'
import { ACCOUNT_TYPES } from '../lib/storage.js'
import { monthLabel } from '../lib/money.js'
import { fmtUSD, fmtCompact, fmtPct, fmtDateShort, plural } from '../lib/format.js'
import { href } from '../hooks/useRoute.js'
import { AnimatedNumber, NumInput, Section, Stat, Labeled, Callout } from './ui.jsx'
import { C, axis, cursor, Frame, Tip } from './charts.jsx'
import { DataTools } from './Logging.jsx'

function ProgressBar({ pct, warn = false, className = '' }) {
  return (
    <div className={`h-1.5 rounded bg-line overflow-hidden ${className}`} aria-hidden="true">
      <div className={`h-full transition-[width] duration-700 ease-out ${warn ? 'bg-warn' : 'bg-fg'}`} style={{ width: `${Math.min(100, Math.max(0, pct * 100))}%` }} />
    </div>
  )
}

function AccountRow({ a, actions }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(a.balance)
  const typeLabel = ACCOUNT_TYPES.find((t) => t.value === a.type)?.label ?? a.type
  return (
    <li className="py-2.5 flex items-center gap-3 group">
      <input
        className="bg-transparent border-b border-transparent hover:border-line focus:border-muted text-sm py-0.5 min-w-0 grow outline-none"
        value={a.name}
        onChange={(e) => actions.updateAccount(a.id, { name: e.target.value })}
        aria-label="Account name"
      />
      <select className="bg-transparent text-xs text-muted outline-none" value={a.type} onChange={(e) => actions.updateAccount(a.id, { type: e.target.value })} aria-label="Account type">
        {ACCOUNT_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      {editing ? (
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault()
            actions.reconcileAccount(a.id, val, a.balance)
            setEditing(false)
          }}
        >
          <NumInput prefix="$" value={val} onChange={setVal} className="w-32" autoFocus aria-label={`${a.name} balance now`} />
          <button type="submit" className="btn btn-sm btn-primary">
            Set
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing(false)}>
            ✕
          </button>
        </form>
      ) : (
        <button
          type="button"
          className={`tnum text-sm text-right w-28 hover:text-accent ${a.isDebt && a.balance > 0 ? 'text-warn' : ''}`}
          title="Click to set the balance as of today"
          onClick={() => {
            setVal(a.balance)
            setEditing(true)
          }}
        >
          {a.isDebt && a.balance > 0 ? '−' : ''}
          {fmtUSD(Math.abs(a.balance))}
        </button>
      )}
      <button
        type="button"
        className="btn btn-ghost btn-sm hover:text-warn sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
        onClick={() => {
          if (window.confirm(`Delete ${a.name} (${typeLabel}) and every transaction on it?`)) actions.deleteAccount(a.id)
        }}
        aria-label={`Delete ${a.name}`}
      >
        Delete
      </button>
    </li>
  )
}

function Accounts({ derived, actions }) {
  const { accts } = derived.money
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState('checking')
  const [opening, setOpening] = useState(0)
  const assets = accts.filter((a) => !a.isDebt)
  const debts = accts.filter((a) => a.isDebt)
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-sm font-medium text-muted">Accounts</h3>
        <span className="text-xs text-dim">Click a balance to set what it is today</span>
      </div>
      <ul className="divide-y divide-line">
        {assets.map((a) => (
          <AccountRow key={a.id} a={a} actions={actions} />
        ))}
        {debts.map((a) => (
          <AccountRow key={a.id} a={a} actions={actions} />
        ))}
      </ul>
      {adding ? (
        <form
          className="mt-3 flex flex-wrap items-end gap-2 border-l-2 border-line pl-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim()) return
            actions.addAccount({ name, type, openingBalance: opening })
            setName('')
            setOpening(0)
            setAdding(false)
          }}
        >
          <Labeled label="Name" className="grow min-w-32">
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Brokerage cash" />
          </Labeled>
          <Labeled label="Type">
            <select className="field" value={type} onChange={(e) => setType(e.target.value)}>
              {ACCOUNT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label={type === 'credit' || type === 'loan' ? 'Owed today' : 'Balance today'}>
            <NumInput prefix="$" value={opening} min={0} onChange={setOpening} className="w-36" />
          </Labeled>
          <button type="submit" className="btn">
            Add
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setAdding(false)}>
            Cancel
          </button>
        </form>
      ) : (
        <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={() => setAdding(true)}>
          + Add account
        </button>
      )}
    </div>
  )
}

export default function Overview({ state, derived, actions, setSetting }) {
  const { money, base, baseRate, monthly } = derived
  const { nw, thisMonth, series, budgets, upcoming, emergency, fire } = money
  const s = state.settings
  const m = thisMonth
  const snaps = state.snapshots
  const topBudgets = budgets.rows.filter((r) => r.budget != null).slice(0, 5)
  const hasAnything = state.transactions.length > 0 || state.entries.length > 0 || money.accts.some((a) => a.balance !== 0)

  return (
    <>
      <section className="pt-10 sm:pt-14 pb-8">
        <p className="text-sm text-muted">Net worth today</p>
        <div className={`mt-1 text-5xl sm:text-7xl font-semibold tracking-tight leading-none ${nw.netWorth < 0 ? 'text-warn' : 'text-accent'}`}>
          <AnimatedNumber value={nw.netWorth} format={(v) => (v < 0 ? `−${fmtUSD(-v)}` : fmtUSD(v))} />
        </div>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl">
          <Stat label="Cash" value={<AnimatedNumber value={nw.cash} format={fmtUSD} />} />
          <Stat label="Investments" value={<AnimatedNumber value={nw.investments} format={fmtUSD} />} sub={derived.currentCount ? 'current value' : 'cost basis'} />
          <Stat label="Debt" value={<AnimatedNumber value={nw.liabilities} format={fmtUSD} />} warn={nw.liabilities > 0} />
          <Stat
            label={`Projected at ${s.retireAge}`}
            value={<AnimatedNumber value={base.ending} format={fmtCompact} />}
            sub={
              <a href={href('plan')} className="hover:text-fg underline-offset-2 hover:underline">
                {fmtUSD(monthly)}/mo at {baseRate}% · see plan
              </a>
            }
          />
        </div>
        {!hasAnything && (
          <p className="note mt-6 max-w-2xl">
            Empty for now. Set your account balances below, log spending under <a href={href('spend')} className="text-fg underline underline-offset-2">Spending</a>, and
            investment deposits under <a href={href('invest')} className="text-fg underline underline-offset-2">Investing</a>. Everything here fills in from those.
          </p>
        )}
      </section>

      <Section id="month" title={`${monthLabel(m.month)}`} lede="Cash flow this month. Invested counts as saved, not spent.">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <Stat label="Income" value={<AnimatedNumber value={m.income} format={fmtUSD} />} />
          <Stat label="Spent" value={<AnimatedNumber value={m.expenses} format={fmtUSD} />} />
          <Stat label="Invested" value={<AnimatedNumber value={m.invested} format={fmtUSD} />} />
          <Stat label="Left over" value={<AnimatedNumber value={m.net} format={(v) => (v < 0 ? `−${fmtUSD(-v)}` : fmtUSD(v))} />} warn={m.net < 0} />
          <Stat label="Savings rate" value={m.savingsRate == null ? '—' : fmtPct(m.savingsRate * 100, 0)} sub={m.investedRate != null ? `${fmtPct(m.investedRate * 100, 0)} invested` : 'income − spending'} warn={m.savingsRate != null && m.savingsRate < 0} />
        </div>
        {series.some((x) => x.income || x.expenses) && (
          <div className="mt-6">
            <Frame height={180}>
              <BarChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} barGap={2}>
                <XAxis dataKey="label" {...axis} />
                <YAxis {...axis} width={44} tickFormatter={fmtCompact} />
                <Tooltip
                  cursor={{ fill: '#1a1e26' }}
                  content={
                    <Tip
                      title={(l, p) => monthLabel(p[0]?.payload.month ?? '')}
                      rows={(p) => {
                        const r = p[0]?.payload
                        return [
                          { label: 'Income', value: fmtUSD(r.income), color: C.fg, strong: true },
                          { label: 'Spent', value: fmtUSD(r.expenses), color: C.dim },
                          { label: 'Invested', value: fmtUSD(r.invested), color: C.accent },
                        ]
                      }}
                    />
                  }
                />
                <Bar dataKey="income" fill={C.fg} isAnimationActive={false} radius={[2, 2, 0, 0]} />
                <Bar dataKey="expenses" fill={C.dim} isAnimationActive={false} radius={[2, 2, 0, 0]} />
                <Bar dataKey="invested" fill={C.accent} isAnimationActive={false} radius={[2, 2, 0, 0]} />
              </BarChart>
            </Frame>
            <p className="text-xs text-dim mt-1">Last 12 months. White: income. Grey: spending. Gold: invested.</p>
          </div>
        )}

        <div className="mt-8 grid md:grid-cols-2 gap-10">
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <h3 className="text-sm font-medium text-muted">Budgets</h3>
              <a href={href('spend', 'budgets')} className="text-xs text-dim hover:text-fg">
                all budgets
              </a>
            </div>
            {topBudgets.length === 0 ? (
              <p className="note">
                No budgets set.{' '}
                <a href={href('spend', 'budgets')} className="text-fg underline underline-offset-2">
                  Add monthly limits
                </a>{' '}
                to see pace against them here.
              </p>
            ) : (
              <ul className="space-y-3">
                {topBudgets.map((r) => (
                  <li key={r.cat.id}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span>{r.cat.name}</span>
                      <span className={`tnum text-xs ${r.over ? 'text-warn' : 'text-muted'}`}>
                        {fmtUSD(r.spent)} / {fmtUSD(r.budget)}
                      </span>
                    </div>
                    <ProgressBar pct={r.pct} warn={r.over} className="mt-1" />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <h3 className="text-sm font-medium text-muted">Next 30 days</h3>
              <a href={href('spend', 'recurring')} className="text-xs text-dim hover:text-fg">
                recurring
              </a>
            </div>
            {upcoming.length === 0 ? (
              <p className="note">
                No recurring items.{' '}
                <a href={href('spend', 'recurring')} className="text-fg underline underline-offset-2">
                  Add bills and paydays
                </a>{' '}
                and they post themselves.
              </p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {upcoming.slice(0, 7).map((u) => (
                  <li key={u.rec.id + u.date} className="py-1.5 flex items-center gap-3">
                    <span className="text-muted tnum w-14 shrink-0">{fmtDateShort(u.date)}</span>
                    <span className="grow truncate">{u.rec.name}</span>
                    <span className={`tnum ${u.rec.type === 'income' ? '' : 'text-muted'}`}>
                      {u.rec.type === 'income' ? '+' : '−'}
                      {fmtUSD(u.rec.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Section>

      <Section id="safety" title="Safety and the finish line" lede="Where spending meets the projection.">
        <div className="grid md:grid-cols-2 gap-10">
          <div>
            <Stat
              label="Emergency fund"
              value={emergency.months == null ? '—' : `${emergency.months.toFixed(1)} months`}
              sub={emergency.avgExpenses > 0 ? `${fmtUSD(nw.cash)} cash ÷ ${fmtUSD(emergency.avgExpenses)}/mo average spend` : 'log a month of spending to measure this'}
              warn={emergency.months != null && emergency.months < emergency.target}
            />
            {emergency.months != null && <ProgressBar pct={emergency.months / emergency.target} warn={emergency.months < emergency.target} className="mt-3 max-w-sm" />}
            <div className="mt-3 flex items-center gap-3">
              <span className="label">Target</span>
              <NumInput value={s.emergencyMonthsTarget} min={0} max={36} suffix="mo" className="w-24" onChange={(v) => setSetting('emergencyMonthsTarget', v)} aria-label="Emergency fund target in months" />
              {emergency.shortfall > 0 && <span className="text-xs text-muted tnum">{fmtUSD(emergency.shortfall)} short</span>}
            </div>
          </div>
          <div>
            {fire.number ? (
              <>
                <Stat label={`Enough to live on at ${s.withdrawalRatePct}%`} value={<AnimatedNumber value={fire.number} format={fmtUSD} />} sub={`${fmtUSD(fire.annualExpenses)} a year, ${emergency.basisMonths > 0 ? `${plural(emergency.basisMonths, 'month')} average` : 'this month so far'} ÷ ${s.withdrawalRatePct}%`} />
                <p className="note mt-3">
                  {fire.crossAge ? (
                    <>
                      At the current pace and {baseRate}%, the projection crosses that around age <span className="text-fg tnum">{fire.crossAge}</span>
                      {fire.crossAge < s.retireAge ? `, ${plural(s.retireAge - fire.crossAge, 'year')} before your retirement age.` : '.'}
                    </>
                  ) : (
                    <>
                      At the current pace and {baseRate}%, the projection does not reach that before {s.retireAge}. Spending less moves the target; investing more moves the line.
                    </>
                  )}{' '}
                  Both halves of that sentence are assumptions you typed in.
                </p>
              </>
            ) : (
              <Callout>Once a month of spending is logged, this shows the balance that could fund it at your withdrawal rate, and when the projection gets there.</Callout>
            )}
          </div>
        </div>
      </Section>

      <Section id="accounts" title="Accounts" lede="Balances update from what you log. Investments come from the Investing tab.">
        <Accounts derived={derived} actions={actions} />
        {snaps.length >= 2 && (
          <div className="mt-10">
            <h3 className="text-sm font-medium text-muted mb-2">Net worth by month</h3>
            <Frame height={160}>
              <LineChart data={snaps} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <XAxis dataKey="month" {...axis} tickFormatter={(v) => monthLabel(v, { short: true })} minTickGap={30} />
                <YAxis {...axis} width={48} tickFormatter={fmtCompact} />
                <Tooltip cursor={cursor} content={<Tip title={(l) => monthLabel(l)} rows={(p) => [{ label: 'Net worth', value: fmtUSD(p[0].value), color: C.fg, strong: true }]} />} />
                <Line type="monotone" dataKey="netWorth" stroke={C.fg} strokeWidth={1.75} dot={false} isAnimationActive={false} />
              </LineChart>
            </Frame>
            <p className="text-xs text-dim mt-1">One point per month, recorded whenever the app is open.</p>
          </div>
        )}
        <div className="rule mt-10 pt-4">
          <h3 className="text-sm font-medium text-muted mb-2">Your data</h3>
          <DataTools state={state} onImport={actions.replaceState} onReset={actions.resetAll} />
          <p className="text-xs text-dim mt-2">Stored only on this computer. Export a backup now and then.</p>
        </div>
      </Section>
    </>
  )
}
