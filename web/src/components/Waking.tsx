import { useEffect, useState } from 'react'

// The backend runs on a free instance that sleeps when idle, so the first
// request after a quiet spell can take up to a minute. Only mention it once a
// request has been slow for a few seconds, so fast responses stay silent.
// TanStack Query pauses requests while offline instead of failing them, and
// "paused" says so, since the server isn't the problem then.
export default function Waking({ active, paused = false }: { active: boolean; paused?: boolean }) {
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    if (!active) return
    const timer = setTimeout(() => setSlow(true), 4000)
    return () => {
      clearTimeout(timer)
      setSlow(false)
    }
  }, [active])

  return (
    <p role="status" className="text-sm text-moss">
      {paused
        ? "You're offline. This will go through when you reconnect."
        : slow && 'Waking up the server. The first request can take up to a minute.'}
    </p>
  )
}
