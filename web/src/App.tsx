import { Link, Route, Routes } from 'react-router'
import Layout from './components/Layout'

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
      <Route element={<Layout />}>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
