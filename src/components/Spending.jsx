import { useEffect, useMemo, useRef, useState } from 'react'
import { FREQUENCIES, today } from '../lib/storage.js'
import { monthLabel, addMonths, perMonth } from '../lib/money.js'
import { fmtUSD, fmtPct, fmtDateShort, plural } from '../lib/format.js'
import { AnimatedNumber, NumInput, Seg, Section, Stat, Labeled } from './ui.jsx'

const TYPE_OPTS = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfer' },
]

function ProgressBar({ pct, warn = false, className = '' }) {
  return (
    <div className={`h-1.5 rounded bg-line overflow-hidden ${className}`} aria-hidden="true">
      <div className={`h-full transition-[width] duration-700 ease-out ${warn ? 'bg-warn' : 'bg-fg'}`} style={{ width: `${Math.min(100, Math.max(0, (pct ?? 0) * 100))}%` }} />
    </div>
  )
}

function MonthPicker({ month, setMonth }) {
  const cur = today().slice(0, 7)
  return (
    <div className="flex items-center gap-1">
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month">
        ‹
      </button>
      <button type="button" className="text-sm px-2 min-w-28 text-center hover:text-accent" onClick={() => setMonth(cur)} title="Jump to this month">
        {monthLabel(month)}
      </button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMonth(addMonths(month, 1))} disabled={month >= cur} aria-label="Next month">
        ›
      </button>
    </div>
  )
}

/* ---------------- quick entry ---------------- */

function TxForm({ state, actions }) {
  const { accounts, spendCategories } = state
  const [type, setType] = useState('expense')
  const [date, setDate] = useState(today())
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [toAccountId, setToAccountId] = useState(accounts[1]?.id ?? accounts[0]?.id ?? '')
  const [note, setNote] = useState('')
  const [newCat, setNewCat] = useState(null)
  const [flash, setFlash] = useState('')
  const amountRef = useRef(null)
  const cats = spendCategories.filter((c) => c.kind === (type === 'income' ? 'income' : 'expense'))

  useEffect(() => {
    if (!cats.find((c) => c.id === categoryId)) setCategoryId(cats[0]?.id ?? '')
  }, [type, cats, categoryId])
  useEffect(() => {
    if (!accounts.find((a) => a.id === accountId)) setAccountId(accounts[0]?.id ?? '')
  }, [accounts, accountId])

  const submit = (e) => {
    e.preventDefault()
    const n = Number(amount)
    if (!Number.isFinite(n) || n <= 0 || !accountId || (type === 'transfer' && (!toAccountId || toAccountId === accountId))) {
      amountRef.current?.focus()
      return
    }
    actions.addTransaction({ type, date, amount: n, categoryId, accountId, toAccountId, note })
    const label = type === 'transfer' ? `${accounts.find((a) => a.id === accountId)?.name} → ${accounts.find((a) => a.id === toAccountId)?.name}` : cats.find((c) => c.id === categoryId)?.name
    setFlash(`${type === 'income' ? 'Received' : type === 'transfer' ? 'Moved' : 'Spent'} ${fmtUSD(n, { cents: n % 1 !== 0 })} · ${label ?? ''}`)
    setAmount('')
    setNote('')
    amountRef.current?.focus()
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-line bg-surface/60 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <Seg options={TYPE_OPTS} value={type} onChange={setType} ariaLabel="Transaction type" />
        <span className="text-xs text-dim hidden sm:inline">Enter to submit · focus returns to amount</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-[9.5rem_1fr_1fr_1fr_auto] gap-3 items-end">
        <Labeled label="Date">
          <input type="date" className="field" value={date} max={today()} onChange={(e) => setDate(e.target.value)} required />
        </Labeled>
        <Labeled label="Amount">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">$</span>
            <input
              ref={amountRef}
              type="text"
              inputMode="decimal"
              className="field pl-7 text-lg"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.keyCode === 13) submit(e)
              }}
              aria-label="Amount in dollars"
            />
          </div>
        </Labeled>
        {type === 'transfer' ? (
          <>
            <Labeled label="From">
              <select className="field" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Labeled>
            <Labeled label="To">
              <select className="field" value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Labeled>
          </>
        ) : (
          <>
            <Labeled label="Category">
              <select
                className="field"
                value={newCat != null ? '__new__' : categoryId}
                onChange={(e) => (e.target.value === '__new__' ? setNewCat('') : setCategoryId(e.target.value))}
              >
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                <option value="__new__">+ New category…</option>
              </select>
            </Labeled>
            <Labeled label={type === 'income' ? 'Into' : 'Paid from'}>
              <select className="field" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Labeled>
          </>
        )}
        <button type="submit" className="btn btn-primary col-span-2 sm:col-span-1 sm:w-24">
          {type === 'income' ? 'Add' : type === 'transfer' ? 'Move' : 'Spend'}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input className="field sm:max-w-sm" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" />
      </div>
      {newCat != null && (
        <div className="mt-3 flex flex-wrap items-end gap-2 border-l-2 border-line pl-3">
          <Labeled label={`New ${type === 'income' ? 'income' : 'expense'} category`} className="grow min-w-40">
            <input
              className="field"
              autoFocus
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (newCat.trim()) {
                    setCategoryId(actions.addSpendCategory({ name: newCat, kind: type === 'income' ? 'income' : 'expense' }))
                    setNewCat(null)
                    amountRef.current?.focus()
                  }
                }
                if (e.key === 'Escape') setNewCat(null)
              }}
            />
          </Labeled>
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (!newCat.trim()) return
              setCategoryId(actions.addSpendCategory({ name: newCat, kind: type === 'income' ? 'income' : 'expense' }))
              setNewCat(null)
              amountRef.current?.focus()
            }}
          >
            Add
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setNewCat(null)}>
            Cancel
          </button>
        </div>
      )}
      <p className="mt-3 text-xs text-dim min-h-4" aria-live="polite">
        {flash}
      </p>
    </form>
  )
}

