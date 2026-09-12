import { useState } from 'react'
import { Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts'
import { today } from '../lib/storage.js'
import { addMonths, monthLabel } from '../lib/money.js'
import { fmtUSD, fmtCompact, fmtPct, fmtDate, plural } from '../lib/format.js'
import { href } from '../hooks/useRoute.js'
import { AnimatedNumber, NumInput, Seg, Section, Stat, Labeled, Callout } from './ui.jsx'
import { C, axis, cursor, Frame, Tip } from './charts.jsx'

const STRATEGY_OPTS = [
  { value: 'avalanche', label: 'Avalanche · highest rate first' },
  { value: 'snowball', label: 'Snowball · smallest first' },
]

function ProgressBar({ pct, warn = false, className = '' }) {
  return (
    <div className={`h-1.5 rounded bg-line overflow-hidden ${className}`} aria-hidden="true">
      <div className={`h-full transition-[width] duration-700 ease-out ${warn ? 'bg-warn' : 'bg-fg'}`} style={{ width: `${Math.min(100, Math.max(0, pct * 100))}%` }} />
    </div>
  )
}

const monthsToLabel = (n) => {
  if (!Number.isFinite(n)) return 'never'
  const y = Math.floor(n / 12)
  const m = n % 12
  return [y ? plural(y, 'year') : null, m ? plural(m, 'month') : null].filter(Boolean).join(' ') || 'now'
}

function Debts({ derived, settings, setSetting, actions }) {
  const { debts, payoff, payoffMinOnly, accts } = derived.money
  const debtAccts = accts.filter((a) => a.isDebt)
  const total = debts.reduce((a, d) => a + d.balance, 0)
  const start = today().slice(0, 7)
  const saved = Number.isFinite(payoffMinOnly.totalInterest) && Number.isFinite(payoff.totalInterest) ? payoffMinOnly.totalInterest - payoff.totalInterest : null
  const chart = payoff.schedule.filter((_, i) => i % Math.max(1, Math.ceil(payoff.schedule.length / 120)) === 0 || i === payoff.schedule.length - 1).map((p) => ({ ...p, label: addMonths(start, p.month) }))

  return (
    <Section id="debts" title="Debts" lede="Balances come from the credit and loan accounts. Set the rate and minimum here; the planner does the rest.">
      {debtAccts.length === 0 ? (
        <Callout>
          No credit cards or loans yet. Add one under{' '}
          <a href={href('overview', 'accounts')} className="text-fg underline underline-offset-2">
            Accounts
          </a>{' '}
          with the amount owed, and the payoff plan appears here.
        </Callout>
      ) : (
        <>
          <ul className="divide-y divide-line">
            {debtAccts.map((a) => (
              <li key={a.id} className="py-3 grid grid-cols-2 sm:grid-cols-[1fr_8rem_8rem_8rem] gap-3 items-end">
                <div>
                  <div className="text-sm">{a.name}</div>
                  <div className={`tnum text-lg font-medium ${a.balance > 0 ? 'text-warn' : ''}`}>{fmtUSD(a.balance)}</div>
                </div>
                <Labeled label="APR">
                  <NumInput value={a.apr} min={0} max={100} step={0.1} suffix="%" onChange={(v) => actions.updateAccount(a.id, { apr: v })} />
                </Labeled>
                <Labeled label="Minimum / mo">
                  <NumInput prefix="$" value={a.minPayment} min={0} onChange={(v) => actions.updateAccount(a.id, { minPayment: v })} />
                </Labeled>
                <div className="text-xs text-dim tnum pb-2">
                  {a.balance > 0 && a.apr > 0 ? `${fmtUSD((a.balance * a.apr) / 100 / 12)}/mo interest` : ''}
                </div>
              </li>
            ))}
          </ul>

          {total > 0 && (
            <>
              <div className="mt-8 grid sm:grid-cols-[1fr_auto] gap-4 items-end">
                <div>
                  <span className="label block mb-1.5">Strategy</span>
                  <Seg options={STRATEGY_OPTS} value={settings.debtStrategy} onChange={(v) => setSetting('debtStrategy', v)} ariaLabel="Payoff strategy" />
                </div>
                <Labeled label="Extra per month, on top of minimums">
                  <NumInput prefix="$" value={settings.debtExtraMonthly} min={0} className="w-44" onChange={(v) => setSetting('debtExtraMonthly', v)} />
                </Labeled>
              </div>

              {payoff.status === 'never' ? (
                <Callout warn>
                  At {fmtUSD(payoff.budget)} a month the balance is not shrinking; interest outruns the payments. Raise the minimums or the extra amount until it does.
                </Callout>
              ) : (
                <>
                  <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <Stat label="Debt free in" value={monthsToLabel(payoff.months)} sub={payoff.months ? monthLabel(addMonths(start, payoff.months)) : ''} accent />
                    <Stat label="Total interest" value={<AnimatedNumber value={payoff.totalInterest} format={fmtUSD} />} warn />
                    <Stat label="Paying" value={`${fmtUSD(payoff.budget)}/mo`} sub="minimums + extra, held constant" />
                    <Stat
                      label="vs. minimums only"
                      value={saved != null && saved > 0 ? `${fmtUSD(saved)} saved` : settings.debtExtraMonthly > 0 ? '—' : 'add an extra amount'}
                      sub={
                        settings.debtExtraMonthly > 0
                          ? Number.isFinite(payoffMinOnly.months)
                            ? `${monthsToLabel(payoffMinOnly.months)} at minimums`
                            : 'minimums alone never clear it'
                          : 'to see the interest it saves'
                      }
                    />
                  </div>
                  <div className="mt-6">
                    <Frame height={160}>
                      <LineChart data={chart} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                        <XAxis dataKey="label" {...axis} tickFormatter={(v) => monthLabel(v, { short: true })} minTickGap={30} />
                        <YAxis {...axis} width={48} tickFormatter={fmtCompact} />
                        <Tooltip cursor={cursor} content={<Tip title={(l) => monthLabel(l)} rows={(p) => [{ label: 'Owed', value: fmtUSD(p[0].value), color: C.warn, strong: true }]} />} />
                        <Line type="monotone" dataKey="balance" stroke={C.warn} strokeWidth={1.75} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </Frame>
                  </div>
                  <ol className="mt-4 text-sm divide-y divide-line">
                    {payoff.order.map((d, i) => (
                      <li key={d.id} className="py-2 flex items-center gap-3">
                        <span className="text-dim tnum w-5">{i + 1}.</span>
                        <span className="grow">{d.name}</span>
                        <span className="text-muted text-xs tnum">{fmtUSD(d.interest)} interest</span>
                        <span className="tnum w-24 text-right">{d.paidOffMonth != null ? monthLabel(addMonths(start, d.paidOffMonth), { short: true }) : '—'}</span>
                      </li>
                    ))}
                  </ol>
                  <p className="note mt-3">
                    Avalanche pays the least interest. Snowball clears the first balance sooner, which some people need to keep going. Either beats paying minimums.
                    Interest here is APR ÷ 12 on the running balance, which is how card and loan statements compute it.
                  </p>
                </>
              )}
            </>
          )}
        </>
      )}
    </Section>
  )
}

function GoalForm({ state, actions, onDone }) {
  const [g, setG] = useState({ name: '', target: '', accountId: '', saved: 0, deadline: '' })
  const set = (k, v) => setG((x) => ({ ...x, [k]: v }))
  return (
    <form
      className="mt-3 border-l-2 border-line pl-3 grid grid-cols-2 sm:grid-cols-5 gap-3 items-end"
      onSubmit={(e) => {
        e.preventDefault()
        if (!g.name.trim() || !(Number(g.target) > 0)) return
        actions.addGoal({ ...g, target: Number(g.target), deadline: g.deadline || null })
        onDone()
      }}
    >
      <Labeled label="Goal" className="col-span-2">
        <input className="field" autoFocus value={g.name} onChange={(e) => set('name', e.target.value)} placeholder="House deposit, trip, new laptop…" />
      </Labeled>
      <Labeled label="Target">
        <NumInput prefix="$" value={g.target} min={0} onChange={(v) => set('target', v)} />
      </Labeled>
      <Labeled label="Tracks" hint="An account balance, or a number you update by hand.">
        <select className="field" value={g.accountId} onChange={(e) => set('accountId', e.target.value)}>
          <option value="">Manual amount</option>
          {state.accounts.filter((a) => !['credit', 'loan'].includes(a.type)).map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} balance
            </option>
          ))}
        </select>
      </Labeled>
      <Labeled label="By (optional)">
        <input type="date" className="field" value={g.deadline} min={today()} onChange={(e) => set('deadline', e.target.value)} />
      </Labeled>
      {!g.accountId && (
        <Labeled label="Saved so far">
          <NumInput prefix="$" value={g.saved} min={0} onChange={(v) => set('saved', v)} />
        </Labeled>
      )}
      <div className="flex gap-2 col-span-2">
        <button type="submit" className="btn btn-primary">
          Add goal
        </button>
        <button type="button" className="btn btn-ghost" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  )
}

