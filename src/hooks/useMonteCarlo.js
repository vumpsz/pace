import { useEffect, useRef, useState } from 'react'

/**
 * Runs the Monte Carlo worker whenever `params` change (debounced), and
 * ignores results from superseded runs.
 */
export function useMonteCarlo(params, { debounce = 300 } = {}) {
  const workerRef = useRef(null)
  const idRef = useRef(0)
  const [state, setState] = useState({ status: 'idle', progress: 0, result: null, error: null })
  const key = JSON.stringify(params)

  useEffect(() => {
    let worker
    try {
      worker = new Worker(new URL('../workers/mc.worker.js', import.meta.url), { type: 'module' })
    } catch (err) {
      setState({ status: 'error', progress: 0, result: null, error: String(err) })
      return
    }
    workerRef.current = worker
    worker.onmessage = (ev) => {
      const { type, id } = ev.data
      if (id !== idRef.current) return
      if (type === 'progress') setState((s) => ({ ...s, status: 'running', progress: ev.data.done / ev.data.total }))
      if (type === 'result') setState({ status: 'done', progress: 1, result: ev.data.result, error: null })
    }
    worker.onerror = (ev) => setState({ status: 'error', progress: 0, result: null, error: ev.message })
    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!workerRef.current) return
    const p = JSON.parse(key)
    if (!p || p.years <= 0) {
      setState({ status: 'idle', progress: 0, result: null, error: null })
      return
    }
    const t = setTimeout(() => {
      const id = ++idRef.current
      setState((s) => ({ ...s, status: 'running', progress: 0 }))
      workerRef.current?.postMessage({ id, params: p })
    }, debounce)
    return () => clearTimeout(t)
  }, [key, debounce])

  return state
}
