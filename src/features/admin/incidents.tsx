import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { format } from 'date-fns'
import { CheckCircle2, MessageSquare, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { programById, useLookups, useNow } from '@/data/hooks'
import { useStore } from '@/data/store'
import type { Incident } from '@/domain/types'
import { useAsk } from '@/assistant/ask-store'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Main } from '@/components/layout/main'
import { EmptyState, PageHeader } from '@/components/burgee/marks'

export const INCIDENT_TYPE: Record<Incident['type'], string> = {
  'capsize-rescue': 'Capsize needing help',
  injury: 'Injury',
  'near-miss': 'Near miss',
  equipment: 'Equipment failure',
  behavior: 'Behavior',
  weather: 'Weather',
  other: 'Other',
}
const SEVERITY: Record<Incident['severity'], string> = {
  minor: 'bg-muted text-muted-foreground',
  moderate: 'bg-signal-soft text-signal',
  serious: 'bg-danger-soft text-destructive',
}

export function AdminIncidents() {
  const incidents = useStore((s) => s.incidents)
  const update = useStore((s) => s.updateIncident)
  const look = useLookups()
  const navigate = useNavigate()
  const [logging, setLogging] = useState(false)
  const [filter, setFilter] = useState<'open' | 'all'>('all')
  const shown = incidents.filter((i) => filter === 'all' || i.status === 'open').sort((a, b) => b.at.localeCompare(a.at))
  const open = incidents.filter((i) => i.status === 'open').length

  return (
    <Main>
      <PageHeader
        title='Incident reports'
        description='Capsizes that needed help, injuries, near misses and equipment failures. Coaches can file from the dock; you follow up and close them here.'
        actions={
          <Button onClick={() => setLogging(true)}>
            <Plus className='size-4' /> Log an incident
          </Button>
        }
      />
      <div className='mb-4 flex flex-wrap items-center gap-2 text-sm'>
        <div className='flex gap-1 rounded-lg bg-muted p-1' role='tablist' aria-label='Status'>
          {(['all', 'open'] as const).map((f) => (
            <button
              key={f}
              role='tab'
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className='rounded-md px-3 py-1.5 font-medium text-muted-foreground aria-selected:bg-card aria-selected:text-foreground aria-selected:shadow-sm'
            >
              {f === 'all' ? `All (${incidents.length})` : `Open (${open})`}
            </button>
          ))}
        </div>
      </div>
      {shown.length === 0 ? (
        <EmptyState title='No open incidents' />
      ) : (
        <ul className='space-y-3'>
          {shown.map((i) => {
            const se = i.sessionId ? look.session.get(i.sessionId) : undefined
            const kids = i.sailorIds.map((id) => look.sailor.get(id)).filter(Boolean)
            const families = [...new Set(kids.map((k) => k!.familyId))]
            return (
              <li key={i.id} className={cn('rounded-lg border bg-card p-4', i.status === 'closed' && 'opacity-80')}>
                <div className='flex flex-wrap items-start justify-between gap-3'>
                  <div>
                    <p className='flex flex-wrap items-center gap-2'>
                      <span className='font-semibold text-heading'>{INCIDENT_TYPE[i.type]}</span>
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium capitalize', SEVERITY[i.severity])}>{i.severity}</span>
                      {i.status === 'closed' && <span className='rounded-full bg-ok-soft px-2 py-0.5 text-xs font-medium text-ok'>Closed</span>}
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      {format(new Date(i.at), 'EEE MMM d, h:mm a')}
                      {se ? `, ${programById.get(se.programId)?.name}` : ''}. Reported by {i.reportedBy}.
                    </p>
                  </div>
                  <div className='flex flex-wrap gap-2'>
                    {families.length > 0 && (
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={() => {
                          useAsk.getState().set({
                            draft: {
                              title: `Quick note from today’s practice`,
                              body: `Hi, a quick heads-up from today: ${i.description} ${i.actionTaken} Please reach out with any questions.`,
                              audience: { kind: 'families', familyIds: families, label: `${kids.map((k) => k!.firstName).join(' & ')}’s family` },
                              channels: ['email', 'sms'],
                              category: 'general',
                            },
                          })
                          navigate({ to: '/admin/messages' })
                        }}
                      >
                        <MessageSquare className='size-4' /> Message family
                      </Button>
                    )}
                    {i.status === 'open' ? (
                      <Button size='sm' variant='outline' onClick={() => { update(i.id, { status: 'closed' }); toast.success('Incident closed') }}>
                        <CheckCircle2 className='size-4' /> Close
                      </Button>
                    ) : (
                      <Button size='sm' variant='ghost' onClick={() => update(i.id, { status: 'open' })}>
                        Reopen
                      </Button>
                    )}
                  </div>
                </div>
                <dl className='mt-3 grid gap-3 text-sm sm:grid-cols-2'>
                  <div>
                    <dt className='text-xs text-muted-foreground'>What happened</dt>
                    <dd>{i.description}</dd>
                  </div>
                  <div>
                    <dt className='text-xs text-muted-foreground'>What we did</dt>
                    <dd>{i.actionTaken}</dd>
                  </div>
                  <div>
                    <dt className='text-xs text-muted-foreground'>Sailors involved</dt>
                    <dd>{kids.length ? kids.map((k) => `${k!.firstName} ${k!.lastName}`).join(', ') : 'None'}</dd>
                  </div>
                  <div>
                    <dt className='text-xs text-muted-foreground'>Parents told</dt>
                    <dd className={cn(!i.parentsNotified && kids.length > 0 && 'font-medium text-signal')}>
                      {i.parentsNotified ? i.notifiedHow ?? 'Yes' : kids.length ? 'Not yet' : 'Not needed'}
                      {!i.parentsNotified && kids.length > 0 && (
                        <button className='ms-2 text-xs font-normal text-primary underline' onClick={() => update(i.id, { parentsNotified: true, notifiedHow: `Recorded ${format(new Date(), 'MMM d, h:mm a')}` })}>
                          Mark as told
                        </button>
                      )}
                    </dd>
                  </div>
                </dl>
              </li>
            )
          })}
        </ul>
      )}
      <IncidentDialog open={logging} onClose={() => setLogging(false)} reporter='Jordan Hale' />
    </Main>
  )
}

