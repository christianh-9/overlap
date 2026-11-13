import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { getToken } from '../api/client'
import { useReceivedWaves } from '../api/waves'

const TABS = [
  { to: '/matches', label: 'Matches' },
  { to: '/activities', label: 'Activities' },
  { to: '/connections', label: 'Connections' },
  { to: '/schedule', label: 'Schedule' },
]

function tabClass({ isActive }: { isActive: boolean }) {
  const state = isActive
    ? 'text-ink before:bg-ink md:underline md:underline-offset-4'
    : 'text-moss hover:text-ink'
  return `relative flex h-14 min-w-0 flex-1 items-center justify-center text-[13px] font-bold md:text-sm before:absolute before:inset-x-5 before:top-0 before:h-0.5 before:rounded-full md:h-auto md:flex-none md:before:hidden ${state}`
}

function profileClass({ isActive }: { isActive: boolean }) {
  return `text-sm font-bold ${isActive ? 'text-ink underline underline-offset-4' : 'text-moss hover:text-ink'}`
}

export default function Layout() {
  const { pathname } = useLocation()
  const showTabs = Boolean(getToken()) && pathname !== '/setup'
  const waves = useReceivedWaves({ enabled: showTabs }).data?.length ?? 0

  return (
    <div className="mx-auto min-h-dvh max-w-xl px-4 lg:max-w-5xl lg:px-8">
      <header className="flex items-center justify-between gap-4 py-4">
        <Link to="/" className="text-lg font-bold tracking-tight">
          Overlap
        </Link>
        {showTabs && (
          <div className="flex items-center gap-6">
            <nav
              aria-label="Main"
              className="fixed inset-x-0 bottom-0 z-10 flex border-t border-rule bg-card pb-[env(safe-area-inset-bottom)] md:static md:gap-6 md:border-0 md:bg-transparent md:pb-0"
            >
              {TABS.map((tab) => {
                const count = tab.to === '/connections' ? waves : 0
                return (
                  <NavLink
                    key={tab.to}
                    to={tab.to}
                    className={tabClass}
                    aria-label={
                      count
                        ? `${tab.label}, ${count} new ${count === 1 ? 'wave' : 'waves'}`
                        : undefined
                    }
                  >
                    <span className="relative">
                      {tab.label}
                      {count > 0 && (
                        <span
                          aria-hidden="true"
                          className="absolute -top-2.5 -right-4 grid h-4 min-w-4 place-items-center rounded-full bg-ink px-1 text-[10px] leading-none text-chalk"
                        >
                          {count}
                        </span>
                      )}
                    </span>
                  </NavLink>
                )
              })}
            </nav>
            <NavLink to="/profile" className={profileClass}>
              Profile
            </NavLink>
          </div>
        )}
      </header>
      <main className={showTabs ? 'pb-20 md:pb-0' : undefined}>
        <Outlet />
      </main>
    </div>
  )
}
