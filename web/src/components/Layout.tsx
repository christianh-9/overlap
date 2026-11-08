import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { getToken } from '../api/client'

const TABS = [
  { to: '/matches', label: 'Matches' },
  { to: '/activities', label: 'Activities' },
  { to: '/schedule', label: 'Schedule' },
  { to: '/setup', label: 'Profile' },
]

function tabClass({ isActive }: { isActive: boolean }) {
  const state = isActive
    ? 'text-ink before:bg-ink md:underline md:underline-offset-4'
    : 'text-moss hover:text-ink'
  return `relative flex h-14 flex-1 items-center justify-center text-sm font-bold before:absolute before:inset-x-6 before:top-0 before:h-0.5 before:rounded-full md:h-auto md:flex-none md:before:hidden ${state}`
}

export default function Layout() {
  const { pathname } = useLocation()
  // New students finish setting up their profile before the rest of the app.
  const showTabs = getToken() && pathname !== '/setup'

  return (
    <div className="mx-auto min-h-dvh max-w-xl px-4 lg:max-w-5xl lg:px-8">
      <header className="flex items-center justify-between gap-4 py-4">
        <Link to="/" className="text-lg font-bold tracking-tight">
          Overlap
        </Link>
        {showTabs && (
          // One nav for both sizes: a bar fixed to the bottom on phones, within
          // thumb reach, and plain header links from md up.
          <nav
            aria-label="Main"
            className="fixed inset-x-0 bottom-0 z-10 flex border-t border-rule bg-card pb-[env(safe-area-inset-bottom)] md:static md:gap-6 md:border-0 md:bg-transparent md:pb-0"
          >
            {TABS.map((tab) => (
              <NavLink key={tab.to} to={tab.to} className={tabClass}>
                {tab.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>
      <main className={showTabs ? 'pb-20 md:pb-0' : undefined}>
        <Outlet />
      </main>
    </div>
  )
}