/* ---------------- transactions list ---------------- */

function TxRow({ t, state, actions }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(t)
  useEffect(() => setDraft(t), [t])
  const acct = (id) => state.accounts.find((a) => a.id === id)?.name ?? '?'
  const cat = state.spendCategories.find((c) => c.id === t.categoryId)?.name
  const cats = state.spendCategories.filter((c) => c.kind === (draft.type === 'income' ? 'income' : 'expense'))
  if (editing) {
    return (
      <li className="py-3 grid grid-cols-2 sm:grid-cols-[9rem_1fr_1fr_1fr_auto] gap-2 items-end">
        <input type="date" className="field" value={draft.date} max={today()} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
        <NumInput prefix="$" value={draft.amount} min={0} onChange={(v) => setDraft({ ...draft, amount: v })} />
        {draft.type !== 'transfer' ? (
          <select className="field" value={draft.categoryId ?? ''} onChange={(e) => setDraft({ ...draft, categoryId: e.target.value || null })}>
            <option value="">Uncategorised</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : (
          <select className="field" value={draft.toAccountId ?? ''} onChange={(e) => setDraft({ ...draft, toAccountId: e.target.value })}>
            {state.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                → {a.name}
              </option>
            ))}
          </select>
        )}
        <select className="field" value={draft.accountId} onChange={(e) => setDraft({ ...draft, accountId: e.target.value })}>
          {state.accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <div className="col-span-2 sm:col-span-1 flex gap-2">
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => {
              actions.updateTransaction(t.id, draft)
              setEditing(false)
            }}
          >
            Save
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
        <input className="field col-span-2 sm:col-span-5" placeholder="Note" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
      </li>
    )
  }
  const sign = t.type === 'income' ? '+' : t.type === 'expense' ? '−' : ''
  return (
    <li className="py-2.5 flex items-center gap-3 group">
      <span className="text-sm text-muted tnum w-14 shrink-0">{fmtDateShort(t.date)}</span>
      <span className="min-w-0 grow">
        <span className="block text-sm truncate">{t.type === 'transfer' ? `${acct(t.accountId)} → ${acct(t.toAccountId)}` : (cat ?? 'Uncategorised')}</span>
        <span className="block text-[11px] text-dim truncate">
          {t.type !== 'transfer' && acct(t.accountId)}
          {t.note ? `${t.type !== 'transfer' ? ' · ' : ''}${t.note}` : ''}
          {t.recurringId ? ' · recurring' : ''}
        </span>
      </span>
      <span className={`tnum text-sm ${t.type === 'income' ? '' : 'text-muted'}`}>
        {sign}
        {fmtUSD(t.amount, { cents: t.amount % 1 !== 0 })}
      </span>
      <span className="flex gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
          Edit
        </button>
        <button type="button" className="btn btn-ghost btn-sm hover:text-warn" onClick={() => actions.deleteTransaction(t.id)}>
          Delete
        </button>
      </span>
    </li>
  )
}

