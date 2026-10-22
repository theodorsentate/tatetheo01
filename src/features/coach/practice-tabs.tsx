import { useState } from 'react'
import { format } from 'date-fns'
import { Check, ChevronRight, Minus, Pencil, Plus, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { LESSON_LIBRARY, TRACKS, skillById, trackFor } from '@/data/curriculum'
import { programById, useLookups } from '@/data/hooks'
import { useStore } from '@/data/store'
import type { Boat, Group, LessonBlock, LessonPlan, Sailor, Session } from '@/domain/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { EVAL_LABEL, EvaluationForm, SkillBar, SkillChecklist, skillProgress } from '@/components/burgee/skills'

/** Start time of a session's weekday practice, e.g. "3:45" → Date on `date`. */
function startOf(session: Session, date: string) {
  const m = session.time.match(/(\d{1,2}):(\d{2})/)
  const pm = /PM/.test(session.time.split('·')[0]) && m && Number(m[1]) < 12
  const d = new Date(`${date}T12:00:00`)
  if (m) d.setHours(Number(m[1]) + (pm ? 12 : 0), Number(m[2]), 0, 0)
  return d
}

/* ───────────── Plan ───────────── */

export function PlanTab({ session, group, date, coachName }: { session: Session; group: Group; date: string; coachName: string }) {
  const plan = useStore((s) => s.lessonPlans.find((p) => p.sessionId === session.id && p.date === date))
  const save = useStore((s) => s.saveLessonPlan)
  const look = useLookups()
  const [editing, setEditing] = useState(false)
  const [picking, setPicking] = useState(false)
  const tracks = [...new Set(group.sailorIds.map((id) => look.sailor.get(id)).filter(Boolean).map((k) => trackFor(k!.level)))]
  const library = LESSON_LIBRARY.filter((l) => l.tracks.some((t) => tracks.includes(t)))
  const dateLabel = format(new Date(`${date}T12:00:00`), 'EEEE, MMM d')

  const use = (libId: string) => {
    const lib = LESSON_LIBRARY.find((l) => l.id === libId)!
    save({ id: plan?.id, sessionId: session.id, date, title: lib.title, focus: lib.focus, blocks: lib.blocks, skillIds: lib.skillIds, notes: plan?.notes, by: coachName })
    setPicking(false)
    toast.success(`${lib.title} is the plan for ${dateLabel}`)
  }

  if (!plan || picking)
    return (
      <div className='px-4 py-4'>
        <p className='text-sm text-muted-foreground'>{plan ? 'Pick a different plan' : `No plan yet for ${dateLabel}. Start from one of these.`}</p>
        <ul className='mt-3 space-y-2'>
          {library.map((l) => (
            <li key={l.id}>
              <button onClick={() => use(l.id)} className='flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-start'>
                <span className='min-w-0 flex-1'>
                  <span className='block font-semibold'>{l.title}</span>
                  <span className='block text-sm text-muted-foreground'>{l.focus}</span>
                  <span className='block text-xs text-muted-foreground'>{l.blocks.reduce((n, b) => n + b.minutes, 0)} minutes</span>
                </span>
                <ChevronRight className='size-4 text-muted-foreground' />
              </button>
            </li>
          ))}
        </ul>
        {plan && (
          <Button variant='ghost' className='mt-2 w-full' onClick={() => setPicking(false)}>
            Keep {plan.title}
          </Button>
        )}
      </div>
    )

  const start = startOf(session, date).getTime()
  const offsets = plan.blocks.map((_, i) => plan.blocks.slice(0, i).reduce((n, b) => n + b.minutes, 0))
  const skills = plan.skillIds.map((id) => skillById.get(id)).filter((k) => k && tracks.includes(k.track))
  return (
    <div className='px-4 py-4'>
      <p className='text-sm text-muted-foreground'>{dateLabel}</p>
      <h2 className='text-xl font-semibold'>{plan.title}</h2>
      <p className='text-sm'>{plan.focus}</p>
      {plan.notes && <p className='mt-3 rounded-lg bg-brass/10 px-3 py-2 text-sm'>{plan.notes}</p>}
      <ol className='mt-4 space-y-0 border-s-2 border-heading/20 ps-4'>
        {plan.blocks.map((b, i) => {
          const at = new Date(start + offsets[i] * 60000)
          return (
            <li key={i} className='relative pb-4 last:pb-0'>
              <span className='absolute -start-[23px] top-1 size-3 rounded-full border-2 border-heading bg-card' aria-hidden='true' />
              <p className='text-xs text-muted-foreground'>
                {format(at, 'h:mm')} · {b.minutes} min
              </p>
              <p className='font-medium'>{b.title}</p>
              {b.detail && <p className='text-sm text-muted-foreground'>{b.detail}</p>}
            </li>
          )
        })}
      </ol>
      {skills.length > 0 && (
        <div className='mt-5'>
          <p className='text-sm font-medium'>Skills to watch for today</p>
          <ul className='mt-1.5 flex flex-wrap gap-1.5'>
            {skills.map((k) => (
              <li key={k!.id} className='rounded-full bg-muted px-2.5 py-1 text-xs'>
                {k!.name}
              </li>
            ))}
          </ul>
          <p className='mt-1.5 text-xs text-muted-foreground'>Tick them off per sailor in the Skills tab.</p>
        </div>
      )}
      <p className='mt-4 text-xs text-muted-foreground'>
        Plan by {plan.by}, updated {format(new Date(plan.updatedAt), 'MMM d')}
      </p>
      <div className='mt-3 grid grid-cols-2 gap-2'>
        <Button variant='outline' onClick={() => setEditing(true)}>
          <Pencil className='size-4' /> Edit
        </Button>
        <Button variant='outline' onClick={() => setPicking(true)}>
          Different plan
        </Button>
      </div>
      <PlanEditor plan={plan} open={editing} onClose={() => setEditing(false)} coachName={coachName} />
    </div>
  )
}

function PlanEditor({ plan, open, onClose, coachName }: { plan: LessonPlan; open: boolean; onClose: () => void; coachName: string }) {
  const save = useStore((s) => s.saveLessonPlan)
  const [blocks, setBlocks] = useState<LessonBlock[]>(plan.blocks)
  const [key, setKey] = useState('')
  if (open && key !== plan.id + plan.updatedAt) {
    setKey(plan.id + plan.updatedAt)
    setBlocks(plan.blocks)
  }
  const set = (i: number, patch: Partial<LessonBlock>) => setBlocks(blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)))
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side='bottom' className='max-h-[90svh] overflow-y-auto rounded-t-2xl'>
        <SheetHeader>
          <SheetTitle>Edit the plan</SheetTitle>
          <SheetDescription>Other coaches on this team see it right away.</SheetDescription>
        </SheetHeader>
        <form
          className='grid gap-3 px-4 pb-6'
          onSubmit={(e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            save({
              ...plan,
              title: String(fd.get('title') || plan.title),
              focus: String(fd.get('focus') ?? ''),
              notes: String(fd.get('notes') ?? '').trim() || undefined,
              blocks: blocks.filter((b) => b.title.trim()),
              by: coachName,
            })
            toast.success('Plan saved')
            onClose()
          }}
        >
          <div className='grid gap-1.5'>
            <Label htmlFor='pl-title'>Title</Label>
            <Input id='pl-title' name='title' defaultValue={plan.title} />
          </div>
          <div className='grid gap-1.5'>
            <Label htmlFor='pl-focus'>Focus</Label>
            <Input id='pl-focus' name='focus' defaultValue={plan.focus} />
          </div>
          <fieldset className='grid gap-2'>
            <legend className='mb-1 text-sm font-medium'>Blocks</legend>
            {blocks.map((b, i) => (
              <div key={i} className='grid grid-cols-[64px_1fr_auto] items-start gap-2'>
                <Input type='number' min={1} value={b.minutes} onChange={(e) => set(i, { minutes: Number(e.target.value) || 0 })} aria-label='Minutes' />
                <div className='grid gap-1'>
                  <Input value={b.title} onChange={(e) => set(i, { title: e.target.value })} aria-label='Block' />
                  <Input value={b.detail ?? ''} onChange={(e) => set(i, { detail: e.target.value || undefined })} placeholder='Details' aria-label='Details' className='h-8 text-xs' />
                </div>
                <Button type='button' size='icon' variant='ghost' onClick={() => setBlocks(blocks.filter((_, j) => j !== i))} aria-label={`Remove ${b.title}`}>
                  <Minus className='size-4' />
                </Button>
              </div>
            ))}
            <Button type='button' variant='outline' size='sm' onClick={() => setBlocks([...blocks, { minutes: 15, title: '' }])}>
              <Plus className='size-4' /> Add a block
            </Button>
          </fieldset>
          <div className='grid gap-1.5'>
            <Label htmlFor='pl-notes'>Notes for coaches</Label>
            <Textarea id='pl-notes' name='notes' rows={2} defaultValue={plan.notes} />
          </div>
          <Button type='submit'>Save plan</Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}

