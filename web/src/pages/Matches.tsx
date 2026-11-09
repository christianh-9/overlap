import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { api } from '../api/client'
import { errorMessage, unwrap } from '../api/errors'
import { useMatches, type Match } from '../api/matches'
import { dayRanges, scheduleDays, useSchedule } from '../api/schedule'
import Avatar from '../components/Avatar'
import DayPicker from '../components/DayPicker'
import { LoadError, Loading } from '../components/QueryStatus'
import TimeStrip, { TimeTicks } from '../components/TimeStrip'
import Waking from '../components/Waking'
import {
  axisFor,
  DAY_NAMES,
  formatDuration,
  formatRange,
  freeGaps,
  parseWindow,
  weekdayOf,
  type Range,
} from '../lib/time'
import { useNow } from '../lib/useNow'

const MIN_GAP = 30

function describe(ranges: Range[]) {
  return ranges.map(([start, end]) => formatRange(start, end)).join(', ')
}

export default function Matches() {
  const schedule = useSchedule()
  const now = useNow()
  const today = weekdayOf(now)
  const [picked, setPicked] = useState<number | null>(null)

  const courses = schedule.data ?? []
  const days = scheduleDays(courses)
  const day = picked ?? (days.includes(today) ? today : 0)
  const matches = useMatches(day)

  if (schedule.isPending) {
    return <Loading label="Loading your schedule..." paused={schedule.isPaused} />
  }
  if (schedule.isError) {
    return (
      <LoadError
        title="Couldn't load your schedule"
        error={schedule.error}
        onRetry={() => schedule.refetch()}
      />
    )
  }

  if (courses.length === 0) {
    return (
      <section className="pt-4 pb-16 lg:pt-10">
        <h1 className="text-3xl leading-tight font-bold">Matches</h1>
        <p className="mt-6 max-w-md rounded-card border border-dashed border-moss p-5 text-moss">
          Add your classes first. Matches come from the gaps between them.
        </p>
        <Link
          to="/schedule"
          className="mt-6 inline-flex h-12 items-center rounded-card bg-ink px-6 font-bold text-chalk"
        >
          Add classes
        </Link>
      </section>
    )
  }

  const busy = dayRanges(courses, day)
  const free = freeGaps(busy, MIN_GAP)
  const axis = axisFor(busy)
  const nowMinutes = day === today ? now.getHours() * 60 + now.getMinutes() : undefined
  const dayName = DAY_NAMES[day]

  return (
    <div className="pt-4 pb-16 lg:grid lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start lg:gap-14 lg:pt-10">
      <section aria-labelledby="your-day" className="lg:sticky lg:top-6">
        <h1 className="text-3xl leading-tight font-bold">Matches</h1>
        <p className="mt-2 text-moss">Students free between classes when you are.</p>
        <div className="mt-6">
          <DayPicker days={days} value={day} onChange={setPicked} />
        </div>
        <h2 id="your-day" className="mt-6 font-bold">
          {day === today ? `Today, ${dayName}` : `Your ${dayName}`}
        </h2>
        <div className="mt-2">
          <TimeStrip
            axis={axis}
            busy={busy}
            free={free}
            now={nowMinutes}
            summary={
              free.length
                ? `Your ${dayName}: free between classes ${describe(free)}.`
                : `Your ${dayName}: no gaps between classes.`
            }
          />
          <TimeTicks axis={axis} />
        </div>
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-moss">
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="hatch-moss inline-block size-3 border border-moss" />
            Your classes
          </span>
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block size-3 rounded-sm border border-ink bg-highlighter"
            />
            Free time you share
          </span>
        </p>
      </section>

      <section aria-label={`Matches for ${dayName}`} className="mt-10 lg:mt-0">
        {busy.length === 0 ? (
          <Empty>You don't have classes on {dayName}. Pick another day.</Empty>
        ) : free.length === 0 ? (
          <Empty>
            Your classes on {dayName} don't leave a gap of 30 minutes or more, so there's no free
            time to match.
          </Empty>
        ) : matches.isPending ? (
          <div>
            <p className="font-bold">Finding people free when you are...</p>
            <div className="mt-2">
              <Waking active paused={matches.isPaused} />
            </div>
          </div>
        ) : matches.isError ? (
          <LoadError
            title="Couldn't load matches"
            error={matches.error}
            onRetry={() => matches.refetch()}
          />
        ) : matches.data.length === 0 ? (
          <Empty>
            Nobody else is free during your gaps on {dayName} yet. Check another day, or{' '}
            <Link to="/activities" className="text-ink underline underline-offset-4">
              browse meetups
            </Link>
            .
          </Empty>
        ) : (
          <MatchList
            matches={matches.data}
            day={day}
            axis={axis}
            busy={busy}
            now={nowMinutes}
          />
        )}
      </section>
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-card border border-dashed border-moss p-5 text-moss">{children}</p>
}

function MatchList({
  matches,
  day,
  axis,
  busy,
  now,
}: {
  matches: Match[]
  day: number
  axis: Range
  busy: Range[]
  now?: number
}) {
  const queryClient = useQueryClient()
  const [notice, setNotice] = useState<ReactNode>(null)

  const wave = useMutation({
    mutationFn: async (match: Match) => {
      const path = { params: { path: { user_id: match.profile.id } } }
      if (match.waved) {
        unwrap(await api.DELETE('/waves/{user_id}', path))
        return { mutual: false }
      }
      return unwrap(await api.POST('/waves/{user_id}', path))
    },
    onSuccess: ({ mutual }, match) => {
      queryClient.setQueryData<Match[]>(['matches', day], (old) =>
        old?.map((m) => (m.profile.id === match.profile.id ? { ...m, waved: !match.waved } : m)),
      )
      // The same person can match on other days too, so those lists are now out of date.
      queryClient.invalidateQueries({ queryKey: ['matches'], refetchType: 'none' })
      // A wave can complete a connection or answer one waiting on Connections.
      queryClient.invalidateQueries({ queryKey: ['waves'] })
      // Names often end in an initial ("Leo M."), so they never end a sentence here.
      const name = match.profile.display_name
      setNotice(
        match.waved
          ? `Wave taken back. ${name} won't see it.`
          : mutual
            ? (
              <>
                You and {name} both waved. Their contact is on your{' '}
                <Link to="/connections" className="font-bold underline underline-offset-4">
                  Connections
                </Link>
                .
              </>
            )
            : `${name} will see your wave. If they wave back, you'll both see each other's contact.`,
      )
    },
    onError: (error) => setNotice(errorMessage(error)),
  })

  const windowsFor = (match: Match) => match.windows.map(parseWindow)
  const isFreeNow = (match: Match) =>
    now !== undefined && windowsFor(match).some(([start, end]) => now >= start && now < end)
  // Keep the backend's order (shared classes first), but anyone free right now comes first.
  const ordered = [...matches].sort((a, b) => Number(isFreeNow(b)) - Number(isFreeNow(a)))

  return (
    <>
      <p role="status" className="mb-3 text-sm empty:mb-0">
        {notice}
      </p>
      <ul className="flex flex-col gap-4">
        {ordered.map((match) => (
          <MatchCard
            key={match.profile.id}
            match={match}
            windows={windowsFor(match)}
            freeNow={isFreeNow(match)}
            axis={axis}
            busy={busy}
            now={now}
            waving={wave.isPending && wave.variables?.profile.id === match.profile.id}
            onWave={() => wave.mutate(match)}
          />
        ))}
      </ul>
    </>
  )
}

function MatchCard({
  match,
  windows,
  freeNow,
  axis,
  busy,
  now,
  waving,
  onWave,
}: {
  match: Match
  windows: Range[]
  freeNow: boolean
  axis: Range
  busy: Range[]
  now?: number
  waving: boolean
  onWave: () => void
}) {
  const { profile } = match
  const details = [profile.major, profile.grad_year && `Class of ${profile.grad_year}`]
    .filter(Boolean)
    .join(' · ')
  const reasons = [
    match.shared_courses > 0 &&
      `${match.shared_courses} ${match.shared_courses === 1 ? 'class' : 'classes'} together`,
    match.same_major && 'Same major',
    match.same_transfer_school && `Both transferred from ${profile.transfer_from}`,
  ].filter(Boolean)

  return (
    <li className="rounded-card border border-rule bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar id={profile.id} name={profile.display_name} />
          <div className="min-w-0">
            <h3 className="text-lg font-bold">{profile.display_name}</h3>
            {details && <p className="text-sm text-moss">{details}</p>}
          </div>
        </div>
        {freeNow && (
          <span className="shrink-0 rounded-full border border-ink bg-highlighter px-2.5 py-0.5 text-sm font-bold">
            Free now
          </span>
        )}
      </div>

      <div className="mt-4">
        <TimeStrip
          axis={axis}
          busy={busy}
          shared={windows}
          now={now}
          summary={`Free together ${describe(windows)}.`}
        />
      </div>
      <p className="mt-2 text-sm">
        <span className="font-mono text-[0.9em]">{describe(windows)}</span>
        <span className="text-moss"> · {formatDuration(match.overlap_minutes)} together</span>
      </p>

      {reasons.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Why you match">
          {reasons.map((reason) => (
            <li key={String(reason)} className="rounded-full border border-rule px-2.5 py-0.5 text-sm">
              {reason}
            </li>
          ))}
        </ul>
      )}

      {profile.bio && <p className="mt-3 line-clamp-2 text-sm text-moss">{profile.bio}</p>}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onWave}
          disabled={waving}
          aria-label={
            match.waved
              ? `Waved at ${profile.display_name}. Press to take it back.`
              : `Wave at ${profile.display_name}`
          }
          className={`h-11 rounded-card px-6 font-bold transition-colors disabled:opacity-60 ${
            match.waved ? 'border border-ink bg-card text-ink' : 'bg-ink text-chalk'
          }`}
        >
          {match.waved ? 'Waved' : 'Wave'}
        </button>
      </div>
    </li>
  )
}
