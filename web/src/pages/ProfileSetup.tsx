import { useNavigate } from 'react-router'
import { useMe, useSignOut } from '../api/me'
import ProfileForm from '../components/ProfileForm'
import { LoadError, Loading } from '../components/QueryStatus'

export default function ProfileSetup() {
  const me = useMe()
  const navigate = useNavigate()
  const signOut = useSignOut()

  if (me.isPending) return <Loading label="Loading your profile..." paused={me.isPaused} />
  if (me.isError) {
    return (
      <LoadError title="Couldn't load your profile" error={me.error} onRetry={() => me.refetch()} />
    )
  }

  return (
    <ProfileForm
      me={me.data}
      title="Set up your profile"
      intro="This is what other students see when your free time lines up with theirs."
      submitLabel="Save profile"
      onSaved={() => navigate('/', { replace: true })}
    >
      <p className="mt-4 text-sm text-moss">
        Signed in as {me.data.email}. Not you?{' '}
        <button type="button" onClick={signOut} className="text-ink underline underline-offset-4">
          Sign out
        </button>
      </p>
    </ProfileForm>
  )
}
