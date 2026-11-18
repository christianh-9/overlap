import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { api } from '../api/client'
import { errorMessage, unwrap } from '../api/errors'
import {
  useConnections,
  useReceivedWaves,
  type Connection,
  type Profile,
  type ReceivedWave,
} from '../api/waves'
import Avatar from '../components/Avatar'
import { LoadError, Loading } from '../components/QueryStatus'
import SafetyMenu from '../components/SafetyMenu'

export default function Connections() {
  const queryClient = useQueryClient()
  const received = useReceivedWaves()
  const connections = useConnections()
  const [notice, setNotice] = useState<string | null>(null)
  const statusRef = useRef<HTMLParagraphElement>(null)

  const waveBack = useMutation({
    mutationFn: async (profile: Profile) =>
      unwrap(
        await api.POST('/waves/{user_id}', { params: { path: { user_id: profile.id } } }),
      ),
    onSuccess: (_, profile) => {
      queryClient.setQueryData<ReceivedWave[]>(['waves', 'received'], (old = []) =>
        old.filter((wave) => wave.profile.id !== profile.id),
      )
      // wave response has no contact
      queryClient.invalidateQueries({ queryKey: ['waves', 'connections'] })
      queryClient.invalidateQueries({ queryKey: ['matches'], refetchType: 'none' })
      setNotice(`You and ${profile.display_name} are connected. Their contact is in your connections.`)
      statusRef.current?.focus()
    },
    onError: (error) => setNotice(errorMessage(error)),
  })

  function safetyDone(profile: Profile, message: string, removed: boolean) {
    if (removed) {
      queryClient.setQueryData<ReceivedWave[]>(['waves', 'received'], (old = []) =>
        old.filter((wave) => wave.profile.id !== profile.id),
      )
      queryClient.setQueryData<Connection[]>(['waves', 'connections'], (old = []) =>
        old.filter((c) => c.profile.id !== profile.id),
      )
      queryClient.invalidateQueries({ queryKey: ['matches'], refetchType: 'none' })
      queryClient.invalidateQueries({ queryKey: ['activities'], refetchType: 'none' })
      queryClient.invalidateQueries({ queryKey: ['blocks'], refetchType: 'none' })
    }
    setNotice(message)
    statusRef.current?.focus()
  }

  return (
    <div className="pt-4 pb-16 lg:pt-10">
      <h1 className="text-3xl leading-tight font-bold">Connections</h1>
      <p className="mt-2 text-moss">
        Waves you've received, and people you've both waved at.
      </p>
      <p ref={statusRef} tabIndex={-1} role="status" className="mt-4 text-sm empty:mt-0">
        {notice}
      </p>

      <div className="mt-8 flex flex-col gap-12 lg:grid lg:grid-cols-2 lg:items-start lg:gap-12">
        <section aria-labelledby="waves-heading">
          <h2 id="waves-heading" className="font-bold">
            Waves for you{received.data?.length ? ` (${received.data.length})` : ''}
          </h2>
          <div className="mt-3">
            {received.isPending ? (
              <Loading label="Loading waves..." paused={received.isPaused} />
            ) : received.isError ? (
              <LoadError
                title="Couldn't load waves"
                error={received.error}
                onRetry={() => received.refetch()}
              />
            ) : received.data.length === 0 ? (
              <Empty>No new waves. When someone waves at you from Matches, they show up here.</Empty>
            ) : (
              <ul className="flex flex-col gap-3">
                {received.data.map(({ profile, note }) => {
                  const pending = waveBack.isPending && waveBack.variables?.id === profile.id
                  return (
                    <PersonCard key={profile.id} profile={profile}>
                      {note && (
                        <p className="mt-3 border-l-2 border-ink pl-3 text-sm">
                          <span className="sr-only">Note from {profile.display_name}: </span>
                          {note}
                        </p>
                      )}
                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          onClick={() => waveBack.mutate(profile)}
                          disabled={pending}
                          aria-label={`Wave back at ${profile.display_name}`}
                          className="h-11 rounded-card bg-ink px-5 font-bold text-chalk disabled:opacity-60"
                        >
                          {pending ? 'Waving...' : 'Wave back'}
                        </button>
                      </div>
                      <SafetyMenu
                        profile={profile}
                        onDone={(message, removed) => safetyDone(profile, message, removed)}
                      />
                    </PersonCard>
                  )
                })}
              </ul>
            )}
          </div>
        </section>

        <section aria-labelledby="connections-heading">
          <h2 id="connections-heading" className="font-bold">
            Your connections{connections.data?.length ? ` (${connections.data.length})` : ''}
          </h2>
          <div className="mt-3">
            {connections.isPending ? (
              <Loading label="Loading connections..." paused={connections.isPaused} />
            ) : connections.isError ? (
              <LoadError
                title="Couldn't load connections"
                error={connections.error}
                onRetry={() => connections.refetch()}
              />
            ) : connections.data.length === 0 ? (
              <Empty>
                When you and someone both wave, their contact handle shows up here.{' '}
                <Link to="/matches" className="text-ink underline underline-offset-4">
                  Find people on Matches
                </Link>
                .
              </Empty>
            ) : (
              <ul className="flex flex-col gap-3">
                {connections.data.map((connection) => (
                  <PersonCard key={connection.profile.id} profile={connection.profile}>
                    <Contact connection={connection} />
                    <SafetyMenu
                      profile={connection.profile}
                      onDone={(message, removed) => safetyDone(connection.profile, message, removed)}
                    />
                  </PersonCard>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-card border border-dashed border-moss p-5 text-moss">{children}</p>
}

function PersonCard({ profile, children }: { profile: Profile; children: ReactNode }) {
  const details = [profile.major, profile.grad_year && `Class of ${profile.grad_year}`]
    .filter(Boolean)
    .join(' · ')
  return (
    <li className="rounded-card border border-rule bg-card p-5">
      <div className="flex items-center gap-3">
        <Avatar id={profile.id} name={profile.display_name} photoUrl={profile.photo_url} />
        <div className="min-w-0">
          <h3 className="text-lg font-bold">{profile.display_name}</h3>
          {details && <p className="text-sm text-moss">{details}</p>}
        </div>
      </div>
      {profile.is_transfer && profile.transfer_from && (
        <p className="mt-1 text-sm">Transferred from {profile.transfer_from}</p>
      )}
      {profile.bio && <p className="mt-2 line-clamp-2 text-sm text-moss">{profile.bio}</p>}
      {children}
    </li>
  )
}

function Contact({ connection }: { connection: Connection }) {
  const [copied, setCopied] = useState(false)

  if (!connection.contact) {
    return (
      <p className="mt-4 border-t border-rule pt-3 text-sm text-moss">
        They haven't added a contact handle yet.
      </p>
    )
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(connection.contact ?? '')
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
    }
  }

  return (
    <div className="mt-4 flex items-center justify-between gap-3 border-t border-rule pt-3">
      <div className="min-w-0">
        <p className="text-sm text-moss">Contact</p>
        <p className="font-bold break-words select-all">{connection.contact}</p>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? 'Copied' : `Copy ${connection.profile.display_name}'s contact`}
        className="h-10 shrink-0 rounded-card border border-rule px-4 text-sm font-bold"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}