function Transactions({ state, actions, month }) {
  const [filter, setFilter] = useState('all')
  const [showAll, setShowAll] = useState(false)
  const list = useMemo(
    () =>
      state.transactions
        .filter((t) => t.date.slice(0, 7) === month && (filter === 'all' || t.type === filter))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [state.transactions, month, filter],
  )
  const shown = showAll ? list : list.slice(0, 15)
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-medium text-muted">Transactions · {plural(list.length, 'item')}</h3>
        <Seg options={[{ value: 'all', label: 'All' }, ...TYPE_OPTS.map((o) => ({ value: o.value, label: o.label + 's' }))]} value={filter} onChange={setFilter} ariaLabel="Filter" />
      </div>
      {list.length === 0 ? (
        <p className="note py-6">Nothing logged in {monthLabel(month)}.</p>
      ) : (
        <ul className="divide-y divide-line">
          {shown.map((t) => (
            <TxRow key={t.id} t={t} state={state} actions={actions} />
          ))}
        </ul>
      )}
      {list.length > 15 && (
        <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Show fewer' : `Show all ${list.length}`}
        </button>
      )}
    </div>
  )
}

/* ---------------- budgets + categories ---------------- */

function Budgets({ state, derived, actions }) {
  const { budgets, thisMonth } = derived.money
  const income = state.spendCategories.filter((c) => c.kind === 'income')
  return (
    <div id="budgets" className="scroll-mt-20">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-sm font-medium text-muted">Budgets · {monthLabel(derived.month)}</h3>
        <span className="text-xs text-dim tnum">
          {budgets.totalBudget > 0 ? `${fmtUSD(budgets.totalSpentBudgeted)} of ${fmtUSD(budgets.totalBudget)} budgeted` : 'set a monthly limit per category'}
        </span>
      </div>
      <ul className="divide-y divide-line">
        {budgets.rows.map((r) => (
          <li key={r.cat.id} className="py-2.5 group">
            <div className="flex items-center gap-3">
              <input
                className="bg-transparent border-b border-transparent hover:border-line focus:border-muted text-sm py-0.5 min-w-0 grow outline-none"
                value={r.cat.name}
                onChange={(e) => actions.updateSpendCategory(r.cat.id, { name: e.target.value })}
                aria-label="Category name"
              />
              <span className={`tnum text-sm w-20 text-right ${r.over ? 'text-warn' : ''}`}>{fmtUSD(r.spent)}</span>
              <span className="text-dim text-xs">/</span>
              <NumInput
                prefix="$"
                value={r.budget ?? ''}
                min={0}
                placeholder="—"
                className="w-28"
                onChange={(v) => actions.updateSpendCategory(r.cat.id, { budget: v })}
                aria-label={`${r.cat.name} monthly budget`}
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm hover:text-warn sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                onClick={() => {
                  if (window.confirm(`Delete category "${r.cat.name}"? Its transactions become uncategorised.`)) actions.deleteSpendCategory(r.cat.id)
                }}
                aria-label={`Delete ${r.cat.name}`}
              >
                ✕
              </button>
            </div>
            {r.budget != null && (
              <div className="mt-1.5 flex items-center gap-3">
                <ProgressBar pct={r.pct} warn={r.over} className="grow" />
                <span className={`text-[11px] tnum w-36 text-right ${r.over ? 'text-warn' : r.aheadOfPace ? 'text-fg' : 'text-dim'}`}>
                  {r.over ? `${fmtUSD(-r.remaining)} over` : r.remaining < 0.005 ? 'on budget · $0 left' : r.aheadOfPace ? `ahead of pace · ${fmtUSD(r.remaining)} left` : `${fmtUSD(r.remaining)} left`}
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2 mt-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => actions.addSpendCategory({ name: 'New category', kind: 'expense' })}>
          + Expense category
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => actions.addSpendCategory({ name: 'New income', kind: 'income' })}>
          + Income category
        </button>
      </div>
      {budgets.unbudgeted > 0 && <p className="text-xs text-dim mt-2 tnum">{fmtUSD(budgets.unbudgeted)} this month sits in categories without a budget.</p>}
      <div className="mt-6">
        <h4 className="text-xs text-muted mb-1">Income categories</h4>
        <ul className="divide-y divide-line">
          {income.map((c) => (
            <li key={c.id} className="py-2 flex items-center gap-3 group">
              <input
                className="bg-transparent border-b border-transparent hover:border-line focus:border-muted text-sm py-0.5 min-w-0 grow outline-none"
                value={c.name}
                onChange={(e) => actions.updateSpendCategory(c.id, { name: e.target.value })}
                aria-label="Income category name"
              />
              <span className="tnum text-sm text-muted">{fmtUSD(thisMonth.incomeByCategory.get(c.id) ?? 0)}</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm hover:text-warn sm:opacity-0 sm:group-hover:opacity-100"
                onClick={() => {
                  if (window.confirm(`Delete "${c.name}"?`)) actions.deleteSpendCategory(c.id)
                }}
                aria-label={`Delete ${c.name}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/* ---------------- recurring ---------------- */

function RecurringForm({ state, actions, onDone }) {
  const cats = (kind) => state.spendCategories.filter((c) => c.kind === kind)
  const [r, setR] = useState({ name: '', amount: '', type: 'expense', categoryId: cats('expense')[0]?.id ?? '', accountId: state.accounts[0]?.id ?? '', toAccountId: state.accounts[1]?.id ?? '', frequency: 'monthly', nextDate: today(), autoPost: true })
  const set = (k, v) => setR((x) => ({ ...x, [k]: v }))
  const list = cats(r.type === 'income' ? 'income' : 'expense')
  return (
    <form
      className="mt-3 border-l-2 border-line pl-3 grid grid-cols-2 sm:grid-cols-4 gap-3 items-end"
      onSubmit={(e) => {
        e.preventDefault()
        if (!r.name.trim() || !(Number(r.amount) > 0)) return
        actions.addRecurring({ ...r, amount: Number(r.amount), categoryId: list.find((c) => c.id === r.categoryId)?.id ?? list[0]?.id ?? null })
        onDone()
      }}
    >
      <Labeled label="Name" className="col-span-2">
        <input className="field" autoFocus value={r.name} onChange={(e) => set('name', e.target.value)} placeholder="Rent, Salary, Netflix…" />
      </Labeled>
      <Labeled label="Amount">
        <NumInput prefix="$" value={r.amount} min={0} onChange={(v) => set('amount', v)} />
      </Labeled>
      <Labeled label="Type">
        <select className="field" value={r.type} onChange={(e) => set('type', e.target.value)}>
          {TYPE_OPTS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Labeled>
      {r.type !== 'transfer' && (
        <Labeled label="Category">
          <select className="field" value={r.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
            {list.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Labeled>
      )}
      <Labeled label={r.type === 'income' ? 'Into' : 'From'}>
        <select className="field" value={r.accountId} onChange={(e) => set('accountId', e.target.value)}>
          {state.accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </Labeled>
      {r.type === 'transfer' && (
        <Labeled label="To">
          <select className="field" value={r.toAccountId} onChange={(e) => set('toAccountId', e.target.value)}>
            {state.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Labeled>
      )}
      <Labeled label="Every">
        <select className="field" value={r.frequency} onChange={(e) => set('frequency', e.target.value)}>
          {FREQUENCIES.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </Labeled>
      <Labeled label="Next date">
        <input type="date" className="field" value={r.nextDate} onChange={(e) => set('nextDate', e.target.value)} />
      </Labeled>
      <label className="flex items-center gap-2 text-sm min-h-[42px] col-span-2 sm:col-span-1">
        <input type="checkbox" className="accent-accent w-4 h-4" checked={r.autoPost} onChange={(e) => set('autoPost', e.target.checked)} />
        Post automatically when due
      </label>
      <div className="flex gap-2 col-span-2 sm:col-span-1">
        <button type="submit" className="btn btn-primary">
          Add
        </button>
        <button type="button" className="btn btn-ghost" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  )
}

function Recurring({ state, actions, derived }) {
  const [adding, setAdding] = useState(false)
  const { recMonthly } = derived.money
  const acct = (id) => state.accounts.find((a) => a.id === id)?.name ?? '?'
  return (
    <div id="recurring" className="scroll-mt-20">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-sm font-medium text-muted">Recurring</h3>
        <span className="text-xs text-dim tnum">
          {fmtUSD(recMonthly.income)}/mo in · {fmtUSD(recMonthly.expenses)}/mo out
        </span>
      </div>
      {state.recurring.length === 0 && !adding && <p className="note py-3">Bills, subscriptions, paydays. Due items post themselves as transactions when the app opens.</p>}
      <ul className="divide-y divide-line">
        {state.recurring.map((r) => (
          <li key={r.id} className={`py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 group ${r.active ? '' : 'opacity-50'}`}>
            <span className="min-w-0 grow">
              <span className="block text-sm truncate">{r.name}</span>
              <span className="block text-[11px] text-dim">
                {r.frequency} · next {fmtDateShort(r.nextDate)} · {r.type === 'transfer' ? `${acct(r.accountId)} → ${acct(r.toAccountId)}` : acct(r.accountId)}
                {!r.autoPost ? ' · reminder only' : ''}
              </span>
            </span>
            <span className={`tnum text-sm ${r.type === 'income' ? '' : 'text-muted'}`}>
              {r.type === 'income' ? '+' : r.type === 'expense' ? '−' : ''}
              {fmtUSD(r.amount)}
              <span className="text-[11px] text-dim"> · {fmtUSD(perMonth(r.amount, r.frequency))}/mo</span>
            </span>
            <span className="flex gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => actions.skipRecurringOnce(r.id)} title="Skip the next occurrence">
                Skip
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => actions.updateRecurring(r.id, { active: !r.active })}>
                {r.active ? 'Pause' : 'Resume'}
              </button>
              <button type="button" className="btn btn-ghost btn-sm hover:text-warn" onClick={() => actions.deleteRecurring(r.id)}>
                Delete
              </button>
            </span>
          </li>
        ))}
      </ul>
      {adding ? (
        <RecurringForm state={state} actions={actions} onDone={() => setAdding(false)} />
      ) : (
        <div className="flex gap-2 mt-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(true)}>
            + Add recurring
          </button>
          {state.recurring.length > 0 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => actions.postDueRecurring()}>
              Post due items now
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* ---------------- page ---------------- */

export default function Spending({ state, derived, actions, month, setMonth }) {
  const m = derived.money.thisMonth
  return (
    <>
      <Section id="log-spend" title="Spending" lede="Income, expenses and transfers between accounts. Investment deposits live under Investing and count as saved here.">
        <TxForm state={state} actions={actions} />
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <MonthPicker month={month} setMonth={setMonth} />
          <div className="grid grid-cols-4 gap-4 sm:gap-6">
            <Stat label="In" value={<AnimatedNumber value={m.income} format={fmtCompactOrUSD} />} />
            <Stat label="Out" value={<AnimatedNumber value={m.expenses} format={fmtCompactOrUSD} />} />
            <Stat label="Invested" value={<AnimatedNumber value={m.invested} format={fmtCompactOrUSD} />} />
            <Stat label="Saved" value={m.savingsRate == null ? '—' : fmtPct(m.savingsRate * 100, 0)} warn={m.savingsRate != null && m.savingsRate < 0} />
          </div>
        </div>
        <div className="mt-6 grid lg:grid-cols-[3fr_2fr] gap-10">
          <Transactions state={state} actions={actions} month={month} />
          <div className="space-y-10">
            <Budgets state={state} derived={derived} actions={actions} />
            <Recurring state={state} actions={actions} derived={derived} />
          </div>
        </div>
      </Section>
    </>
  )
}

function fmtCompactOrUSD(v) {
  return Math.abs(v) >= 100000 ? `$${(v / 1000).toFixed(0)}k` : fmtUSD(v)
}