/* ───────────── Boats ───────────── */

const SAILOR_BOAT: Record<string, Boat['kind']> = { 'green-team': 'Opti', 'rwb-team': 'Opti', '420-team': 'Club 420', 'ilca-team': 'ILCA' }

export function BoatsTab({ session, group }: { session: Session; group: Group }) {
  const boats = useStore((s) => s.boats)
  const a = useStore((s) => s.boatAssignments.find((x) => x.sessionId === session.id))
  const assign = useStore((s) => s.assignBoat)
  const look = useLookups()
  const kind = SAILOR_BOAT[session.programId] ?? 'Opti'
  const pool = boats.filter((b) => b.kind === kind)
  const coachBoats = boats.filter((b) => b.kind === 'RIB' || b.kind === 'Whaler')
  const kids = group.sailorIds.map((id) => look.sailor.get(id)!).filter(Boolean).sort((x, y) => x.lastName.localeCompare(y.lastName))
  const taken = new Map<string, number>()
  Object.values(a?.sailors ?? {}).forEach((b) => b !== 'own' && taken.set(b, (taken.get(b) ?? 0) + 1))
  const perBoat = kind === 'Club 420' ? 2 : 1

  const row = (label: string, value: string | undefined, options: Boat[], onChange: (v: string | null) => void, allowOwn: boolean) => {
    const boat = value && value !== 'own' ? boats.find((b) => b.id === value) : undefined
    const double = boat && (taken.get(boat.id) ?? 0) > perBoat
    return (
      <li key={label} className='px-4 py-2.5'>
        <div className='flex items-center gap-3'>
          <span className='min-w-0 flex-1 truncate text-sm font-medium'>{label}</span>
          <Select value={value ?? 'none'} onValueChange={(v) => onChange(v === 'none' ? null : v)}>
            <SelectTrigger className='h-9 w-40' aria-label={`Boat for ${label}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className='max-h-72'>
              <SelectItem value='none'>Not assigned</SelectItem>
              {allowOwn && <SelectItem value='own'>Own boat</SelectItem>}
              {options.map((b) => (
                <SelectItem key={b.id} value={b.id} disabled={b.status === 'out-of-service'}>
                  {b.name}
                  {b.status !== 'ready' ? ` (${b.status === 'needs-repair' ? 'needs repair' : 'out of service'})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {boat && boat.status !== 'ready' && (
          <p className='mt-1 flex items-center gap-1.5 text-xs font-medium text-signal'>
            <TriangleAlert className='size-3.5' /> {boat.name}: {boat.issue ?? 'needs attention'}
          </p>
        )}
        {double && <p className='mt-1 text-xs font-medium text-destructive'>{boat!.name} is assigned to more than one sailor</p>}
      </li>
    )
  }

  return (
    <div className='py-4'>
      <h2 className='px-4 text-sm font-semibold text-muted-foreground'>Coach boats</h2>
      <ul className='mt-2 divide-y border-y bg-card'>
        {group.coachIds.map((cid) =>
          row(look.coach.get(cid)?.name ?? 'Coach', a?.coaches[cid], coachBoats, (v) => assign(session.id, 'coach', cid, v), false)
        )}
      </ul>
      <h2 className='mt-5 px-4 text-sm font-semibold text-muted-foreground'>
        Sailors · {kind === 'Club 420' ? 'two to a boat' : kind}
      </h2>
      <ul className='mt-2 divide-y border-y bg-card'>
        {kids.map((k) => row(`${k.firstName} ${k.lastName}`, a?.sailors[k.id], pool, (v) => assign(session.id, 'sailor', k.id, v as string | 'own' | null), kind !== 'Club 420'))}
      </ul>
      <p className='mt-2 px-4 text-xs text-muted-foreground'>Boats out of service can’t be picked. Repairs come from the director’s boat list.</p>
    </div>
  )
}

/* ───────────── Skills ───────────── */

export function SkillsTab({ session, group, coachId, coachName }: { session: Session; group: Group; coachId: string; coachName: string }) {
  const marks = useStore((s) => s.skillMarks)
  const evaluations = useStore((s) => s.evaluations)
  const look = useLookups()
  const [open, setOpen] = useState<Sailor | null>(null)
  const [writing, setWriting] = useState(false)
  const kids = group.sailorIds.map((id) => look.sailor.get(id)!).filter(Boolean).sort((x, y) => x.lastName.localeCompare(y.lastName))
  const evalFor = (sid: string) => evaluations.filter((e) => e.sailorId === sid && e.sessionId === session.id).sort((x, y) => y.date.localeCompare(x.date))[0]
  const program = programById.get(session.programId)!
  return (
    <div className='py-4'>
      <p className='px-4 text-sm text-muted-foreground'>Tap a sailor to tick off skills or write their evaluation.</p>
      <ul className='mt-3 divide-y border-y bg-card'>
        {kids.map((k) => {
          const p = skillProgress(k, marks)
          const ev = evalFor(k.id)
          return (
            <li key={k.id}>
              <button className='flex w-full items-center gap-3 px-4 py-3 text-start' onClick={() => setOpen(k)}>
                <span className='min-w-0 flex-1'>
                  <span className='block font-semibold'>
                    {k.firstName} {k.lastName}
                  </span>
                  <SkillBar got={p.got} working={p.working.length} total={p.total} className='mt-1.5' />
                  <span className='mt-1 flex justify-between text-xs text-muted-foreground'>
                    <span>
                      {p.got} of {p.total} {TRACKS[p.track].short} skills
                    </span>
                    <span className={cn(ev?.status === 'shared' && 'text-ok', !ev && 'text-signal')}>{ev ? EVAL_LABEL[ev.status] : 'No evaluation'}</span>
                  </span>
                </span>
                <ChevronRight className='size-4 text-muted-foreground' />
              </button>
            </li>
          )
        })}
      </ul>
      <Sheet open={!!open} onOpenChange={(o) => { if (!o) { setOpen(null); setWriting(false) } }}>
        <SheetContent side='bottom' className='max-h-[92svh] overflow-y-auto rounded-t-2xl'>
          {open && (
            <>
              <SheetHeader>
                <SheetTitle>
                  {open.firstName} {open.lastName}
                </SheetTitle>
                <SheetDescription>{program.name}</SheetDescription>
              </SheetHeader>
              <div className='px-4 pb-6'>
                {writing ? (
                  <EvaluationForm sailor={open} sessionId={session.id} coachId={coachId} existing={evalFor(open.id)} onDone={() => setWriting(false)} />
                ) : (
                  <>
                    <SkillChecklist sailor={open} editableBy={coachName} />
                    <div className='mt-5 rounded-lg border p-3'>
                      {evalFor(open.id) ? (
                        <>
                          <p className='flex items-center gap-1.5 text-sm font-medium'>
                            {evalFor(open.id)!.status === 'shared' && <Check className='size-4 text-ok' />}
                            {EVAL_LABEL[evalFor(open.id)!.status]}, {format(new Date(`${evalFor(open.id)!.date}T12:00:00`), 'MMM d')}
                          </p>
                          <p className='mt-1 line-clamp-2 text-sm text-muted-foreground'>{evalFor(open.id)!.strengths}</p>
                          <Button variant='outline' size='sm' className='mt-2' onClick={() => setWriting(true)}>
                            Edit evaluation
                          </Button>
                        </>
                      ) : (
                        <>
                          <p className='text-sm font-medium'>No evaluation yet</p>
                          <p className='text-sm text-muted-foreground'>Families see it in their app once you share it.</p>
                          <Button size='sm' className='mt-2' onClick={() => setWriting(true)}>
                            Write evaluation
                          </Button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
