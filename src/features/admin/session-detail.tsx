import { useMemo, useState } from 'react'
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { Link } from '@tanstack/react-router'
import { format } from 'date-fns'
import {
  AlertTriangle,
  ArrowLeft,
  ClipboardX,
  GripVertical,
  HeartPulse,
  Megaphone,
  Plus,
  Sparkles,
  UserPlus,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { CERT_TYPES, FORM_TEMPLATES } from '@/data/catalog'
import { programById, termById, useLookups, useNow, useSessionStats, useWaitlistPosition } from '@/data/hooks'
import { useStore } from '@/data/store'
import {
  ageOn,
  coachCertRows,
  coachCertSummary,
  groupLoad,
  outstandingForms,
} from '@/domain/rules'
import type { Group, Sailor } from '@/domain/types'
import { attendanceRecord, dayCounts, latestSwimCheck, practiceDates, STATUS_LABEL } from '@/domain/attendance'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Main } from '@/components/layout/main'
import {
  CertStatusLabel,
  EmptyState,
  FleetChip,
  Initials,
  RegStatus,
} from '@/components/burgee/marks'

const UNASSIGNED = '__unassigned'

export function SessionDetail({ sessionId }: { sessionId: string }) {
  const look = useLookups()
  const session = look.session.get(sessionId)
  const stats = useSessionStats()
  if (!session)
    return (
      <Main>
        <EmptyState title='That session no longer exists'>
          <Link to='/admin/programs' className='underline'>
            Back to programs
          </Link>
        </EmptyState>
      </Main>
    )
  const program = programById.get(session.programId)!
  const term = termById.get(session.termId)!
  const st = stats.get(session.id)!

  return (
    <Main>
      <Link to='/admin/programs' className='mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground'>
        <ArrowLeft className='size-4' /> Programs
      </Link>
      <div className='mb-6 flex flex-wrap items-end justify-between gap-4'>
        <div className='flex gap-3'>
          <span className='mt-1 w-1.5 shrink-0 rounded-full' style={{ background: program.color }} aria-hidden='true' />
          <div>
            <p className='text-sm text-muted-foreground'>{term.name}</p>
            <h1 className='text-2xl font-semibold'>
              {program.name}, {session.name}
            </h1>
            <p className='mt-1 text-sm text-muted-foreground'>
              {format(new Date(`${session.startDate}T12:00:00`), 'EEE MMM d')} –{' '}
              {format(new Date(`${session.endDate}T12:00:00`), 'EEE MMM d')}. {session.days}, {session.time}. Coach ratio 1:{program.ratio}.
            </p>
          </div>
        </div>
        <div className='flex items-center gap-4'>
          <span className='text-sm text-muted-foreground'>
            <span className='font-semibold text-foreground'>{st.taken}</span> sailors{st.waitlist ? `, ${st.waitlist} on the waitlist` : ''}
          </span>
          <Button asChild variant='outline'>
            <Link to='/admin/messages' search={{ session: session.id }}>
              <Megaphone className='size-4' /> Message families
            </Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue='roster'>
        <TabsList>
          <TabsTrigger value='roster'>Groups & coaches</TabsTrigger>
          <TabsTrigger value='attendance'>Attendance</TabsTrigger>
          <TabsTrigger value='registrations'>Sailors</TabsTrigger>
        </TabsList>
        <TabsContent value='roster' className='mt-6'>
          <RosterBoard sessionId={session.id} />
        </TabsContent>
        <TabsContent value='attendance' className='mt-6'>
          <AttendancePanel sessionId={session.id} />
        </TabsContent>
        <TabsContent value='registrations' className='mt-6'>
          <SessionRegistrations sessionId={session.id} />
        </TabsContent>
      </Tabs>
    </Main>
  )
}

/* ───────────────────────── Roster board ───────────────────────── */

