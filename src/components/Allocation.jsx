import { useMemo, useState } from 'react'
import { fmtUSD, fmtPct } from '../lib/format.js'
import { AnimatedNumber, NumInput, Seg, Section, Stat, TagDot, Callout } from './ui.jsx'

const MODE_OPTS = [
  { value: 'basis', label: 'Cost basis' },
  { value: 'value', label: 'Current value' },
]

// Neutral shades only. Core reads light, speculative reads dim; the warn color
// is reserved for the over-target state so it always means the same thing.
const CORE_SHADES = ['#e7e9ee', '#c9cdd5', '#aab0ba', '#8f96a3', '#767d8a', '#5f6672']
const SPEC_SHADES = ['#4a505b', '#3b414b', '#2f343d', '#272c34']
const WARN_SHADES = ['#ef6b6b', '#c95a5a', '#a54b4b', '#823c3c']

export default function Allocation({ derived, settings, setSetting }) {
  const { cats, totals, byTag, currentCount } = derived
  const [mode, setMode] = useState(currentCount > 0 ? 'value' : 'basis')
  const key = mode === 'value' ? 'value' : 'basis'
  const total = totals[key]
  const target = settings.targetSpeculativePct
  const specPct = total > 0 ? (byTag.speculative[key] / total) * 100 : 0
  const corePct = total > 0 ? 100 - specPct : 0
  const drift = specPct - target
  const over = total > 0 && drift > 0.05

  const segments = useMemo(() => {
    const core = cats.filter((c) => c.tag === 'core' && c[key] > 0).sort((a, b) => b[key] - a[key])
    const spec = cats.filter((c) => c.tag === 'speculative' && c[key] > 0).sort((a, b) => b[key] - a[key])
    const specShades = over ? WARN_SHADES : SPEC_SHADES
    return [
      ...core.map((c, i) => ({ ...c, color: CORE_SHADES[Math.min(i, CORE_SHADES.length - 1)], pct: (c[key] / total) * 100 })),
      ...spec.map((c, i) => ({ ...c, color: specShades[Math.min(i, specShades.length - 1)], pct: (c[key] / total) * 100 })),
    ]
  }, [cats, key, total, over])

  const rows = useMemo(() => [...cats].sort((a, b) => (a.tag === b.tag ? b[key] - a[key] : a.tag === 'core' ? -1 : 1)), [cats, key])

  return (
    <Section id="allocation" title="Allocation" lede="Where the money sits, as a share of the whole. The speculative sleeve is a rule, not a feeling.">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-6">
        <Seg options={MODE_OPTS} value={mode} onChange={setMode} ariaLabel="Allocation basis" />
        <span className="text-xs text-muted">
          {mode === 'value'
            ? currentCount === cats.length
              ? 'Every category has a current value.'
              : `${currentCount} of ${cats.length} categories have a current value; the rest fall back to cost basis.`
            : 'Cost basis: what you put in, not what it is worth. Set current values in Log to see the real split.'}
        </span>
      </div>

      {total <= 0 ? (
        <p className="note">Nothing to allocate yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-5">
            <Stat label="Core" value={<AnimatedNumber value={corePct} format={(v) => fmtPct(v, 1)} />} sub={fmtUSD(byTag.core[key])} />
            <Stat label="Speculative" value={<AnimatedNumber value={specPct} format={(v) => fmtPct(v, 1)} />} sub={fmtUSD(byTag.speculative[key])} warn={over} />
            <Stat label="Target" value={`${100 - target} / ${target}`} sub="core / speculative" />
            <Stat
              label={over ? 'Over target' : 'Headroom'}
              value={<AnimatedNumber value={Math.abs(drift)} format={(v) => `${v.toFixed(1)} pts`} />}
              sub={over ? fmtUSD((drift / 100) * total) + ' past the line' : fmtUSD((-drift / 100) * total) + ' before the line'}
              warn={over}
            />
          </div>

          <div className="relative pt-4 pb-6">
            <div className="flex h-9 sm:h-10 rounded overflow-hidden" role="img" aria-label={`Allocation: ${fmtPct(corePct)} core, ${fmtPct(specPct)} speculative`}>
              {segments.map((s) => (
                <div
                  key={s.id}
                  className="h-full transition-[width] duration-700 ease-out relative group"
                  style={{ width: `${s.pct}%`, background: s.color }}
                  title={`${s.name} · ${fmtPct(s.pct)} · ${fmtUSD(s[key])}`}
                >
                  {s.pct > 9 && (
                    <span className={`absolute inset-0 flex items-center px-2 text-[11px] truncate ${s.tag === 'core' ? 'text-bg' : 'text-fg'}`}>{s.name}</span>
                  )}
                </div>
              ))}
            </div>
            <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: `${100 - target}%` }}>
              <div className={`w-px h-full ${over ? 'bg-warn' : 'bg-accent'}`} />
              <span className={`absolute -translate-x-1/2 bottom-0 text-[10px] whitespace-nowrap ${over ? 'text-warn' : 'text-accent'}`}>target {target}%</span>
            </div>
          </div>

          {over ? (
            <Callout warn>
              Speculative is <span className="tnum font-medium">{drift.toFixed(1)} points</span> over your {target}% target. Getting back to the line means{' '}
              <span className="tnum font-medium">{fmtUSD((drift / 100) * total)}</span> less in speculative, or the same amount more in core.
            </Callout>
          ) : Math.abs(drift) < 0.05 ? (
            <Callout>Speculative is sitting right on the {target}% target. Any speculative buy from here tips it over unless core grows too.</Callout>
          ) : (
            <Callout>
              Speculative is <span className="tnum">{Math.abs(drift).toFixed(1)} points</span> under target. The sleeve can grow by about{' '}
              <span className="tnum">{fmtUSD(Math.max(0, (-drift / 100) * total))}</span> before it crosses the line, assuming core stays put.
            </Callout>
          )}

          <ul className="mt-6 divide-y divide-line text-sm">
            {rows.map((c) => (
              <li key={c.id} className="py-2 flex items-center gap-3">
                <TagDot tag={c.tag} />
                <span className="grow truncate">{c.name}</span>
                {mode === 'value' && !c.usingCurrent && c.basis > 0 && <span className="text-[10px] text-dim border border-line rounded px-1">basis</span>}
                <span className="tnum text-muted w-24 text-right">{fmtUSD(c[key])}</span>
                <span className={`tnum w-14 text-right ${c.tag === 'speculative' && over ? 'text-warn' : ''}`}>{total > 0 ? fmtPct((c[key] / total) * 100) : '—'}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-6 flex items-center gap-3">
        <label className="label">Speculative target</label>
        <NumInput value={target} min={0} max={100} suffix="%" className="w-28" onChange={(v) => setSetting('targetSpeculativePct', v)} aria-label="Speculative target percent" />
      </div>
    </Section>
  )
}
