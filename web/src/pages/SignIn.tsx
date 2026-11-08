import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { api, getToken, setToken } from '../api/client'
import { errorMessage, unwrap } from '../api/errors'
import SubmitButton from '../components/SubmitButton'
import Waking from '../components/Waking'

// request-code has no response model on the backend, so its type is unknown.
// In local dev mode it includes the code so no email has to be sent.
function devCode(body: unknown) {
  const code = (body as { dev_code?: unknown } | undefined)?.dev_code
  return typeof code === 'string' ? code : null
}

export default function SignIn() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  const requestCode = useMutation({
    mutationFn: async (address: string) =>
      unwrap(await api.POST('/auth/request-code', { body: { email: address } })),
    onSuccess: (_, address) => {
      setSentTo(address)
      setCode('')
    },
  })

  const verify = useMutation({
    mutationFn: async () =>
      unwrap(await api.POST('/auth/verify', { body: { email: sentTo ?? '', code } })),
    onSuccess: ({ access_token }) => {
      setToken(access_token)
      navigate('/', { replace: true })
    },
  })

  function submitEmail(event: FormEvent) {
    event.preventDefault()
    const address = email.trim().toLowerCase()
    if (!address.endsWith('@uci.edu')) {
      setLocalError('Use your @uci.edu email address.')
      return
    }
    setLocalError(null)
    requestCode.mutate(address)
  }

  function submitCode(event: FormEvent) {
    event.preventDefault()
    if (code.length !== 6) {
      setLocalError('Enter the 6-digit code from the email.')
      return
    }
    setLocalError(null)
    verify.mutate()
  }

  function changeEmail() {
    setSentTo(null)
    setLocalError(null)
    requestCode.reset()
    verify.reset()
  }

  const pending = requestCode.isPending || verify.isPending
  const failed = sentTo ? verify.error ?? requestCode.error : requestCode.error
  const error = localError ?? (failed ? errorMessage(failed) : null)
  const dev = sentTo ? devCode(requestCode.data) : null
  const errorText = error && (
    <p id="sign-in-error" role="alert" className="text-danger">
      {error}
    </p>
  )

  // After all hooks, because hooks must run in the same order on every render.
  if (getToken()) return <Navigate to="/" replace />

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col px-4 pt-16 pb-10 lg:max-w-5xl lg:px-8 lg:pt-10">
      <p className="text-lg font-bold tracking-tight">Overlap</p>

      <div className="lg:my-auto lg:grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-center lg:gap-16">
        {/* Phones drop the intro once the code is sent, to keep the code field
            near the top. Desktops have room to keep it beside the form. */}
        <section className={sentTo ? 'hidden lg:block' : undefined}>
          <h1 className="mt-10 text-3xl leading-tight font-bold text-balance lg:mt-0 lg:text-5xl">
            See who's free when you are.
          </h1>
          <p className="mt-3 text-moss lg:mt-5 lg:text-lg">
            Add your classes, and Overlap shows other UCI students with the same gaps in their day.
          </p>
          <DayPreview />
        </section>

        <div className="mt-10 lg:mt-0 lg:rounded-card lg:border lg:border-rule lg:bg-card lg:p-8">
          {sentTo === null ? (
            <form onSubmit={submitEmail} noValidate className="flex flex-col gap-2">
              <label htmlFor="email" className="font-bold">
                UCI email
              </label>
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@uci.edu"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'sign-in-error' : undefined}
                className="h-12 rounded-card border border-rule bg-card px-3"
              />
              {errorText}
              <SubmitButton pending={pending}>Send code</SubmitButton>
              <p className="mt-2 text-sm text-moss">
                We'll email you a 6-digit code. There's no password to remember.
              </p>
            </form>
          ) : (
            <>
              <h2 className="text-3xl leading-tight font-bold text-balance lg:text-2xl">
                Check your email
              </h2>
              <p className="mt-3 text-moss">
                We sent a 6-digit code to <span className="font-bold text-ink">{sentTo}</span>. It
                expires in 10 minutes.
              </p>

              {dev && (
                <p className="mt-6 rounded-card border border-dashed border-moss px-3 py-2 text-sm text-moss">
                  Local dev code: <span className="font-mono text-ink">{dev}</span>
                </p>
              )}

              <form onSubmit={submitCode} noValidate className="mt-8 flex flex-col gap-2">
                <label htmlFor="code" className="font-bold">
                  Code
                </label>
                <input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'sign-in-error' : undefined}
                  className="h-14 rounded-card border border-rule bg-card px-3 font-mono text-2xl tracking-[0.4em]"
                />
                {errorText}
                <SubmitButton pending={pending}>Sign in</SubmitButton>
              </form>

              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <button type="button" onClick={changeEmail} className="underline underline-offset-4">
                  Use a different email
                </button>
                <button
                  type="button"
                  onClick={() => {
                    verify.reset()
                    setLocalError(null)
                    requestCode.mutate(sentTo)
                  }}
                  disabled={pending}
                  className="underline underline-offset-4 disabled:opacity-60"
                >
                  Send a new code
                </button>
              </div>
            </>
          )}

          <div className="mt-4">
            <Waking active={pending} paused={requestCode.isPaused || verify.isPaused} />
          </div>
        </div>
      </div>
    </div>
  )
}

// Minutes after 8am, on an 8am to 10pm day.
const DAY = 14 * 60
const YOU = [
  [60, 180],
  [330, 410],
  [480, 560],
]
const SAM = [
  [90, 180],
  [300, 470],
]
const SHARED = [180, 300]

function at(minutes: number) {
  return `${(minutes / DAY) * 100}%`
}

function Lane({ classes, className }: { classes: number[][]; className?: string }) {
  return (
    <div className={`relative h-9 lg:h-11 ${className ?? ''}`}>
      {classes.map(([start, end]) => (
        <div
          key={start}
          className="hatch-rule absolute inset-y-0"
          style={{ left: at(start), width: at(end - start) }}
        />
      ))}
    </div>
  )
}

// A static sketch of how matching works: class time hatched, the gap two people
// share highlighted. Phones show one lane, desktops show both. It previews the
// matches page, so screen readers skip it.
function DayPreview() {
  return (
    <div aria-hidden="true" className="mt-8 flex gap-3 lg:mt-12">
      <div className="hidden w-10 flex-col pt-px text-sm text-moss lg:flex">
        <span className="flex h-11 items-center">You</span>
        <span className="flex h-11 items-center">Sam</span>
      </div>
      <div className="flex-1">
        <div className="relative overflow-hidden rounded-md border border-rule bg-card">
          <div
            className="absolute inset-y-1 rounded-sm bg-highlighter"
            style={{ left: at(SHARED[0]), width: at(SHARED[1] - SHARED[0]) }}
          />
          <Lane classes={YOU} />
          <Lane classes={SAM} className="hidden border-t border-rule lg:block" />
        </div>
        <div className="relative mt-1.5 h-4 font-mono text-[11px] text-moss">
          <span className="absolute left-0">8a</span>
          <span className="absolute font-medium text-ink" style={{ left: at(SHARED[0]) }}>
            11:00–1:00
          </span>
          <span className="absolute right-0">10p</span>
        </div>
      </div>
    </div>
  )
}
