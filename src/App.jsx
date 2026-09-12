import { useEffect, useMemo, useState } from 'react'
import { useStore } from './hooks/useStore.js'
import { useDerived } from './hooks/useDerived.js'
import { useRoute } from './hooks/useRoute.js'
import { monthKey } from './lib/storage.js'
import { withDerivedAge } from './lib/money.js'
import Nav from './components/Nav.jsx'
import Overview from './components/Overview.jsx'
import Spending from './components/Spending.jsx'
import Logging from './components/Logging.jsx'
import Allocation from './components/Allocation.jsx'
import Projection, { Hero } from './components/Projection.jsx'
import Risk from './components/Risk.jsx'
import MonteCarlo from './components/MonteCarlo.jsx'
import DebtsGoals from './components/DebtsGoals.jsx'

const PLAN_SUBNAV = [
  ['projection', 'Projection'],
  ['risk', 'Risk'],
  ['montecarlo', 'Sequence risk'],
]

export default function App() {
  const { state: rawState, actions, setSetting } = useStore()
  const { page, navigate } = useRoute()
  const [month, setMonth] = useState(monthKey())
  // Age comes from the birth date when one is set, so it stays current on its own.
  const settings = useMemo(() => withDerivedAge(rawState.settings), [rawState.settings])
  const state = useMemo(() => (settings === rawState.settings ? rawState : { ...rawState, settings }), [rawState, settings])
  const derived = useDerived(state, month)

  // Recurring items post themselves when the app opens (and once a day if left open).
  useEffect(() => {
    actions.postDueRecurring()
    const t = setInterval(() => actions.postDueRecurring(), 6 * 60 * 60 * 1000)
    return () => clearInterval(t)
  }, [actions])

  // One net-worth point per month.
  const { nw } = derived.money
  useEffect(() => {
    actions.upsertSnapshot({ month: monthKey(), netWorth: Math.round(nw.netWorth), cash: Math.round(nw.cash), debt: Math.round(nw.liabilities), investments: Math.round(nw.investments) })
  }, [actions, nw.netWorth, nw.cash, nw.liabilities, nw.investments])

  const common = { state, derived, actions, settings: state.settings, setSetting }

  return (
    <div className="min-h-dvh pb-16 sm:pb-0">
      <Nav page={page} navigate={navigate} />
      <main className="mx-auto max-w-5xl px-4 sm:px-6 divide-y divide-line">
        {page === 'overview' && <Overview {...common} />}
        {page === 'spend' && <Spending {...common} month={month} setMonth={setMonth} />}
        {page === 'invest' && (
          <>
            <Logging state={state} actions={actions} />
            <Allocation derived={derived} settings={state.settings} setSetting={setSetting} />
          </>
        )}
        {page === 'plan' && (
          <>
            <Hero derived={derived} settings={state.settings} setSetting={setSetting} entryCount={state.entries.length} />
            <div className="py-3 flex gap-1 text-sm">
              {PLAN_SUBNAV.map(([id, label]) => (
                <a key={id} href={`#/plan/${id}`} className="text-muted hover:text-fg px-2 py-1 rounded">
                  {label}
                </a>
              ))}
            </div>
            <Projection derived={derived} settings={state.settings} setSetting={setSetting} entries={state.entries} />
            <Risk derived={derived} settings={state.settings} setSetting={setSetting} />
            <MonteCarlo derived={derived} settings={state.settings} />
          </>
        )}
        {page === 'goals' && <DebtsGoals {...common} />}
      </main>

      <footer className="mx-auto max-w-5xl px-4 sm:px-6 py-10 text-xs text-dim leading-relaxed border-t border-line">
        <p>
          Pace is a modeling tool, not financial advice. Every number past today is a projection from assumptions you typed in, and markets do not owe
          anyone a straight line. Your data stays on this computer and never leaves it.
        </p>
      </footer>
    </div>
  )
}
