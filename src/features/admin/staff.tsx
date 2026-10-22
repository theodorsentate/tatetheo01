import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { CERT_TYPES } from '@/data/catalog'
import { termById, useLookups, useNow } from '@/data/hooks'
import { useStore } from '@/data/store'
import { coachCertRows, coachCertSummary, type CertStatus } from '@/domain/rules'
import type { Coach, StaffRole } from '@/domain/types'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Main } from '@/components/layout/main'
import { CertStatusLabel, Initials, PageHeader } from '@/components/burgee/marks'

export const ROLE_LABEL: Record<StaffRole, string> = {
  'program-director': 'Program director',
  'head-coach': 'Head coach',
  instructor: 'Instructor',
  assistant: 'Assistant instructor',
  'swim-coach': 'Swim coach',
  'tennis-pro': 'Tennis pro',
}

const cellTone: Record<CertStatus, string> = {
  valid: '',
  expiring: 'bg-signal-soft',
  expired: 'bg-danger-soft',
  missing: 'bg-danger-soft',
}

export function AdminStaff() {
  const coaches = useStore((s) => s.coaches)
  const groups = useStore((s) => s.groups)
  const warn = useStore((s) => s.settings.certWarningDays)
  const renew = useStore((s) => s.renewCert)
  const look = useLookups()
  const now = useNow(60_000)
  const [problemsOnly, setProblemsOnly] = useState(false)
  const [renewing, setRenewing] = useState<{ coach: Coach; certTypeId: string } | null>(null)
  const [issued, setIssued] = useState(format(now, 'yyyy-MM-dd'))

  const rows = useMemo(
    () =>
      coaches.map((c) => {
        const certs = coachCertRows(c, CERT_TYPES, now, warn)
        return { c, certs, summary: coachCertSummary(certs) }
      }),
    [coaches, now, warn]
  )
  const tally = rows.reduce(
    (t, r) => ({ ...t, [r.summary]: (t[r.summary] ?? 0) + 1 }),
    {} as Record<CertStatus, number>
  )
  const visible = problemsOnly ? rows.filter((r) => r.summary !== 'valid') : rows

  return (
    <Main>
      <PageHeader
        title='Staff & certifications'
        description={`Burgee flags anything expiring within ${warn} days. Coaches with an expired or missing required certification show a warning on every roster they are on.`}
      />
      <div className='mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm'>
        <span>
          <strong className='font-display text-lg'>{tally.valid ?? 0}</strong> <span className='text-muted-foreground'>fully current</span>
        </span>
        <span>
          <strong className='font-display text-lg text-signal'>{tally.expiring ?? 0}</strong>{' '}
          <span className='text-muted-foreground'>expiring soon</span>
        </span>
        <span>
          <strong className='font-display text-lg text-destructive'>{(tally.expired ?? 0) + (tally.missing ?? 0)}</strong>{' '}
          <span className='text-muted-foreground'>expired or missing</span>
        </span>
        <label className='ms-auto flex items-center gap-2'>
          <Checkbox checked={problemsOnly} onCheckedChange={(v) => setProblemsOnly(!!v)} /> Only show staff who need attention
        </label>
      </div>

      <div className='overflow-x-auto rounded-lg border bg-card'>
        <table className='w-full min-w-[1080px] text-sm'>
          <thead className='border-b text-xs text-muted-foreground'>
            <tr>
              <th className='sticky start-0 z-10 bg-card px-4 py-2 text-start font-medium'>Staff</th>
              {CERT_TYPES.map((ct) => (
                <th key={ct.id} className='px-2 py-2 text-start align-bottom font-medium'>
                  <span className='block w-24 leading-tight'>{ct.name}</span>
                </th>
              ))}
              <th className='px-4 py-2 text-start font-medium'>Assigned to</th>
            </tr>
          </thead>
          <tbody className='divide-y'>
            {visible.map(({ c, certs }) => {
              const assigned = groups.filter((g) => g.coachIds.includes(c.id))
              return (
                <tr key={c.id}>
                  <td className='sticky start-0 z-10 bg-card px-4 py-2.5'>
                    <span className='flex items-center gap-2.5'>
                      <Initials name={c.name} hue={c.avatarHue} />
                      <span>
                        <span className='block font-medium whitespace-nowrap'>{c.name}</span>
                        <span className='block text-xs text-muted-foreground'>{ROLE_LABEL[c.role]}</span>
                      </span>
                    </span>
                  </td>
                  {CERT_TYPES.map((ct) => {
                    const row = certs.find((r) => r.certType.id === ct.id)
                    if (!row)
                      return (
                        <td key={ct.id} className='px-2 py-2.5 text-xs text-muted-foreground/50'>
                          <span className='sr-only'>Not required</span>—
                        </td>
                      )
                    return (
                      <td key={ct.id} className={cn('px-2 py-2.5', cellTone[row.status])}>
                        <button
                          className='block text-start'
                          onClick={() => {
                            setIssued(format(now, 'yyyy-MM-dd'))
                            setRenewing({ coach: c, certTypeId: ct.id })
                          }}
                          aria-label={`Record ${ct.name} for ${c.name}`}
                        >
                          <CertStatusLabel status={row.status} />
                          <span className='block text-xs text-muted-foreground'>
                            {row.expires ? format(new Date(`${row.expires}T12:00:00`), 'MMM d, yyyy') : 'Add'}
                          </span>
                        </button>
                      </td>
                    )
                  })}
                  <td className='w-48 px-4 py-2.5 text-xs text-muted-foreground'>
                    {assigned.length
                      ? assigned
                          .slice(0, 3)
                          .map((g) => {
                            const se = look.session.get(g.sessionId)!
                            return `${g.name}, ${se.name.startsWith('Week') ? se.name.replace('Week', 'wk') : termById.get(se.termId)?.name.split(' ')[0].toLowerCase()}`
                          })
                          .join(', ') + (assigned.length > 3 ? ` +${assigned.length - 3}` : '')
                      : 'Not on a roster'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={!!renewing} onOpenChange={(o) => !o && setRenewing(null)}>
        <DialogContent>
          {renewing && (
            <>
              <DialogHeader>
                <DialogTitle>Record certification</DialogTitle>
                <DialogDescription>
                  {CERT_TYPES.find((c) => c.id === renewing.certTypeId)?.name} for {renewing.coach.name}. Burgee works out the
                  expiry from the issue date.
                </DialogDescription>
              </DialogHeader>
              <div className='grid gap-2'>
                <Label htmlFor='issued'>Issued on</Label>
                <Input id='issued' type='date' value={issued} onChange={(e) => setIssued(e.target.value)} />
              </div>
              <DialogFooter>
                <Button variant='outline' onClick={() => setRenewing(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    renew(renewing.coach.id, renewing.certTypeId, issued)
                    toast.success(`Certification saved for ${renewing.coach.name}`)
                    setRenewing(null)
                  }}
                >
                  Save certification
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Main>
  )
}
