import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { api } from '../api/client'
import { errorMessage, unwrap } from '../api/errors'
import { dayRanges, scheduleDays, useSchedule, type Course } from '../api/schedule'
import { useTerm } from '../api/term'
import DayPicker from '../components/DayPicker'
import { LoadError, Loading } from '../components/QueryStatus'
import SubmitButton from '../components/SubmitButton'
import TimeStrip, { TimeTicks } from '../components/TimeStrip'
import Waking from '../components/Waking'
import {
  axisFor,
  DAY_LETTERS,
  DAY_NAMES,
  DAY_SHORT,
  formatRange,
  freeGaps,
  toMinutes,
  weekdayOf,
  type Range,
} from '../lib/time'
import { useNow } from '../lib/useNow'

const MIN_GAP = 30
const WEBSOC = 'https://www.reg.uci.edu/perl/WebSoc'

function courseName(course: Course) {
  return `${course.dept} ${course.number}`
}

function summarize(weekday: number, busy: Range[], free: Range[]) {
  const day = DAY_NAMES[weekday]
  if (busy.length === 0) return `${day}: no classes.`
  const classes = `${busy.length} ${busy.length === 1 ? 'class' : 'classes'}`
  const gaps = free.length
    ? `Free between classes ${free.map(([start, end]) => formatRange(start, end)).join(', ')}.`
    : 'No gaps of 30 minutes or more.'
  return `${day}: ${classes}. ${gaps}`
}

// "MWF 9:00–9:50am · ICS 174": meetings at the same time and place share a line.
function groupMeetings(meetings: Course['meetings']) {
  const groups = new Map<string, { days: number[]; range: Range; location: string | null }>()
  for (const meeting of meetings) {
    const key = `${meeting.start_time}|${meeting.end_time}|${meeting.location ?? ''}`
    const group = groups.get(key) ?? {
      days: [],
      range: [toMinutes(meeting.start_time), toMinutes(meeting.end_time)] as Range,
      location: meeting.location,
    }
    group.days.push(meeting.weekday)
    groups.set(key, group)
  }
  return [...groups.values()]
    .map((group) => ({ ...group, days: group.days.sort((a, b) => a - b) }))
    .sort((a, b) => a.days[0] - b.days[0] || a.range[0] - b.range[0])
}

export default function Schedule() {
  const schedule = useSchedule()

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
  return <ScheduleView courses={schedule.data} />
}

