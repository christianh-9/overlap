import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useActivities, type Activity } from '../api/activities'
import { api } from '../api/client'
import { ApiError, errorMessage, unwrap } from '../api/errors'
import { useMe } from '../api/me'
import { dayRanges, useSchedule } from '../api/schedule'
import Avatar from '../components/Avatar'
import { LoadError, Loading } from '../components/QueryStatus'
import SubmitButton from '../components/SubmitButton'
import Waking from '../components/Waking'
import {
  dateInputValue,
  dayHeading,
  formatTime,
  freeGaps,
  minutesOf,
  weekdayOf,
  type Range,
} from '../lib/time'
import { useNow } from '../lib/useNow'

const MAX_DAYS_AHEAD = 7
const DAY_MS = 86_400_000

function byStart(a: Activity, b: Activity) {
  return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
}

export default function Activities() {
  const activities = useActivities()
  const me = useMe()

  if (activities.isPending || me.isPending) {
    return <Loading label="Loading meetups..." paused={activities.isPaused || me.isPaused} />
  }
  if (activities.isError) {
    return (
      <LoadError
        title="Couldn't load meetups"
        error={activities.error}
        onRetry={() => activities.refetch()}
      />
    )
  }
  if (me.isError) {
    return (
      <LoadError title="Couldn't load your profile" error={me.error} onRetry={() => me.refetch()} />
    )
  }
  return <ActivitiesView activities={activities.data} myId={me.data.id} />
}

