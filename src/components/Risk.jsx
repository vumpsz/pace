import { useMemo, useState } from 'react'
import { maxAbsorbableLoss, project, recoveryGain, solveRateForTarget, yearsToRetire } from '../lib/finance.js'
import { fmtUSD, fmtPct, fmtMult, plural } from '../lib/format.js'
import { AnimatedNumber, NumInput, Section, Stat, Labeled } from './ui.jsx'

const LOSSES = [0.1, 0.2, 0.3, 0.5, 0.7, 0.9]

function Block({ n, title, children }) {
  return (
    <div className="grid sm:grid-cols-[3rem_1fr] gap-x-4 gap-y-3">
      <div className="text-sm text-dim tnum pt-0.5">{String(n).padStart(2, '0')}</div>
      <div>
        <h3 className="text-base font-medium mb-3">{title}</h3>
        {children}
      </div>
    </div>
  )
}

export default function Risk({ derived, settings, setSetting }) {
  const { totals, byTag, ctx, baseRate } = derived
  const [amount, setAmount] = useState(10000)
  const years = yearsToRetire(settings)
  const target = settings.solveTarget

  const total = totals.value
  const specDollars = byTag.speculative.value
  const targetPct = settings.targetSpeculativePct
  const targetDollars = (total * targetPct) / 100
  const headroom = targetDollars - specDollars

  const grow = (amt, rate) => project(rate, { start: amt, basis: amt, monthly: 0, s: settings }).ending
  const atBase = grow(amount, baseRate)
  const at20 = grow(amount, 20)

  const riskable = Math.min(amount, ctx.start)
  const before = useMemo(() => solveRateForTarget(target, ctx), [target, ctx])
  const after = useMemo(
    () => solveRateForTarget(target, { ...ctx, start: ctx.start - riskable, basis: Math.min(ctx.basis, ctx.start - riskable) }),
    [target, ctx, riskable],
  )
  const gap = before.status === 'ok' && after.status === 'ok' ? after.ratePct - before.ratePct : null

  const mal = useMemo(() => maxAbsorbableLoss(target, baseRate, ctx), [target, baseRate, ctx])

  const rateLabel = (r) => (r.status === 'ok' ? fmtPct(r.ratePct, 1) : r.status === 'reached' ? 'none needed' : 'not reachable')

  return (
    <Section
      id="risk"
      title="Risk"
      lede="After a big gain, the instinct is to treat the winnings as free money and take more risk. These five numbers say what that actually costs."
    >
      <div className="space-y-12">
        <Block n={1} title="Sleeve sizing">
          <div className="grid grid-cols-3 gap-4">
            <Stat label="Speculative now" value={<AnimatedNumber value={specDollars} format={fmtUSD} />} sub={total > 0 ? fmtPct((specDollars / total) * 100) + ' of portfolio' : ''} warn={headroom < 0} />
            <Stat label={headroom >= 0 ? 'Headroom to target' : 'Over target by'} value={<AnimatedNumber value={Math.abs(headroom)} format={fmtUSD} />} sub={`${targetPct}% target · ${fmtUSD(targetDollars)}`} warn={headroom < 0} />
            <Stat label="Sleeve at 2× portfolio" value={<AnimatedNumber value={targetDollars * 2} format={fmtUSD} />} sub={`${targetPct}% of ${fmtUSD(total * 2)}`} />
          </div>
          <p className="note mt-4">
            The rule is a percentage, so the dollars at risk scale with the portfolio on their own. This is the legitimate version of “I have more to risk
            now”: the rule stays fixed and the dollars move. Nothing about a good year changes the rule.
          </p>
        </Block>

        <Block n={2} title="Cost of losing it">
          <div className="grid sm:grid-cols-[12rem_1fr_1fr] gap-4 items-start">
            <Labeled label="Amount you would put at risk">
              <NumInput prefix="$" value={amount} min={0} onChange={setAmount} />
            </Labeled>
            <Stat label={`Worth at ${settings.retireAge}, ${baseRate}%`} value={<AnimatedNumber value={atBase} format={fmtUSD} />} sub={amount > 0 ? fmtMult(atBase / amount) : ''} />
            <Stat label={`Worth at ${settings.retireAge}, 20%`} value={<AnimatedNumber value={at20} format={fmtUSD} />} sub={amount > 0 ? fmtMult(at20 / amount) : ''} warn />
          </div>
          <p className="note mt-4">
            Lose {fmtUSD(amount)} today and the hole at retirement is not {fmtUSD(amount)}. It is whatever that money would have compounded to over{' '}
            {plural(years, 'year')}. High return assumptions make risk more expensive, not less: if you believe in 20%, a loss costs you{' '}
            <span className="text-fg tnum">{fmtMult(at20 / Math.max(1, amount))}</span> the sticker price.
          </p>
        </Block>

        <Block n={3} title="Required return, before and after">
          <div className="grid grid-cols-3 gap-4">
            <Stat label={`To reach ${fmtUSD(target)} at this pace`} value={rateLabel(before)} sub="annual return needed today" />
            <Stat label={`After losing ${fmtUSD(riskable)}`} value={rateLabel(after)} sub="annual return needed then" warn={gap != null && gap > 0.05} />
            <Stat label="Gap" value={gap == null ? '—' : `${gap >= 0 ? '+' : ''}${gap.toFixed(2)} pts`} warn={gap != null && gap > 0.05} />
          </div>
          <p className="note mt-4">
            This is the number that moves opposite to the instinct. A gain <em>lowers</em> the return you still need, which is a reason to take less risk, not more.
            {riskable < amount && ` (Capped at your current balance of ${fmtUSD(ctx.start)}; you cannot lose more than you have.)`}
            {' '}Target is the one from Projection; change it there.
          </p>
        </Block>

        <Block n={4} title="Recovery math">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {LOSSES.map((l) => (
              <div key={l} className="border-t border-line pt-2">
                <div className="text-xs text-muted tnum">−{Math.round(l * 100)}%</div>
                <div className="tnum text-lg font-medium text-warn">+{Math.round(recoveryGain(l) * 100)}%</div>
                <div className="text-[11px] text-dim">to get back to even</div>
              </div>
            ))}
          </div>
          <p className="note mt-4">Losses and gains are not symmetric. Down 50% needs up 100%. Down 90% needs a tenfold return just to be flat, before counting the years it took.</p>
        </Block>

        <Block n={5} title="Maximum absorbable loss">
          <div className="grid grid-cols-2 gap-4">
            <Stat
              label={`Largest one-time loss that still reaches ${fmtUSD(target)}`}
              value={mal.status === 'unreachable' ? 'n/a' : <AnimatedNumber value={mal.loss} format={fmtUSD} />}
              sub={mal.status === 'unreachable' ? '' : ctx.start > 0 ? `${fmtPct((mal.loss / ctx.start) * 100, 0)} of today’s balance` : ''}
              warn={mal.status === 'unreachable'}
            />
            <Stat label="Assumes" value={`${baseRate}% · ${fmtUSD(ctx.monthly)}/mo`} sub="base rate and current pace, held to retirement" />
          </div>
          <p className="note mt-4">
            {mal.status === 'unreachable' ? (
              <>At {baseRate}% and the current pace the target is not reached even without a loss, so there is nothing to absorb. Raise the pace or lower the target.</>
            ) : mal.status === 'all' ? (
              <>
                Right now you could lose the entire balance and still get there. That is not a license: it is true only because your future contributions are doing
                nearly all of the work this early. The number shrinks every year as the balance takes over from the deposits.
              </>
            ) : (
              <>
                Lose more than {fmtUSD(mal.loss)} today and {fmtUSD(target)} is no longer reachable at {baseRate}% without saving more. Early in accumulation this
                number is large because contributions carry the plan; it gets smaller as the balance grows.
              </>
            )}
          </p>
        </Block>
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <span className="label">Target used above</span>
        <NumInput prefix="$" value={target} min={0} className="w-44" onChange={(v) => setSetting('solveTarget', v)} aria-label="Target ending balance" />
      </div>
    </Section>
  )
}
