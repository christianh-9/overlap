import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { api } from '../api/client'
import { errorMessage, unwrap } from '../api/errors'
import { useMe } from '../api/me'
import type { components } from '../api/schema'
import Avatar from '../components/Avatar'
import { LoadError, Loading } from '../components/QueryStatus'
import { REASONS } from '../data/reasons'

type Report = components['schemas']['AdminReportOut']
type Action = components['schemas']['ResolveIn']['action']

const REASON_LABELS: Record<string, string> = Object.fromEntries(REASONS)

const DONE: Record<Action, string> = {
  dismiss: 'Report dismissed.',
  remove_photo: 'Photo removed.',
  ban: 'Account banned.',
}

const button = 'h-10 rounded-card px-4 text-sm font-bold disabled:opacity-60'

export default function Admin() {
  const me = useMe()
  const reports = useQuery({
    queryKey: ['admin', 'reports'],
    queryFn: async () => unwrap(await api.GET('/admin/reports')),
    enabled: me.data?.is_admin === true,
  })
  const [notice, setNotice] = useState<string | null>(null)

  if (me.isPending) return <Loading label="Loading..." paused={me.isPaused} />
  if (me.isError) {
    return (
      <LoadError title="Couldn't load your profile" error={me.error} onRetry={() => me.refetch()} />
    )
  }
  if (!me.data.is_admin) {
    return (
      <section className="py-12">
        <h1 className="text-2xl font-bold">Admins only</h1>
        <p className="mt-2 text-moss">This page is for reviewing reports.</p>
      </section>
    )
  }

  return (
    <div className="pt-4 pb-16 lg:pt-10">
      <h1 className="text-3xl leading-tight font-bold">Reports</h1>
      <p className="mt-2 text-moss">Open reports from every campus, oldest first.</p>
      <p role="status" className="mt-4 text-sm empty:mt-0">
        {notice}
      </p>

      <div className="mt-6">
        {reports.isPending ? (
          <Loading label="Loading reports..." paused={reports.isPaused} />
        ) : reports.isError ? (
          <LoadError
            title="Couldn't load reports"
            error={reports.error}
            onRetry={() => reports.refetch()}
          />
        ) : reports.data.length === 0 ? (
          <p className="rounded-card border border-dashed border-moss p-5 text-moss">
            No open reports.
          </p>
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2">
            {reports.data.map((report) => (
              <ReportCard key={report.id} report={report} onDone={setNotice} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function ReportCard({ report, onDone }: { report: Report; onDone: (notice: string) => void }) {
  const queryClient = useQueryClient()
  const [confirmBan, setConfirmBan] = useState(false)
  const { reported } = report
  const name = reported?.display_name || report.reported_email

  const resolve = useMutation({
    mutationFn: async (action: Action) =>
      unwrap(
        await api.POST('/admin/reports/{report_id}/resolve', {
          params: { path: { report_id: report.id } },
          body: { action },
        }),
      ),
    onSuccess: (_, action) => {
      queryClient.setQueryData<Report[]>(['admin', 'reports'], (old = []) =>
        action === 'ban'
          ? old.filter((r) => r.reported_email !== report.reported_email)
          : old.filter((r) => r.id !== report.id),
      )
      onDone(DONE[action])
    },
  })

  const filed = new Date(report.created_at).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

  return (
    <li className="rounded-card border border-rule bg-card p-5">
      <p className="text-sm text-moss">
        <span className="font-bold text-ink">{REASON_LABELS[report.reason] ?? report.reason}</span>
        {' · '}
        {filed}
        {report.campus && ` · ${report.campus}`}
      </p>

      {reported ? (
        <div className="mt-4 flex items-center gap-3">
          <Avatar
            id={reported.id}
            name={reported.display_name}
            photoUrl={reported.photo_url}
            size="lg"
          />
          <div className="min-w-0">
            <h2 className="text-lg font-bold">{reported.display_name || 'No name'}</h2>
            <p className="truncate text-sm text-moss">{report.reported_email}</p>
            {reported.major && <p className="text-sm text-moss">{reported.major}</p>}
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <h2 className="text-lg font-bold">Account deleted</h2>
          <p className="truncate text-sm text-moss">{report.reported_email}</p>
        </div>
      )}

      <dl className="mt-4 flex flex-col gap-3 text-sm">
        {reported?.bio && <Evidence label="Bio">{reported.bio}</Evidence>}
        {report.contact && <Evidence label="Contact handle">{report.contact}</Evidence>}
        {report.note && <Evidence label="Their note to the reporter">{report.note}</Evidence>}
        <Evidence label={`What ${report.reporter_name || 'the reporter'} said`}>
          {report.details || <span className="text-moss">No details given.</span>}
        </Evidence>
      </dl>

      {resolve.error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {errorMessage(resolve.error)}
        </p>
      )}

      {confirmBan ? (
        <div className="mt-5 rounded-card border border-danger p-4">
          <p className="text-sm">
            Ban {name}? This deletes their account and blocks their email. It can't be undone.
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmBan(false)}
              className={`${button} border border-rule`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => resolve.mutate('ban')}
              disabled={resolve.isPending}
              className={`${button} bg-danger text-card`}
            >
              {resolve.isPending ? 'Banning...' : 'Ban'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => resolve.mutate('dismiss')}
            disabled={resolve.isPending}
            className={`${button} border border-rule`}
          >
            Dismiss
          </button>
          {reported?.photo_url && (
            <button
              type="button"
              onClick={() => resolve.mutate('remove_photo')}
              disabled={resolve.isPending}
              className={`${button} border border-ink`}
            >
              Remove photo
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfirmBan(true)}
            disabled={resolve.isPending}
            className={`${button} border border-danger text-danger`}
          >
            Ban
          </button>
        </div>
      )}
    </li>
  )
}

function Evidence({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="font-bold">{label}</dt>
      <dd className="mt-0.5 break-words whitespace-pre-wrap">{children}</dd>
    </div>
  )
}
