import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { format } from 'date-fns'
import { Download, ExternalLink, MapPin, Plus, Send, Users } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { saveFile, toCsv } from '@/lib/files'
import { PERSONAS, TERMS } from '@/data/catalog'
import { useLookups, useNow } from '@/data/hooks'
import { useStore } from '@/data/store'
import { LEVELS, ageOn } from '@/domain/rules'
import { eligibleSailors, regattaSummary, termForDate } from '@/domain/regattas'
import type { Level, RegattaResponse, Sailor } from '@/domain/types'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Main } from '@/components/layout/main'
import { FleetChip, PageHeader } from '@/components/burgee/marks'

const day = (d: string) => new Date(`${d}T12:00:00`)
const RACING_LEVELS: Level[] = ['opti-green', 'opti-red', 'opti-white', 'opti-blue', 'club-420', 'ilca']

/** Hook: everything about one regatta, from the calendar event to who's going. */
export function useRegatta(eventId: string | undefined) {
  const calendar = useStore((s) => s.calendar)
  const regattas = useStore((s) => s.regattas)
  const responses = useStore((s) => s.regattaResponses)
  const sailors = useStore((s) => s.sailors)
  const regs = useStore((s) => s.registrations)
  const sessions = useStore((s) => s.sessions)
  return useMemo(() => {
    const event = calendar.find((e) => e.id === eventId)
    const details = regattas.find((r) => r.eventId === eventId)
    if (!event || !details) return undefined
    const term = termForDate(TERMS, event.date)
    const eligible = eligibleSailors(details, sailors, regs, sessions, term.id)
    return { event, details, eligible, summary: regattaSummary(event.id, eligible, responses) }
  }, [calendar, regattas, responses, sailors, regs, sessions, eventId])
}

export function AdminRegattas({ regatta }: { regatta?: string }) {
  const now = useNow(60_000)
  const calendar = useStore((s) => s.calendar)
  const regattas = useStore((s) => s.regattas)
  const responses = useStore((s) => s.regattaResponses)
  const navigate = useNavigate()
  const [adding, setAdding] = useState(false)
  const today = format(now, 'yyyy-MM-dd')

  const list = regattas
    .map((r) => ({ r, e: calendar.find((e) => e.id === r.eventId)! }))
    .filter((x) => x.e)
    .sort((a, b) => a.e.date.localeCompare(b.e.date))
  const upcoming = list.filter((x) => (x.e.endDate ?? x.e.date) >= today)
  const past = list.filter((x) => (x.e.endDate ?? x.e.date) < today)
  const selectedId = regatta ?? upcoming[0]?.e.id ?? past[0]?.e.id

  return (
    <Main>
      <PageHeader
        title='Regattas'
        description='Families tap Interested or Going in their app. You see the list here, then enter sailors on the official site.'
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus className='size-4' /> Add regatta
          </Button>
        }
      />
      <div className='grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]'>
        <nav aria-label='Regattas' className='space-y-1'>
          {[...upcoming, ...past].map(({ e }) => {
            const going = responses.filter((x) => x.eventId === e.id && x.status === 'going').length
            const isPast = (e.endDate ?? e.date) < today
            return (
              <button
                key={e.id}
                onClick={() => navigate({ to: '/admin/regattas', search: { regatta: e.id }, replace: true })}
                aria-current={selectedId === e.id ? 'true' : undefined}
                className={cn(
                  'flex w-full gap-3 rounded-lg px-3 py-2.5 text-start transition-colors',
                  selectedId === e.id ? 'bg-card shadow-sm ring-1 ring-border' : 'hover:bg-card/60',
                  isPast && 'opacity-60'
                )}
              >
                <span className='w-9 shrink-0 text-center leading-tight'>
                  <span className='block text-[11px] text-muted-foreground'>{format(day(e.date), 'MMM')}</span>
                  <span className='block font-display text-lg font-semibold text-heading'>{format(day(e.date), 'd')}</span>
                </span>
                <span className='min-w-0'>
                  <span className='block text-sm font-medium'>{e.title}</span>
                  <span className='block text-xs text-muted-foreground'>{isPast ? 'Finished' : `${going} going`}</span>
                </span>
              </button>
            )
          })}
          {list.length === 0 && <p className='px-3 text-sm text-muted-foreground'>No regattas yet. Add the first one.</p>}
        </nav>
        {selectedId ? <RegattaDetail eventId={selectedId} /> : null}
      </div>
      <AddRegattaDialog open={adding} onClose={() => setAdding(false)} onAdded={(id) => navigate({ to: '/admin/regattas', search: { regatta: id } })} />
    </Main>
  )
}

