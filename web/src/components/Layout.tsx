import { Link, NavLink, Outlet } from 'react-router'
import { getToken } from '../api/client'

function navClass({ isActive }: { isActive: boolean }) {
  return isActive ? 'font-bold underline underline-offset-4' : 'text-moss hover:text-ink'
}

export default function Layout() {
  return (
    <div className="mx-auto min-h-dvh max-w-xl px-4 lg:max-w-5xl lg:px-8">
      <header className="flex items-center justify-between gap-4 py-4">
        <Link to="/" className="text-lg font-bold tracking-tight">
          Overlap
        </Link>
        {getToken() && (
          <nav aria-label="Main" className="flex gap-5 text-sm">
            <NavLink to="/schedule" className={navClass}>
              Schedule
            </NavLink>
            <NavLink to="/setup" className={navClass}>
              Edit profile
            </NavLink>
          </nav>
        )}
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
