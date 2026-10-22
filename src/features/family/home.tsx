import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { format } from 'date-fns'
import { CalendarX, Car, ChevronRight, ClipboardList, Clock, HeartPulse, LogOut, MessageCircle, Plus, Smartphone, Trophy, Waves, X } from 'lucide-react'
import { toast } from 'sonner'
import { FORM_TEMPLATES, PERSONAS, TERMS } from '@/data/catalog'
import { familyRegs, programById, useLookups, useNow, useWaitlistPosition } from '@/data/hooks'
import { useStore } from '@/data/store'
import { currentGroups, NewMessage, useFamilyRecipients } from '@/features/inbox/inbox'
import { PhoneMessages } from '@/features/inbox/messages-screen'
import { MessageList } from '@/features/inbox/message-list'
import { cn } from '@/lib/utils'
import { latestSwimCheck, meetsOn, nextPractice, pendingForFamily } from '@/domain/attendance'
import { ACTIVE_STATUSES } from '@/domain/pricing'
import { LEVELS } from '@/domain/rules'
import { eligibleSailors, termForDate } from '@/domain/regattas'
import type { Announcement, DayNote, RegattaResponse, Sailor } from '@/domain/types'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { RegStatus } from '@/components/burgee/marks'
import { CALL, Pennant } from '@/components/burgee/practice'
import { SkillBar, SkillChecklist, skillProgress } from '@/components/burgee/skills'
import { now as clockNow } from '@/lib/clock'

export function useFamily() {
  const families = useStore((s) => s.families)
  const sailors = useStore((s) => s.sailors)
  const family = families.find((f) => f.id === PERSONAS.familyId)!
  const kids = useMemo(() => sailors.filter((s) => s.familyId === family.id), [sailors, family.id])
  return { family, kids }
}

/** Season forms plus any one-off forms the club has created. */
export function useAllTemplates() {
  const custom = useStore((s) => s.customTemplates)
  return useMemo(() => [...FORM_TEMPLATES, ...custom], [custom])
}

/** Everything the persona family still has to sign, with due dates. */
export function useFamilyPending() {
  const { family, kids } = useFamily()
  const regs = useStore((s) => s.registrations)
  const submissions = useStore((s) => s.submissions)
  const requests = useStore((s) => s.formRequests)
  const season = useStore((s) => s.settings.season)
  const templates = useAllTemplates()
  return useMemo(() => {
    const active = new Set(regs.filter((r) => ACTIVE_STATUSES.has(r.status)).map((r) => r.sailorId))
    return pendingForFamily({ familyId: family.id, kids, activeSailorIds: active, templates, submissions, requests, season })
  }, [family.id, kids, regs, submissions, requests, season, templates])
}

