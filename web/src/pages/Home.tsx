import { Navigate } from 'react-router'
import { useMe } from '../api/me'
import { LoadError, Loading } from '../components/QueryStatus'

export default function Home() {
  const me = useMe()

  if (me.isPending) return <Loading label="Loading your profile..." paused={me.isPaused} />
  if (me.isError) {
    return (
      <LoadError title="Couldn't load your profile" error={me.error} onRetry={() => me.refetch()} />
    )
  }

  if (me.data.display_name === '') return <Navigate to="/setup" replace />

  return (
    <section className="py-12">
      <h1 className="text-2xl font-bold">You're all set, {me.data.display_name}</h1>
      <p className="mt-2 text-moss">Your profile is saved.</p>
    </section>
  )
}
