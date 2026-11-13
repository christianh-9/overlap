import { useEffect, useState } from 'react'

// render's free tier sleeps, first request can take a minute
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