function RegattaDetail({ eventId }: { eventId: string }) {
  const data = useRegatta(eventId)
  const look = useLookups()
  const send = useStore((s) => s.sendAnnouncement)
  const assignments = useStore((s) => s.boatAssignments)
  const boats = useStore((s) => s.boats)
  const regs = useStore((s) => s.registrations)
  const [tab, setTab] = useState<'going' | 'interested' | 'noAnswer' | 'notGoing'>('going')
  if (!data) return null
  const { event, details, summary } = data
  const familiesOf = (ids: string[]) => [...new Set(ids.map((id) => look.sailor.get(id)?.familyId).filter(Boolean) as string[])]

  const boatFor = (sailorId: string) => {
    const reg = regs.find((r) => r.sailorId === sailorId && r.status === 'confirmed' && assignments.some((a) => a.sessionId === r.sessionId && a.sailors[sailorId]))
    const a = reg && assignments.find((x) => x.sessionId === reg.sessionId)
    const b = a?.sailors[sailorId]
    if (!b) return '—'
    return b === 'own' ? 'Own boat' : (boats.find((x) => x.id === b)?.name ?? '—')
  }

  const nudge = () => {
    const fams = familiesOf(summary.noAnswer.map((k) => k.id))
    const n = send({
      title: `${event.title}: are you in?`,
      body: `Let us know by ${details.entryDeadline ? format(day(details.entryDeadline), 'EEEE, MMMM d') : 'this week'}. Open Burgee and tap Interested or Going.`,
      category: 'reminder',
      audience: { kind: 'families', familyIds: fams, label: `${event.title}: no answer yet` },
      channels: ['email', 'sms'],
      sentBy: PERSONAS.director.name,
    })
    toast.success(`Reminder sent to ${n} families`)
  }
  const messageGoing = () => {
    const fams = familiesOf(summary.going.map((r) => r.sailorId))
    const n = send({
      title: `${event.title}: details for sailors going`,
      body: `${details.travel ?? ''} ${event.time ? `Schedule: ${event.time}.` : ''} Reply here with any questions.`.trim(),
      category: 'schedule',
      audience: { kind: 'families', familyIds: fams, label: `${event.title}: going` },
      channels: ['email', 'sms'],
      sentBy: PERSONAS.director.name,
    })
    toast.success(`Sent to ${n} families`)
  }
  const download = async () => {
    const rows = summary.going.map((r) => {
      const k = look.sailor.get(r.sailorId)!
      const f = look.family.get(k.familyId)!
      return [`${k.firstName} ${k.lastName}`, LEVELS[k.level].label, ageOn(k.dob, event.date), boatFor(k.id), f.guardians[0].name, f.guardians[0].phone, f.guardians[0].email, r.chaperone ? 'Yes' : '']
    })
    const ok = await saveFile(
      `${event.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-entries.csv`,
      toCsv([['Sailor', 'Fleet', 'Age on race day', 'Boat', 'Guardian', 'Phone', 'Email', 'Chaperone'], ...rows]),
      'text/csv'
    )
    if (ok) toast.success('Entry list ready')
  }

  const tabs = [
    { id: 'going', label: 'Going', n: summary.going.length },
    { id: 'interested', label: 'Interested', n: summary.interested.length },
    { id: 'noAnswer', label: 'No answer', n: summary.noAnswer.length },
    { id: 'notGoing', label: 'Not going', n: summary.notGoing.length },
  ] as const
  const rowsFor = (t: typeof tab): { k: Sailor; r?: RegattaResponse }[] =>
    t === 'noAnswer' ? summary.noAnswer.map((k) => ({ k })) : summary[t].map((r) => ({ k: look.sailor.get(r.sailorId)!, r })).filter((x) => x.k)

  return (
    <article className='rounded-xl border bg-card'>
      <header className='border-b p-5'>
        <h2 className='text-xl font-semibold'>{event.title}</h2>
        <p className='mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground'>
          <span>
            {format(day(event.date), 'EEE, MMM d')}
            {event.endDate && ` – ${format(day(event.endDate), 'EEE, MMM d')}`}
          </span>
          {event.location && (
            <span className='flex items-center gap-1'>
              <MapPin className='size-3.5' /> {event.location}
            </span>
          )}
        </p>
        <div className='mt-3 flex flex-wrap gap-1.5'>
          {details.levels.map((l) => (
            <FleetChip key={l} level={l} />
          ))}
        </div>
        <dl className='mt-4 grid gap-3 text-sm sm:grid-cols-3'>
          <div>
            <dt className='text-muted-foreground'>Entry closes</dt>
            <dd className='font-medium'>{details.entryDeadline ? format(day(details.entryDeadline), 'EEE, MMM d') : 'Not set'}</dd>
          </div>
          <div>
            <dt className='text-muted-foreground'>Coaches</dt>
            <dd className='font-medium'>{details.coachIds.map((id) => look.coach.get(id)?.name.split(' ')[0]).filter(Boolean).join(', ') || 'Not set'}</dd>
          </div>
          <div>
            <dt className='text-muted-foreground'>Chaperones</dt>
            <dd className={cn('font-medium', summary.chaperones.length < details.chaperonesNeeded && 'text-signal')}>
              {summary.chaperones.length} of {details.chaperonesNeeded}
              {summary.chaperones.length > 0 && (
                <span className='block text-xs font-normal text-muted-foreground'>
                  {summary.chaperones.map((r) => r.by.split(' ')[0]).join(', ')}
                </span>
              )}
            </dd>
          </div>
        </dl>
        {details.travel && <p className='mt-3 text-sm'>{details.travel}</p>}
        <div className='mt-4 flex flex-wrap gap-2'>
          <Button size='sm' onClick={messageGoing} disabled={!summary.going.length}>
            <Send className='size-4' /> Message families going
          </Button>
          <Button size='sm' variant='outline' onClick={download} disabled={!summary.going.length}>
            <Download className='size-4' /> Entry list
          </Button>
          {details.entryUrl && (
            <Button size='sm' variant='outline' asChild>
              <a href={details.entryUrl} target='_blank' rel='noreferrer'>
                <ExternalLink className='size-4' /> Official entry
              </a>
            </Button>
          )}
        </div>
      </header>
      <div className='flex gap-1 overflow-x-auto border-b px-3' role='tablist'>
        {tabs.map((t) => (
          <button
            key={t.id}
            role='tab'
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn('-mb-px border-b-2 px-3 py-2.5 text-sm font-medium', tab === t.id ? 'border-brass text-heading' : 'border-transparent text-muted-foreground hover:text-foreground')}
          >
            {t.label} <span className='ms-1 text-muted-foreground'>{t.n}</span>
          </button>
        ))}
      </div>
      {tab === 'noAnswer' && summary.noAnswer.length > 0 && (
        <div className='flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-5 py-2.5 text-sm'>
          <span className='text-muted-foreground'>{familiesOf(summary.noAnswer.map((k) => k.id)).length} families haven’t answered.</span>
          <Button size='sm' variant='outline' onClick={nudge}>
            <Users className='size-4' /> Remind them
          </Button>
        </div>
      )}
      <ul className='divide-y'>
        {rowsFor(tab).map(({ k, r }) => (
          <li key={k.id} className='flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-sm'>
            <span className='min-w-0 flex-1'>
              <span className='font-medium'>
                {k.firstName} {k.lastName}
              </span>
              <span className='ms-2 text-xs text-muted-foreground'>{look.family.get(k.familyId)?.guardians[0].name}</span>
            </span>
            <FleetChip level={k.level} />
            {tab === 'going' && <span className='w-28 text-xs text-muted-foreground'>{boatFor(k.id)}</span>}
            {r?.chaperone && <span className='rounded-full bg-brass/15 px-2 py-0.5 text-xs font-medium text-brass'>Chaperone</span>}
          </li>
        ))}
        {rowsFor(tab).length === 0 && <li className='px-5 py-6 text-center text-sm text-muted-foreground'>Nobody here yet.</li>}
      </ul>
    </article>
  )
}

