import { Link, Route, Routes } from 'react-router'
import Layout from './components/Layout'
import RequireAuth from './components/RequireAuth'
import Activities from './pages/Activities'
import Connections from './pages/Connections'
import Home from './pages/Home'
import Matches from './pages/Matches'
import ProfileSetup from './pages/ProfileSetup'
import Schedule from './pages/Schedule'
import SignIn from './pages/SignIn'

function NotFound() {
  return (
    <section className="py-12">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-moss">This link doesn't go anywhere in Overlap.</p>
      <Link to="/" className="mt-6 inline-block font-bold underline underline-offset-4">
        Go to the home page
      </Link>
    </section>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignIn />} />
      <Route element={<Layout />}>
        <Route element={<RequireAuth />}>
          <Route index element={<Home />} />
          <Route path="setup" element={<ProfileSetup />} />
          <Route path="matches" element={<Matches />} />
          <Route path="activities" element={<Activities />} />
          <Route path="connections" element={<Connections />} />
          <Route path="schedule" element={<Schedule />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
