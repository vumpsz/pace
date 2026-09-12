import { useEffect, useMemo, useRef, useState } from 'react'
import { basisByCategory, signed } from '../lib/finance.js'
import { exportJSON, importJSON, today } from '../lib/storage.js'
import { fmtUSD, fmtDateShort, plural } from '../lib/format.js'
import { NumInput, Seg, Section, TagDot, Labeled } from './ui.jsx'

const KIND_OPTS = [
  { value: 'deposit', label: 'Deposit' },
  { value: 'withdrawal', label: 'Withdraw' },
]
const TAG_OPTS = [
  { value: 'core', label: 'Core' },
  { value: 'speculative', label: 'Speculative' },
]

function NewCategoryInline({ onCreate, onCancel }) {
  const [name, setName] = useState('')
  const [tag, setTag] = useState('core')
  const ref = useRef(null)
  useEffect(() => ref.current?.focus(), [])
  const submit = () => {
    if (!name.trim()) return
    onCreate({ name, tag })
  }
  return (
    <div className="mt-3 flex flex-wrap items-end gap-2 border-l-2 border-line pl-3">
      <Labeled label="New category" className="grow min-w-40">
        <input
          ref={ref}
          className="field"
          placeholder="e.g. TSLA"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
            if (e.key === 'Escape') onCancel()
          }}
        />
      </Labeled>
      <Seg options={TAG_OPTS} value={tag} onChange={setTag} ariaLabel="Category tag" />
      <button type="button" className="btn" onClick={submit}>
        Add
      </button>
      <button type="button" className="btn btn-ghost" onClick={onCancel}>
        Cancel
      </button>
    </div>
  )
}

function EntryForm({ categories, accounts = [], onAdd, onAddCategory }) {
  const [date, setDate] = useState(today())
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '')
  const [accountId, setAccountId] = useState('')
  const [kind, setKind] = useState('deposit')
  const [exclude, setExclude] = useState(false)
  const [newCat, setNewCat] = useState(false)
  const [flash, setFlash] = useState(null)
  const amountRef = useRef(null)

  useEffect(() => {
    if (!categories.find((c) => c.id === categoryId)) setCategoryId(categories[0]?.id ?? '')
  }, [categories, categoryId])

  const submit = (e) => {
    e.preventDefault()
    const n = Number(amount)
    if (!Number.isFinite(n) || n <= 0 || !categoryId) {
      amountRef.current?.focus()
      return
    }
    onAdd({ date, amount: n, categoryId, kind, excludeFromPace: exclude, accountId: accountId || null })
    const cat = categories.find((c) => c.id === categoryId)
    setFlash(`${kind === 'withdrawal' ? 'Withdrew' : 'Logged'} ${fmtUSD(n, { cents: n % 1 !== 0 })} · ${cat?.name ?? ''}`)
    setAmount('')
    setExclude(false)
    amountRef.current?.focus()
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-line bg-surface/60 p-4 sm:p-5">
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
              autoFocus
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
        <Labeled label="Category" className="col-span-2 sm:col-span-1">
          <select
            className="field"
            value={newCat ? '__new__' : categoryId}
            onChange={(e) => {
              if (e.target.value === '__new__') setNewCat(true)
              else setCategoryId(e.target.value)
            }}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.tag === 'speculative' ? '· spec' : ''}
              </option>
            ))}
            <option value="__new__">+ New category…</option>
          </select>
        </Labeled>
        <Labeled label={kind === 'withdrawal' ? 'Proceeds to' : 'Paid from'}>
          <select className="field" value={accountId} onChange={(e) => setAccountId(e.target.value)} aria-label="Bank account">
            <option value="">No account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Labeled>
        <button type="submit" className="btn btn-primary col-span-2 sm:col-span-1 sm:w-24">
          {kind === 'withdrawal' ? 'Withdraw' : 'Log'}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Seg options={KIND_OPTS} value={kind} onChange={setKind} ariaLabel="Entry kind" />
        <label className="flex items-center gap-2 text-sm text-muted cursor-pointer select-none">
          <input type="checkbox" className="accent-accent w-4 h-4" checked={exclude} onChange={(e) => setExclude(e.target.checked)} />
          Not my pace
          <span className="text-dim hidden sm:inline">(rollover, windfall, one-off)</span>
        </label>
        <span className="text-xs text-dim ml-auto hidden sm:inline">Enter to submit · focus returns to amount</span>
      </div>
      {newCat && (
        <NewCategoryInline
          onCreate={(c) => {
            const id = onAddCategory(c)
            setCategoryId(id)
            setNewCat(false)
            amountRef.current?.focus()
          }}
          onCancel={() => setNewCat(false)}
        />
      )}
      <p className="mt-3 text-xs text-dim min-h-4" aria-live="polite">
        {flash}
      </p>
    </form>
  )
}