function Goals({ state, derived, actions }) {
  const [adding, setAdding] = useState(false)
  const rows = derived.money.goalRows
  return (
    <Section id="goals" title="Goals" lede="Named targets with a date. Link one to a savings account and it tracks itself.">
      {rows.length === 0 && !adding && <p className="note">Nothing yet.</p>}
      <ul className="space-y-6">
        {rows.map(({ goal, saved, remaining, pct, monthsLeft, requiredMonthly, done }) => {
          const acct = goal.accountId ? state.accounts.find((a) => a.id === goal.accountId)?.name : null
          return (
            <li key={goal.id} className="group">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <input
                  className="bg-transparent border-b border-transparent hover:border-line focus:border-muted text-base font-medium py-0.5 min-w-0 grow outline-none"
                  value={goal.name}
                  onChange={(e) => actions.updateGoal(goal.id, { name: e.target.value })}
                  aria-label="Goal name"
                />
                <span className="tnum text-sm">
                  <span className={done ? 'text-accent' : ''}>{fmtUSD(saved)}</span> <span className="text-dim">of {fmtUSD(goal.target)}</span>
                </span>
                <button type="button" className="btn btn-ghost btn-sm hover:text-warn sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100" onClick={() => actions.deleteGoal(goal.id)}>
                  Delete
                </button>
              </div>
              <ProgressBar pct={pct} className="mt-2" />
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
                <span className="tnum">{fmtPct(pct * 100, 0)}</span>
                {acct ? <span>tracks {acct}</span> : <span className="flex items-center gap-1">saved <NumInput prefix="$" value={goal.saved} min={0} className="w-28" onChange={(v) => actions.updateGoal(goal.id, { saved: v })} aria-label="Saved so far" /></span>}
                <span className="flex items-center gap-1">
                  by <input type="date" className="field !min-h-8 !py-1 w-36 text-xs" value={goal.deadline ?? ''} onChange={(e) => actions.updateGoal(goal.id, { deadline: e.target.value || null })} aria-label="Deadline" />
                </span>
                {done ? (
                  <span className="text-accent">reached</span>
                ) : goal.deadline ? (
                  <span className="tnum">
                    {fmtUSD(requiredMonthly)}/mo needed · {monthsLeft > 0 ? `${monthsLeft.toFixed(0)} months to ${fmtDate(goal.deadline)}` : 'deadline passed'}
                  </span>
                ) : (
                  <span className="tnum">{fmtUSD(remaining)} to go</span>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      {adding ? (
        <GoalForm state={state} actions={actions} onDone={() => setAdding(false)} />
      ) : (
        <button type="button" className="btn btn-ghost btn-sm mt-4" onClick={() => setAdding(true)}>
          + Add goal
        </button>
      )}
    </Section>
  )
}

export default function DebtsGoals({ state, derived, actions, settings, setSetting }) {
  return (
    <>
      <Debts derived={derived} settings={settings} setSetting={setSetting} actions={actions} />
      <Goals state={state} derived={derived} actions={actions} />
    </>
  )
}
