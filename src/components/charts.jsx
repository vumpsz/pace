import { ResponsiveContainer } from 'recharts'

export const C = {
  accent: '#e9b949',
  warn: '#ef6b6b',
  fg: '#e7e9ee',
  muted: '#8f96a3',
  dim: '#5c6370',
  line: '#222732',
  surface: '#12151b',
}

// Neutral ramp for the non-selected rate lines, dark to light.
export const GRAYS = ['#3f4652', '#565d6a', '#6f7683', '#8f96a3', '#b3b9c3']

export const axis = {
  axisLine: false,
  tickLine: false,
  tick: { fill: C.dim, fontSize: 11 },
}

export const cursor = { stroke: C.line, strokeWidth: 1 }

export function Frame({ height = 260, children, className = '' }) {
  return (
    <div className={`w-full ${className}`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  )
}

/** Dark, minimal tooltip. `rows` maps a payload into [{label, value, color}]. */
export function Tip({ active, payload, label, title, rows }) {
  if (!active || !payload?.length) return null
  const items = rows ? rows(payload, label) : payload.map((p) => ({ label: p.name, value: p.value, color: p.color }))
  return (
    <div className="rounded-md border border-line bg-surface/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
      {title && <div className="text-muted mb-1">{title(label, payload)}</div>}
      {items.map((r, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-muted">
            {r.color && <span className="inline-block w-2 h-2 rounded-sm" style={{ background: r.color }} />}
            {r.label}
          </span>
          <span className="tnum" style={{ color: r.strong ? C.fg : undefined }}>
            {r.value}
          </span>
        </div>
      ))}
    </div>
  )
}