function RosterBoard({ sessionId }: { sessionId: string }) {
  const look = useLookups()
  const session = look.session.get(sessionId)!
  const program = programById.get(session.programId)!
  const allGroups = useStore((s) => s.groups)
  const regs = useStore((s) => s.registrations)
  const submissions = useStore((s) => s.submissions)
  const season = useStore((s) => s.settings.season)
  const moveSailor = useStore((s) => s.moveSailor)
  const autoGroup = useStore((s) => s.autoGroupSession)
  const addGroup = useStore((s) => s.addGroup)
  const groups = useMemo(() => allGroups.filter((g) => g.sessionId === sessionId), [allGroups, sessionId])

  const confirmed = regs
    .filter((r) => r.sessionId === sessionId && r.status === 'confirmed')
    .map((r) => look.sailor.get(r.sailorId)!)
  const grouped = new Set(groups.flatMap((g) => g.sailorIds))
  const unassigned = confirmed.filter((s) => !grouped.has(s.id))

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor))
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.over.id === UNASSIGNED) return
    moveSailor(String(e.active.id), String(e.over.id))
  }

  const missingForms = (s: Sailor) => outstandingForms(s, FORM_TEMPLATES, submissions, season).length

  if (!confirmed.length)
    return <EmptyState title='No confirmed sailors yet'>Groups can be built once families register.</EmptyState>

  return (
    <div>
      <div className='mb-4 flex flex-wrap items-center gap-2'>
        <p className='me-auto text-sm text-muted-foreground'>
          {confirmed.length} confirmed sailors in {groups.length || 'no'} group{groups.length === 1 ? '' : 's'}.
          Drag sailors between groups, or use the menu on each card.
        </p>
        <Button
          variant={groups.length ? 'outline' : 'default'}
          onClick={() => {
            autoGroup(sessionId)
            toast.success(`Built ${Math.max(1, Math.ceil(confirmed.length / program.ratio))} age-banded groups at 1:${program.ratio}`)
          }}
        >
          <Sparkles className='size-4' /> {groups.length ? 'Rebuild groups' : 'Build groups'}
        </Button>
        {groups.length > 0 && (
          <Button variant='outline' onClick={() => addGroup(sessionId)}>
            <Plus className='size-4' /> Add group
          </Button>
        )}
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
          {unassigned.length > 0 && (
            <GroupColumn id={UNASSIGNED} title='Not in a group' subtitle={`${unassigned.length} sailors`} tone='muted'>
              {unassigned.map((s) => (
                <SailorCard key={s.id} sailor={s} sessionStart={session.startDate} groups={groups} missingForms={missingForms(s)} onMove={(g) => moveSailor(s.id, g)} />
              ))}
            </GroupColumn>
          )}
          {groups.map((g) => (
            <GroupColumnWithCoaches key={g.id} group={g} ratio={program.ratio} activity={program.activity}>
              {g.sailorIds.map((sid) => {
                const s = look.sailor.get(sid)
                if (!s) return null
                return (
                  <SailorCard key={s.id} sailor={s} sessionStart={session.startDate} groups={groups} currentGroup={g.id} missingForms={missingForms(s)} onMove={(to) => moveSailor(s.id, to)} />
                )
              })}
              {g.sailorIds.length === 0 && <p className='px-1 py-4 text-center text-xs text-muted-foreground'>Drop sailors here</p>}
            </GroupColumnWithCoaches>
          ))}
        </div>
      </DndContext>
    </div>
  )
}

function GroupColumn({
  id,
  title,
  subtitle,
  tone,
  header,
  children,
}: {
  id: string
  title: string
  subtitle?: React.ReactNode
  tone?: 'muted' | 'danger'
  header?: React.ReactNode
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <section
      ref={setNodeRef}
      aria-label={title}
      className={cn(
        'rounded-lg border bg-card transition-colors',
        tone === 'muted' && 'border-dashed bg-muted/40',
        tone === 'danger' && 'border-destructive/60',
        isOver && 'border-primary ring-2 ring-primary/20'
      )}
    >
      <header className='border-b px-3 py-2.5'>
        <div className='flex items-baseline justify-between gap-2'>
          <h3 className='font-semibold'>{title}</h3>
          {subtitle && <span className='text-xs text-muted-foreground'>{subtitle}</span>}
        </div>
        {header}
      </header>
      <div className='space-y-1.5 p-2'>{children}</div>
    </section>
  )
}