/** Shared by the director page and the coach's group screen. */
export function IncidentDialog({
  open,
  onClose,
  reporter,
  sessionId,
  sailorOptions,
}: {
  open: boolean
  onClose: () => void
  reporter: string
  sessionId?: string
  sailorOptions?: { id: string; name: string }[]
}) {
  const log = useStore((s) => s.logIncident)
  const sessions = useStore((s) => s.sessions)
  const regs = useStore((s) => s.registrations)
  const look = useLookups()
  const now = useNow()
  const today = format(now, 'yyyy-MM-dd')
  const running = sessions.filter((s) => today >= s.startDate && today <= s.endDate)
  const [sid, setSid] = useState(sessionId ?? running[0]?.id ?? '')
  const [type, setType] = useState<Incident['type']>('capsize-rescue')
  const [severity, setSeverity] = useState<Incident['severity']>('minor')
  const [picked, setPicked] = useState<string[]>([])
  const [told, setTold] = useState(false)
  const options =
    sailorOptions ??
    regs
      .filter((r) => r.sessionId === sid && r.status === 'confirmed')
      .map((r) => look.sailor.get(r.sailorId)!)
      .sort((a, b) => a.lastName.localeCompare(b.lastName))
      .map((k) => ({ id: k.id, name: `${k.firstName} ${k.lastName}` }))
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className='max-h-[92svh] overflow-y-auto sm:max-w-lg'>
        <form
          key={String(open)}
          className='grid gap-4'
          onSubmit={(e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            const v = (k: string) => String(fd.get(k) ?? '').trim()
            if (!v('description')) return toast.error('Describe what happened.')
            log({
              at: new Date(`${v('date')}T${v('time') || '12:00'}`).toISOString(),
              sessionId: sid || undefined,
              sailorIds: picked,
              type,
              severity,
              description: v('description'),
              actionTaken: v('action') || 'Not recorded',
              parentsNotified: told,
              notifiedHow: told ? v('how') || 'Yes' : undefined,
              reportedBy: reporter,
              status: 'open',
            })
            toast.success('Incident report filed. The program director has it.')
            setPicked([])
            setTold(false)
            onClose()
          }}
        >
          <DialogHeader>
            <DialogTitle>Log an incident</DialogTitle>
            <DialogDescription>Write it while it’s fresh. Stick to what you saw and what you did.</DialogDescription>
          </DialogHeader>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='grid gap-1.5'>
              <Label htmlFor='inc-type'>What kind</Label>
              <Select value={type} onValueChange={(v) => setType(v as Incident['type'])}>
                <SelectTrigger id='inc-type'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(INCIDENT_TYPE) as Incident['type'][]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {INCIDENT_TYPE[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='grid gap-1.5'>
              <Label htmlFor='inc-sev'>How serious</Label>
              <Select value={severity} onValueChange={(v) => setSeverity(v as Incident['severity'])}>
                <SelectTrigger id='inc-sev'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='minor'>Minor</SelectItem>
                  <SelectItem value='moderate'>Moderate</SelectItem>
                  <SelectItem value='serious'>Serious (call the director now)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='grid gap-1.5'>
              <Label htmlFor='inc-date'>Date</Label>
              <Input id='inc-date' name='date' type='date' defaultValue={today} />
            </div>
            <div className='grid gap-1.5'>
              <Label htmlFor='inc-time'>Time</Label>
              <Input id='inc-time' name='time' type='time' defaultValue={format(now, 'HH:mm')} />
            </div>
          </div>
          {!sessionId && (
            <div className='grid gap-1.5'>
              <Label htmlFor='inc-session'>Session</Label>
              <Select value={sid} onValueChange={(v) => { setSid(v); setPicked([]) }}>
                <SelectTrigger id='inc-session'>
                  <SelectValue placeholder='Choose' />
                </SelectTrigger>
                <SelectContent>
                  {running.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {programById.get(s.programId)?.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {options.length > 0 && (
            <fieldset>
              <legend className='mb-1.5 text-sm font-medium'>Sailors involved</legend>
              <div className='grid max-h-40 grid-cols-2 gap-1.5 overflow-y-auto text-sm'>
                {options.map((o) => (
                  <label key={o.id} className='flex items-center gap-2'>
                    <Checkbox checked={picked.includes(o.id)} onCheckedChange={(c) => setPicked(c ? [...picked, o.id] : picked.filter((x) => x !== o.id))} />
                    {o.name}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <div className='grid gap-1.5'>
            <Label htmlFor='inc-desc'>What happened</Label>
            <Textarea id='inc-desc' name='description' rows={3} placeholder='Capsized near the windward mark and couldn’t right the boat after two tries.' />
          </div>
          <div className='grid gap-1.5'>
            <Label htmlFor='inc-action'>What you did</Label>
            <Textarea id='inc-action' name='action' rows={2} placeholder='Pulled her into the RIB, towed the boat in, warmed up ashore.' />
          </div>
          <div className='grid gap-2'>
            <label className='flex items-center gap-2 text-sm'>
              <Checkbox checked={told} onCheckedChange={(c) => setTold(!!c)} /> Parents have been told
            </label>
            {told && <Input name='how' aria-label='How parents were told' placeholder='Called mom at 4:55 PM' />}
          </div>
          <DialogFooter>
            <Button type='button' variant='outline' onClick={onClose}>
              Cancel
            </Button>
            <Button type='submit'>File report</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
