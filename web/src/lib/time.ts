// Times are minutes after midnight throughout, which keeps comparisons and
// widths simple. The API weekday counts from Monday = 0.

export type Range = [start: number, end: number]

export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const DAY_LETTERS = ['M', 'Tu', 'W', 'Th', 'F', 'Sa', 'Su']

export function toMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

// The matches API sends shared windows as "10:00-12:00" on a 24-hour clock.
export function parseWindow(window: string): Range {
  const [start, end] = window.split('-')
  return [toMinutes(start), toMinutes(end)]
}

export function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest}m`
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}

// JavaScript counts weekdays from Sunday = 0; the API counts from Monday = 0.
export function weekdayOf(date: Date) {
  return (date.getDay() + 6) % 7
}

function clock(minutes: number) {
  const hours = Math.floor(minutes / 60)
  return `${((hours + 11) % 12) + 1}:${String(minutes % 60).padStart(2, '0')}`
}

function half(minutes: number) {
  return minutes < 12 * 60 ? 'am' : 'pm'
}

export function formatTime(minutes: number) {
  return clock(minutes) + half(minutes)
}

// "9:30–10:50am", or "11:00am–12:20pm" when the range crosses noon.
export function formatRange(start: number, end: number) {
  return half(start) === half(end)
    ? `${clock(start)}–${formatTime(end)}`
    : `${formatTime(start)}–${formatTime(end)}`
}

// Mirrors free_gaps in app/matching.py, so the gaps shown on the schedule are
// exactly the ones matching uses: only time between classes counts.
export function freeGaps(busy: Range[], minGap: number): Range[] {
  const gaps: Range[] = []
  let busyUntil: number | null = null
  for (const [start, end] of [...busy].sort((a, b) => a[0] - b[0] || a[1] - b[1])) {
    if (busyUntil !== null && start - busyUntil >= minGap) gaps.push([busyUntil, start])
    busyUntil = busyUntil === null ? end : Math.max(busyUntil, end)
  }
  return gaps
}

const DAY_START = 8 * 60
const DAY_END = 22 * 60

// 8am to 10pm, widened to the hour around anything that falls outside it.
export function axisFor(ranges: Range[]): Range {
  const starts = ranges.map(([start]) => Math.floor(start / 60) * 60)
  const ends = ranges.map(([, end]) => Math.ceil(end / 60) * 60)
  return [Math.min(DAY_START, ...starts), Math.max(DAY_END, ...ends)]
}
