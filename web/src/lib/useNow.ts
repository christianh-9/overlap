import { useEffect, useState } from 'react'

// Re-renders once a minute so anything drawn at "now" keeps up with the clock.
export function useNow() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  return now
}
