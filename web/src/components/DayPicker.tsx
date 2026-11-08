import { DAY_SHORT } from '../lib/time'

export default function DayPicker({
  days,
  value,
  onChange,
}: {
  days: number[]
  value: number
  onChange: (day: number) => void
}) {
  return (
    <div role="group" aria-label="Day" className="flex gap-1.5">
      {days.map((day) => (
        <button
          key={day}
          type="button"
          aria-pressed={day === value}
          onClick={() => onChange(day)}
          className={`h-10 flex-1 rounded-card border text-sm font-bold ${
            day === value ? 'border-ink bg-ink text-chalk' : 'border-rule bg-card'
          }`}
        >
          {DAY_SHORT[day]}
        </button>
      ))}
    </div>
  )
}