function AddRegattaDialog({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (id: string) => void }) {
  const add = useStore((s) => s.addRegatta)
  const coaches = useStore((s) => s.coaches)
  const send = useStore((s) => s.sendAnnouncement)
  const [levels, setLevels] = useState<Level[]>(['opti-green'])
  const [coachIds, setCoachIds] = useState<string[]>([])
  const [ask, setAsk] = useState(true)
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className='max-h-[90svh] overflow-y-auto sm:max-w-lg'>
        <form
          key={String(open)}
          className='grid gap-4'
          onSubmit={(e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            const v = (k: string) => String(fd.get(k) ?? '').trim()
            if (!v('title') || !v('date')) return toast.error('Add a name and a date.')
            add(
              { title: v('title'), date: v('date'), endDate: v('endDate') || undefined, location: v('location') || undefined, time: v('time') || undefined },
              {
                levels,
                coachIds,
                entryDeadline: v('deadline') || undefined,
                entryFee: Number(v('fee')) || undefined,
                entryUrl: v('url') || undefined,
                chaperonesNeeded: Number(v('chaperones')) || 0,
                travel: v('travel') || undefined,
              }
            )
            const s = useStore.getState()
            const ev = s.calendar[s.calendar.length - 1]
            if (ask) {
              const term = termForDate(TERMS, ev.date)
              const fams = [...new Set(eligibleSailors({ levels }, s.sailors, s.registrations, s.sessions, term.id).map((k) => k.familyId))]
              send({
                title: `New regatta: ${ev.title}`,
                body: `${format(day(ev.date), 'EEEE, MMMM d')}${ev.location ? ` at ${ev.location}` : ''}. Open Burgee and tap Interested or Going so coaches can plan.`,
                category: 'schedule',
                audience: { kind: 'families', familyIds: fams, label: `${ev.title}: eligible sailors` },
                channels: ['email', 'sms'],
                sentBy: PERSONAS.director.name,
              })
              toast.success(`${ev.title} added. ${fams.length} families asked.`)
            } else toast.success(`${ev.title} added`)
            onAdded(ev.id)
            onClose()
          }}
        >
          <DialogHeader>
            <DialogTitle>Add a regatta</DialogTitle>
            <DialogDescription>It goes on the calendar and families of eligible sailors can answer from their app.</DialogDescription>
          </DialogHeader>
          <div className='grid gap-1.5'>
            <Label htmlFor='rg-title'>Name</Label>
            <Input id='rg-title' name='title' placeholder='Winter Frostbite #1' />
          </div>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='grid gap-1.5'>
              <Label htmlFor='rg-date'>Date</Label>
              <Input id='rg-date' name='date' type='date' />
            </div>
            <div className='grid gap-1.5'>
              <Label htmlFor='rg-end'>Last day (if more than one)</Label>
              <Input id='rg-end' name='endDate' type='date' />
            </div>
            <div className='grid gap-1.5'>
              <Label htmlFor='rg-loc'>Where</Label>
              <Input id='rg-loc' name='location' placeholder='Harbor Island YC' />
            </div>
            <div className='grid gap-1.5'>
              <Label htmlFor='rg-time'>Schedule</Label>
              <Input id='rg-time' name='time' placeholder='First warning 11:00 AM' />
            </div>
          </div>
          <fieldset>
            <legend className='mb-1.5 text-sm font-medium'>Fleets</legend>
            <div className='flex flex-wrap gap-x-4 gap-y-2 text-sm'>
              {RACING_LEVELS.map((l) => (
                <label key={l} className='flex items-center gap-2'>
                  <Checkbox checked={levels.includes(l)} onCheckedChange={(c) => setLevels(c ? [...levels, l] : levels.filter((x) => x !== l))} />
                  {LEVELS[l].label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className='grid gap-4 sm:grid-cols-3'>
            <div className='grid gap-1.5'>
              <Label htmlFor='rg-deadline'>Entry closes</Label>
              <Input id='rg-deadline' name='deadline' type='date' />
            </div>
            <div className='grid gap-1.5'>
              <Label htmlFor='rg-fee'>Entry fee ($)</Label>
              <Input id='rg-fee' name='fee' type='number' min={0} placeholder='45' />
            </div>
            <div className='grid gap-1.5'>
              <Label htmlFor='rg-chap'>Chaperones needed</Label>
              <Input id='rg-chap' name='chaperones' type='number' min={0} defaultValue={2} />
            </div>
          </div>
          <div className='grid gap-1.5'>
            <Label htmlFor='rg-url'>Official entry link</Label>
            <Input id='rg-url' name='url' type='url' placeholder='Regatta Network or Clubspot page' />
          </div>
          <fieldset>
            <legend className='mb-1.5 text-sm font-medium'>Coaches going</legend>
            <div className='grid grid-cols-2 gap-2 text-sm'>
              {coaches
                .filter((c) => c.role !== 'program-director')
                .map((c) => (
                  <label key={c.id} className='flex items-center gap-2'>
                    <Checkbox checked={coachIds.includes(c.id)} onCheckedChange={(v) => setCoachIds(v ? [...coachIds, c.id] : coachIds.filter((x) => x !== c.id))} />
                    {c.name}
                  </label>
                ))}
            </div>
          </fieldset>
          <div className='grid gap-1.5'>
            <Label htmlFor='rg-travel'>Travel and logistics</Label>
            <Textarea id='rg-travel' name='travel' rows={2} placeholder='Trailer leaves Friday 3 PM. Families drive.' />
          </div>
          <label className='flex items-center gap-2 text-sm'>
            <Checkbox checked={ask} onCheckedChange={(v) => setAsk(!!v)} /> Ask eligible families now (text and email)
          </label>
          <DialogFooter>
            <Button type='button' variant='outline' onClick={onClose}>
              Cancel
            </Button>
            <Button type='submit'>Add regatta</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
