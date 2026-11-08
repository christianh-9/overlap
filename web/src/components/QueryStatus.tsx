import { errorMessage } from '../api/errors'
import Waking from './Waking'

export function Loading({ label, paused }: { label: string; paused: boolean }) {
  return (
    <section className="py-12">
      <p className="font-bold">{label}</p>
      <div className="mt-2">
        <Waking active paused={paused} />
      </div>
    </section>
  )
}

export function LoadError({
  title,
  error,
  onRetry,
}: {
  title: string
  error: unknown
  onRetry: () => void
}) {
  return (
    <section className="py-12">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-moss">{errorMessage(error)}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-6 h-11 rounded-card bg-ink px-5 font-bold text-chalk"
      >
        Try again
      </button>
    </section>
  )
}
