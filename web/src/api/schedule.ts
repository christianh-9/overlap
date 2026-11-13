import { useQuery } from '@tanstack/react-query'
import { api } from './client'
import { unwrap } from './errors'
import { toMinutes, type Range } from '../lib/time'
import type { components } from './schema'

export type Course = components['schemas']['CourseOut']
export type CampusHours = components['schemas']['CampusHoursOut']

export function useSchedule() {
  return useQuery({
    queryKey: ['schedule'],
    queryFn: async () => unwrap(await api.GET('/schedule')),
  })
}

export function scheduleDays(courses: Course[]) {
  const weekend = [5, 6].filter((day) =>
    courses.some((course) => course.meetings.some((meeting) => meeting.weekday === day)),
  )
  return [0, 1, 2, 3, 4, ...weekend]
}

export function dayRanges(courses: Course[], weekday: number): Range[] {
  return courses.flatMap((course) =>
    course.meetings
      .filter((meeting) => meeting.weekday === weekday)
      .map((meeting): Range => [toMinutes(meeting.start_time), toMinutes(meeting.end_time)]),
  )
}

export function useCampusHours() {
  return useQuery({
    queryKey: ['campus-hours'],
    queryFn: async () => unwrap(await api.GET('/schedule/hours')),
  })
}

export function hoursOn(hours: CampusHours[] | undefined, weekday: number): Range | null {
  const day = hours?.find((h) => h.weekday === weekday)
  return day ? [toMinutes(day.start_time), toMinutes(day.end_time)] : null
}
