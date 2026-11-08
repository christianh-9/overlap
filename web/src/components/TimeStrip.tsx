import type { Range } from '../lib/time'

function position(axis: Range, minutes: number) {
  return ((minutes - axis[0]) / (axis[1] - axis[0])) * 100
}

function span(axis: Range, [start, end]: Range) {
  return { left: `${position(axis, start)}%`, width: `${position(axis, end) - position(axis, start)}%` }
}

// One day drawn to scale: class time hatched, the free gaps between classes
// outlined. The drawing is summarized for screen readers, and every page that
// uses it also lists the same times as text.
export default function TimeStrip({
  axis,
  busy,
  free = [],
  now,
  summary,
}: {
  axis: Range
  busy: Range[]
  free?: Range[]
  now?: number
  summary: string
}) {
  const showNow = now !== undefined && now >= axis[0] && now <= axis[1]

  return (
    <div role="img" aria-label={summary} className="relative h-11 rounded-md border border-rule bg-card">
      {free.map((range) => (
        <div
          key={range[0]}
          className="absolute inset-y-1.5 rounded-sm border border-dashed border-ink"
          style={span(axis, range)}
        />
      ))}
      {busy.map((range) => (
        <div
          key={`${range[0]}-${range[1]}`}
          className="hatch-moss absolute inset-y-0 border-x border-moss"
          style={span(axis, range)}
        />
      ))}
      {showNow && (
        <div
          className="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-full bg-ink"
          style={{ left: `${position(axis, now)}%` }}
        />
      )}
    </div>
  )
}

function tickLabel(minutes: number, first: boolean, last: boolean) {
  const hour = ((minutes / 60 + 11) % 12) + 1
  if (first || last) return `${hour}${minutes < 12 * 60 ? 'a' : 'p'}`
  return String(hour)
}

export function TimeTicks({ axis }: { axis: Range }) {
  const ticks: number[] = []
  for (let minutes = axis[0]; minutes <= axis[1]; minutes += 120) ticks.push(minutes)

  return (
    <div aria-hidden="true" className="relative mt-1.5 h-4 font-mono text-[11px] text-moss">
      {ticks.map((minutes, index) => {
        const first = index === 0
        const last = minutes === axis[1]
        return (
          <span
            key={minutes}
            className={`absolute ${first ? '' : last ? '-translate-x-full' : '-translate-x-1/2'}`}
            style={{ left: `${position(axis, minutes)}%` }}
          >
            {tickLabel(minutes, first, last)}
          </span>
        )
      })}
    </div>
  )
}