function EntryRow({ entry, categories, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(entry)
  const cat = categories.find((c) => c.id === entry.categoryId)
  useEffect(() => setDraft(entry), [entry])

  if (editing) {
    return (
      <li className="py-3 grid grid-cols-2 sm:grid-cols-[9rem_1fr_1fr_auto] gap-2 items-end">
        <input type="date" className="field" value={draft.date} max={today()} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
        <NumInput prefix="$" value={draft.amount} min={0} onChange={(v) => setDraft({ ...draft, amount: v })} />
        <select className="field col-span-2 sm:col-span-1" value={draft.categoryId} onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <div className="col-span-2 sm:col-span-1 flex flex-wrap items-center gap-2">
          <Seg options={KIND_OPTS} value={draft.kind} onChange={(kind) => setDraft({ ...draft, kind })} ariaLabel="Entry kind" />
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input type="checkbox" className="accent-accent" checked={draft.excludeFromPace} onChange={(e) => setDraft({ ...draft, excludeFromPace: e.target.checked })} />
            Not pace
          </label>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => {
              onUpdate(entry.id, draft)
              setEditing(false)
            }}
          >
            Save
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
      </li>
    )
  }

  const v = signed(entry)
  return (
    <li className="py-2.5 flex items-center gap-3 group">
      <span className="text-sm text-muted tnum w-16 shrink-0">{fmtDateShort(entry.date)}</span>
      <span className="flex items-center gap-2 min-w-0 grow">
        <TagDot tag={cat?.tag ?? 'core'} />
        <span className="truncate text-sm">{cat?.name ?? 'Unknown'}</span>
        {entry.excludeFromPace && <span className="text-[10px] text-dim border border-line rounded px-1 shrink-0">not pace</span>}
      </span>
      <span className={`tnum text-sm ${v < 0 ? 'text-muted' : ''}`}>{v < 0 ? '−' : ''}{fmtUSD(Math.abs(v), { cents: v % 1 !== 0 })}</span>
      <span className="flex gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)} aria-label="Edit entry">
          Edit
        </button>
        <button type="button" className="btn btn-ghost btn-sm hover:text-warn" onClick={() => onDelete(entry.id)} aria-label="Delete entry">
          Delete
        </button>
      </span>
    </li>
  )
}

function Ledger({ entries, categories, onUpdate, onDelete }) {
  const [showAll, setShowAll] = useState(false)
  const sorted = useMemo(() => [...entries].sort((a, b) => b.date.localeCompare(a.date)), [entries])
  const shown = showAll ? sorted : sorted.slice(0, 12)
  if (!entries.length) {
    return <p className="note py-6">No entries yet. Log the first deposit above and every number on this page comes to life.</p>
  }
  return (
    <div>
      <ul className="divide-y divide-line">
        {shown.map((e) => (
          <EntryRow key={e.id} entry={e} categories={categories} onUpdate={onUpdate} onDelete={onDelete} />
        ))}
      </ul>
      {sorted.length > 12 && (
        <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Show fewer' : `Show all ${sorted.length}`}
        </button>
      )}
    </div>
  )
}

