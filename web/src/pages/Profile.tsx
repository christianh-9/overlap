import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ReactNode } from 'react'
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
            onClick={() => signOut()}
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

      <Section title="Delete account">
        <DeleteAccount email={me.data.email} />
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
                  <Avatar id={person.id} name={person.display_name} photoUrl={person.photo_url} size="sm" />
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

function DeleteAccount({ email }: { email: string }) {
  const signOut = useSignOut()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const openRef = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)
  const matches = typed.trim().toLowerCase() === email.toLowerCase()

  useEffect(() => {
    if (wasOpen.current && !open) openRef.current?.focus()
    wasOpen.current = open
  }, [open])

  const remove = useMutation({
    mutationFn: async () => unwrap(await api.DELETE('/me')),
    onSuccess: () => signOut('Your account was deleted.'),
  })

  if (!open) {
    return (
      <div>
        <p className="text-moss">
          This removes your profile, schedule, waves, connections, and the meetups you posted.
          It can't be undone.
        </p>
        <button
          ref={openRef}
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 h-11 rounded-card border border-danger px-5 font-bold text-danger"
        >
          Delete my account
        </button>
      </div>
    )
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (matches) remove.mutate()
      }}
      className="rounded-card border border-danger p-4"
    >
      <p className="font-bold">Delete your account for good?</p>
      <p className="mt-1 text-moss">
        Your profile, schedule, waves, connections, and meetups you posted are removed. You can
        sign up again later, but you'll start from scratch.
      </p>
      <label htmlFor="confirm-email" className="mt-4 block font-bold">
        Type your email to confirm
      </label>
      <input
        id="confirm-email"
        type="email"
        autoComplete="off"
        autoFocus
        placeholder={email}
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        className="mt-2 h-12 w-full rounded-card border border-rule bg-card px-3"
      />
      {remove.error && (
        <p role="alert" className="mt-2 text-danger">
          {errorMessage(remove.error)}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={!matches || remove.isPending}
          className="h-11 rounded-card bg-danger px-5 font-bold text-card disabled:opacity-50"
        >
          {remove.isPending ? 'Deleting...' : 'Delete account'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setTyped('')
            remove.reset()
          }}
          className="h-11 rounded-card border border-rule px-5 font-bold"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
