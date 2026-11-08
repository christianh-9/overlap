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

  return <Navigate to={me.data.display_name === '' ? '/setup' : '/schedule'} replace />
}
