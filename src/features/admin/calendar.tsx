import { useMemo, useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ChevronLeft, ChevronRight, MapPin, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { PROGRAMS } from '@/data/catalog'
import { programById, useNow } from '@/data/hooks'
import { useStore } from '@/data/store'
import { meetsOn } from '@/domain/attendance'
import type { ClubEvent } from '@/domain/types'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/burgee/marks'

export const KIND: Record<ClubEvent['kind'], { label: string; className: string }> = {
  regatta: { label: 'Regatta', className: 'bg-primary text-primary-foreground' },
  deadline: { label: 'Deadline', className: 'bg-signal-soft text-signal' },
  meeting: { label: 'Meeting', className: 'bg-secondary text-secondary-foreground' },
  social: { label: 'Social', className: 'bg-brass/15 text-brass' },
  training: { label: 'Training', className: 'bg-ok-soft text-ok' },
}

const iso = (d: Date) => format(d, 'yyyy-MM-dd')
const inRange = (e: ClubEvent, day: string) => day >= e.date && day <= (e.endDate ?? e.date)

export function AdminCalendar() {
  const now = useNow(60_000)
  const sessions = useStore((s) => s.sessions)
  const events = useStore((s) => s.calendar)
  const remove = useStore((s) => s.removeCalendarEvent)
  const [month, setMonth] = useState(() => startOfMonth(now))
  const [selected, setSelected] = useState(() => iso(now))
  const [adding, setAdding] = useState(false)

  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(month)), end: endOfWeek(endOfMonth(month)) })

  const meeting = (d: Date) => [...new Set(sessions.filter((s) => meetsOn(s, d)).map((s) => s.programId))]
  const byDay = useMemo(
    () => new Map(eachDayOfInterval({ start: startOfWeek(startOfMonth(month)), end: endOfWeek(endOfMonth(month)) }).map((d) => [iso(d), meeting(d)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessions, month]
  )
  const programsOn = (d: Date) => byDay.get(iso(d)) ?? meeting(d)

  const selDate = new Date(`${selected}T12:00:00`)
  const selEvents = events.filter((e) => inRange(e, selected))
  const selPrograms = programsOn(selDate)
  const upcoming = [...events].filter((e) => (e.endDate ?? e.date) >= iso(now)).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8)

  return (
    <Main>
      <PageHeader
        title='Calendar'
        description='Practices and camp weeks come straight from your programs. Add regattas, deadlines, meetings and socials so staff and families see the whole season.'
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus className='size-4' /> Add event
          </Button>
        }
      />
      <div className='grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]'>
        <section aria-label='Month' className='rounded-lg border bg-card'>
          <header className='flex items-center justify-between border-b px-4 py-3'>
            <h2 className='text-lg font-semibold'>{format(month, 'MMMM yyyy')}</h2>
            <div className='flex gap-1'>
              <Button variant='ghost' size='icon' onClick={() => setMonth(addMonths(month, -1))} aria-label='Previous month'>
                <ChevronLeft className='size-4' />
              </Button>
              <Button variant='outline' size='sm' onClick={() => { setMonth(startOfMonth(now)); setSelected(iso(now)) }}>
                Today
              </Button>
              <Button variant='ghost' size='icon' onClick={() => setMonth(addMonths(month, 1))} aria-label='Next month'>
                <ChevronRight className='size-4' />
              </Button>
            </div>
          </header>
          <div className='grid grid-cols-7 border-b text-center text-xs text-muted-foreground'>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className='py-2'>
                {d}
              </div>
            ))}
          </div>
          <div className='grid grid-cols-7'>
            {days.map((d) => {
              const k = iso(d)
              const progs = programsOn(d)
              const evs = events.filter((e) => inRange(e, k))
              const isToday = isSameDay(d, now)
              return (
                <button
                  key={k}
                  onClick={() => setSelected(k)}
                  aria-pressed={selected === k}
                  aria-label={`${format(d, 'MMMM d')}: ${evs.length} events, ${progs.length} programs meeting`}
                  className={cn(
                    'min-h-24 border-e border-b p-1.5 text-start align-top transition-colors last:border-e-0 hover:bg-accent/50 [&:nth-child(7n)]:border-e-0',
                    !isSameMonth(d, month) && 'bg-muted/40 text-muted-foreground',
                    selected === k && 'bg-accent ring-2 ring-primary ring-inset'
                  )}
                >
                  <span className={cn('inline-flex size-6 items-center justify-center rounded-full text-xs', isToday && 'bg-primary font-semibold text-primary-foreground')}>
                    {format(d, 'd')}
                  </span>
                  <span className='mt-1 block space-y-0.5'>
                    {evs.slice(0, 2).map((e) => (
                      <span key={e.id} className={cn('block truncate rounded px-1 py-0.5 text-[11px] font-medium', KIND[e.kind].className)}>
                        {e.title}
                      </span>
                    ))}
                    {evs.length > 2 && <span className='block text-[11px] text-muted-foreground'>+{evs.length - 2} more</span>}
                  </span>
                  {progs.length > 0 && (
                    <span className='mt-1 flex flex-wrap items-center gap-0.5' aria-hidden='true'>
                      {progs.slice(0, 6).map((p) => (
                        <span key={p} className='size-1.5 rounded-full' style={{ background: programById.get(p)?.color }} />
                      ))}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </section>

        <aside className='space-y-6'>
          <section className='rounded-lg border bg-card p-4'>
            <h2 className='font-semibold'>{format(selDate, 'EEEE, MMMM d')}</h2>
            {selEvents.length === 0 && selPrograms.length === 0 && <p className='mt-2 text-sm text-muted-foreground'>Nothing scheduled.</p>}
            <ul className='mt-3 space-y-3'>
              {selEvents.map((e) => (
                <li key={e.id} className='text-sm'>
                  <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium', KIND[e.kind].className)}>{KIND[e.kind].label}</span>
                  <p className='mt-1 font-medium'>{e.title}</p>
                  <p className='text-xs text-muted-foreground'>
                    {[e.endDate ? `${format(new Date(`${e.date}T12:00:00`), 'MMM d')}–${format(new Date(`${e.endDate}T12:00:00`), 'MMM d')}` : null, e.time].filter(Boolean).join(', ')}
                  </p>
                  {e.location && (
                    <p className='flex items-center gap-1 text-xs text-muted-foreground'>
                      <MapPin className='size-3' /> {e.location}
                    </p>
                  )}
                  {e.programIds?.length ? <p className='text-xs text-muted-foreground'>For {e.programIds.map((p) => programById.get(p)?.name).join(', ')}</p> : null}
                  {e.notes && <p className='mt-1 text-xs'>{e.notes}</p>}
                  <button
                    className='mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive'
                    onClick={() => {
                      remove(e.id)
                      toast('Event removed')
                    }}
                  >
                    <Trash2 className='size-3' /> Remove
                  </button>
                </li>
              ))}
            </ul>
            {selPrograms.length > 0 && (
              <div className='mt-4 border-t pt-3'>
                <p className='text-xs font-medium text-muted-foreground'>On the water</p>
                <ul className='mt-1.5 space-y-1 text-sm'>
                  {selPrograms.map((p) => {
                    const se = sessions.find((s) => s.programId === p && meetsOn(s, selDate))!
                    return (
                      <li key={p} className='flex items-center gap-2'>
                        <span className='size-2 rounded-full' style={{ background: programById.get(p)?.color }} />
                        <span className='flex-1'>{programById.get(p)?.name}</span>
                        <span className='text-xs text-muted-foreground'>{se.time.split('·')[0].replace('Weekdays ', '')}</span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </section>
          <section>
            <h2 className='mb-2 text-lg font-semibold'>Coming up</h2>
            <ol className='divide-y rounded-lg border bg-card'>
              {upcoming.map((e) => (
                <li key={e.id}>
                  <button
                    className='flex w-full gap-3 px-4 py-2.5 text-start text-sm hover:bg-muted/50'
                    onClick={() => {
                      setMonth(startOfMonth(new Date(`${e.date}T12:00:00`)))
                      setSelected(e.date)
                    }}
                  >
                    <span className='w-12 shrink-0 text-center'>
                      <span className='block text-[11px] text-muted-foreground'>{format(new Date(`${e.date}T12:00:00`), 'MMM')}</span>
                      <span className='block font-display text-lg leading-none font-semibold text-heading'>{format(new Date(`${e.date}T12:00:00`), 'd')}</span>
                    </span>
                    <span className='min-w-0 flex-1'>
                      <span className='block font-medium'>{e.title}</span>
                      <span className='text-xs text-muted-foreground'>{KIND[e.kind].label}{e.location ? `, ${e.location}` : ''}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
      <AddEventDialog open={adding} onClose={() => setAdding(false)} defaultDate={selected} />
    </Main>
  )
}

function AddEventDialog({ open, onClose, defaultDate }: { open: boolean; onClose: () => void; defaultDate: string }) {
  const add = useStore((s) => s.addCalendarEvent)
  const [kind, setKind] = useState<ClubEvent['kind']>('regatta')
  const [programs, setPrograms] = useState<string[]>([])
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className='max-h-[90svh] overflow-y-auto sm:max-w-lg'>
        <form
          key={String(open) + defaultDate}
          className='grid gap-4'
          onSubmit={(e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            const v = (k: string) => String(fd.get(k) ?? '').trim()
            if (!v('title') || !v('date')) return toast.error('Add a title and a date.')
            add({
              title: v('title'),
              kind,
              date: v('date'),
              endDate: v('endDate') || undefined,
              time: v('time') || undefined,
              location: v('location') || undefined,
              notes: v('notes') || undefined,
              programIds: programs.length ? programs : undefined,
            })
            toast.success(`${v('title')} added to the calendar`)
            setPrograms([])
            onClose()
          }}
        >
          <DialogHeader>
            <DialogTitle>Add an event</DialogTitle>
            <DialogDescription>Regattas, deadlines, coach trainings and socials. Practices are added automatically from your programs.</DialogDescription>
          </DialogHeader>
          <div className='grid gap-1.5'>
            <Label htmlFor='ev-title'>Title</Label>
            <Input id='ev-title' name='title' placeholder='Charleston Race Week' />
          </div>
          <div className='grid gap-4 sm:grid-cols-3'>
            <div className='grid gap-1.5'>
              <Label htmlFor='ev-kind'>Type</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as ClubEvent['kind'])}>
                <SelectTrigger id='ev-kind'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(KIND) as ClubEvent['kind'][]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {KIND[k].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='grid gap-1.5'>
              <Label htmlFor='ev-date'>Date</Label>
              <Input id='ev-date' name='date' type='date' defaultValue={defaultDate} />
            </div>
            <div className='grid gap-1.5'>
              <Label htmlFor='ev-end'>Ends (optional)</Label>
              <Input id='ev-end' name='endDate' type='date' />
            </div>
          </div>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='grid gap-1.5'>
              <Label htmlFor='ev-time'>Time</Label>
              <Input id='ev-time' name='time' placeholder='First warning 11:00 AM' />
            </div>
            <div className='grid gap-1.5'>
              <Label htmlFor='ev-loc'>Location</Label>
              <Input id='ev-loc' name='location' placeholder='Saltmarsh Bay YC' />
            </div>
          </div>
          <fieldset>
            <legend className='mb-1.5 text-sm font-medium'>For which programs? (optional)</legend>
            <div className='grid grid-cols-2 gap-1.5 text-sm'>
              {PROGRAMS.map((p) => (
                <label key={p.id} className='flex items-center gap-2'>
                  <Checkbox checked={programs.includes(p.id)} onCheckedChange={(c) => setPrograms(c ? [...programs, p.id] : programs.filter((x) => x !== p.id))} />
                  {p.name}
                </label>
              ))}
            </div>
          </fieldset>
          <div className='grid gap-1.5'>
            <Label htmlFor='ev-notes'>Notes</Label>
            <Textarea id='ev-notes' name='notes' rows={2} />
          </div>
          <DialogFooter>
            <Button type='button' variant='outline' onClick={onClose}>
              Cancel
            </Button>
            <Button type='submit'>Add to calendar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