function GroupColumnWithCoaches({
  group,
  ratio,
  activity,
  children,
}: {
  group: Group
  ratio: number
  activity: string
  children: React.ReactNode
}) {
  const coaches = useStore((s) => s.coaches)
  const setCoaches = useStore((s) => s.setGroupCoaches)
  const warn = useStore((s) => s.settings.certWarningDays)
  const now = useNow(60_000)
  const load = groupLoad(group, ratio)
  const eligible = coaches.filter((c) => c.activities.includes(activity as never) && c.role !== 'program-director')
  const assigned = group.coachIds.map((id) => coaches.find((c) => c.id === id)!).filter(Boolean)
  const problem = load.noCoach || load.overRatio

  return (
    <GroupColumn
      id={group.id}
      title={group.name}
      tone={problem ? 'danger' : undefined}
      subtitle={
        <span className={cn(problem && 'font-medium text-destructive')}>
          {load.sailors}/{load.capacity || 0} at 1:{ratio}
        </span>
      }
      header={
        <div className='mt-2 space-y-1.5'>
          {problem && (
            <p className='flex items-center gap-1 text-xs font-medium text-destructive'>
              <AlertTriangle className='size-3.5' />
              {load.noCoach ? 'Needs a coach before it can go on the water' : `Over ratio. Add a coach or move ${load.sailors - load.capacity} sailors.`}
            </p>
          )}
          <div className='flex flex-wrap items-center gap-1.5'>
            {assigned.map((c) => {
              const status = coachCertSummary(coachCertRows(c, CERT_TYPES, now, warn))
              return (
                <span key={c.id} className='inline-flex items-center gap-1.5 rounded-full border py-0.5 ps-0.5 pe-2 text-xs'>
                  <Initials name={c.name} hue={c.avatarHue} className='size-5 text-[10px]' />
                  {c.name}
                  {status !== 'valid' && <CertStatusLabel status={status} detail='' />}
                </span>
              )
            })}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant='ghost' size='sm' className='h-6 px-2 text-xs'>
                  <UserPlus className='size-3.5' /> Coaches
                </Button>
              </PopoverTrigger>
              <PopoverContent align='start' className='w-72 p-2'>
                <p className='px-2 pb-2 text-xs text-muted-foreground'>Assign coaches to {group.name}</p>
                <ul className='max-h-72 overflow-y-auto'>
                  {eligible.map((c) => {
                    const status = coachCertSummary(coachCertRows(c, CERT_TYPES, now, warn))
                    const checked = group.coachIds.includes(c.id)
                    return (
                      <li key={c.id}>
                        <label className='flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted'>
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) =>
                              setCoaches(group.id, v ? [...group.coachIds, c.id] : group.coachIds.filter((x) => x !== c.id))
                            }
                          />
                          <span className='flex-1 text-sm'>{c.name}</span>
                          <CertStatusLabel status={status} />
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </PopoverContent>
            </Popover>
          </div>
          {group.resource && <p className='text-xs text-muted-foreground'>{group.resource}</p>}
        </div>
      }
    >
      {children}
    </GroupColumn>
  )
}

function SailorCard({
  sailor,
  sessionStart,
  groups,
  currentGroup,
  missingForms,
  onMove,
}: {
  sailor: Sailor
  sessionStart: string
  groups: Group[]
  currentGroup?: string
  missingForms: number
  onMove: (groupId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: sailor.id })
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-sm',
        isDragging && 'z-10 shadow-lg ring-2 ring-primary/30'
      )}
    >
      <button
        className='cursor-grab touch-none text-muted-foreground active:cursor-grabbing'
        aria-label={`Drag ${sailor.firstName} ${sailor.lastName}`}
        {...listeners}
        {...attributes}
      >
        <GripVertical className='size-4' />
      </button>
      <span className='min-w-0 flex-1'>
        <span className='block truncate font-medium'>
          {sailor.firstName} {sailor.lastName}
        </span>
        <span className='flex items-center gap-2 text-xs text-muted-foreground'>
          Age {ageOn(sailor.dob, sessionStart)}
          <FleetChip level={sailor.level} />
        </span>
      </span>
      {sailor.medicalAlerts.length > 0 && (
        <HeartPulse className='size-4 shrink-0 text-destructive' aria-label={`Medical: ${sailor.medicalAlerts.join(', ')}`}>
          <title>{sailor.medicalAlerts.join(', ')}</title>
        </HeartPulse>
      )}
      {missingForms > 0 && (
        <ClipboardX className='size-4 shrink-0 text-signal' aria-label={`${missingForms} forms missing`}>
          <title>{missingForms} forms missing</title>
        </ClipboardX>
      )}
      {groups.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='ghost' size='sm' className='h-6 px-1.5 text-xs'>
              Move
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuLabel className='text-xs font-normal text-muted-foreground'>Move to</DropdownMenuLabel>
            {groups
              .filter((g) => g.id !== currentGroup)
              .map((g) => (
                <DropdownMenuItem key={g.id} onClick={() => onMove(g.id)}>
                  {g.name}
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

function SessionRegistrations({ sessionId }: { sessionId: string }) {
  const look = useLookups()
  const regs = useStore((s) => s.registrations)
  const positions = useWaitlistPosition()
  const cancel = useStore((s) => s.cancelRegistration)
  const [showCancelled, setShowCancelled] = useState(false)
  const list = regs
    .filter((r) => r.sessionId === sessionId && (showCancelled || r.status !== 'cancelled'))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return (
    <div>
      <label className='mb-3 flex items-center gap-2 text-sm'>
        <Checkbox checked={showCancelled} onCheckedChange={(v) => setShowCancelled(!!v)} /> Show cancelled
      </label>
      <div className='overflow-x-auto rounded-lg border bg-card'>
        <table className='w-full min-w-[680px] text-sm'>
          <thead className='border-b text-xs text-muted-foreground'>
            <tr>
              <th className='px-4 py-2 text-start font-medium'>Sailor</th>
              <th className='px-4 py-2 text-start font-medium'>Family</th>
              <th className='px-4 py-2 text-start font-medium'>Registered</th>
              <th className='px-4 py-2 text-start font-medium'>Status</th>
              <th className='px-4 py-2'>
                <span className='sr-only'>Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className='divide-y'>
            {list.map((r) => {
              const s = look.sailor.get(r.sailorId)!
              const f = look.family.get(s.familyId)!
              return (
                <tr key={r.id}>
                  <td className='px-4 py-2'>
                    <span className='font-medium'>
                      {s.firstName} {s.lastName}
                    </span>
                    <FleetChip level={s.level} className='ms-2' />
                  </td>
                  <td className='px-4 py-2'>
                    <Link to='/admin/families' search={{ family: f.id }} className='hover:underline'>
                      {f.name}
                    </Link>
                  </td>
                  <td className='px-4 py-2 text-muted-foreground'>{format(new Date(r.createdAt), 'MMM d')}</td>
                  <td className='px-4 py-2'>
                    <RegStatus status={r.status} position={positions.get(r.id)} />
                  </td>
                  <td className='px-4 py-2 text-end'>
                    {r.status !== 'cancelled' && (
                      <Button
                        size='sm'
                        variant='ghost'
                        className='text-destructive hover:text-destructive'
                        onClick={() => {
                          cancel(r.id)
                          toast(`${s.firstName} removed. The waitlist has been re-run.`)
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ───────────────────────── Attendance ───────────────────────── */

function AttendancePanel({ sessionId }: { sessionId: string }) {
  const look = useLookups()
  const session = look.session.get(sessionId)!
  const regs = useStore((s) => s.registrations)
  const attendance = useStore((s) => s.attendance)
  const swimChecks = useStore((s) => s.swimChecks)
  const now = useNow()
  const today = format(now, 'yyyy-MM-dd')
  const dates = practiceDates(session, now)
  const shown = dates.slice(-10)
  const all = Object.values(attendance).filter((e) => e.sessionId === sessionId)
  const kids = regs
    .filter((r) => r.sessionId === sessionId && r.status === 'confirmed')
    .map((r) => look.sailor.get(r.sailorId)!)
    .sort((a, b) => a.lastName.localeCompare(b.lastName))
  const todays = all.filter((e) => e.date === today)
  const counts = dayCounts(todays, kids.map((k) => k.id))

  if (!dates.length)
    return (
      <EmptyState title='No sessions have run yet'>
        Coaches take attendance from their phones starting {format(new Date(`${session.startDate}T12:00:00`), 'MMMM d')}. It shows up here live.
      </EmptyState>
    )

  return (
    <div className='space-y-4'>
      {dates.includes(today) && (
        <p className='flex flex-wrap gap-x-6 gap-y-1 rounded-lg border bg-card px-4 py-3 text-sm'>
          <span className='font-medium'>Today</span>
          <span>{counts.present + counts.ashore} here</span>
          <span className={counts.onWater ? 'font-semibold text-signal' : ''}>{counts.onWater} on the water</span>
          <span>{counts.pickedUp} gone home</span>
          <span>{counts.absent} absent</span>
          <span className='text-muted-foreground'>{counts.notIn} not checked in</span>
        </p>
      )}
      <div className='overflow-x-auto rounded-lg border bg-card'>
        <table className='w-full min-w-[720px] text-sm'>
          <thead className='border-b text-xs text-muted-foreground'>
            <tr>
              <th className='px-4 py-2 text-start font-medium'>Sailor</th>
              {shown.map((d) => (
                <th key={d} className='px-1 py-2 text-center font-medium'>
                  {format(new Date(`${d}T12:00:00`), 'M/d')}
                </th>
              ))}
              <th className='px-4 py-2 text-end font-medium'>Season</th>
              <th className='px-4 py-2 text-start font-medium'>Swim check</th>
            </tr>
          </thead>
          <tbody className='divide-y'>
            {kids.map((k) => {
              const rec = attendanceRecord(all, k.id, sessionId, dates.filter((d) => d < today))
              const sc = latestSwimCheck(swimChecks, k.id)
              return (
                <tr key={k.id}>
                  <td className='px-4 py-2'>
                    <span className='font-medium'>
                      {k.firstName} {k.lastName}
                    </span>
                    {rec.missedLast3 && <span className='ms-2 text-xs font-medium text-destructive'>missed last 3</span>}
                  </td>
                  {shown.map((d) => {
                    const e = all.find((x) => x.date === d && x.sailorId === k.id)
                    const label = e ? STATUS_LABEL[e.status] : 'Not marked'
                    return (
                      <td key={d} className='px-1 py-2 text-center'>
                        <span
                          title={`${d}: ${label}${e?.pickedUpBy ? `, with ${e.pickedUpBy}` : ''}`}
                          className={cn(
                            'inline-block size-3 rounded-full',
                            !e ? 'bg-border' : e.status === 'absent' ? 'bg-destructive/70' : e.status === 'on-water' ? 'bg-signal' : 'bg-ok'
                          )}
                        >
                          <span className='sr-only'>{label}</span>
                        </span>
                      </td>
                    )
                  })}
                  <td className='px-4 py-2 text-end'>
                    {rec.rate === undefined ? '—' : `${Math.round(rec.rate * 100)}%`}
                    <span className='block text-xs text-muted-foreground'>
                      {rec.attended}/{rec.attended + rec.missed}
                    </span>
                  </td>
                  <td className='px-4 py-2 text-xs'>
                    {sc?.result === 'passed' ? (
                      <span className='text-ok'>Passed {format(new Date(`${sc.date}T12:00:00`), 'MMM d')}</span>
                    ) : (
                      <span className='font-medium text-signal'>{sc ? 'Retest needed' : 'Not done'}</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className='text-xs text-muted-foreground'>Green: attended. Red: absent. Amber: on the water right now. Grey: not marked.</p>
    </div>
  )
}
