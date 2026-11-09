import type { ReactNode } from 'react'
import { useMe, useSignOut } from '../api/me'
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
