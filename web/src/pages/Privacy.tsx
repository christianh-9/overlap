import type { ReactNode } from 'react'
import { FEEDBACK } from '../data/links'

const link = 'font-bold text-ink underline underline-offset-4'

export default function Privacy() {
  return (
    <article className="max-w-2xl pt-4 pb-16 lg:pt-10">
      <h1 className="text-3xl leading-tight font-bold">Privacy</h1>
      <p className="mt-2 text-moss">
        What Overlap stores, who can see it, and how to delete it. Last updated November 2026.
      </p>

      <Part title="What we store">
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>Your campus email address, which is how you sign in.</li>
          <li>
            Your profile: display name, major, graduation year, transfer school, bio, contact
            handle, and photo if you add one.
          </li>
          <li>Your classes and the hours you're on campus, each quarter.</li>
          <li>Waves you send, with any note, and meetups you post or join.</li>
          <li>People you've blocked, and reports you've made.</li>
          <li>
            When you request a sign-in code, the IP address it came from, used only to limit
            repeated requests.
          </li>
        </ul>
      </Part>

      <Part title="Who can see what">
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>
            Your profile and photo: other students at your campus. Students at other campuses
            never see you.
          </li>
          <li>Your contact handle: only people you've both waved at.</li>
          <li>A note on your wave: only the person you waved at.</li>
          <li>Your email address: never shown to other students.</li>
          <li>Reports: only the person who runs Overlap, to review them.</li>
        </ul>
        <p className="mt-3">
          Photos are stored at public web addresses that can't be guessed or listed. Anyone with a
          photo's exact address could open it.
        </p>
      </Part>

      <Part title="Services Overlap uses">
        <p>
          The site runs on Vercel, the server on Render, and the database on Neon. Photos are
          stored with Amazon Web Services, and email is sent through Resend. Each of them handles
          your data only to run Overlap.
        </p>
        <p className="mt-3">
          Class times come from Anteater API by ICSSC for UCI and from UCR's public class search.
          Only the section number you enter is sent to them, never anything about you.
        </p>
      </Part>

      <Part title="Emails we send">
        <p>
          Sign-in codes, and an email when someone waves at you or you connect, at most one a day.
          You can turn wave emails off in your profile. We don't send marketing email.
        </p>
      </Part>

      <Part title="Deleting your data">
        <p>
          Delete account in your profile removes your profile, photo, classes, waves, connections,
          and meetups right away. If you were reported, the report is kept with your email
          address, so a ban still works if you sign up again.
        </p>
      </Part>

      <Part title="Questions">
        <p>
          For questions or requests about your data,{' '}
          <a href={FEEDBACK} target="_blank" rel="noreferrer" className={link}>
            send a message
          </a>{' '}
          and leave an email address if you'd like a reply.
        </p>
        <p className="mt-3">
          Overlap is an independent student project. It isn't affiliated with or endorsed by UC
          Irvine or UC Riverside.
        </p>
      </Part>
    </article>
  )
}

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 font-bold">{title}</h2>
      <div className="text-moss">{children}</div>
    </section>
  )
}
