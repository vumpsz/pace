import { useEffect, useRef, useState } from 'react'

const reduceMotion = () =>
  typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)

/** Number that eases from its previous value to the next one. */
export function AnimatedNumber({ value, format = (v) => String(v), duration = 700, className = '' }) {
  const [shown, setShown] = useState(value)
  const fromRef = useRef(value)
  const rafRef = useRef(0)

  useEffect(() => {
    const from = fromRef.current
    const to = value
    // Hidden windows pause requestAnimationFrame, so skip straight to the value there.
    if (!Number.isFinite(from) || !Number.isFinite(to) || reduceMotion() || from === to || (typeof document !== 'undefined' && document.hidden)) {
      fromRef.current = to
      setShown(to)
      return
    }
    const t0 = performance.now()
    cancelAnimationFrame(rafRef.current)
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration)
      const v = from + (to - from) * easeOutCubic(p)
      fromRef.current = v
      setShown(v)
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
      else fromRef.current = to
    }
    rafRef.current = requestAnimationFrame(tick)
    // Safety net: whatever happens to the frame loop, land on the final value.
    const safety = setTimeout(() => {
      cancelAnimationFrame(rafRef.current)
      fromRef.current = to
      setShown(to)
    }, duration + 80)
    return () => {
      cancelAnimationFrame(rafRef.current)
      clearTimeout(safety)
    }
  }, [value, duration])

  return <span className={`tnum ${className}`}>{format(shown)}</span>
}

/** Numeric input that tolerates in-progress typing ("1." "-" "") and commits parsable values. */
const displayNum = (v) => (v == null || v === '' ? '' : Number(v).toLocaleString('en-US', { maximumFractionDigits: 4 }))

export function NumInput({ value, onChange, min, max, step, className = '', suffix, prefix, ...rest }) {
  const [text, setText] = useState(displayNum(value))
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused) setText(displayNum(value))
  }, [value, focused])
  const commit = (input) => {
    const raw = input.replace(/,/g, '')
    setText(input)
    if (raw === '' || raw === '-' || raw === '.' || raw === '-.') return
    const n = Number(raw)
    if (!Number.isFinite(n)) return
    let v = n
    if (min != null && v < min) v = min
    if (max != null && v > max) v = max
    onChange(v)
  }
  return (
    <div className={`relative ${className}`}>
      {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">{prefix}</span>}
      <input
        type="text"
        inputMode="decimal"
        className={`field ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-9' : ''}`}
        value={text}
        onChange={(e) => commit(e.target.value)}
        onFocus={() => {
          setFocused(true)
          setText(value == null ? '' : String(value))
        }}
        onBlur={() => {
          setFocused(false)
          setText(displayNum(value))
        }}
        step={step}
        {...rest}
      />
      {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted text-sm">{suffix}</span>}
    </div>
  )
}

export function Seg({ options, value, onChange, accent = false, ariaLabel }) {
  return (
    <div className="seg" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          className={accent ? 'on-accent' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Labeled({ label, children, hint, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="label block mb-1.5">{label}</span>
      {children}
      {hint && <span className="block mt-1 text-xs text-dim">{hint}</span>}
    </label>
  )
}

export function Section({ id, title, lede, children, className = '' }) {
  return (
    <section id={id} className={`scroll-mt-20 py-12 sm:py-16 ${className}`}>
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">{title}</h2>
        {lede && <p className="note mt-2 max-w-2xl">{lede}</p>}
      </div>
      {children}
    </section>
  )
}

export function Stat({ label, value, sub, big = false, warn = false, accent = false, className = '' }) {
  const color = warn ? 'text-warn' : accent ? 'text-accent' : 'text-fg'
  return (
    <div className={className}>
      <div className="label">{label}</div>
      <div className={`tnum ${big ? 'text-3xl sm:text-4xl' : 'text-xl sm:text-2xl'} font-semibold tracking-tight mt-0.5 ${color}`}>{value}</div>
      {sub && <div className="text-xs text-dim mt-1">{sub}</div>}
    </div>
  )
}

export function TagDot({ tag }) {
  return (
    <span
      aria-label={tag}
      title={tag}
      className={`inline-block w-2 h-2 rounded-full ${tag === 'speculative' ? 'bg-muted ring-1 ring-muted/40 ring-offset-1 ring-offset-bg' : 'bg-fg'}`}
    />
  )
}

export function Callout({ children, warn = false }) {
  return (
    <p className={`text-sm leading-relaxed border-l-2 pl-3 ${warn ? 'border-warn text-fg' : 'border-line text-muted'}`}>{children}</p>
  )
}
