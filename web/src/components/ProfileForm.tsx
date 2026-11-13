import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent, type ReactNode } from 'react'
import { api } from '../api/client'
import { ApiError, errorMessage, unwrap } from '../api/errors'
import type { components } from '../api/schema'
import { COMMUNITY_COLLEGES } from '../data/communityColleges'
import { MAJORS } from '../data/majors'
import Avatar from './Avatar'
import SubmitButton from './SubmitButton'
import Waking from './Waking'

export type Me = components['schemas']['MeOut']

const THIS_YEAR = new Date().getFullYear()
const GRAD_YEARS = Array.from({ length: 7 }, (_, i) => THIS_YEAR + i)

const HINTS: Record<string, string> = {
  display_name: 'First name and last initial works well.',
  transfer_from: "Not listed? Leave this blank.",
  contact: "Instagram, Discord, or a phone number. Only people you've both waved at can see this.",
}

// keep a saved value even if it's no longer listed
function withSaved(list: string[], saved: string | null) {
  return saved && !list.includes(saved) ? [saved, ...list] : list
}

export default function ProfileForm({
  me,
  title,
  intro,
  submitLabel,
  onSaved,
  children,
}: {
  me: Me
  title: string
  intro: string
  submitLabel: string
  onSaved?: (saved: Me) => void
  children?: ReactNode
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(me.display_name)
  const [major, setMajor] = useState(me.major ?? '')
  const [gradYear, setGradYear] = useState(me.grad_year ? String(me.grad_year) : '')
  const [isTransfer, setIsTransfer] = useState(me.is_transfer)
  const [college, setCollege] = useState(me.transfer_from ?? '')
  const [bio, setBio] = useState(me.bio)
  const [contact, setContact] = useState(me.contact ?? '')
  const [nameMissing, setNameMissing] = useState(false)

  const save = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.PATCH('/me', {
          body: {
            display_name: name.trim(),
            major: major || null,
            grad_year: gradYear ? Number(gradYear) : null,
            is_transfer: isTransfer,
            transfer_from: isTransfer && college ? college : null,
            bio: bio.trim(),
            contact: contact.trim() || null,
          },
        }),
      ),
    onSuccess: (saved) => {
      queryClient.setQueryData(['me'], saved)
      onSaved?.(saved)
    },
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      setNameMissing(true)
      document.getElementById('display_name')?.focus()
      return
    }
    setNameMissing(false)
    save.mutate()
  }

  const fieldError =
    save.error instanceof ApiError && save.error.field
      ? { field: save.error.field, message: save.error.message }
      : null
  const errors: Record<string, string> = {}
  if (nameMissing) errors.display_name = 'Enter a display name.'
  if (fieldError) errors[fieldError.field] = fieldError.message
  const formError = save.error && !fieldError ? errorMessage(save.error) : null

  function describe(id: string) {
    const ids = [HINTS[id] && `${id}-hint`, errors[id] && `${id}-error`].filter(Boolean)
    return {
      id,
      'aria-describedby': ids.length ? ids.join(' ') : undefined,
      'aria-invalid': errors[id] ? true : undefined,
    }
  }

  const control = 'h-12 w-full rounded-card border border-rule bg-card px-3'

  return (
    <div className="pt-4 pb-16 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start lg:gap-16 lg:pt-10">
      <section>
        <h1 className="text-3xl leading-tight font-bold text-balance">{title}</h1>
        <p className="mt-2 text-moss">{intro}</p>

        <form
          onSubmit={submit}
          onChange={() => save.isSuccess && save.reset()}
          noValidate
          className="mt-8 flex flex-col gap-6"
        >
          <Field id="display_name" label="Display name" error={errors.display_name}>
            <input
              {...describe('display_name')}
              autoComplete="nickname"
              maxLength={50}
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setNameMissing(false)
              }}
              className={control}
            />
          </Field>

          <div className="flex flex-col gap-6 sm:grid sm:grid-cols-[minmax(0,1fr)_9rem] sm:gap-4">
            <Field id="major" label="Major" error={errors.major}>
              <select
                {...describe('major')}
                value={major}
                onChange={(event) => setMajor(event.target.value)}
                className={control}
              >
                <option value="">Choose your major</option>
                {withSaved(MAJORS, me.major).map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </Field>

            <Field id="grad_year" label="Graduation year" error={errors.grad_year}>
              <select
                {...describe('grad_year')}
                value={gradYear}
                onChange={(event) => setGradYear(event.target.value)}
                className={control}
              >
                <option value="">Choose</option>
                {GRAD_YEARS.map((year) => (
                  <option key={year}>{year}</option>
                ))}
              </select>
            </Field>
          </div>

          <fieldset>
            <legend className="font-bold">Did you transfer to UCI?</legend>
            <div className="mt-2 flex gap-6">
              {(
                [
                  ['Yes', true],
                  ['No', false],
                ] as const
              ).map(([label, value]) => (
                <label key={label} className="flex h-11 items-center gap-2">
                  <input
                    type="radio"
                    name="is_transfer"
                    checked={isTransfer === value}
                    onChange={() => setIsTransfer(value)}
                    className="size-5 accent-ink"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          {isTransfer && (
            <Field id="transfer_from" label="Community college" error={errors.transfer_from}>
              <select
                {...describe('transfer_from')}
                value={college}
                onChange={(event) => setCollege(event.target.value)}
                className={control}
              >
                <option value="">Choose your college</option>
                {withSaved(COMMUNITY_COLLEGES, me.transfer_from).map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </Field>
          )}

          <Field id="bio" label="About you" error={errors.bio}>
            <textarea
              {...describe('bio')}
              maxLength={500}
              rows={4}
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              placeholder="Where you spend time between classes, what you're into, what you'd want to do with an hour free."
              className="w-full rounded-card border border-rule bg-card px-3 py-2.5"
            />
            <p className="text-right text-sm text-moss">{bio.length} / 500</p>
          </Field>

          <Field id="contact" label="Contact handle" error={errors.contact}>
            <input
              {...describe('contact')}
              maxLength={100}
              value={contact}
              onChange={(event) => setContact(event.target.value)}
              className={control}
            />
          </Field>

          <div className="flex flex-col gap-2">
            {formError && (
              <p role="alert" className="text-danger">
                {formError}
              </p>
            )}
            <SubmitButton pending={save.isPending}>{submitLabel}</SubmitButton>
            <p role="status" className="text-sm empty:hidden">
              {save.isSuccess && !save.isPending ? 'Saved.' : ''}
            </p>
            <Waking active={save.isPending} paused={save.isPaused} />
          </div>
        </form>

        {children}
      </section>

      <aside className="hidden lg:sticky lg:top-6 lg:block" aria-label="Preview">
        <p className="text-sm font-bold text-moss">How others see you</p>
        <ProfilePreview
          id={me.id}
          name={name.trim()}
          major={major}
          gradYear={gradYear}
          college={isTransfer ? college || 'a community college' : null}
          bio={bio.trim()}
          contact={contact.trim()}
        />
      </aside>
    </div>
  )
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string
  label: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-bold">
        {label}
      </label>
      {children}
      {HINTS[id] && (
        <p id={`${id}-hint`} className="text-sm text-moss">
          {HINTS[id]}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

function ProfilePreview({
  id,
  name,
  major,
  gradYear,
  college,
  bio,
  contact,
}: {
  id: number
  name: string
  major: string
  gradYear: string
  college: string | null
  bio: string
  contact: string
}) {
  const details = [major, gradYear && `Class of ${gradYear}`].filter(Boolean).join(' · ')

  return (
    <div className="mt-3 rounded-card border border-rule bg-card p-5">
      <div className="flex items-center gap-3">
        <Avatar id={id} name={name || '?'} />
        <div className="min-w-0">
          <p className={`text-lg font-bold ${name ? '' : 'text-moss'}`}>{name || 'Your name'}</p>
          <p className="text-sm text-moss">{details || 'Major and graduation year'}</p>
        </div>
      </div>
      {college && <p className="mt-3 text-sm">Transferred from {college}</p>}
      <p className={`mt-3 text-sm ${bio ? '' : 'text-moss'}`}>
        {bio || 'A line or two about you shows here.'}
      </p>
      <div className="mt-4 border-t border-rule pt-3 text-sm">
        <p className="text-moss">Contact, after you both wave</p>
        <p className={contact ? 'font-bold' : 'text-moss'}>{contact || 'Not added yet'}</p>
      </div>
    </div>
  )
}
