import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { api } from '../api/client'
import { errorMessage, unwrap } from '../api/errors'
import { useMe, useSignOut } from '../api/me'
import type { Profile as Person } from '../api/waves'
import Avatar from '../components/Avatar'
import ProfileForm from '../components/ProfileForm'
import { LoadError, Loading } from '../components/QueryStatus'

const ANTEATER_API = 'https://docs.icssc.club/docs/developer/anteaterapi'
const ICSSC = 'https://studentcouncil.ics.uci.edu/'

export default function Profile() {
  const me = useMe()
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
      title="Your profile"
      intro="What other students see when your free time lines up with theirs."
      submitLabel="Save changes"
    >
      <Section title="Account">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 break-words text-moss">
            Signed in as <span className="font-bold text-ink">{me.data.email}</span>
          </p>
          <button
            type="button"
            onClick={signOut}
            className="h-11 rounded-card border border-ink px-5 font-bold"
          >
            Sign out
          </button>
        </div>
      </Section>

      <Section title="Blocked people">
        <BlockedPeople />
      </Section>

      <Section title="About Overlap">
        <div className="flex flex-col gap-3 text-moss">
          <p>
            Overlap shows you other UCI students whose free time between classes lines up with
            yours, so you can meet through mutual waves and small meetups.
          </p>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            <li>Your profile is shown to students whose gaps overlap yours.</li>
            <li>Your contact handle is shown only to people you've both waved at.</li>
            <li>Your email is never shown to anyone.</li>
          </ul>
          <p>
            If someone makes you uncomfortable, use More on their card in Connections to block or
            report them.
          </p>
          <p>
            Course and schedule data comes from{' '}
            <a href={ANTEATER_API} target="_blank" rel="noreferrer" className={link}>
              Anteater API
            </a>{' '}
            by{' '}
            <a href={ICSSC} target="_blank" rel="noreferrer" className={link}>
              ICSSC
            </a>
            , the ICS Student Council.
          </p>
          <p>
            Overlap is an independent student project. It isn't affiliated with or endorsed by UC
            Irvine.
          </p>
        </div>
      </Section>
    </ProfileForm>
  )
}

const link = 'font-bold text-ink underline underline-offset-4'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-12 border-t border-rule pt-6">
      <h2 className="mb-3 font-bold">{title}</h2>
      {children}
    </section>
  )
}

function BlockedPeople() {
  const queryClient = useQueryClient()
  const [notice, setNotice] = useState<string | null>(null)
  const blocked = useQuery({
    queryKey: ['blocks'],
    queryFn: async () => unwrap(await api.GET('/blocks')),
  })

  const unblock = useMutation({
    mutationFn: async (person: Person) => {
      unwrap(
        await api.DELETE('/users/{user_id}/block', {
          params: { path: { user_id: person.id } },
        }),
      )
      return person
    },
    onSuccess: (person) => {
      queryClient.setQueryData<Person[]>(['blocks'], (old = []) =>
        old.filter((p) => p.id !== person.id),
      )
      // They can show up again in matches, waves, and meetups.
      for (const key of ['matches', 'waves', 'activities']) {
        queryClient.invalidateQueries({ queryKey: [key], refetchType: 'none' })
      }
      setNotice(`${person.display_name} is unblocked. You'll see each other again.`)
    },
    onError: (error) => setNotice(errorMessage(error)),
  })

  if (blocked.isPending) return <p className="text-moss">Loading...</p>
  if (blocked.isError) {
    return (
      <p className="text-moss">
        {errorMessage(blocked.error)}{' '}
        <button type="button" onClick={() => blocked.refetch()} className={link}>
          Try again
        </button>
      </p>
    )
  }

  return (
    <div>
      <p role="status" className="mb-3 text-sm empty:mb-0">
        {notice}
      </p>
      {blocked.data.length === 0 ? (
        <p className="text-moss">You haven't blocked anyone.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-rule">
          {blocked.data.map((person) => {
            const pending = unblock.isPending && unblock.variables?.id === person.id
            return (
              <li key={person.id} className="flex items-center justify-between gap-3 py-3">
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar id={person.id} name={person.display_name} size="sm" />
                  <span className="truncate font-bold">{person.display_name}</span>
                </span>
                <button
                  type="button"
                  onClick={() => unblock.mutate(person)}
                  disabled={pending}
                  aria-label={`Unblock ${person.display_name}`}
                  className="h-10 shrink-0 rounded-card border border-rule px-4 text-sm font-bold disabled:opacity-60"
                >
                  {pending ? 'Unblocking...' : 'Unblock'}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