function ScheduleView({ courses }: { courses: Course[] }) {
  const queryClient = useQueryClient()
  const term = useTerm().data?.label
  const now = useNow()
  const today = weekdayOf(now)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  const days = scheduleDays(courses)
  const [day, setDay] = useState(days.includes(today) ? today : 0)
  const [code, setCode] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ text: string; undo?: string } | null>(null)

  const add = useMutation({
    mutationFn: async (courseCode: string) =>
      unwrap(await api.POST('/schedule/courses', { body: { course_code: courseCode } })),
    onSuccess: (course) => {
      queryClient.setQueryData<Course[]>(['schedule'], (old = []) =>
        old.some((existing) => existing.id === course.id) ? old : [...old, course],
      )
      queryClient.invalidateQueries({ queryKey: ['matches'] })
      setCode('')
      setNotice({ text: `Added ${courseName(course)}.` })
    },
  })

  const drop = useMutation({
    mutationFn: async (course: Course) => {
      unwrap(
        await api.DELETE('/schedule/courses/{course_id}', {
          params: { path: { course_id: course.id } },
        }),
      )
      return course
    },
    onSuccess: (course) => {
      queryClient.setQueryData<Course[]>(['schedule'], (old = []) =>
        old.filter((existing) => existing.id !== course.id),
      )
      queryClient.invalidateQueries({ queryKey: ['matches'] })
      setNotice({ text: `Dropped ${courseName(course)}.`, undo: course.course_code })
    },
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    setNotice(null)
    if (!/^\d{5}$/.test(code)) {
      setLocalError('Enter the 5-digit section code.')
    } else if (courses.some((course) => course.course_code === code)) {
      setLocalError('That class is already in your schedule.')
    } else {
      setLocalError(null)
      add.mutate(code)
    }
  }

  const addError = localError ?? (add.error ? errorMessage(add.error) : null)
  const sorted = [...courses].sort(
    (a, b) =>
      courseName(a).localeCompare(courseName(b), undefined, { numeric: true }) ||
      a.course_code.localeCompare(b.course_code),
  )
  const axis = axisFor(days.flatMap((weekday) => dayRanges(courses, weekday)))

  return (
    <div className="pt-4 pb-16 lg:grid lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start lg:gap-16 lg:pt-10">
      <div>
        <h1 className="text-3xl leading-tight font-bold">Schedule</h1>
        {term && <p className="mt-1 text-moss">{term} classes</p>}

        <form onSubmit={submit} noValidate className="mt-6 flex flex-col gap-2">
          <label htmlFor="course_code" className="font-bold">
            Add a class
          </label>
          <div className="flex gap-2">
            <input
              id="course_code"
              inputMode="numeric"
              autoComplete="off"
              maxLength={5}
              placeholder="5-digit code"
              value={code}
              onChange={(event) => {
                setCode(event.target.value.replace(/\D/g, ''))
                setLocalError(null)
              }}
              aria-invalid={addError ? true : undefined}
              aria-describedby={`course_code-hint${addError ? ' course_code-error' : ''}`}
              className="h-12 min-w-0 flex-1 rounded-card border border-rule bg-card px-3 font-mono tracking-widest placeholder:font-sans placeholder:tracking-normal"
            />
            <SubmitButton pending={add.isPending} className="shrink-0">
              Add class
            </SubmitButton>
          </div>
          <p id="course_code-hint" className="text-sm text-moss">
            Section codes are listed in the{' '}
            <a href={WEBSOC} target="_blank" rel="noreferrer" className="text-ink underline underline-offset-4">
              Schedule of Classes
            </a>
            .
          </p>
          {addError && (
            <p id="course_code-error" role="alert" className="text-danger">
              {addError}
            </p>
          )}
          <Waking active={add.isPending} paused={add.isPaused} />
        </form>

        <p role="status" className="mt-2 text-sm">
          {notice?.text}{' '}
          {notice?.undo && (
            <button
              type="button"
              onClick={() => notice.undo && add.mutate(notice.undo)}
              disabled={add.isPending}
              className="font-bold underline underline-offset-4"
            >
              Add it back
            </button>
          )}
        </p>

        {courses.length === 0 ? (
          <p className="mt-8 rounded-card border border-dashed border-moss p-5 text-moss">
            Add your {term ? `${term} ` : ''}classes to see your free time. Section codes are the
            5-digit numbers in the Schedule of Classes.
          </p>
        ) : (
          <>
            <section className="mt-8 lg:hidden" aria-labelledby="day-heading">
              <DayPicker days={days} value={day} onChange={setDay} />
              <h2 id="day-heading" className="mt-5 font-bold">
                {day === today ? `Today, ${DAY_NAMES[day]}` : DAY_NAMES[day]}
              </h2>
              <DayStrip
                axis={axis}
                courses={courses}
                weekday={day}
                now={day === today ? nowMinutes : undefined}
              />
              <TimeTicks axis={axis} />
              <FreeText busy={dayRanges(courses, day)} weekday={day} />
            </section>

            <section className="mt-10">
              <h2 className="font-bold">Your classes ({courses.length})</h2>
              {drop.error && (
                <p role="alert" className="mt-2 text-danger">
                  {errorMessage(drop.error)}
                </p>
              )}
              <ul className="mt-3 divide-y divide-rule rounded-card border border-rule bg-card">
                {sorted.map((course) => {
                  const dropping = drop.isPending && drop.variables?.id === course.id
                  return (
                    <li key={course.id} className="flex items-start justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <p className="font-bold">
                          {courseName(course)}{' '}
                          <span className="font-normal text-moss">· {course.title}</span>
                        </p>
                        <p className="mt-1 font-mono text-sm">{course.course_code}</p>
                        {course.meetings.length === 0 ? (
                          <p className="text-sm text-moss">No set meeting times</p>
                        ) : (
                          groupMeetings(course.meetings).map((group) => (
                            <p key={`${group.days.join()}-${group.range[0]}`} className="text-sm">
                              {group.days.map((weekday) => DAY_LETTERS[weekday]).join('')}{' '}
                              <span className="font-mono text-[0.9em]">{formatRange(...group.range)}</span>
                              {group.location && (
                                <span className="text-moss"> · {group.location}</span>
                              )}
                            </p>
                          ))
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => drop.mutate(course)}
                        disabled={dropping}
                        aria-label={`Drop ${courseName(course)}, section ${course.course_code}`}
                        className="h-9 shrink-0 rounded-card border border-rule px-3 text-sm font-bold disabled:opacity-60"
                      >
                        {dropping ? 'Dropping...' : 'Drop'}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          </>
        )}
      </div>

      {courses.length > 0 && (
        <section className="hidden lg:block" aria-labelledby="week-heading">
          <h2 id="week-heading" className="font-bold">
            Your week
          </h2>
          <p className="mt-1 text-sm text-moss">
            Dashed outlines are the gaps between classes that matching uses.
          </p>
          <div className="mt-5 flex flex-col gap-4">
            {days.map((weekday) => (
              <div key={weekday} className="grid grid-cols-[3rem_minmax(0,1fr)] items-start gap-3">
                <p className={`pt-3 text-sm ${weekday === today ? 'font-bold' : 'text-moss'}`}>
                  {DAY_SHORT[weekday]}
                </p>
                <div>
                  <DayStrip
                    axis={axis}
                    courses={courses}
                    weekday={weekday}
                    now={weekday === today ? nowMinutes : undefined}
                  />
                  <FreeText busy={dayRanges(courses, weekday)} weekday={weekday} compact />
                </div>
              </div>
            ))}
            <div className="grid grid-cols-[3rem_minmax(0,1fr)] gap-3">
              <span />
              <TimeTicks axis={axis} />
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

function DayStrip({
  axis,
  courses,
  weekday,
  now,
}: {
  axis: Range
  courses: Course[]
  weekday: number
  now?: number
}) {
  const busy = dayRanges(courses, weekday)
  const free = freeGaps(busy, MIN_GAP)
  return (
    <TimeStrip
      axis={axis}
      busy={busy}
      free={free}
      now={now}
      summary={summarize(weekday, busy, free)}
    />
  )
}

function FreeText({ busy, weekday, compact = false }: { busy: Range[]; weekday: number; compact?: boolean }) {
  const free = freeGaps(busy, MIN_GAP)
  const size = compact ? 'mt-1.5 text-xs' : 'mt-3 text-sm'

  if (busy.length === 0) {
    return <p className={`${size} text-moss`}>No classes on {DAY_NAMES[weekday]}.</p>
  }
  if (busy.length === 1) {
    return <p className={`${size} text-moss`}>One class, so no gaps between classes.</p>
  }
  if (free.length === 0) {
    return <p className={`${size} text-moss`}>No gaps of 30 minutes or more between classes.</p>
  }
  return (
    <p className={size}>
      Free between classes:{' '}
      <span className="font-mono text-[0.9em]">
        {free.map(([start, end]) => formatRange(start, end)).join(', ')}
      </span>
    </p>
  )
}
