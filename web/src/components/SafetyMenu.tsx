import { useMutation } from '@tanstack/react-query'
import { useRef, useState, type FormEvent } from 'react'
import { api } from '../api/client'
import { errorMessage, unwrap } from '../api/errors'
import type { components } from '../api/schema'
import type { Profile } from '../api/waves'

type Reason = components['schemas']['ReportIn']['reason']

const REASONS: [Reason, string][] = [
  ['harassment', 'Harassment'],
  ['spam', 'Spam'],
  ['fake_profile', 'Fake profile'],
  ['inappropriate', 'Inappropriate content'],
  ['other', 'Something else'],
]

const button = 'h-10 rounded-card px-4 text-sm font-bold disabled:opacity-60'

// Block and report live behind a native <details>, which already handles
// keyboard and screen reader behavior for show and hide.
export default function SafetyMenu({
  profile,
  onDone,
}: {
  profile: Profile
  onDone: (message: string, removed: boolean) => void
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const [mode, setMode] = useState<'menu' | 'block' | 'report'>('menu')
  const [reason, setReason] = useState<Reason | null>(null)
  const [details, setDetails] = useState('')
  const [alsoBlock, setAlsoBlock] = useState(true)
  const [reasonMissing, setReasonMissing] = useState(false)
  const name = profile.display_name
  const path = { params: { path: { user_id: profile.id } } }

  function close() {
    if (detailsRef.current) detailsRef.current.open = false
    setMode('menu')
  }

  const block = useMutation({
    mutationFn: async () => unwrap(await api.POST('/users/{user_id}/block', path)),
    onSuccess: () => {
      close()
      onDone(`${name} is blocked. You won't see each other in Overlap.`, true)
    },
  })

  const report = useMutation({
    mutationFn: async (chosen: Reason) =>
      unwrap(
        await api.POST('/users/{user_id}/report', {
          ...path,
          body: { reason: chosen, details: details.trim(), block: alsoBlock },
        }),
      ),
    onSuccess: () => {
      close()
      onDone(
        alsoBlock
          ? 'Thanks. Your report was sent, and they are blocked.'
          : 'Thanks. Your report was sent.',
        alsoBlock,
      )
    },
  })

  function submitReport(event: FormEvent) {
    event.preventDefault()
    if (!reason) {
      setReasonMissing(true)
      return
    }
    setReasonMissing(false)
    report.mutate(reason)
  }

  const error = block.error ?? report.error

  return (
    <details ref={detailsRef} className="mt-3 text-sm">
      <summary
        aria-label={`More options for ${name}`}
        className="ml-auto w-fit cursor-pointer list-none rounded-card px-2 py-1 text-moss underline underline-offset-4 hover:text-ink [&::-webkit-details-marker]:hidden"
      >
        More
      </summary>

      <div className="mt-2 rounded-card border border-rule p-3">
        {mode === 'menu' && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMode('block')}
              className={`${button} border border-rule`}
            >
              Block
            </button>
            <button
              type="button"
              onClick={() => setMode('report')}
              className={`${button} border border-rule`}
            >
              Report
            </button>
          </div>
        )}

        {mode === 'block' && (
          <div role="group" aria-label={`Block ${name}`}>
            <p className="font-bold">Block {name}?</p>
            <p className="mt-1 text-moss">
              You won't see each other in matches, waves, connections, or meetups.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => block.mutate()}
                disabled={block.isPending}
                className={`${button} bg-danger text-card`}
              >
                {block.isPending ? 'Blocking...' : 'Block'}
              </button>
              <button
                type="button"
                onClick={() => setMode('menu')}
                autoFocus
                className={`${button} border border-rule`}
              >
                Keep
              </button>
            </div>
          </div>
        )}

        {mode === 'report' && (
          <form onSubmit={submitReport} noValidate>
            <fieldset aria-describedby={reasonMissing ? `reason-error-${profile.id}` : undefined}>
              <legend className="font-bold">Why are you reporting {name}?</legend>
              <div className="mt-2 flex flex-col gap-1">
                {REASONS.map(([value, label]) => (
                  <label key={value} className="flex min-h-9 items-center gap-2">
                    <input
                      type="radio"
                      name={`reason-${profile.id}`}
                      checked={reason === value}
                      onChange={() => {
                        setReason(value)
                        setReasonMissing(false)
                      }}
                      className="size-4 accent-ink"
                    />
                    {label}
                  </label>
                ))}
              </div>
              {reasonMissing && (
                <p id={`reason-error-${profile.id}`} role="alert" className="mt-1 text-danger">
                  Choose a reason.
                </p>
              )}
            </fieldset>

            <label htmlFor={`details-${profile.id}`} className="mt-3 block font-bold">
              Details (optional)
            </label>
            <textarea
              id={`details-${profile.id}`}
              maxLength={1000}
              rows={3}
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              className="mt-1 w-full rounded-card border border-rule bg-card px-3 py-2"
            />

            <label className="mt-2 flex min-h-9 items-center gap-2">
              <input
                type="checkbox"
                checked={alsoBlock}
                onChange={(event) => setAlsoBlock(event.target.checked)}
                className="size-4 accent-ink"
              />
              Also block them
            </label>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={report.isPending}
                className={`${button} bg-ink text-chalk`}
              >
                {report.isPending ? 'Sending...' : 'Send report'}
              </button>
              <button
                type="button"
                onClick={() => setMode('menu')}
                className={`${button} border border-rule`}
              >
                Back
              </button>
            </div>
          </form>
        )}

        {error && (
          <p role="alert" className="mt-2 text-danger">
            {errorMessage(error)}
          </p>
        )}
      </div>
    </details>
  )
}
