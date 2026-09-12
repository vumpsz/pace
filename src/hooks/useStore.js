import { useCallback, useEffect, useMemo, useState } from 'react'
import { loadState, saveState, seedState, uid, today, isDebtType } from '../lib/storage.js'
import { dueOccurrences } from '../lib/money.js'

const clean = (v) => Math.abs(Number(v) || 0)

export function useStore() {
  const [state, setState] = useState(loadState)

  useEffect(() => {
    saveState(state)
  }, [state])

  const actions = useMemo(() => {
    const patch = (fn) => setState((s) => ({ ...s, ...fn(s) }))
    const upsertList = (key, id, p) => patch((s) => ({ [key]: s[key].map((x) => (x.id === id ? { ...x, ...p } : x)) }))
    return {
      // ----- investments -----
      addEntry(e) {
        const entry = {
          id: uid(),
          date: e.date || today(),
          amount: clean(e.amount),
          categoryId: e.categoryId,
          kind: e.kind === 'withdrawal' ? 'withdrawal' : 'deposit',
          excludeFromPace: Boolean(e.excludeFromPace),
          accountId: e.accountId || null,
        }
        patch((s) => ({ entries: [entry, ...s.entries] }))
        return entry.id
      },
      updateEntry(id, p) {
        upsertList('entries', id, { ...p, ...(p.amount != null ? { amount: clean(p.amount) } : {}) })
      },
      deleteEntry(id) {
        patch((s) => ({ entries: s.entries.filter((e) => e.id !== id) }))
      },
      addCategory({ name, tag }) {
        const cat = { id: uid(), name: (name || '').trim() || 'Untitled', tag: tag === 'speculative' ? 'speculative' : 'core', currentValue: null }
        patch((s) => ({ categories: [...s.categories, cat] }))
        return cat.id
      },
      updateCategory(id, p) {
        upsertList('categories', id, p)
      },
      deleteCategory(id) {
        patch((s) => ({ categories: s.categories.filter((c) => c.id !== id), entries: s.entries.filter((e) => e.categoryId !== id) }))
      },

      // ----- accounts -----
      addAccount({ name, type, openingBalance = 0, apr = 0, minPayment = 0 }) {
        const a = { id: uid(), name: (name || '').trim() || 'Account', type: type || 'checking', openingBalance: clean(openingBalance), apr: clean(apr), minPayment: clean(minPayment), includeInNetWorth: true }
        patch((s) => ({ accounts: [...s.accounts, a] }))
        return a.id
      },
      updateAccount(id, p) {
        upsertList('accounts', id, p)
      },
      /** Set what the balance is right now; the opening balance absorbs the difference. */
      reconcileAccount(id, displayBalance, currentDisplay) {
        patch((s) => ({
          accounts: s.accounts.map((a) => {
            if (a.id !== id) return a
            const diff = clean(displayBalance) - currentDisplay
            return { ...a, openingBalance: a.openingBalance + diff }
          }),
        }))
      },
      deleteAccount(id) {
        patch((s) => ({
          accounts: s.accounts.filter((a) => a.id !== id),
          transactions: s.transactions.filter((t) => t.accountId !== id && t.toAccountId !== id),
          recurring: s.recurring.filter((r) => r.accountId !== id && r.toAccountId !== id),
          entries: s.entries.map((e) => (e.accountId === id ? { ...e, accountId: null } : e)),
          goals: s.goals.map((g) => (g.accountId === id ? { ...g, accountId: null } : g)),
        }))
      },

      // ----- spending -----
      addSpendCategory({ name, kind, budget = null }) {
        const c = { id: uid(), name: (name || '').trim() || 'Untitled', kind: kind === 'income' ? 'income' : 'expense', budget }
        patch((s) => ({ spendCategories: [...s.spendCategories, c] }))
        return c.id
      },
      updateSpendCategory(id, p) {
        upsertList('spendCategories', id, p)
      },
      deleteSpendCategory(id) {
        patch((s) => ({
          spendCategories: s.spendCategories.filter((c) => c.id !== id),
          transactions: s.transactions.map((t) => (t.categoryId === id ? { ...t, categoryId: null } : t)),
          recurring: s.recurring.map((r) => (r.categoryId === id ? { ...r, categoryId: null } : r)),
        }))
      },
      addTransaction(t) {
        const tx = {
          id: uid(),
          date: t.date || today(),
          amount: clean(t.amount),
          type: t.type === 'income' ? 'income' : t.type === 'transfer' ? 'transfer' : 'expense',
          categoryId: t.type === 'transfer' ? null : t.categoryId || null,
          accountId: t.accountId,
          toAccountId: t.type === 'transfer' ? t.toAccountId || null : null,
          note: (t.note || '').trim(),
          recurringId: t.recurringId || null,
        }
        patch((s) => ({ transactions: [tx, ...s.transactions] }))
        return tx.id
      },
      updateTransaction(id, p) {
        upsertList('transactions', id, { ...p, ...(p.amount != null ? { amount: clean(p.amount) } : {}) })
      },
      deleteTransaction(id) {
        patch((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) }))
      },

      // ----- recurring -----
      addRecurring(r) {
        const rec = {
          id: uid(),
          name: (r.name || '').trim() || 'Recurring',
          amount: clean(r.amount),
          type: r.type === 'income' ? 'income' : r.type === 'transfer' ? 'transfer' : 'expense',
          categoryId: r.type === 'transfer' ? null : r.categoryId || null,
          accountId: r.accountId,
          toAccountId: r.type === 'transfer' ? r.toAccountId || null : null,
          frequency: r.frequency || 'monthly',
          nextDate: r.nextDate || today(),
          autoPost: r.autoPost == null ? true : Boolean(r.autoPost),
          active: true,
        }
        patch((s) => ({ recurring: [...s.recurring, rec] }))
        return rec.id
      },
      updateRecurring(id, p) {
        upsertList('recurring', id, p)
      },
      deleteRecurring(id) {
        patch((s) => ({ recurring: s.recurring.filter((r) => r.id !== id) }))
      },
      /** Materialize every due occurrence of auto-posting recurring items as transactions. */
      postDueRecurring(todayIso = today()) {
        let posted = 0
        patch((s) => {
          const newTx = []
          const recurring = s.recurring.map((r) => {
            if (!r.active || !r.autoPost) return r
            const { dates, nextDate } = dueOccurrences(r, todayIso)
            if (!dates.length) return r
            for (const date of dates) {
              newTx.push({ id: uid(), date, amount: r.amount, type: r.type, categoryId: r.categoryId, accountId: r.accountId, toAccountId: r.toAccountId, note: r.name, recurringId: r.id })
            }
            posted += dates.length
            return { ...r, nextDate }
          })
          return newTx.length ? { recurring, transactions: [...newTx, ...s.transactions] } : {}
        })
        return posted
      },
      skipRecurringOnce(id) {
        patch((s) => ({
          recurring: s.recurring.map((r) => (r.id === id ? { ...r, nextDate: dueOccurrences({ ...r, nextDate: r.nextDate }, r.nextDate).nextDate } : r)),
        }))
      },

      // ----- goals -----
      addGoal(g) {
        const goal = { id: uid(), name: (g.name || '').trim() || 'Goal', target: clean(g.target), accountId: g.accountId || null, saved: clean(g.saved), deadline: g.deadline || null }
        patch((s) => ({ goals: [...s.goals, goal] }))
        return goal.id
      },
      updateGoal(id, p) {
        upsertList('goals', id, p)
      },
      deleteGoal(id) {
        patch((s) => ({ goals: s.goals.filter((g) => g.id !== id) }))
      },

      // ----- snapshots -----
      upsertSnapshot(snap) {
        patch((s) => {
          const others = s.snapshots.filter((x) => x.month !== snap.month)
          const prev = s.snapshots.find((x) => x.month === snap.month)
          if (prev && Math.abs(prev.netWorth - snap.netWorth) < 0.005 && Math.abs(prev.cash - snap.cash) < 0.005 && Math.abs(prev.debt - snap.debt) < 0.005 && Math.abs(prev.investments - snap.investments) < 0.005) return {}
          return { snapshots: [...others, snap].sort((a, b) => a.month.localeCompare(b.month)).slice(-120) }
        })
      },

      updateSettings(p) {
        patch((s) => ({ settings: { ...s.settings, ...p } }))
      },
      replaceState(next) {
        setState(next)
      },
      resetAll() {
        setState(seedState())
      },
    }
  }, [])

  const setSetting = useCallback((key, value) => actions.updateSettings({ [key]: value }), [actions])

  return { state, actions, setSetting }
}

export { isDebtType }
