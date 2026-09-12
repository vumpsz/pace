const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const usd2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function fmtUSD(n, { cents = false } = {}) {
  if (n == null || !Number.isFinite(n)) return '—'
  return (cents ? usd2 : usd0).format(n)
}

export function fmtCompact(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(abs >= 1e10 ? 0 : 1)}B`
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(abs >= 1e7 ? 0 : 1)}M`
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}k`
  return `${sign}$${abs.toFixed(0)}`
}

export function fmtPct(n, d = 1) {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${n.toFixed(d)}%`
}

export function fmtSignedPct(n, d = 1) {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${n > 0 ? '+' : ''}${n.toFixed(d)}%`
}

export function fmtMult(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  if (n >= 100) return `${Math.round(n)}×`
  if (n >= 10) return `${n.toFixed(1)}×`
  return `${n.toFixed(2)}×`
}

export function fmtDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function fmtDateShort(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const now = new Date()
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: dt.getFullYear() === now.getFullYear() ? undefined : '2-digit' })
}

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
