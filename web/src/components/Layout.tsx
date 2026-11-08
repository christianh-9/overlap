import { Link, Outlet } from 'react-router'

export default function Layout() {
  return (
    <div className="mx-auto min-h-dvh max-w-xl px-4 lg:max-w-5xl lg:px-8">
      <header className="py-4">
        <Link to="/" className="text-lg font-bold tracking-tight">
          Overlap
        </Link>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