function ActivitiesView({ activities, myId }: { activities: Activity[]; myId: number }) {
  const queryClient = useQueryClient()
  const schedule = useSchedule()
  const now = useNow()
  const [formOpen, setFormOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<number | null>(null)
  const statusRef = useRef<HTMLParagraphElement>(null)

  const update = (change: (old: Activity[]) => Activity[]) =>
    queryClient.setQueryData<Activity[]>(['activities'], (old = []) => change(old))
  const replace = (activity: Activity) =>
    update((old) => old.map((a) => (a.id === activity.id ? activity : a)))

  const join = useMutation({
    mutationFn: async (activity: Activity) =>
      unwrap(
        await api.POST('/activities/{activity_id}/join', {
          params: { path: { activity_id: activity.id } },
        }),
      ),
    onSuccess: (activity) => {
      replace(activity)
      setNotice(`You're going to ${activity.title}.`)
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        setNotice('This meetup just filled up.')
        queryClient.invalidateQueries({ queryKey: ['activities'] })
      } else {
        setNotice(errorMessage(error))
      }
    },
  })

  const leave = useMutation({
    mutationFn: async (activity: Activity) => {
      unwrap(
        await api.POST('/activities/{activity_id}/leave', {
          params: { path: { activity_id: activity.id } },
        }),
      )
      return activity
    },
    onSuccess: (activity) => {
      replace({ ...activity, joined: false, member_count: activity.member_count - 1 })
      setNotice(`You left ${activity.title}.`)
    },
    onError: (error) => setNotice(errorMessage(error)),
  })

  const cancel = useMutation({
    mutationFn: async (activity: Activity) => {
      unwrap(
        await api.DELETE('/activities/{activity_id}', {
          params: { path: { activity_id: activity.id } },
        }),
      )
      return activity
    },
    onSuccess: (activity) => {
      update((old) => old.filter((a) => a.id !== activity.id))
      setConfirming(null)
      setNotice(`Cancelled ${activity.title}.`)
      // The card and its buttons are gone, so give focus somewhere that explains why.
      statusRef.current?.focus()
    },
    onError: (error) => setNotice(errorMessage(error)),
  })

  const busyIds = new Set(
    [join, leave, cancel].filter((m) => m.isPending).map((m) => m.variables?.id),
  )

  // Starts inside one of your free gaps that weekday: the same gaps matching uses.
  const duringFreeTime = (activity: Activity) => {
    if (!schedule.data) return false
    const start = new Date(activity.starts_at)
    const minutes = minutesOf(start)
    return freeGaps(dayRanges(schedule.data, weekdayOf(start)), 30).some(
      ([from, to]: Range) => minutes >= from && minutes < to,
    )
  }

  const groups = new Map<string, Activity[]>()
  for (const activity of [...activities].sort(byStart)) {
    const heading = dayHeading(new Date(activity.starts_at), now)
    groups.set(heading, [...(groups.get(heading) ?? []), activity])
  }

  return (
    <div className="pt-4 pb-16 lg:grid lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start lg:gap-14 lg:pt-10">
      <section aria-labelledby="post-heading" className="lg:sticky lg:top-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl leading-tight font-bold">Activities</h1>
          <button
            type="button"
            onClick={() => setFormOpen(!formOpen)}
            aria-expanded={formOpen}
            aria-controls="post-meetup"
            className="h-11 rounded-card border border-ink px-4 text-sm font-bold lg:hidden"
          >
            {formOpen ? 'Close' : 'Post a meetup'}
          </button>
        </div>
        <p className="mt-2 text-moss">Small meetups at UCI, soonest first.</p>

        <div id="post-meetup" className={`${formOpen ? '' : 'hidden'} mt-6 lg:block`}>
          <h2 id="post-heading" className="font-bold">
            Post a meetup
          </h2>
          <PostForm
            now={now}
            onPosted={(activity) => {
              update((old) => [...old, activity].sort(byStart))
              setFormOpen(false)
              setNotice(`Posted ${activity.title}.`)
            }}
          />
        </div>
      </section>

      <section aria-label="Upcoming meetups" className="mt-10 lg:mt-0">
        <p ref={statusRef} tabIndex={-1} role="status" className="mb-3 text-sm empty:mb-0">
          {notice}
        </p>
        {activities.length === 0 ? (
          <p className="rounded-card border border-dashed border-moss p-5 text-moss">
            No meetups planned yet. Post one, like a study session or lunch between classes.
          </p>
        ) : (
          [...groups].map(([heading, items]) => (
            <div key={heading} className="mb-8">
              <h2 className="mb-3 font-bold">{heading}</h2>
              <ul className="flex flex-col gap-3">
                {items.map((activity) => (
                  <ActivityCard
                    key={activity.id}
                    activity={activity}
                    mine={activity.creator.id === myId}
                    freeTime={duringFreeTime(activity)}
                    busy={busyIds.has(activity.id)}
                    confirming={confirming === activity.id}
                    onJoin={() => join.mutate(activity)}
                    onLeave={() => leave.mutate(activity)}
                    onCancel={() => setConfirming(activity.id)}
                    onConfirmCancel={() => cancel.mutate(activity)}
                    onKeep={() => setConfirming(null)}
                  />
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  )
}

function ActivityCard({
  activity,
  mine,
  freeTime,
  busy,
  confirming,
  onJoin,
  onLeave,
  onCancel,
  onConfirmCancel,
  onKeep,
}: {
  activity: Activity
  mine: boolean
  freeTime: boolean
  busy: boolean
  confirming: boolean
  onJoin: () => void
  onLeave: () => void
  onCancel: () => void
  onConfirmCancel: () => void
  onKeep: () => void
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const wasConfirming = useRef(false)
  useEffect(() => {
    if (wasConfirming.current && !confirming) cancelRef.current?.focus()
    wasConfirming.current = confirming
  }, [confirming])

  const spotsLeft = activity.max_size - activity.member_count
  const full = spotsLeft <= 0
  const button = 'h-11 shrink-0 rounded-card px-5 font-bold disabled:opacity-60'

  return (
    <li className="rounded-card border border-rule bg-card p-5">
      <div className="flex items-start gap-4">
        <p className="w-[4.5rem] shrink-0 pt-0.5 font-mono text-sm">
          {formatTime(minutesOf(new Date(activity.starts_at)))}
        </p>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold break-words">{activity.title}</h3>
          <p className="text-sm break-words">{activity.location}</p>
          <p className="mt-1.5 flex items-center gap-2 text-sm text-moss">
            <Avatar id={activity.creator.id} name={activity.creator.display_name} size="sm" />
            {mine ? 'Posted by you' : `Posted by ${activity.creator.display_name}`}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            {freeTime && (
              <span className="rounded-full border border-ink bg-highlighter px-2.5 py-0.5 font-bold">
                During your free time
              </span>
            )}
            <span className={full ? 'font-bold' : 'text-moss'}>
              {full ? 'Full' : `${spotsLeft} ${spotsLeft === 1 ? 'spot' : 'spots'} left`}
              <span className="text-moss"> · {activity.member_count} going</span>
            </span>
          </div>
        </div>
      </div>

      {confirming ? (
        <div className="mt-4 rounded-card border border-danger p-3" role="group" aria-label="Confirm cancel">
          <p className="text-sm font-bold">Cancel this meetup for everyone who joined?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onConfirmCancel}
              disabled={busy}
              className={`${button} bg-danger text-card`}
            >
              {busy ? 'Cancelling...' : 'Cancel meetup'}
            </button>
            <button
              type="button"
              onClick={onKeep}
              autoFocus
              className={`${button} border border-rule`}
            >
              Keep it
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex justify-end">
          {mine ? (
            <button
              ref={cancelRef}
              type="button"
              onClick={onCancel}
              className={`${button} border border-rule`}
            >
              Cancel
            </button>
          ) : activity.joined ? (
            <button
              type="button"
              onClick={onLeave}
              disabled={busy}
              aria-label={`Leave ${activity.title}`}
              className={`${button} border border-ink`}
            >
              {busy ? 'Leaving...' : 'Leave'}
            </button>
          ) : (
            <button
              type="button"
              onClick={onJoin}
              disabled={busy || full}
              aria-label={full ? `${activity.title} is full` : `Join ${activity.title}`}
              className={`${button} bg-ink text-chalk`}
            >
              {full ? 'Full' : busy ? 'Joining...' : 'Join'}
            </button>
          )}
        </div>
      )}
    </li>
  )
}

const FIELDS = ['title', 'location', 'starts_at', 'max_size'] as const
type Field = (typeof FIELDS)[number]

function PostForm({ now, onPosted }: { now: Date; onPosted: (activity: Activity) => void }) {
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [date, setDate] = useState(dateInputValue(now))
  const [time, setTime] = useState('')
  const [spots, setSpots] = useState('4')
  const [localErrors, setLocalErrors] = useState<Partial<Record<Field, string>>>({})

  const post = useMutation({
    mutationFn: async (startsAt: Date) =>
      unwrap(
        await api.POST('/activities', {
          body: {
            title: title.trim(),
            location: location.trim(),
            starts_at: startsAt.toISOString(),
            max_size: Number(spots),
          },
        }),
      ),
    onSuccess: (activity) => {
      setTitle('')
      setLocation('')
      setTime('')
      setSpots('4')
      onPosted(activity)
    },
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    const errors: Partial<Record<Field, string>> = {}
    if (!title.trim()) errors.title = 'Say what the meetup is.'
    if (!location.trim()) errors.location = 'Say where to meet.'
    // Date and time inputs give local values, so this Date is in local time.
    const startsAt = new Date(`${date}T${time}`)
    const ahead = startsAt.getTime() - Date.now()
    if (!date || !time || Number.isNaN(ahead)) errors.starts_at = 'Pick a day and time.'
    else if (ahead <= 0 || ahead > MAX_DAYS_AHEAD * DAY_MS)
      errors.starts_at = 'Pick a time in the next 7 days.'
    const size = Number(spots)
    if (!Number.isInteger(size) || size < 2 || size > 20) errors.max_size = 'Use 2 to 20 spots.'

    setLocalErrors(errors)
    if (Object.keys(errors).length === 0) post.mutate(startsAt)
  }

  const serverField =
    post.error instanceof ApiError && FIELDS.includes(post.error.field as Field)
      ? (post.error.field as Field)
      : null
  const errors: Partial<Record<Field, string>> = { ...localErrors }
  if (serverField && post.error) errors[serverField] = post.error.message
  const formError = post.error && !serverField ? errorMessage(post.error) : null

  const describe = (id: Field) => ({
    id,
    'aria-invalid': errors[id] ? true : undefined,
    'aria-describedby': errors[id] ? `${id}-error` : undefined,
  })
  const control = 'h-12 w-full min-w-0 rounded-card border border-rule bg-card px-3'

  return (
    <form onSubmit={submit} noValidate className="mt-4 flex flex-col gap-5">
      <Row id="title" label="What" error={errors.title}>
        <input
          {...describe('title')}
          maxLength={100}
          placeholder="Study for STATS 7 midterm"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className={control}
        />
      </Row>
      <Row id="location" label="Where" error={errors.location}>
        <input
          {...describe('location')}
          maxLength={100}
          placeholder="Science Library, 2nd floor"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          className={control}
        />
      </Row>
      <fieldset aria-describedby={errors.starts_at ? 'starts_at-error' : undefined}>
        <legend className="font-bold">When</legend>
        <div className="mt-2 grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-2">
          <label className="sr-only" htmlFor="starts_at">
            Day
          </label>
          <input
            {...describe('starts_at')}
            type="date"
            min={dateInputValue(now)}
            max={dateInputValue(new Date(now.getTime() + MAX_DAYS_AHEAD * DAY_MS))}
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className={control}
          />
          <label className="sr-only" htmlFor="starts_at_time">
            Time
          </label>
          <input
            id="starts_at_time"
            type="time"
            step={300}
            value={time}
            onChange={(event) => setTime(event.target.value)}
            aria-invalid={errors.starts_at ? true : undefined}
            aria-describedby={errors.starts_at ? 'starts_at-error' : undefined}
            className={control}
          />
        </div>
        {errors.starts_at && (
          <p id="starts_at-error" role="alert" className="mt-2 text-danger">
            {errors.starts_at}
          </p>
        )}
      </fieldset>
      <Row id="max_size" label="Spots, including you" error={errors.max_size}>
        <input
          {...describe('max_size')}
          type="number"
          inputMode="numeric"
          min={2}
          max={20}
          value={spots}
          onChange={(event) => setSpots(event.target.value)}
          className={`${control} max-w-[7rem]`}
        />
      </Row>
      <div className="flex flex-col gap-2">
        {formError && (
          <p role="alert" className="text-danger">
            {formError}
          </p>
        )}
        <SubmitButton pending={post.isPending} className="">
          Post meetup
        </SubmitButton>
        <Waking active={post.isPending} paused={post.isPaused} />
      </div>
    </form>
  )
}

function Row({
  id,
  label,
  error,
  children,
}: {
  id: string
  label: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-bold">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
