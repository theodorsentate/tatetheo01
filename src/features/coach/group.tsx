import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { format } from 'date-fns'
import {
  Anchor,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ClipboardX,
  CloudLightning,
  HeartPulse,
  LifeBuoy,
  Megaphone,
  Phone,
  Sailboat,
  StickyNote,
  TriangleAlert,
  Undo2,
  Waves,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { FORM_TEMPLATES, PERSONAS } from '@/data/catalog'
import { programById, useLookups, useNow } from '@/data/hooks'
import { useStore } from '@/data/store'
import {
  attendanceKey,
  attendanceRecord,
  dayCounts,
  latestSwimCheck,
  meetsOn,
  nextPractice,
  practiceDates,
  STATUS_LABEL,
} from '@/domain/attendance'
import { ageOn, outstandingForms } from '@/domain/rules'
import type { AttendanceEntry, AttendanceStatus, Sailor } from '@/domain/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState, FleetChip } from '@/components/burgee/marks'
import { CALL, Pennant, PracticeCallDialog } from '@/components/burgee/practice'
import { IncidentDialog } from '@/features/admin/incidents'
import { BoatsTab, PlanTab, SkillsTab } from './practice-tabs'

const PILL: Record<AttendanceStatus, string> = {
  present: 'bg-secondary text-foreground',
  absent: 'bg-muted text-muted-foreground',
  'on-water': 'bg-signal-soft text-signal',
  ashore: 'bg-accent text-primary',
  'picked-up': 'bg-ok-soft text-ok',
}

function useCoachName() {
  return useStore((s) => s.coaches.find((c) => c.id === PERSONAS.coachId)!.name)
}

export function CoachGroup({ groupId }: { groupId: string }) {
  const groups = useStore((s) => s.groups)
  const attendance = useStore((s) => s.attendance)
  const swimChecks = useStore((s) => s.swimChecks)
  const submissions = useStore((s) => s.submissions)
  const season = useStore((s) => s.settings.season)
  const mark = useStore((s) => s.markAttendance)
  const coachName = useCoachName()
  const look = useLookups()
  const now = useNow()
  const [open, setOpen] = useState<string | null>(null)
  const [compose, setCompose] = useState<null | 'message' | 'weather'>(null)
  const [signingOut, setSigningOut] = useState<Sailor | null>(null)
  const [swimFor, setSwimFor] = useState<{ sailor: Sailor; thenLaunch: boolean } | null>(null)
  const [reporting, setReporting] = useState(false)
  const [tab, setTab] = useState<'roster' | 'plan' | 'boats' | 'skills'>('roster')
  const [calling, setCalling] = useState(false)
  const role = useStore((s) => s.coaches.find((c) => c.id === PERSONAS.coachId)?.role)
  const calls = useStore((s) => s.practiceCalls)

  const group = groups.find((g) => g.id === groupId)
  const session = group ? look.session.get(group.sessionId) : undefined
  const today = format(now, 'yyyy-MM-dd')
  const kids = (group?.sailorIds ?? [])
    .map((id) => look.sailor.get(id)!)
    .filter(Boolean)
    .sort((a, b) => a.lastName.localeCompare(b.lastName))
  if (!group || !session)
    return (
      <div className='p-4'>
        <EmptyState title='That group was rebuilt'>
          <Link to='/coach' className='underline'>
            Back to today
          </Link>
        </EmptyState>
      </div>
    )

  const program = programById.get(session.programId)!
  const live = today >= session.startDate && today <= session.endDate
  const entry = (sid: string): AttendanceEntry | undefined => attendance[attendanceKey(today, session.id, sid)]
  const todays = kids.map((k) => entry(k.id)).filter(Boolean) as AttendanceEntry[]
  const counts = dayCounts(todays, kids.map((k) => k.id))
  const dates = practiceDates(session, now)
  const swimOk = (sid: string) => latestSwimCheck(swimChecks, sid)?.result === 'passed'
  const coaches = group.coachIds.map((id) => look.coach.get(id)?.name).filter(Boolean)
  const call = calls.find((c) => c.sessionId === session.id && c.date === today)
  const planDate = nextPractice(session, now) ?? today

  const launch = (ids: string[]) => {
    const ok = ids.filter(swimOk)
    const blocked = ids.filter((id) => !swimOk(id))
    if (ok.length) mark(today, session.id, ok, 'on-water', { by: coachName })
    if (blocked.length === 1 && ids.length === 1) {
      setSwimFor({ sailor: look.sailor.get(blocked[0])!, thenLaunch: true })
      return
    }
    const names = blocked.map((id) => look.sailor.get(id)!.firstName).join(' and ')
    if (blocked.length)
      toast.warning(`${ok.length ? `${ok.length} on the water. ` : ''}${names} need${blocked.length === 1 ? 's' : ''} a swim check before launching.`, { duration: 7000 })
    else if (ok.length) toast.success(`${ok.length} on the water`)
  }

  return (
    <div className='pb-8'>
      <div className='px-4 pt-4'>
        <Link to='/coach' className='mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground'>
          <ArrowLeft className='size-4' /> Today
        </Link>
        <h1 className='text-2xl font-semibold'>{group.name}</h1>
        <p className='text-sm text-muted-foreground'>
          {program.name}. {live ? `${format(now, 'EEE MMM d')}, ${session.time.split('·')[0].trim()}` : `Starts ${format(new Date(`${session.startDate}T12:00:00`), 'MMM d')}`}.
        </p>
        <p className='mt-0.5 text-sm'>
          {kids.length} sailors with {coaches.join(' & ') || 'no coach'}
          {group.resource ? `, ${group.resource}` : ''}
        </p>
        {live && meetsOn(session, now) && (
          <div className={cn('mt-3 flex items-center gap-3 rounded-lg px-3 py-2', call ? CALL[call.status].soft : 'bg-muted')}>
            <Pennant status={call?.status ?? 'none'} className='h-5 w-7' />
            <span className='min-w-0 flex-1 text-sm'>
              <span className={cn('block font-semibold', call && CALL[call.status].text)}>{call ? CALL[call.status].sentence : 'No call yet today'}</span>
              {call?.note && <span className='block truncate text-xs text-muted-foreground'>{call.note}</span>}
            </span>
            {(role === 'head-coach' || role === 'program-director') && (
              <Button size='sm' variant='outline' className='bg-card' onClick={() => setCalling(true)}>
                Change
              </Button>
            )}
          </div>
        )}
      </div>

      <div className='sticky top-0 z-10 mt-4 border-b bg-background/95 px-2 backdrop-blur' role='tablist' aria-label='Group'>
        <div className='flex'>
          {(
            [
              ['roster', 'Roster'],
              ['plan', 'Plan'],
              ['boats', 'Boats'],
              ['skills', 'Skills'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              role='tab'
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn('-mb-px flex-1 border-b-2 py-2.5 text-sm font-medium', tab === id ? 'border-brass text-heading' : 'border-transparent text-muted-foreground')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'plan' && <PlanTab session={session} group={group} date={planDate} coachName={coachName} />}
      {tab === 'boats' && <BoatsTab session={session} group={group} />}
      {tab === 'skills' && <SkillsTab session={session} group={group} coachId={PERSONAS.coachId} coachName={coachName} />}

      {tab === 'roster' && live && (
        <section aria-label='Attendance today' className='mt-4 px-4'>
          <SafetyBanner counts={counts} total={kids.length} />
          <dl className='mt-3 grid grid-cols-4 gap-1 text-center'>
            {[
              ['Not in', counts.notIn],
              ['Here', counts.present + counts.ashore],
              ['On water', counts.onWater],
              ['Gone home', counts.pickedUp],
            ].map(([label, n]) => (
              <div key={label as string} className='rounded-lg bg-card py-2 ring-1 ring-border'>
                <dt className='text-[11px] text-muted-foreground'>{label}</dt>
                <dd className='font-display text-xl font-semibold'>{n}</dd>
              </div>
            ))}
          </dl>
          <div className='mt-3 grid grid-cols-2 gap-2'>
            {counts.onWater > 0 ? (
              <Button
                className='col-span-2'
                onClick={() => {
                  mark(today, session.id, todays.filter((e) => e.status === 'on-water').map((e) => e.sailorId), 'ashore', { by: coachName })
                  toast.success('Everyone is marked ashore')
                }}
              >
                <Anchor className='size-4' /> All {counts.onWater} ashore
              </Button>
            ) : counts.present > 0 ? (
              <Button className='col-span-2' onClick={() => launch(todays.filter((e) => e.status === 'present').map((e) => e.sailorId))}>
                <Sailboat className='size-4' /> Launch {counts.present} checked in
              </Button>
            ) : null}
            <Button variant='outline' onClick={() => setCompose('message')}>
              <Megaphone className='size-4' /> Message parents
            </Button>
            <Button variant='outline' onClick={() => setCalling(true)}>
              <CloudLightning className='size-4' /> Weather call
            </Button>
            <Button variant='ghost' className='col-span-2 text-muted-foreground' onClick={() => setReporting(true)}>
              <TriangleAlert className='size-4' /> Report an incident
            </Button>
          </div>
        </section>
      )}

      {tab === 'roster' && (
      <ul className='mt-4 divide-y border-y bg-card'>
        {kids.map((k) => {
          const e = entry(k.id)
          const expanded = open === k.id
          const due = outstandingForms(k, FORM_TEMPLATES, submissions, season)
          const swim = latestSwimCheck(swimChecks, k.id)
          const rec = attendanceRecord(Object.values(attendance), k.id, session.id, dates.filter((d) => d < today))
          return (
            <li key={k.id}>
              <div className='px-4 py-3'>
                <div className='flex items-start gap-3'>
                  <button className='min-w-0 flex-1 text-start' onClick={() => setOpen(expanded ? null : k.id)} aria-expanded={expanded}>
                    <span className='flex items-center gap-1.5 font-semibold'>
                      {k.firstName} {k.lastName}
                      <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
                    </span>
                    <span className='flex items-center gap-2 text-xs text-muted-foreground'>
                      Age {ageOn(k.dob, today)} <FleetChip level={k.level} />
                    </span>
                  </button>
                  {live && e && (
                    <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-medium', PILL[e.status])}>
                      {e.status === 'picked-up' ? 'Went home' : STATUS_LABEL[e.status]}
                    </span>
                  )}
                </div>
                <div className='mt-1.5 space-y-1 text-sm'>
                  {k.medicalAlerts.length > 0 && (
                    <p className='flex items-center gap-1.5 font-medium text-destructive'>
                      <HeartPulse className='size-4 shrink-0' /> {k.medicalAlerts.join(', ')}
                    </p>
                  )}
                  {swim?.result !== 'passed' && (
                    <p className='flex items-center gap-1.5 text-xs font-medium text-signal'>
                      <LifeBuoy className='size-3.5 shrink-0' /> Swim check needed
                    </p>
                  )}
                  {due.length > 0 && (
                    <p className='flex items-center gap-1.5 text-xs font-medium text-signal'>
                      <ClipboardX className='size-3.5 shrink-0' /> Missing {due.map((d) => d.short.toLowerCase()).join(', ')}
                    </p>
                  )}
                  {k.parentNote && (
                    <p className='flex items-start gap-1.5 text-xs text-muted-foreground'>
                      <StickyNote className='mt-px size-3.5 shrink-0' />
                      <span className={cn('min-w-0', !expanded && 'line-clamp-1')}>{k.parentNote.text}</span>
                    </p>
                  )}
                  {rec.missedLast3 && <p className='text-xs font-medium text-destructive'>Missed the last 3 practices</p>}
                </div>
                {live && (
                  <AttendanceButtons
                    entry={e}
                    onSet={(status) => {
                      if (status === 'on-water') return launch([k.id])
                      if (status === 'picked-up') return setSigningOut(k)
                      mark(today, session.id, [k.id], status, { by: coachName })
                    }}
                    onUndo={() => useStore.getState().clearAttendance(today, session.id, k.id)}
                  />
                )}
              </div>
              {expanded && (
                <SailorDetails
                  sailor={k}
                  sessionStart={session.startDate}
                  swimLabel={
                    swim
                      ? `${swim.result === 'passed' ? 'Passed' : 'Did not pass'} ${format(new Date(`${swim.date}T12:00:00`), 'MMM d, yyyy')}, ${swim.by}`
                      : 'Not done yet'
                  }
                  onSwim={() => setSwimFor({ sailor: k, thenLaunch: false })}
                  record={rec}
                  showSwim
                />
              )}
            </li>
          )
        })}
      </ul>
      )}

      <PracticeCallDialog
        open={calling}
        onClose={() => setCalling(false)}
        sessions={[session]}
        initial={{ status: call?.status === 'cancelled' ? 'on' : 'cancelled', sessionIds: [session.id] }}
        by={coachName}
      />
      <SignOutSheet
        sailor={signingOut}
        onClose={() => setSigningOut(null)}
        onDone={(who, authorized) => {
          mark(today, session.id, [signingOut!.id], 'picked-up', { by: coachName, pickedUpBy: who })
          if (authorized) toast.success(`${signingOut!.firstName} went home with ${who}`)
          else toast.warning(`${who} isn’t on ${signingOut!.firstName}’s pickup list. The family has been notified.`)
          setSigningOut(null)
        }}
      />
      <SwimCheckSheet
        target={swimFor}
        onClose={() => setSwimFor(null)}
        onSave={(result, note) => {
          const s = swimFor!.sailor
          useStore.getState().recordSwimCheck({ sailorId: s.id, result, date: today, by: coachName, note: note || undefined })
          if (result === 'passed' && swimFor!.thenLaunch) {
            mark(today, session.id, [s.id], 'on-water', { by: coachName })
            toast.success(`${s.firstName} passed and is on the water`)
          } else toast.success(result === 'passed' ? `${s.firstName} passed the swim check` : `${s.firstName} stays ashore until a retest`)
          setSwimFor(null)
        }}
      />
      <IncidentDialog
        open={reporting}
        onClose={() => setReporting(false)}
        reporter={coachName}
        sessionId={session.id}
        sailorOptions={kids.map((k) => ({ id: k.id, name: `${k.firstName} ${k.lastName}` }))}
      />
      <GroupMessageSheet mode={compose} groupId={group.id} familyCount={new Set(kids.map((k) => k.familyId)).size} onClose={() => setCompose(null)} />
    </div>
  )
}

function SafetyBanner({ counts, total }: { counts: ReturnType<typeof dayCounts>; total: number }) {
  if (counts.onWater > 0)
    return (
      <p className='flex items-center gap-2 rounded-lg border border-signal/50 bg-signal-soft px-3 py-2.5 text-sm font-semibold text-signal'>
        <Waves className='size-5' /> {counts.onWater} on the water
      </p>
    )
  if (counts.launchedToday)
    return (
      <p className='flex items-center gap-2 rounded-lg border border-ok/40 bg-ok-soft px-3 py-2.5 text-sm font-semibold text-ok'>
        <CheckCircle2 className='size-5' /> All sailors ashore
      </p>
    )
  return (
    <p className='rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground'>
      {counts.notIn === total ? 'Check sailors in as they arrive.' : `${counts.notIn} not checked in yet.`}
    </p>
  )
}

function AttendanceButtons({
  entry,
  onSet,
  onUndo,
}: {
  entry?: AttendanceEntry
  onSet: (s: AttendanceStatus) => void
  onUndo: () => void
}) {
  const btn = 'h-10 flex-1 text-sm'
  const time = (iso?: string) => (iso ? format(new Date(iso), 'h:mm a') : '')
  let body: React.ReactNode
  switch (entry?.status) {
    case undefined:
      body = (
        <>
          <Button className={btn} onClick={() => onSet('present')}>
            Check in
          </Button>
          <Button variant='outline' className={btn} onClick={() => onSet('absent')}>
            Absent
          </Button>
        </>
      )
      break
    case 'present':
      body = (
        <Button className={btn} onClick={() => onSet('on-water')}>
          <Sailboat className='size-4' /> Launch
        </Button>
      )
      break
    case 'on-water':
      body = (
        <Button className={btn} onClick={() => onSet('ashore')}>
          <Anchor className='size-4' /> Ashore
        </Button>
      )
      break
    case 'ashore':
      body = (
        <>
          <Button variant='outline' className={btn} onClick={() => onSet('on-water')}>
            Back out
          </Button>
          <Button className={btn} onClick={() => onSet('picked-up')}>
            Sign out
          </Button>
        </>
      )
      break
    case 'picked-up':
      body = <p className='flex-1 text-xs text-muted-foreground'>With {entry.pickedUpBy} at {time(entry.updatedAt)}</p>
      break
    case 'absent':
      body = <p className='flex-1 text-xs text-muted-foreground'>Marked absent</p>
      break
  }
  return (
    <div className='mt-2.5 flex items-center gap-2'>
      {body}
      {entry && (
        <Button variant='ghost' size='icon' className='size-10 shrink-0 text-muted-foreground' onClick={onUndo} aria-label='Undo'>
          <Undo2 className='size-4' />
        </Button>
      )}
    </div>
  )
}

function SailorDetails({
  sailor: k,
  record,
  swimLabel,
  onSwim,
  showSwim,
}: {
  sailor: Sailor
  sessionStart: string
  record: ReturnType<typeof attendanceRecord>
  swimLabel: string
  onSwim: () => void
  showSwim: boolean
}) {
  const look = useLookups()
  const submissions = useStore((s) => s.submissions)
  const season = useStore((s) => s.settings.season)
  const fam = look.family.get(k.familyId)!
  const medical = submissions.find((s) => s.templateId === 'medical' && s.sailorId === k.id && s.season === season)
  return (
    <div className='space-y-3 bg-muted/50 px-4 py-3 text-sm'>
      {k.parentNote && (
        <div className='rounded-md border bg-card p-3'>
          <p className='text-xs text-muted-foreground'>Note from {k.parentNote.by.split(' ')[0]}</p>
          <p className='mt-0.5'>{k.parentNote.text}</p>
        </div>
      )}
      {fam.guardians.map((g) => (
        <a key={g.phone} href={`tel:${g.phone}`} className='flex items-center justify-between rounded-md border bg-card px-3 py-2'>
          <span>
            <span className='block font-medium'>{g.name}</span>
            <span className='text-xs text-muted-foreground'>{g.relationship}</span>
          </span>
          <span className='inline-flex items-center gap-1.5 font-medium text-primary'>
            <Phone className='size-4' /> {g.phone}
          </span>
        </a>
      ))}
      <dl className='grid gap-2 rounded-md border bg-card p-3'>
        <div>
          <dt className='text-xs text-muted-foreground'>Can also pick up</dt>
          <dd>{k.authorizedPickups?.join(', ') || 'Guardians only'}</dd>
        </div>
        {medical ? (
          <>
            <div>
              <dt className='text-xs text-muted-foreground'>Emergency contact</dt>
              <dd>
                {medical.values.emergencyName} <span className='text-primary'>{medical.values.emergencyPhone}</span>
              </dd>
            </div>
            <div>
              <dt className='text-xs text-muted-foreground'>Allergies / medications</dt>
              <dd>
                {medical.values.allergies || 'None'}. {medical.values.medications || 'No medications'}.
              </dd>
            </div>
          </>
        ) : (
          <p className='text-xs text-signal'>No medical form on file. Call a guardian before this sailor goes out.</p>
        )}
        {showSwim && (
          <div className='flex items-end justify-between gap-2'>
            <div>
              <dt className='text-xs text-muted-foreground'>Swim check</dt>
              <dd>{swimLabel}</dd>
            </div>
            <Button size='sm' variant='outline' onClick={onSwim}>
              Record
            </Button>
          </div>
        )}
        {record.marks.length > 0 && (
          <div>
            <dt className='text-xs text-muted-foreground'>
              This season: {record.attended} of {record.attended + record.missed} practices
            </dt>
            <dd className='mt-1 flex flex-wrap gap-1' aria-hidden='true'>
              {record.marks.slice(-14).map((m) => (
                <span
                  key={m.date}
                  title={`${m.date}: ${m.status ?? 'not marked'}`}
                  className={cn('size-2.5 rounded-full', !m.status ? 'bg-border' : m.status === 'absent' ? 'bg-destructive/70' : 'bg-ok')}
                />
              ))}
            </dd>
          </div>
        )}
      </dl>
    </div>
  )
}

function SignOutSheet({
  sailor,
  onClose,
  onDone,
}: {
  sailor: Sailor | null
  onClose: () => void
  onDone: (who: string, authorized: boolean) => void
}) {
  const look = useLookups()
  const [choice, setChoice] = useState('')
  const [other, setOther] = useState('')
  const fam = sailor ? look.family.get(sailor.familyId) : undefined
  const allowed = sailor && fam ? [...fam.guardians.map((g) => `${g.name} (${g.relationship.toLowerCase()})`), ...(sailor.authorizedPickups ?? [])] : []
  return (
    <Sheet open={!!sailor} onOpenChange={(o) => { if (!o) { onClose(); setChoice(''); setOther('') } }}>
      <SheetContent side='bottom' className='rounded-t-2xl'>
        {sailor && (
          <>
            <SheetHeader>
              <SheetTitle>Who is {sailor.firstName} going home with?</SheetTitle>
              <SheetDescription>Only people on the family’s list can sign a sailor out.</SheetDescription>
            </SheetHeader>
            <div className='grid gap-3 px-4 pb-6'>
              <RadioGroup value={choice} onValueChange={setChoice}>
                {[...allowed, 'Someone else'].map((p) => (
                  <label key={p} className='flex items-center gap-2 rounded-md border p-3 text-sm'>
                    <RadioGroupItem value={p} /> {p}
                  </label>
                ))}
              </RadioGroup>
              {choice === 'Someone else' && (
                <div className='grid gap-1.5'>
                  <Label htmlFor='other-pickup'>Name</Label>
                  <Input id='other-pickup' value={other} onChange={(e) => setOther(e.target.value)} />
                  <p className='text-xs text-signal'>Not on the pickup list. Call a guardian to confirm before releasing.</p>
                </div>
              )}
              <Button
                size='lg'
                disabled={!choice || (choice === 'Someone else' && !other.trim())}
                onClick={() => {
                  const who = choice === 'Someone else' ? other.trim() : choice.replace(/\s*\(.*\)$/, '')
                  onDone(who, choice !== 'Someone else')
                  setChoice('')
                  setOther('')
                }}
              >
                Sign out {sailor.firstName}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function SwimCheckSheet({
  target,
  onClose,
  onSave,
}: {
  target: { sailor: Sailor; thenLaunch: boolean } | null
  onClose: () => void
  onSave: (result: 'passed' | 'not-passed', note: string) => void
}) {
  const [note, setNote] = useState('')
  return (
    <Sheet open={!!target} onOpenChange={(o) => { if (!o) { onClose(); setNote('') } }}>
      <SheetContent side='bottom' className='rounded-t-2xl'>
        {target && (
          <>
            <SheetHeader>
              <SheetTitle>Swim check for {target.sailor.firstName}</SheetTitle>
              <SheetDescription>
                {target.thenLaunch ? `${target.sailor.firstName} needs a passed swim check before launching. ` : ''}
                Swim 25 yards and tread water for 2 minutes in a life jacket.
              </SheetDescription>
            </SheetHeader>
            <div className='grid gap-3 px-4 pb-6'>
              <div className='grid gap-1.5'>
                <Label htmlFor='swim-note'>Note (optional)</Label>
                <Textarea id='swim-note' rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder='e.g. strong swimmer, retest without fins' />
              </div>
              <div className='grid grid-cols-2 gap-2'>
                <Button size='lg' variant='outline' onClick={() => { onSave('not-passed', note); setNote('') }}>
                  Not yet
                </Button>
                <Button size='lg' onClick={() => { onSave('passed', note); setNote('') }}>
                  Passed{target.thenLaunch ? ', launch' : ''}
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function GroupMessageSheet({
  mode,
  groupId,
  familyCount,
  onClose,
}: {
  mode: null | 'message' | 'weather'
  groupId: string
  familyCount: number
  onClose: () => void
}) {
  const send = useStore((s) => s.sendAnnouncement)
  const group = useStore((s) => s.groups.find((g) => g.id === groupId))
  const coachName = useCoachName()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [lastMode, setLastMode] = useState(mode)
  if (mode !== lastMode) {
    setLastMode(mode)
    if (mode === 'weather') {
      setTitle(`${group?.name} practice cancelled — weather`)
      setBody('Conditions are over our limit for juniors today, so we are staying off the water. Sailors at the club will do a chalk talk until pickup.')
    } else if (mode === 'message') {
      setTitle('')
      setBody('')
    }
  }
  return (
    <Sheet open={!!mode} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side='bottom' className='rounded-t-2xl'>
        <SheetHeader>
          <SheetTitle>{mode === 'weather' ? 'Send a weather call' : 'Message parents'}</SheetTitle>
          <SheetDescription>Goes to {familyCount} families in {group?.name} by email and text.</SheetDescription>
        </SheetHeader>
        <div className='grid gap-3 px-4 pb-6'>
          <div className='grid gap-1.5'>
            <Label htmlFor='ct'>Subject</Label>
            <Input id='ct' value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className='grid gap-1.5'>
            <Label htmlFor='cb'>Message</Label>
            <Textarea id='cb' rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <Button
            onClick={() => {
              if (!title.trim() || !body.trim()) return toast.error('Add a subject and a message.')
              const n = send({ title, body, category: mode === 'weather' ? 'weather' : 'general', audience: { kind: 'group', groupId }, channels: ['email', 'sms'], sentBy: coachName })
              toast.success(`Sent to ${n} families`)
              onClose()
            }}
          >
            Send now
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
