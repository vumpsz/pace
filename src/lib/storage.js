// Versioned localStorage persistence. Everything stays on the device.
export const STORAGE_KEY = 'pace-investment-tracker'
export const SCHEMA = 2

export const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)

export const DEFAULT_SETTINGS = {
  birthDate: '2010-10-16',
  currentAge: 15,
  retireAge: 65,
  targetSpeculativePct: 10,
  feeDragPct: 0.1,
  inflationPct: 3,
  realDollars: false,
  contributionSteps: [],
  withdrawalRatePct: 4,
  paceWindowDays: 90,
  overrideOn: false,
  overrideAmount: 500,
  overrideFrequency: 'monthly',
  baseRate: 10,
  solveTarget: 1000000,
  // personal finance
  emergencyMonthsTarget: 6,
  debtStrategy: 'avalanche',
  debtExtraMonthly: 0,
  monthStartDay: 1,
}

export const ACCOUNT_TYPES = [
  { value: 'checking', label: 'Checking', liquid: true, debt: false },
  { value: 'savings', label: 'Savings', liquid: true, debt: false },
  { value: 'cash', label: 'Cash', liquid: true, debt: false },
  { value: 'credit', label: 'Credit card', liquid: false, debt: true },
  { value: 'loan', label: 'Loan', liquid: false, debt: true },
  { value: 'other', label: 'Other asset', liquid: false, debt: false },
]
export const isDebtType = (t) => ACCOUNT_TYPES.find((a) => a.value === t)?.debt ?? false
export const isLiquidType = (t) => ACCOUNT_TYPES.find((a) => a.value === t)?.liquid ?? false

export const FREQUENCIES = ['weekly', 'biweekly', 'monthly', 'quarterly', 'annual']

function seedCategories() {
  const mk = (name, tag) => ({ id: uid(), name, tag, currentValue: null })
  return [mk('S&P 500 index fund', 'core'), mk('VOO', 'core'), mk('NVDA', 'speculative'), mk('Bitcoin', 'speculative'), mk('Cash', 'core')]
}

function seedAccounts() {
  const mk = (name, type) => ({ id: uid(), name, type, openingBalance: 0, apr: 0, minPayment: 0, includeInNetWorth: true })
  return [mk('Checking', 'checking'), mk('Savings', 'savings'), mk('Credit card', 'credit')]
}

function seedSpendCategories() {
  const mk = (name, kind, budget = null) => ({ id: uid(), name, kind, budget })
  return [
    mk('Salary', 'income'),
    mk('Other income', 'income'),
    mk('Housing', 'expense'),
    mk('Groceries', 'expense'),
    mk('Dining', 'expense'),
    mk('Transport', 'expense'),
    mk('Utilities', 'expense'),
    mk('Health', 'expense'),
    mk('Subscriptions', 'expense'),
    mk('Entertainment', 'expense'),
    mk('Shopping', 'expense'),
    mk('Other', 'expense'),
  ]
}

export function seedState() {
  return {
    schema: SCHEMA,
    categories: seedCategories(),
    entries: [],
    settings: { ...DEFAULT_SETTINGS },
    accounts: seedAccounts(),
    spendCategories: seedSpendCategories(),
    transactions: [],
    recurring: [],
    goals: [],
    snapshots: [],
  }
}

const num = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
const str = (v, fallback = '') => (v == null ? fallback : String(v))
const optId = (v, ids) => (v != null && ids.has(String(v)) ? String(v) : null)

