import { useCallback, useEffect, useState } from 'react'

export const ROUTES = [
  ['overview', 'Overview'],
  ['spend', 'Spending'],
  ['invest', 'Investing'],
  ['plan', 'Plan'],
  ['goals', 'Debts & goals'],
]
const IDS = new Set(ROUTES.map((r) => r[0]))

function parse() {
  const h = (typeof window !== 'undefined' ? window.location.hash : '').replace(/^#\/?/, '')
  const [page, sub] = h.split('/')
  return { page: IDS.has(page) ? page : 'overview', sub: sub || null }
}

export function useRoute() {
  const [route, setRoute] = useState(parse)
  useEffect(() => {
    const on = () => setRoute(parse())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  useEffect(() => {
    if (route.sub) {
      const el = document.getElementById(route.sub)
      if (el) el.scrollIntoView({ block: 'start' })
    } else {
      window.scrollTo(0, 0)
    }
  }, [route])
  const navigate = useCallback((page, sub) => {
    window.location.hash = `#/${page}${sub ? `/${sub}` : ''}`
  }, [])
  return { ...route, navigate }
}

export const href = (page, sub) => `#/${page}${sub ? `/${sub}` : ''}`
