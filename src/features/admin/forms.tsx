import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Check, Minus, Send } from 'lucide-react'
import { toast } from 'sonner'
import { FORM_TEMPLATES, PROGRAMS } from '@/data/catalog'
import { useLookups } from '@/data/hooks'
import { useStore } from '@/data/store'
import { requestProgress } from '@/domain/attendance'
import { ACTIVE_STATUSES } from '@/domain/pricing'
import type { FormSubmission, FormTemplate } from '@/domain/types'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Main } from '@/components/layout/main'
import { FleetChip, PageHeader } from '@/components/burgee/marks'
import { SendFormDialog } from './send-form'
import { now as clockNow } from '@/lib/clock'

export function AdminForms() {
  const regs = useStore((s) => s.registrations)
  const sailors = useStore((s) => s.sailors)
  const submissions = useStore((s) => s.submissions)
  const season = useStore((s) => s.settings.season)
  const sendAnnouncement = useStore((s) => s.sendAnnouncement)
  const requests = useStore((s) => s.formRequests)
  const custom = useStore((s) => s.customTemplates)
  const sendRequest = useStore((s) => s.sendFormRequest)
  const look = useLookups()
  const [sending, setSending] = useState(false)
  const [missingOnly, setMissingOnly] = useState(true)
  const [program, setProgram] = useState('all')
  const [viewing, setViewing] = useState<{ sub: FormSubmission; t: FormTemplate } | null>(null)

  const rows = useMemo(() => {
    const active = regs.filter((r) => ACTIVE_STATUSES.has(r.status))
    const inProgram = (sid: string) =>
      program === 'all' || active.some((r) => r.sailorId === sid && look.session.get(r.sessionId)?.programId === program)
    const activeIds = new Set(active.map((r) => r.sailorId))
    return sailors
      .filter((s) => activeIds.has(s.id) && inProgram(s.id))
      .map((s) => {
        const cells = FORM_TEMPLATES.map((t) => ({
          t,
          sub: submissions.find(
            (x) =>
              x.templateId === t.id &&
              x.season === season &&
              (t.scope === 'family' ? x.familyId === s.familyId : x.sailorId === s.id)
          ),
        }))
        return { s, cells, missing: cells.filter((c) => !c.sub).length }
      })
      .sort((a, b) => b.missing - a.missing || a.s.lastName.localeCompare(b.s.lastName))
  }, [regs, sailors, submissions, season, program, look])

  const shown = missingOnly ? rows.filter((r) => r.missing) : rows
  const famsMissing = [...new Set(rows.filter((r) => r.missing).map((r) => r.s.familyId))]

  return (
    <Main>
      <PageHeader
        title='Forms & waivers'
        description={`Signed once per sailor for the ${season} season, from the parent’s phone.`}
        actions={
          <>
            <Button
              variant='outline'
              disabled={!famsMissing.length}
              onClick={() => {
                const n = sendAnnouncement({
                  title: `Reminder: ${season} forms`,
                  body: 'Your sailor is still missing one or more season forms. It takes about a minute from your phone in Burgee, and sailors need them on file before their next session.',
                  category: 'reminder',
                  audience: { kind: 'outstanding-forms' },
                  channels: ['email', 'sms'],
                  sentBy: 'Jordan Hale',
                })
                toast.success(`Reminder sent to ${n} families by email and text`)
              }}
            >
              Remind {famsMissing.length} families
            </Button>
            <Button onClick={() => setSending(true)}>
              <Send className='size-4' /> Send a form
            </Button>
          </>
        }
      />
      <SendFormDialog open={sending} onOpenChange={setSending} />

      {requests.length > 0 && (
        <section className='mb-8' aria-labelledby='sent-forms'>
          <h2 id='sent-forms' className='mb-3 text-lg font-semibold'>
            Sent for signature
          </h2>
          <ul className='divide-y rounded-lg border bg-card'>
            {requests.map((r) => {
              const t = [...custom, ...FORM_TEMPLATES].find((x) => x.id === r.templateId)
              if (!t) return null
              const p = requestProgress(r, t, submissions, season)
              const pct = p.total ? Math.round((p.done / p.total) * 100) : 0
              const late = r.dueDate && r.dueDate < format(clockNow(), 'yyyy-MM-dd') && p.done < p.total
              const unsignedSailors = r.sailorIds.filter((sid) => !submissions.some((s) => s.templateId === t.id && s.season === season && s.sailorId === sid))
              const unsignedFamilies =
                t.scope === 'family'
                  ? r.familyIds.filter((fid) => !submissions.some((s) => s.templateId === t.id && s.season === season && s.familyId === fid))
                  : [...new Set(unsignedSailors.map((sid) => look.sailor.get(sid)!.familyId))]
              return (
                <li key={r.id} className='grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_220px_auto] sm:items-center'>
                  <div className='min-w-0'>
                    <p className='font-medium'>{t.name}</p>
                    <p className='text-xs text-muted-foreground'>
                      {r.audienceLabel}. Sent {format(new Date(r.sentAt), 'MMM d')} by {r.sentBy}
                      {r.dueDate && (
                        <span className={late ? 'font-medium text-destructive' : ''}>, due {format(new Date(`${r.dueDate}T12:00:00`), 'MMM d')}</span>
                      )}
                    </p>
                  </div>
                  <div className='flex items-center gap-2'>
                    <div className='h-1.5 flex-1 overflow-hidden rounded-full bg-muted'>
                      <div className='h-full rounded-full bg-ok' style={{ width: `${pct}%` }} />
                    </div>
                    <span className='w-16 text-end text-xs font-medium'>
                      {p.done}/{p.total} signed
                    </span>
                  </div>
                  <Button
                    size='sm'
                    variant='outline'
                    disabled={!unsignedFamilies.length}
                    onClick={() => {
                      sendRequest({
                        templateId: t.id,
                        familyIds: unsignedFamilies,
                        sailorIds: unsignedSailors,
                        audienceLabel: `${r.audienceLabel} (not yet signed)`,
                        dueDate: r.dueDate,
                        message: r.message,
                        channels: r.channels,
                        sentBy: 'Jordan Hale',
                      })
                      toast.success(`Nudged ${unsignedFamilies.length} families`)
                    }}
                  >
                    Nudge {unsignedFamilies.length}
                  </Button>
                </li>
              )
            })}
          </ul>
        </section>
      )}
      <div className='mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
        {FORM_TEMPLATES.map((t) => {
          const done = rows.filter((r) => r.cells.find((c) => c.t.id === t.id)?.sub).length
          const pct = rows.length ? Math.round((done / rows.length) * 100) : 0
          return (
            <div key={t.id} className='rounded-lg border bg-card p-4'>
              <p className='font-medium'>{t.name}</p>
              <p className='mt-0.5 text-xs text-muted-foreground'>{t.description}</p>
              <div className='mt-3 flex items-center gap-2'>
                <div className='h-1.5 flex-1 overflow-hidden rounded-full bg-muted'>
                  <div className='h-full rounded-full bg-ok' style={{ width: `${pct}%` }} />
                </div>
                <span className='text-xs font-medium'>
                  {done}/{rows.length}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <div className='mb-3 flex flex-wrap items-center gap-4'>
        <Select value={program} onValueChange={setProgram}>
          <SelectTrigger className='h-9 w-56' aria-label='Program'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All programs</SelectItem>
            {PROGRAMS.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className='flex items-center gap-2 text-sm'>
          <Checkbox checked={missingOnly} onCheckedChange={(v) => setMissingOnly(!!v)} /> Only sailors with something missing
        </label>
        <span className='ms-auto text-sm text-muted-foreground'>{shown.length} sailors</span>
      </div>

      <div className='overflow-x-auto rounded-lg border bg-card'>
        <table className='w-full min-w-[760px] text-sm'>
          <thead className='border-b text-xs text-muted-foreground'>
            <tr>
              <th className='px-4 py-2 text-start font-medium'>Sailor</th>
              <th className='px-4 py-2 text-start font-medium'>Guardian</th>
              {FORM_TEMPLATES.map((t) => (
                <th key={t.id} className='px-3 py-2 text-center font-medium'>
                  {t.short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className='divide-y'>
            {shown.map(({ s, cells }) => {
              const f = look.family.get(s.familyId)!
              return (
                <tr key={s.id}>
                  <td className='px-4 py-2'>
                    <span className='block font-medium'>
                      {s.firstName} {s.lastName}
                    </span>
                    <FleetChip level={s.level} />
                  </td>
                  <td className='px-4 py-2 text-muted-foreground'>
                    {f.guardians[0].name}
                    <span className='block text-xs'>{f.guardians[0].phone}</span>
                  </td>
                  {cells.map(({ t, sub }) => (
                    <td key={t.id} className='px-3 py-2 text-center'>
                      {sub ? (
                        <button
                          onClick={() => setViewing({ sub, t })}
                          className='inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-ok hover:bg-ok-soft'
                          aria-label={`View signed ${t.name} for ${s.firstName}`}
                        >
                          <Check className='size-4' /> {format(new Date(sub.signedAt), 'MMM d')}
                        </button>
                      ) : (
                        <span className='inline-flex items-center gap-1 text-xs font-medium text-signal'>
                          <Minus className='size-4' /> Missing
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className='max-h-[85svh] overflow-y-auto'>
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle>{viewing.t.name}</DialogTitle>
                <DialogDescription>
                  {viewing.sub.sailorId
                    ? `${look.sailor.get(viewing.sub.sailorId)?.firstName} ${look.sailor.get(viewing.sub.sailorId)?.lastName}`
                    : `${look.family.get(viewing.sub.familyId)?.name} family`}
                  , {viewing.sub.season} season
                </DialogDescription>
              </DialogHeader>
              <dl className='grid gap-3 text-sm'>
                {viewing.t.fields.map((field) => (
                  <div key={field.id}>
                    <dt className='text-xs text-muted-foreground'>{field.label}</dt>
                    <dd>{viewing.sub.values[field.id] || '—'}</dd>
                  </div>
                ))}
              </dl>
              <p className='rounded-md bg-muted p-3 text-xs text-muted-foreground'>{viewing.t.body}</p>
              <p className='text-sm'>
                Signed by <span className='font-medium'>{viewing.sub.signedBy}</span> on {format(new Date(viewing.sub.signedAt), 'MMMM d, yyyy, h:mm a')}
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Main>
  )
}