export function FamilyHome() {
  const { family, kids } = useFamily()
  const regs = useStore((s) => s.registrations)
  const sailors = useStore((s) => s.sailors)
  const announcements = useStore((s) => s.announcements)
  const calls = useStore((s) => s.practiceCalls)
  const attendance = useStore((s) => s.attendance)
  const swimChecks = useStore((s) => s.swimChecks)
  const marks = useStore((s) => s.skillMarks)
  const evaluations = useStore((s) => s.evaluations)
  const dayNotes = useStore((s) => s.dayNotes)
  const groups = useStore((s) => s.groups)
  const removeDayNote = useStore((s) => s.removeDayNote)
  const positions = useWaitlistPosition()
  const look = useLookups()
  const now = useNow()
  const regattas = useKidRegattas()
  const recipients = useFamilyRecipients(family.id)
  const [notesFor, setNotesFor] = useState<Sailor | null>(null)
  const [progressFor, setProgressFor] = useState<Sailor | null>(null)
  const [dayNoteFor, setDayNoteFor] = useState<{ sailor: Sailor; kind: DayNote['kind'] } | null>(null)
  const [writeTo, setWriteTo] = useState<{ key?: string; subject?: string } | null>(null)
  const todayIso = format(now, 'yyyy-MM-dd')

  const mine = familyRegs(regs, sailors, family.id)
  const pending = useFamilyPending()
  const guardian = family.guardians[0]
  const familyMessages = useFamilyMessages(announcements)
  const teamFor = (k: Sailor) =>
    mine
      .filter((r) => r.sailorId === k.id && r.status === 'confirmed')
      .map((r) => look.session.get(r.sessionId)!)
      .find((se) => se && todayIso >= se.startDate && todayIso <= se.endDate)
  // Open on the kid who is on the water right now, else one sailing today.
  const [kidId, setKidId] = useState(
    () =>
      (kids.find((k) => Object.values(attendance).some((e) => e.sailorId === k.id && e.date === todayIso && e.status === 'on-water')) ??
        kids.find((k) => {
          const t = teamFor(k)
          return t && meetsOn(t, now)
        }) ??
        kids[0])?.id
  )
  const kid = kids.find((k) => k.id === kidId) ?? kids[0]

  // ── This kid ──
  const team = teamFor(kid)
  const program = team ? programById.get(team.programId) : undefined
  const practicingToday = !!team && meetsOn(team, now)
  const call = team && calls.find((c) => c.sessionId === team.id && c.date === todayIso)
  const next = team ? nextPractice(team, practicingToday ? new Date(now.getTime() + 86400000) : now) : undefined
  const live = Object.values(attendance)
    .filter((e) => e.sailorId === kid.id && e.date === todayIso)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
  const forms = pending.filter((p) => !p.sailor || p.sailor.id === kid.id)
  const kidRegattas = regattas.filter((r) => r.eligible.has(kid.id))
  const askRegattas = kidRegattas.filter((r) => !r.responses.get(kid.id))
  const progress = skillProgress(kid, marks)
  const evaluation = evaluations.filter((e) => e.sailorId === kid.id && e.status === 'shared').sort((a, b) => b.date.localeCompare(a.date))[0]
  const weeks = mine
    .filter((r) => r.sailorId === kid.id && r.status !== 'cancelled')
    .sort((a, b) => look.session.get(a.sessionId)!.startDate.localeCompare(look.session.get(b.sessionId)!.startDate))
  const kidNotes = dayNotes.filter((d) => d.sailorId === kid.id && d.date >= todayIso).sort((a, b) => a.date.localeCompare(b.date))
  const todoCount = forms.length + askRegattas.length
  const kidGroups = currentGroups(groups, look, todayIso).filter((g) => g.sailorIds.includes(kid.id))

  return (
    <div className='px-4 py-5'>
      <h1 className='text-2xl font-semibold'>Hi, {guardian.name.split(' ')[0]}</h1>

      {kids.length > 1 && (
        <div className='mt-4 flex gap-2' role='tablist' aria-label='Your sailors'>
          {kids.map((k) => (
            <button
              key={k.id}
              role='tab'
              aria-selected={k.id === kid.id}
              onClick={() => setKidId(k.id)}
              className={cn(
                'flex flex-1 items-center gap-2 rounded-xl border px-3 py-2 text-start transition-colors',
                k.id === kid.id ? 'border-heading bg-card shadow-sm ring-1 ring-heading' : 'bg-card/60 text-muted-foreground'
              )}
            >
              <span className='size-2.5 shrink-0 rounded-full' style={{ background: LEVELS[k.level].color }} aria-hidden='true' />
              <span className='min-w-0'>
                <span className='block font-semibold text-foreground'>{k.firstName}</span>
                <span className='block text-xs'>{LEVELS[k.level].label}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Today: the one loud thing on the screen */}
      <section className={cn('mt-4 overflow-hidden rounded-2xl border', practicingToday && call ? CALL[call.status].soft : 'bg-card')} aria-label='Today'>
        <div className='flex items-start gap-3 p-4'>
          <Pennant status={practicingToday ? (call?.status ?? 'none') : 'none'} className='mt-0.5 h-8 w-12' />
          <div className='min-w-0 flex-1'>
            {practicingToday && team ? (
              <>
                <p className={cn('font-display text-xl leading-tight font-semibold', call && CALL[call.status].text)}>{call ? CALL[call.status].sentence : 'Sailing today'}</p>
                <p className='text-sm text-muted-foreground'>
                  {program?.name}, {team.time.split('·')[0].replace('Weekdays ', '').trim()}
                </p>
                {call?.note && <p className='mt-1.5 text-sm'>{call.note}</p>}
                {call && <p className='mt-1 text-xs text-muted-foreground'>Called by {call.by.split(' ')[0]} at {format(new Date(call.postedAt), 'h:mm a')}</p>}
              </>
            ) : (
              <>
                <p className='font-display text-xl leading-tight font-semibold'>No sailing today</p>
                <p className='text-sm text-muted-foreground'>
                  {team && next ? `Next: ${format(new Date(`${next}T12:00:00`), 'EEEE, MMM d')}` : `${kid.firstName} isn’t signed up this week.`}
                </p>
              </>
            )}
          </div>
        </div>
        {live && (
          <p
            className={cn(
              'flex items-center gap-2 border-t px-4 py-2.5 text-sm font-medium',
              live.status === 'on-water' ? 'bg-signal-soft text-signal' : live.status === 'absent' ? 'bg-muted text-muted-foreground' : 'bg-ok-soft text-ok'
            )}
          >
            <Waves className='size-4' />
            {(() => {
              const time = format(new Date(live.status === 'on-water' && live.launchedAt ? live.launchedAt : live.updatedAt), 'h:mm a')
              return live.status === 'on-water'
                ? `${kid.firstName} is on the water (since ${time})`
                : live.status === 'ashore'
                  ? `Back ashore at ${time}`
                  : live.status === 'present'
                    ? `Checked in at ${time}`
                    : live.status === 'picked-up'
                      ? `Went home with ${live.pickedUpBy} at ${time}`
                      : 'Out today'
            })()}
          </p>
        )}
        {kidNotes.length > 0 && (
          <ul className='divide-y border-t bg-card/70'>
            {kidNotes.map((d) => (
              <li key={d.id} className='flex items-center gap-2 px-4 py-2 text-sm'>
                <MessageCircle className='size-4 shrink-0 text-heading' />
                <span className='min-w-0 flex-1'>
                  {d.date === todayIso ? 'Today' : format(new Date(`${d.date}T12:00:00`), 'EEE, MMM d')}: {dayNoteText(d, kid)}
                </span>
                <button
                  aria-label='Remove this note'
                  className='text-muted-foreground'
                  onClick={() => {
                    removeDayNote(d.id)
                    toast('Removed. The coaches have been told.')
                  }}
                >
                  <X className='size-4' />
                </button>
              </li>
            ))}
          </ul>
        )}
        {team && (
          <div className='grid grid-cols-4 border-t bg-card/70 text-center text-xs'>
            {DAY_NOTE_KINDS.map((k) => (
              <button key={k.kind} onClick={() => setDayNoteFor({ sailor: kid, kind: k.kind })} className='flex flex-col items-center gap-1 px-1 py-2.5 font-medium text-heading hover:bg-muted/50'>
                <k.icon className='size-4' />
                {k.short}
              </button>
            ))}
          </div>
        )}
      </section>

      {todoCount > 0 && (
        <section className='mt-6' aria-labelledby='todo'>
          <h2 id='todo' className='mb-2 text-lg font-semibold'>
            To do <span className='text-sm font-normal text-muted-foreground'>{todoCount}</span>
          </h2>
          <ul className='space-y-2'>
            {forms.map((f) => (
              <li key={`${f.template.id}-${f.sailor?.id ?? 'fam'}`}>
                <Link to='/family/forms' className='flex items-center gap-3 rounded-xl border bg-card p-4'>
                  <ClipboardList className='size-5 shrink-0 text-muted-foreground' />
                  <span className='min-w-0 flex-1'>
                    <span className='block font-medium'>Sign the {f.template.name.toLowerCase().replace(/^the /, '')}</span>
                    <span className='block text-sm text-muted-foreground'>
                      {f.sailor ? `For ${f.sailor.firstName}` : 'For the family'}
                      {f.dueDate && <span className='text-signal'>, due {format(new Date(`${f.dueDate}T12:00:00`), 'MMM d')}</span>}
                    </span>
                  </span>
                  <ChevronRight className='size-4 text-muted-foreground' />
                </Link>
              </li>
            ))}
            {askRegattas.map((r) => (
              <li key={r.event.id} className='rounded-xl border bg-card p-4'>
                <RegattaAsk regatta={r} sailor={kid} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className='mt-6' aria-labelledby='latest'>
        <div className='mb-1 flex items-baseline justify-between'>
          <h2 id='latest' className='text-lg font-semibold'>
            News from the club
          </h2>
          <Link to='/family/messages' className='text-sm font-medium text-heading'>
            All messages
          </Link>
        </div>
        <div className='-mx-4'>
          <MessageList items={familyMessages.slice(0, 2)} empty='No news yet' />
        </div>
      </section>

      <section className='mt-6' aria-labelledby='progress'>
        <h2 id='progress' className='mb-2 text-lg font-semibold'>
          How {kid.firstName} is doing
        </h2>
        <button onClick={() => setProgressFor(kid)} className='block w-full rounded-xl border bg-card p-4 text-start'>
          <span className='flex items-baseline justify-between gap-2'>
            <span className='font-medium'>{progress.trackInfo.name}</span>
            <span className='text-sm text-muted-foreground'>
              {progress.got} of {progress.total} skills
            </span>
          </span>
          <SkillBar got={progress.got} working={progress.working.length} total={progress.total} className='mt-2' />
          {progress.working.length > 0 && <span className='mt-2 block text-sm text-muted-foreground'>Working on: {progress.working.map((w) => w.name.toLowerCase()).join(', ')}</span>}
          {evaluation && (
            <span className='mt-3 block border-t pt-3'>
              <span className='block text-xs text-muted-foreground'>
                From {look.coach.get(evaluation.coachId)?.name.split(' ')[0]}, {format(new Date(`${evaluation.date}T12:00:00`), 'MMM d')}
              </span>
              <span className='mt-0.5 line-clamp-3 block text-sm'>“{evaluation.strengths}”</span>
              <span className='mt-1 block text-sm font-medium text-heading'>Read the full evaluation</span>
            </span>
          )}
        </button>
      </section>

      {kidGroups.map((g) => {
        const se = look.session.get(g.sessionId)!
        const p = programById.get(se.programId)!
        return (
          <section key={g.id} className='mt-6' aria-labelledby={`grp-${g.id}`}>
            <div className='mb-2 flex items-baseline justify-between'>
              <h2 id={`grp-${g.id}`} className='text-lg font-semibold'>
                {kid.firstName}’s group this week
              </h2>
              {g.coachIds[0] && (
                <button className='text-sm font-medium text-heading' onClick={() => setWriteTo({ key: `${g.coachIds[0]}-${kid.id}` })}>
                  Message coach
                </button>
              )}
            </div>
            <div className='rounded-xl border bg-card p-4 text-sm'>
              <p className='font-medium'>
                {g.name} · {p.name}
              </p>
              <p className='text-xs text-muted-foreground'>
                {p.slot === 'PM' ? 'Afternoons' : 'Mornings'}, {se.time}. Coach{g.coachIds.length > 1 ? 'es' : ''}: {g.coachIds.map((c) => look.coach.get(c)?.name).join(' and ') || 'to be set'}
              </p>
              <ul className='mt-3 flex flex-wrap gap-1.5'>
                {g.sailorIds.map((sid) => {
                  const k = look.sailor.get(sid)
                  if (!k) return null
                  return (
                    <li key={sid} className={cn('rounded-full px-2.5 py-1 text-xs', sid === kid.id ? 'bg-heading text-white' : 'bg-muted')}>
                      {k.firstName} {k.lastName[0]}.
                    </li>
                  )
                })}
              </ul>
            </div>
          </section>
        )
      })}

      {kidRegattas.some((r) => r.responses.get(kid.id)) && (
        <section className='mt-6' aria-labelledby='regattas'>
          <h2 id='regattas' className='mb-2 text-lg font-semibold'>
            Regattas
          </h2>
          <ul className='divide-y rounded-xl border bg-card'>
            {kidRegattas
              .filter((r) => r.responses.get(kid.id))
              .map((r) => (
                <li key={r.event.id} className='p-4'>
                  <RegattaAsk regatta={r} sailor={kid} compact />
                </li>
              ))}
          </ul>
        </section>
      )}

      <section className='mt-6' aria-labelledby='coaches'>
        <div className='mb-2 flex items-baseline justify-between'>
          <h2 id='coaches' className='text-lg font-semibold'>
            For {kid.firstName}’s coaches
          </h2>
          <button className='text-sm font-medium text-heading' onClick={() => setNotesFor(kid)}>
            {kid.parentNote ? 'Edit' : 'Add a note'}
          </button>
        </div>
        <div className='space-y-1.5 rounded-xl border bg-card p-4 text-sm'>
          {kid.parentNote ? <p>{kid.parentNote.text}</p> : <p className='text-muted-foreground'>Anything coaches should know: nerves, glasses, what helps.</p>}
          <p className='text-xs text-muted-foreground'>
            Pickup: guardians{kid.authorizedPickups?.length ? `, ${kid.authorizedPickups.join(', ')}` : ' only'}.{' '}
            {(() => {
              const sc = latestSwimCheck(swimChecks, kid.id)
              return sc?.result === 'passed' ? `Swim check passed ${format(new Date(`${sc.date}T12:00:00`), 'MMM d')}.` : 'Swim check on the first day.'
            })()}
          </p>
          {kid.medicalAlerts.length > 0 && (
            <p className='flex items-center gap-1.5 text-xs text-muted-foreground'>
              <HeartPulse className='size-3.5 text-destructive' /> {kid.medicalAlerts.join(', ')}
            </p>
          )}
        </div>
      </section>

      <section className='mt-6' aria-labelledby='weeks'>
        <div className='mb-2 flex items-baseline justify-between'>
          <h2 id='weeks' className='text-lg font-semibold'>
            {kid.firstName}’s weeks
          </h2>
          <button className='text-sm font-medium text-heading' onClick={() => setWriteTo({ key: 'director', subject: `Another week for ${kid.firstName}?` })}>
            Ask about a week
          </button>
        </div>
        <ul className='divide-y rounded-xl border bg-card'>
          {weeks.map((r) => {
            const se = look.session.get(r.sessionId)!
            const p = programById.get(se.programId)!
            const isNow = todayIso >= se.startDate && todayIso <= se.endDate
            return (
              <li key={r.id} className='flex items-center gap-3 px-4 py-2.5'>
                <span className='h-7 w-1 rounded-full' style={{ background: p.color }} aria-hidden='true' />
                <span className='min-w-0 flex-1'>
                  <span className='block text-sm font-medium'>
                    {p.name}, {se.name}
                  </span>
                  <span className='block text-xs text-muted-foreground'>
                    {format(new Date(`${se.startDate}T12:00:00`), 'MMM d')}–{format(new Date(`${se.endDate}T12:00:00`), 'MMM d')}
                    {isNow && ', this week'}
                  </span>
                </span>
                {r.status === 'waitlisted' || r.status === 'offered' ? (
                  <RegStatus status={r.status} position={positions.get(r.id)} />
                ) : (
                  <span className='text-xs text-muted-foreground'>{se.endDate < todayIso ? 'Done' : 'Signed up'}</span>
                )}
              </li>
            )
          })}
          {weeks.length === 0 && <li className='px-4 py-3 text-sm text-muted-foreground'>No weeks yet.</li>}
        </ul>
        <p className='mt-1.5 text-xs text-muted-foreground'>Sign-ups and payments go through the club as usual.</p>
      </section>

      <InstallTip />

      <NotesSheet sailor={notesFor} onClose={() => setNotesFor(null)} />
      <DayNoteSheet open={dayNoteFor} onClose={() => setDayNoteFor(null)} />
      <NewMessage
        open={!!writeTo}
        onClose={() => setWriteTo(null)}
        me={{ id: `family:${family.id}`, name: guardian.name }}
        recipients={recipients}
        initial={{ recipientKey: writeTo?.key, subject: writeTo?.subject }}
        onSent={() => setWriteTo(null)}
      />

      <Sheet open={!!progressFor} onOpenChange={(o) => !o && setProgressFor(null)}>
        <SheetContent side='bottom' className='max-h-[90svh] overflow-y-auto rounded-t-2xl'>
          {progressFor && (
            <>
              <SheetHeader>
                <SheetTitle>How {progressFor.firstName} is doing</SheetTitle>
                <SheetDescription>Coaches update this from the water.</SheetDescription>
              </SheetHeader>
              <div className='space-y-5 px-4 pb-6'>
                {evaluation && progressFor.id === kid.id && (
                  <section className='rounded-lg border p-3 text-sm'>
                    <p className='text-xs text-muted-foreground'>
                      Evaluation from {look.coach.get(evaluation.coachId)?.name}, {format(new Date(`${evaluation.date}T12:00:00`), 'MMMM d')}
                    </p>
                    <p className='mt-2 font-medium'>Going well</p>
                    <p>{evaluation.strengths}</p>
                    <p className='mt-2 font-medium'>Working on</p>
                    <p>{evaluation.workOn}</p>
                    {evaluation.nextStep && (
                      <>
                        <p className='mt-2 font-medium'>Next step</p>
                        <p>{evaluation.nextStep}</p>
                      </>
                    )}
                  </section>
                )}
                <SkillChecklist sailor={progressFor} />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

export const DAY_NOTE_KINDS: { kind: DayNote['kind']; short: string; title: string; icon: React.ElementType }[] = [
  { kind: 'absent', short: 'Out', title: 'Out for the day', icon: CalendarX },
  { kind: 'late', short: 'Late', title: 'Running late', icon: Clock },
  { kind: 'early', short: 'Leaving early', title: 'Leaving early', icon: LogOut },
  { kind: 'pickup', short: 'Pickup', title: 'Someone else is picking up', icon: Car },
]

export function dayNoteText(d: DayNote, kid: Sailor) {
  switch (d.kind) {
    case 'absent':
      return `${kid.firstName} is out${d.note ? ` (${d.note})` : ''}`
    case 'late':
      return `${kid.firstName} will be late${d.detail ? `, about ${d.detail}` : ''}${d.note ? ` (${d.note})` : ''}`
    case 'early':
      return `${kid.firstName} leaves at ${d.detail}${d.note ? ` (${d.note})` : ''}`
    case 'pickup':
      return `${d.detail} is picking ${kid.firstName} up${d.note ? ` (${d.note})` : ''}`
  }
}

/** A parent tells the coaches about one day: out, late, leaving early, or a different pickup. */
function DayNoteSheet({ open, onClose }: { open: { sailor: Sailor; kind: DayNote['kind'] } | null; onClose: () => void }) {
  const add = useStore((s) => s.addDayNote)
  const update = useStore((s) => s.updateSailor)
  const regs = useStore((s) => s.registrations)
  const { family } = useFamily()
  const look = useLookups()
  const now = useNow(60_000)
  const [kind, setKind] = useState<DayNote['kind']>('absent')
  const [day, setDay] = useState('')
  const [who, setWho] = useState('')
  const [loaded, setLoaded] = useState<string | null>(null)
  const kid = open?.sailor
  const todayIso = format(now, 'yyyy-MM-dd')
  // The next few days this sailor is signed up to sail.
  const days = useMemo(() => {
    if (!kid) return []
    const out: string[] = []
    const sessions = regs.filter((r) => r.sailorId === kid.id && r.status === 'confirmed').map((r) => look.session.get(r.sessionId)!)
    for (let i = 0; i < 21 && out.length < 6; i++) {
      const d = new Date(now.getTime() + i * 86400000)
      if (sessions.some((se) => se && meetsOn(se, d))) out.push(format(d, 'yyyy-MM-dd'))
    }
    return out
  }, [kid, regs, look, now])
  const key = open ? `${open.sailor.id}-${open.kind}` : null
  if (open && loaded !== key) {
    setLoaded(key)
    setKind(open.kind)
    setDay(days[0] ?? todayIso)
    setWho('')
  }
  if (!open && loaded) setLoaded(null)
  const pickupPeople = kid ? [...family.guardians.map((g) => g.name), ...(kid.authorizedPickups ?? [])] : []

  return (
    <Sheet open={!!open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side='bottom' className='max-h-[92svh] overflow-y-auto rounded-t-2xl'>
        {kid && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              const note = String(fd.get('note') ?? '').trim() || undefined
              let detail: string | undefined = String(fd.get('detail') ?? '').trim() || undefined
              if (kind === 'pickup') {
                detail = who === 'other' ? String(fd.get('other') ?? '').trim() : who
                if (!detail) return toast.error('Who is picking up?')
                // Someone new gets added to the approved list for next time too.
                if (who === 'other' && !(kid.authorizedPickups ?? []).includes(detail)) update(kid.id, { authorizedPickups: [...(kid.authorizedPickups ?? []), detail] })
              }
              if (kind === 'early' && !detail) return toast.error('What time are you picking up?')
              add({ sailorId: kid.id, date: day, kind, detail, note, by: family.guardians[0].name })
              toast.success(`Told ${kid.firstName}’s coaches`)
              onClose()
            }}
          >
            <SheetHeader>
              <SheetTitle>Tell {kid.firstName}’s coaches</SheetTitle>
              <SheetDescription>It shows on their roster right away.</SheetDescription>
            </SheetHeader>
            <div className='grid gap-4 px-4 pb-6'>
              <div className='grid grid-cols-2 gap-2' role='radiogroup' aria-label='What’s happening'>
                {DAY_NOTE_KINDS.map((k) => (
                  <button
                    key={k.kind}
                    type='button'
                    role='radio'
                    aria-checked={kind === k.kind}
                    onClick={() => setKind(k.kind)}
                    className={cn('flex items-center gap-2 rounded-lg border px-3 py-2.5 text-start text-sm', kind === k.kind && 'border-heading bg-heading/5 font-medium ring-1 ring-heading')}
                  >
                    <k.icon className='size-4 shrink-0' /> {k.title}
                  </button>
                ))}
              </div>
              <div className='grid gap-1.5'>
                <Label>Which day</Label>
                <div className='flex flex-wrap gap-1.5'>
                  {(days.length ? days : [todayIso]).map((d) => (
                    <button
                      key={d}
                      type='button'
                      onClick={() => setDay(d)}
                      aria-pressed={day === d}
                      className={cn('rounded-full border px-3 py-1 text-sm', day === d && 'border-heading bg-heading text-white')}
                    >
                      {d === todayIso ? 'Today' : format(new Date(`${d}T12:00:00`), 'EEE d')}
                    </button>
                  ))}
                </div>
              </div>
              {kind === 'pickup' && (
                <div className='grid gap-1.5'>
                  <Label>Who’s picking up</Label>
                  <div className='flex flex-wrap gap-1.5'>
                    {[...pickupPeople, 'other'].map((p) => (
                      <button
                        key={p}
                        type='button'
                        onClick={() => setWho(p)}
                        aria-pressed={who === p}
                        className={cn('rounded-full border px-3 py-1 text-sm', who === p && 'border-heading bg-heading text-white')}
                      >
                        {p === 'other' ? 'Someone else' : p}
                      </button>
                    ))}
                  </div>
                  {who === 'other' && <Input name='other' placeholder='Name and relationship, e.g. Jen Park (neighbor)' aria-label='Who is picking up' />}
                </div>
              )}
              {(kind === 'early' || kind === 'late') && (
                <div className='grid gap-1.5'>
                  <Label htmlFor='dn-detail'>{kind === 'early' ? 'Pickup time' : 'Arriving around'}</Label>
                  <Input id='dn-detail' name='detail' placeholder={kind === 'early' ? '11:00 AM' : '9:45 AM'} />
                </div>
              )}
              <div className='grid gap-1.5'>
                <Label htmlFor='dn-note'>Anything else (optional)</Label>
                <Textarea id='dn-note' name='note' rows={2} placeholder={kind === 'absent' ? 'Dentist appointment' : ''} />
              </div>
              <Button type='submit'>Send to the coaches</Button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  )
}

/** Regattas the family's sailors can go to, with their answers. */
export function useKidRegattas() {
  const { kids } = useFamily()
  const calendar = useStore((s) => s.calendar)
  const regattas = useStore((s) => s.regattas)
  const responses = useStore((s) => s.regattaResponses)
  const regs = useStore((s) => s.registrations)
  const sessions = useStore((s) => s.sessions)
  const now = useNow(60_000)
  const today = format(now, 'yyyy-MM-dd')
  return useMemo(
    () =>
      regattas
        .map((d) => ({ d, event: calendar.find((e) => e.id === d.eventId)! }))
        .filter((x) => x.event && (x.event.endDate ?? x.event.date) >= today)
        .sort((a, b) => a.event.date.localeCompare(b.event.date))
        .map(({ d, event }) => {
          const term = termForDate(TERMS, event.date)
          const eligible = new Set(eligibleSailors(d, kids, regs, sessions, term.id).map((k) => k.id))
          const mine = new Map(responses.filter((r) => r.eventId === event.id && eligible.has(r.sailorId)).map((r) => [r.sailorId, r]))
          return { details: d, event, eligible, responses: mine }
        })
        .filter((x) => x.eligible.size > 0),
    [regattas, calendar, responses, kids, regs, sessions, today]
  )
}

function RegattaAsk({ regatta, sailor, compact }: { regatta: ReturnType<typeof useKidRegattas>[number]; sailor: Sailor; compact?: boolean }) {
  const respond = useStore((s) => s.respondToRegatta)
  const { family } = useFamily()
  const current = regatta.responses.get(sailor.id)
  const [editing, setEditing] = useState(!compact)
  const e = regatta.event
  const set = (status: RegattaResponse['status'], chaperone = current?.chaperone) => {
    respond({ eventId: e.id, sailorId: sailor.id, status, chaperone: status === 'going' ? chaperone : false, by: family.guardians[0].name })
    if (!current || current.status !== status)
      toast.success(status === 'going' ? `${sailor.firstName} is going. Coaches will be in touch with details.` : status === 'interested' ? 'Marked interested' : 'Got it, not this time')
    setEditing(false)
  }
  const label = { going: 'Going', interested: 'Interested', 'not-going': 'Not this time' }
  return (
    <div>
      <div className='flex items-start gap-3'>
        <Trophy className='mt-0.5 size-5 shrink-0 text-brass' />
        <div className='min-w-0 flex-1'>
          <p className='font-medium'>{e.title}</p>
          <p className='text-sm text-muted-foreground'>
            {format(new Date(`${e.date}T12:00:00`), 'EEE, MMM d')}
            {e.location ? `, ${e.location}` : ''}
          </p>
          {!editing && current && (
            <p className={cn('mt-1 text-sm font-medium', current.status === 'going' ? 'text-ok' : current.status === 'interested' ? 'text-heading' : 'text-muted-foreground')}>
              {label[current.status]}
              {current.chaperone && ', and you’re chaperoning'}
            </p>
          )}
        </div>
        {!editing && (
          <button className='text-sm font-medium text-heading' onClick={() => setEditing(true)}>
            Change
          </button>
        )}
      </div>
      {editing && (
        <>
          {!current && <p className='mt-2 text-sm'>Is {sailor.firstName} in? {regatta.details.entryDeadline && `Coaches need to know by ${format(new Date(`${regatta.details.entryDeadline}T12:00:00`), 'MMM d')}.`}</p>}
          <div className='mt-3 grid grid-cols-3 gap-2'>
            {(['going', 'interested', 'not-going'] as const).map((st) => (
              <Button key={st} size='sm' variant={current?.status === st ? 'default' : 'outline'} onClick={() => set(st)}>
                {label[st]}
              </Button>
            ))}
          </div>
          {(current?.status === 'going' || !current) && regatta.details.chaperonesNeeded > 0 && (
            <label className='mt-3 flex items-center gap-2 text-sm'>
              <Checkbox checked={!!current?.chaperone} disabled={current?.status !== 'going'} onCheckedChange={(v) => current && set('going', !!v)} />
              I can chaperone{current?.status !== 'going' && <span className='text-muted-foreground'> (pick Going first)</span>}
            </label>
          )}
          {regatta.details.entryFee && <p className='mt-2 text-xs text-muted-foreground'>Entry fee ${regatta.details.entryFee}, billed by the regatta.</p>}
        </>
      )}
    </div>
  )
}

/** Burgee runs in the browser; parents can pin it to their home screen like an app. */
function InstallTip() {
  const [hidden, setHidden] = useState(() => {
    try {
      return window.localStorage.getItem('burgee-install-tip') === 'hidden'
    } catch {
      return false
    }
  })
  if (hidden) return null
  return (
    <aside className='mt-8 flex items-start gap-3 rounded-xl bg-heading p-4 text-white'>
      <Smartphone className='mt-0.5 size-5 shrink-0' />
      <div className='min-w-0 flex-1 text-sm'>
        <p className='font-semibold'>Put Burgee on your home screen</p>
        <p className='mt-0.5 text-white/80'>On iPhone, tap Share, then Add to Home Screen. On Android, tap the menu, then Install app. You’ll still get texts and emails.</p>
      </div>
      <button
        aria-label='Dismiss'
        onClick={() => {
          setHidden(true)
          try {
            window.localStorage.setItem('burgee-install-tip', 'hidden')
          } catch {
            /* private browsing: it just comes back next visit */
          }
        }}
      >
        <X className='size-4 text-white/70' />
      </button>
    </aside>
  )
}

/** Announcements that would have reached the persona family. */
export function useFamilyMessages(announcements: Announcement[], familyId: string = PERSONAS.familyId) {
  const regs = useStore((s) => s.registrations)
  const sailors = useStore((s) => s.sailors)
  const groups = useStore((s) => s.groups)
  const look = useLookups()
  return useMemo(() => {
    const mine = familyRegs(regs, sailors, familyId).filter((r) => r.status !== 'cancelled')
    const sessionIds = new Set(mine.map((r) => r.sessionId))
    const programIds = new Set([...sessionIds].map((id) => look.session.get(id)?.programId))
    const kidIds = new Set(mine.map((r) => r.sailorId))
    return announcements.filter((a) => {
      switch (a.audience.kind) {
        case 'everyone':
        case 'outstanding-forms':
          return true
        case 'waitlisted':
          return mine.some((r) => r.status === 'waitlisted')
        case 'families':
          return a.audience.familyIds.includes(familyId)
        case 'program':
          return programIds.has(a.audience.programId)
        case 'session':
          return sessionIds.has(a.audience.sessionId)
        case 'group': {
          const g = groups.find((x) => x.id === (a.audience as { groupId: string }).groupId)
          return !!g?.sailorIds.some((id) => kidIds.has(id))
        }
        default:
          return false
      }
    })
  }, [announcements, regs, sailors, groups, look, familyId])
}

export function FamilyMessages() {
  const announcements = useStore((s) => s.announcements)
  const { family } = useFamily()
  const items = useFamilyMessages(announcements)
  const recipients = useFamilyRecipients(PERSONAS.familyId)
  return (
    <PhoneMessages
      me={{ id: `family:${PERSONAS.familyId}`, name: family.guardians[0].name }}
      recipients={recipients}
      updates={items}
      intro='Ask the coaches or the director anything. Club updates live here too.'
    />
  )
}

function NotesSheet({ sailor, onClose }: { sailor: Sailor | null; onClose: () => void }) {
  const { family } = useFamily()
  const update = useStore((s) => s.updateSailor)
  const [text, setText] = useState('')
  const [pickups, setPickups] = useState<string[]>([])
  const [newPickup, setNewPickup] = useState('')
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  if (sailor && loadedFor !== sailor.id) {
    setLoadedFor(sailor.id)
    setText(sailor.parentNote?.text ?? '')
    setPickups(sailor.authorizedPickups ?? [])
    setNewPickup('')
  }
  return (
    <Sheet open={!!sailor} onOpenChange={(o) => { if (!o) { onClose(); setLoadedFor(null) } }}>
      <SheetContent side='bottom' className='max-h-[90svh] overflow-y-auto rounded-t-2xl'>
        {sailor && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const extra = newPickup.trim() ? [...pickups, newPickup.trim()] : pickups
              update(sailor.id, {
                parentNote: text.trim() ? { text: text.trim(), updatedAt: clockNow().toISOString(), by: family.guardians[0].name } : undefined,
                authorizedPickups: extra,
              })
              toast.success(`${sailor.firstName}’s coaches will see this`)
              onClose()
              setLoadedFor(null)
            }}
          >
            <SheetHeader>
              <SheetTitle>For {sailor.firstName}’s coaches</SheetTitle>
              <SheetDescription>Coaches see this on their roster. Medical details belong on the medical form.</SheetDescription>
            </SheetHeader>
            <div className='grid gap-4 px-4 pb-6'>
              <div className='grid gap-1.5'>
                <Label htmlFor='note'>Note</Label>
                <Textarea id='note' rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder='e.g. Gets nervous in big breeze. A quick check-in before launching helps.' />
              </div>
              <div className='grid gap-1.5'>
                <Label htmlFor='pickup'>Who else can pick {sailor.firstName} up?</Label>
                <ul className='grid gap-1.5'>
                  {pickups.map((p) => (
                    <li key={p} className='flex items-center justify-between rounded-md border px-3 py-2 text-sm'>
                      {p}
                      <button type='button' onClick={() => setPickups(pickups.filter((x) => x !== p))} aria-label={`Remove ${p}`}>
                        <X className='size-4 text-muted-foreground' />
                      </button>
                    </li>
                  ))}
                </ul>
                <div className='flex gap-2'>
                  <Input id='pickup' value={newPickup} onChange={(e) => setNewPickup(e.target.value)} placeholder='Name (relationship)' />
                  <Button
                    type='button'
                    variant='outline'
                    size='icon'
                    disabled={!newPickup.trim()}
                    onClick={() => {
                      setPickups([...pickups, newPickup.trim()])
                      setNewPickup('')
                    }}
                    aria-label='Add pickup'
                  >
                    <Plus className='size-4' />
                  </Button>
                </div>
                <p className='text-xs text-muted-foreground'>Guardians on the account can always pick up.</p>
              </div>
              <Button type='submit' size='lg'>
                Save for coaches
              </Button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  )
}