export function normalize(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Not an object')
  if (typeof raw.schema !== 'number' || raw.schema < 1 || raw.schema > SCHEMA) throw new Error(`Unsupported schema ${raw.schema}; this app reads 1-${SCHEMA}`)
  if (!Array.isArray(raw.categories) || !Array.isArray(raw.entries)) throw new Error('Missing categories or entries')

  // ----- investment side (schema 1) -----
  const categories = raw.categories.map((c) => ({
    id: str(c.id, uid()),
    name: str(c.name, 'Untitled'),
    tag: c.tag === 'speculative' ? 'speculative' : 'core',
    currentValue: c.currentValue == null ? null : num(Number(c.currentValue), null),
  }))
  const catIds = new Set(categories.map((c) => c.id))

  // ----- personal finance side (schema 2) -----
  const accountsRaw = Array.isArray(raw.accounts) ? raw.accounts : seedAccounts()
  const accounts = accountsRaw.map((a) => ({
    id: str(a.id, uid()),
    name: str(a.name, 'Account'),
    type: ACCOUNT_TYPES.some((t) => t.value === a.type) ? a.type : 'other',
    openingBalance: num(Number(a.openingBalance), 0),
    apr: num(Number(a.apr), 0),
    minPayment: num(Number(a.minPayment), 0),
    includeInNetWorth: a.includeInNetWorth == null ? true : Boolean(a.includeInNetWorth),
  }))
  const acctIds = new Set(accounts.map((a) => a.id))

  const entries = raw.entries
    .filter((e) => e && catIds.has(String(e.categoryId)))
    .map((e) => ({
      id: str(e.id, uid()),
      date: str(e.date, today()),
      amount: Math.abs(num(Number(e.amount), 0)),
      categoryId: String(e.categoryId),
      kind: e.kind === 'withdrawal' ? 'withdrawal' : 'deposit',
      excludeFromPace: Boolean(e.excludeFromPace),
      accountId: optId(e.accountId, acctIds),
    }))

  const spendRaw = Array.isArray(raw.spendCategories) ? raw.spendCategories : seedSpendCategories()
  const spendCategories = spendRaw.map((c) => ({
    id: str(c.id, uid()),
    name: str(c.name, 'Untitled'),
    kind: c.kind === 'income' ? 'income' : 'expense',
    budget: c.budget == null ? null : num(Number(c.budget), null),
  }))
  const spendIds = new Set(spendCategories.map((c) => c.id))

  const transactions = (Array.isArray(raw.transactions) ? raw.transactions : [])
    .filter((t) => t && acctIds.has(String(t.accountId)))
    .map((t) => ({
      id: str(t.id, uid()),
      date: str(t.date, today()),
      amount: Math.abs(num(Number(t.amount), 0)),
      type: t.type === 'income' ? 'income' : t.type === 'transfer' ? 'transfer' : 'expense',
      categoryId: optId(t.categoryId, spendIds),
      accountId: String(t.accountId),
      toAccountId: optId(t.toAccountId, acctIds),
      note: str(t.note, ''),
      recurringId: t.recurringId == null ? null : String(t.recurringId),
    }))

  const recurring = (Array.isArray(raw.recurring) ? raw.recurring : [])
    .filter((r) => r && acctIds.has(String(r.accountId)))
    .map((r) => ({
      id: str(r.id, uid()),
      name: str(r.name, 'Recurring'),
      amount: Math.abs(num(Number(r.amount), 0)),
      type: r.type === 'income' ? 'income' : r.type === 'transfer' ? 'transfer' : 'expense',
      categoryId: optId(r.categoryId, spendIds),
      accountId: String(r.accountId),
      toAccountId: optId(r.toAccountId, acctIds),
      frequency: FREQUENCIES.includes(r.frequency) ? r.frequency : 'monthly',
      nextDate: str(r.nextDate, today()),
      autoPost: r.autoPost == null ? true : Boolean(r.autoPost),
      active: r.active == null ? true : Boolean(r.active),
    }))

  const goals = (Array.isArray(raw.goals) ? raw.goals : []).map((g) => ({
    id: str(g.id, uid()),
    name: str(g.name, 'Goal'),
    target: Math.abs(num(Number(g.target), 0)),
    accountId: optId(g.accountId, acctIds),
    saved: Math.abs(num(Number(g.saved), 0)),
    deadline: g.deadline ? str(g.deadline) : null,
  }))

  const snapshots = (Array.isArray(raw.snapshots) ? raw.snapshots : [])
    .filter((s) => s && typeof s.month === 'string')
    .map((s) => ({ month: s.month, netWorth: num(Number(s.netWorth), 0), cash: num(Number(s.cash), 0), debt: num(Number(s.debt), 0), investments: num(Number(s.investments), 0) }))

  const s = raw.settings && typeof raw.settings === 'object' ? raw.settings : {}
  const settings = { ...DEFAULT_SETTINGS }
  for (const k of Object.keys(DEFAULT_SETTINGS)) {
    if (!(k in s)) continue
    const d = DEFAULT_SETTINGS[k]
    if (Array.isArray(d)) {
      settings[k] = Array.isArray(s[k])
        ? s[k]
            .map((x) => ({ age: num(Number(x?.age), NaN), monthly: Math.abs(num(Number(x?.monthly), NaN)) }))
            .filter((x) => Number.isFinite(x.age) && Number.isFinite(x.monthly))
        : d
    } else if (typeof d === 'number') settings[k] = num(Number(s[k]), d)
    else if (typeof d === 'boolean') settings[k] = Boolean(s[k])
    else settings[k] = String(s[k])
  }

  return { schema: SCHEMA, categories, entries, settings, accounts, spendCategories, transactions, recurring, goals, snapshots }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedState()
    return normalize(JSON.parse(raw))
  } catch (err) {
    console.warn('Could not load saved state, starting fresh:', err)
    return seedState()
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (err) {
    console.warn('Could not save state:', err)
  }
}

export function exportJSON(state) {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2)
}

export function importJSON(text) {
  return normalize(JSON.parse(text))
}

export function today() {
  const d = new Date()
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10)
}

export const monthKey = (iso = today()) => iso.slice(0, 7)