function CategoryRow({ cat, basis, entryCount, onUpdate, onDelete }) {
  return (
    <li className="py-3 grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_9rem_auto] gap-x-3 gap-y-2 items-center">
      <input
        className="bg-transparent border-b border-transparent hover:border-line focus:border-muted text-sm py-1 min-w-0 outline-none"
        value={cat.name}
        onChange={(e) => onUpdate(cat.id, { name: e.target.value })}
        aria-label="Category name"
      />
      <Seg options={TAG_OPTS} value={cat.tag} onChange={(tag) => onUpdate(cat.id, { tag })} ariaLabel={`${cat.name} tag`} />
      <div className="col-span-2 sm:col-span-1 flex items-center gap-2">
        <NumInput
          prefix="$"
          value={cat.currentValue ?? ''}
          min={0}
          placeholder={Math.round(basis).toLocaleString()}
          onChange={(v) => onUpdate(cat.id, { currentValue: v })}
          className="w-full"
          aria-label={`${cat.name} current value`}
        />
        {cat.currentValue != null && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onUpdate(cat.id, { currentValue: null })} title="Clear current value; use cost basis">
            ✕
          </button>
        )}
      </div>
      <button
        type="button"
        className="btn btn-ghost btn-sm hover:text-warn justify-self-end"
        onClick={() => {
          if (entryCount > 0 && !window.confirm(`Delete "${cat.name}" and its ${plural(entryCount, 'entry', 'entries')}?`)) return
          onDelete(cat.id)
        }}
      >
        Delete
      </button>
    </li>
  )
}

export function DataTools({ state, onImport, onReset }) {
  const fileRef = useRef(null)
  const [msg, setMsg] = useState(null)
  const doExport = () => {
    const blob = new Blob([exportJSON(state)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pace-backup-${today()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  const doImport = async (file) => {
    if (!file) return
    try {
      const next = importJSON(await file.text())
      if (!window.confirm(`Replace current data with ${next.entries.length} entries and ${next.categories.length} categories from this file?`)) return
      onImport(next)
      setMsg('Imported.')
    } catch (err) {
      setMsg(`Could not import: ${err.message}`)
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="btn btn-sm" onClick={doExport}>
        Export JSON
      </button>
      <button type="button" className="btn btn-sm" onClick={() => fileRef.current?.click()}>
        Import JSON
      </button>
      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => doImport(e.target.files?.[0])} />
      <button
        type="button"
        className="btn btn-ghost btn-sm hover:text-warn"
        onClick={() => {
          if (window.confirm('Erase all entries, categories and settings on this device?')) onReset()
        }}
      >
        Reset
      </button>
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </div>
  )
}

export default function Logging({ state, actions }) {
  const { entries, categories } = state
  const basis = useMemo(() => basisByCategory(entries), [entries])
  const counts = useMemo(() => {
    const m = new Map()
    for (const e of entries) m.set(e.categoryId, (m.get(e.categoryId) ?? 0) + 1)
    return m
  }, [entries])

  return (
    <Section id="log" title="Log" lede="What actually went in, and where. This ledger is the only source for everything below.">
      <EntryForm categories={categories} accounts={state.accounts} onAdd={actions.addEntry} onAddCategory={actions.addCategory} />
      <div className="mt-8 grid lg:grid-cols-[3fr_2fr] gap-10">
        <div>
          <h3 className="text-sm font-medium text-muted mb-1">Entries</h3>
          <Ledger entries={entries} categories={categories} onUpdate={actions.updateEntry} onDelete={actions.deleteEntry} />
        </div>
        <div>
          <div className="flex items-baseline justify-between mb-1">
            <h3 className="text-sm font-medium text-muted">Categories</h3>
            <span className="text-xs text-dim">Current value, blank = cost basis</span>
          </div>
          <ul className="divide-y divide-line">
            {categories.map((c) => (
              <CategoryRow
                key={c.id}
                cat={c}
                basis={basis.get(c.id) ?? 0}
                entryCount={counts.get(c.id) ?? 0}
                onUpdate={actions.updateCategory}
                onDelete={actions.deleteCategory}
              />
            ))}
          </ul>
          <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={() => actions.addCategory({ name: 'New category', tag: 'core' })}>
            + Add category
          </button>
        </div>
      </div>
    </Section>
  )
}
