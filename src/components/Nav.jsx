import { ROUTES, href } from '../hooks/useRoute.js'

export default function Nav({ page }) {
  return (
    <>
      <header className="sticky top-0 z-20 bg-bg/85 backdrop-blur border-b border-line">
        <nav className="mx-auto max-w-5xl px-4 sm:px-6 h-12 flex items-center gap-1">
          <a href={href('overview')} className="font-semibold tracking-tight mr-4 shrink-0 flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-accent" aria-hidden="true" />
            Pace
          </a>
          <div className="hidden sm:flex items-center gap-1">
            {ROUTES.map(([id, label]) => (
              <a
                key={id}
                href={href(id)}
                aria-current={page === id ? 'page' : undefined}
                className={`text-sm px-2.5 py-1 rounded transition-colors ${page === id ? 'text-fg bg-raised' : 'text-muted hover:text-fg'}`}
              >
                {label}
              </a>
            ))}
          </div>
          <span className="ml-auto text-[11px] text-dim hidden sm:inline">local only · nothing leaves this device</span>
        </nav>
      </header>
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-20 bg-bg/95 backdrop-blur border-t border-line grid grid-cols-5" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} aria-label="Sections">
        {ROUTES.map(([id, label]) => (
          <a
            key={id}
            href={href(id)}
            aria-current={page === id ? 'page' : undefined}
            className={`flex flex-col items-center justify-center h-14 text-[11px] leading-tight ${page === id ? 'text-accent' : 'text-muted'}`}
          >
            <span className={`w-1 h-1 rounded-full mb-1 ${page === id ? 'bg-accent' : 'bg-transparent'}`} aria-hidden="true" />
            {label.replace('Debts & goals', 'Goals')}
          </a>
        ))}
      </nav>
    </>
  )
}
