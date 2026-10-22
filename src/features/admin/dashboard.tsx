import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { addDays, differenceInCalendarDays, format } from 'date-fns'
import {
  type AlertTriangle,
  Anchor,
  ClipboardCheck,
  GraduationCap,
  MessageCircle,
  MessagesSquare,
  ShieldAlert,
  TriangleAlert,
  Trophy,
  UserRoundX,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { CERT_TYPES, FORM_TEMPLATES, PERSONAS, TERMS } from '@/data/catalog'
import { programById, useLookups, useNow } from '@/data/hooks'
import { useStore } from '@/data/store'
import { ACTIVE_STATUSES } from '@/domain/pricing'
import { coachCertRows, groupLoad, outstandingForms } from '@/domain/rules'
import { Button } from '@/components/ui/button'
import { Main } from '@/components/layout/main'
import { AskBar } from '@/assistant/ask-panel'
import { dayCounts } from '@/domain/attendance'
import type { Session } from '@/domain/types'
import { CALL, type CallStatus, Pennant, PracticeCallDialog, sessionsOn } from '@/components/burgee/practice'
import { KIND } from './calendar'
import { isUnread } from '@/features/inbox/inbox'
import { dayNoteText } from '@/features/family/home'

type When = 'today' | 'week' | 'later'
type Attention = {
  id: string
  when: When
  tone: 'danger' | 'signal' | 'neutral'
  icon: typeof AlertTriangle
  title: string
  detail: string
  action?: React.ReactNode
}

export function AdminDashboard() {
  const now = useNow()
  const regs = useStore((s) => s.registrations)
  const sessions = useStore((s) => s.sessions)
  const coaches = useStore((s) => s.coaches)
  const groups = useStore((s) => s.groups)
  const sailors = useStore((s) => s.sailors)
  const submissions = useStore((s) => s.submissions)
  const settings = useStore((s) => s.settings)
  const sendFormReminders = useStore((s) => s.sendFormReminders)
  const boats = useStore((s) => s.boats)
  const incidents = useStore((s) => s.incidents)
  const calendar = useStore((s) => s.calendar)
  const regattas = useStore((s) => s.regattas)
  const regattaResponses = useStore((s) => s.regattaResponses)
  const threads = useStore((s) => s.threads)
  const dayNotes = useStore((s) => s.dayNotes)
  const evaluations = useStore((s) => s.evaluations)
  const attendance = useStore((s) => s.attendance)
  const [showLater, setShowLater] = useState(false)
  const look = useLookups()

  const today = format(now, 'yyyy-MM-dd')
  const term = TERMS.find((t) => t.startDate <= today && t.endDate >= today)
  const weekNo = term ? Math.floor(differenceInCalendarDays(now, new Date(`${term.startDate}T12:00:00`)) / 7) + 1 : 0
  const weeksIn = term ? Math.ceil((differenceInCalendarDays(new Date(`${term.endDate}T12:00:00`), new Date(`${term.startDate}T12:00:00`)) + 1) / 7) : 0
  const todays = sessionsOn(sessions, now)
  const thisWeek = sessions.filter((s) => s.startDate <= today && s.endDate >= today)

  const attention = useMemo<Attention[]>(() => {
    const items: Attention[] = []
    const todayIds = new Set(sessionsOn(sessions, now).map((s) => s.id))
    const nextWeekStart = format(addDays(now, 7 - ((now.getDay() + 6) % 7)), 'yyyy-MM-dd')
    const nextWeekEnd = format(addDays(new Date(`${nextWeekStart}T12:00:00`), 6), 'yyyy-MM-dd')
    const coachesToday = new Set(groups.filter((g) => todayIds.has(g.sessionId)).flatMap((g) => g.coachIds))

    // Messages waiting on the director
    const unread = threads.filter((t) => t.participants.includes('director') && isUnread(t, 'director'))
    if (unread.length)
      items.push({
        id: 'inbox',
        when: 'today',
        tone: 'signal',
        icon: MessagesSquare,
        title: `${unread.length} message${unread.length === 1 ? '' : 's'} waiting for you`,
        detail: unread
          .slice(0, 2)
          .map((t) => `${t.messages[t.messages.length - 1].name.split(' ')[0]}: ${t.subject}`)
          .join(' · '),
        action: (
          <Button asChild size='sm' variant='outline'>
            <Link to='/admin/inbox'>Open inbox</Link>
          </Button>
        ),
      })

    // Parent notes for today (the coaches already see them on their rosters)
    const notes = dayNotes.filter((d) => d.date === today)
    if (notes.length)
      items.push({
        id: 'notes',
        when: 'today',
        tone: 'neutral',
        icon: MessageCircle,
        title: `${notes.length} parent note${notes.length === 1 ? '' : 's'} for today`,
        detail: notes
          .map((d) => {
            const k = look.sailor.get(d.sailorId)
            return k ? dayNoteText(d, k) : ''
          })
          .join('. '),
        action: (
          <Button asChild size='sm' variant='outline'>
            <Link to='/admin/attendance'>Attendance</Link>
          </Button>
        ),
      })

    // Coach coverage: today and next week
    for (const g of groups) {
      const session = look.session.get(g.sessionId)
      if (!session) continue
      const isToday = todayIds.has(session.id)
      const isNextWeek = session.startDate >= nextWeekStart && session.startDate <= nextWeekEnd
      if (!isToday && !isNextWeek) continue
      const program = programById.get(session.programId)!
      const load = groupLoad(g, program.ratio)
      if (load.noCoach || load.overRatio) {
        items.push({
          id: `g-${g.id}`,
          when: isToday ? 'today' : 'week',
          tone: isToday ? 'danger' : 'signal',
          icon: UserRoundX,
          title: `${g.name}${isToday ? '' : ' next week'} has ${load.noCoach ? 'no coach' : `${load.sailors} sailors for ${g.coachIds.length} coach`}`,
          detail: `${program.name}, ${session.name}. Ratio is 1:${program.ratio}.`,
          action: (
            <Button asChild size='sm' variant='outline'>
              <Link to='/admin/sessions/$sessionId' params={{ sessionId: session.id }}>
                Fix roster
              </Link>
            </Button>
          ),
        })
      }
    }

    // Certifications: urgent for anyone coaching today, later for everyone else
    for (const c of coaches) {
      const rows = coachCertRows(c, CERT_TYPES, now, settings.certWarningDays).filter((r) => r.status !== 'valid')
      if (!rows.length) continue
      const blocking = rows.filter((r) => r.status !== 'expiring')
      const onWater = coachesToday.has(c.id)
      const when: When = blocking.length ? (onWater ? 'today' : 'week') : 'later'
      const names = (st: string) => rows.filter((r) => r.status === st).map((r) => r.certType.name)
      items.push({
        id: `c-${c.id}`,
        when,
        tone: blocking.length ? 'danger' : 'signal',
        icon: ShieldAlert,
        title:
          rows.length === 1
            ? rows[0].status === 'expiring'
              ? `${c.name}'s ${rows[0].certType.name} expires in ${rows[0].daysLeft} days`
              : rows[0].status === 'expired'
                ? `${c.name}'s ${rows[0].certType.name} expired`
                : `${c.name} has no ${rows[0].certType.name} on file`
            : `${c.name} needs ${rows.length} certifications`,
        detail:
          rows.length === 1 && rows[0].status === 'expiring'
            ? `Expires ${format(new Date(`${rows[0].expires}T12:00:00`), 'MMM d')}.`
            : [
                names('missing').length && `Missing: ${names('missing').join(', ')}.`,
                names('expired').length && `Expired: ${names('expired').join(', ')}.`,
                names('expiring').length && `Expiring soon: ${names('expiring').join(', ')}.`,
                onWater && blocking.length ? `${c.name.split(' ')[0]} is coaching today.` : '',
              ]
                .filter(Boolean)
                .join(' '),
        action: (
          <Button asChild size='sm' variant='outline'>
            <Link to='/admin/documents' search={{ person: c.id }}>
              View files
            </Link>
          </Button>
        ),
      })
    }

    // Open incident reports
    const openInc = incidents.filter((i) => i.status === 'open')
    if (openInc.length)
      items.push({
        id: 'incidents',
        when: 'today',
        tone: openInc.some((i) => i.severity === 'serious') ? 'danger' : 'neutral',
        icon: TriangleAlert,
        title: `${openInc.length} incident report${openInc.length > 1 ? 's' : ''} to review`,
        detail: openInc
          .map((i) => `${i.reportedBy.split(' ')[0]}: ${i.description}`)
          .slice(0, 2)
          .join(' '),
        action: (
          <Button asChild size='sm' variant='outline'>
            <Link to='/admin/incidents'>Review</Link>
          </Button>
        ),
      })

    // Evaluations the coaches sent for approval
    const pendingEvals = evaluations.filter((e) => e.status === 'pending')
    if (pendingEvals.length)
      items.push({
        id: 'evals',
        when: 'week',
        tone: 'signal',
        icon: GraduationCap,
        title: `${pendingEvals.length} evaluation${pendingEvals.length === 1 ? '' : 's'} waiting for your approval`,
        detail: `From ${[...new Set(pendingEvals.map((e) => look.coach.get(e.coachId)?.name.split(' ')[0]))].join(', ')}. Families see them once you approve.`,
        action: (
          <Button asChild size='sm' variant='outline'>
            <Link to='/admin/progress'>Review</Link>
          </Button>
        ),
      })

    // Forms for sailors here this week
    const weekIds = new Set(sessions.filter((s) => s.startDate <= today && s.endDate >= today).map((s) => s.id))
    const here = new Set(regs.filter((r) => weekIds.has(r.sessionId) && ACTIVE_STATUSES.has(r.status)).map((r) => r.sailorId))
    const missing = sailors.filter((s) => here.has(s.id) && outstandingForms(s, FORM_TEMPLATES, submissions, settings.season).length)
    if (missing.length) {
      const fams = [...new Set(missing.map((s) => s.familyId))]
      items.push({
        id: 'forms',
        when: 'week',
        tone: 'neutral',
        icon: ClipboardCheck,
        title: `${missing.length} sailor${missing.length === 1 ? '' : 's'} here this week ${missing.length === 1 ? 'is' : 'are'} missing forms`,
        detail: `${missing
          .slice(0, 4)
          .map((k) => k.firstName)
          .join(', ')}${missing.length > 4 ? ` and ${missing.length - 4} more` : ''}. Coaches see a flag on the roster.`,
        action: (
          <Button
            size='sm'
            variant='outline'
            onClick={() => {
              sendFormReminders(fams)
              toast.success(`Reminders sent to ${fams.length} families`)
            }}
          >
            Send reminders
          </Button>
        ),
      })
    }

    // Regatta entries closing within a week
    for (const r of regattas) {
      const ev = calendar.find((e) => e.id === r.eventId)
      if (!ev || !r.entryDeadline) continue
      const days = differenceInCalendarDays(new Date(`${r.entryDeadline}T12:00:00`), now)
      if (days < 0 || days > 7) continue
      const going = regattaResponses.filter((x) => x.eventId === r.eventId && x.status === 'going').length
      const chaps = regattaResponses.filter((x) => x.eventId === r.eventId && x.chaperone).length
      items.push({
        id: `reg-${r.eventId}`,
        when: 'week',
        tone: 'signal',
        icon: Trophy,
        title: `${ev.title}: enter ${going} sailor${going === 1 ? '' : 's'} by ${format(new Date(`${r.entryDeadline}T12:00:00`), 'EEE, MMM d')}`,
        detail: chaps < r.chaperonesNeeded ? `${chaps} of ${r.chaperonesNeeded} chaperones so far.` : 'Chaperones are covered.',
        action: (
          <Button asChild size='sm' variant='outline'>
            <Link to='/admin/regattas' search={{ regatta: r.eventId }}>
              Open
            </Link>
          </Button>
        ),
      })
    }

    // Boats: a coach boat out of service matters today; the rest can wait
    const down = boats.filter((b) => b.status !== 'ready')
    if (down.length) {
      const coachBoatOut = down.some((b) => (b.kind === 'RIB' || b.kind === 'Whaler') && b.status === 'out-of-service')
      items.push({
        id: 'boats',
        when: coachBoatOut ? 'today' : 'later',
        tone: coachBoatOut ? 'danger' : 'neutral',
        icon: Anchor,
        title: `${down.length} boats need work`,
        detail: down
          .slice(0, 3)
          .map((b) => `${b.name}: ${b.issue ?? 'needs attention'}`)
          .join('. '),
        action: (
          <Button asChild size='sm' variant='outline'>
            <Link to='/admin/equipment'>Open fleet</Link>
          </Button>
        ),
      })
    }

    const order = { danger: 0, signal: 1, neutral: 2 }
    return items.sort((a, b) => order[a.tone] - order[b.tone])
  }, [groups, look, coaches, now, today, settings, regs, sailors, sessions, submissions, sendFormReminders, boats, incidents, regattas, calendar, regattaResponses, threads, dayNotes, evaluations])

  const week = useMemo(() => {
    const ids = new Set(thisWeek.map((s) => s.id))
    const kids = new Set(regs.filter((r) => ids.has(r.sessionId) && r.status === 'confirmed').map((r) => r.sailorId))
    const todayIds = new Set(todays.map((s) => s.id))
    const expected = regs.filter((r) => todayIds.has(r.sessionId) && r.status === 'confirmed').length
    const entries = Object.values(attendance).filter((e) => e.date === today && todayIds.has(e.sessionId))
    const here = entries.filter((e) => e.status !== 'absent').length
    const out = entries.filter((e) => e.status === 'absent').length
    const shared = evaluations.filter((e) => e.status === 'shared').length
    return { kids: kids.size, expected, here, out, shared }
  }, [thisWeek, todays, regs, attendance, today, evaluations])

  const upcoming = calendar
    .filter((e) => (e.endDate ?? e.date) >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5)
  const hour = now.getHours()
  const buckets: { id: When; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'This week' },
    { id: 'later', label: 'Later' },
  ]

  return (
    <Main>
      <div className='mb-8'>
        <p className='text-sm text-muted-foreground'>
          {format(now, 'EEEE, MMMM d')}
          {term && ` · ${term.season === 'summer' ? 'Camp' : term.name} week ${weekNo} of ${weeksIn}`}
        </p>
        <h1 className='mt-1 text-3xl font-semibold'>
          Good {hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'}, {PERSONAS.director.name.split(' ')[0]}
        </h1>
        <div className='mt-5 max-w-2xl'>
          <AskBar />
        </div>
      </div>

      <div className='grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]'>
        <div className='space-y-8'>
          <TodayOnTheWater sessions={todays} now={now} />

          <section aria-labelledby='attention'>
            <h2 id='attention' className='mb-3 text-lg font-semibold'>
              Needs you
            </h2>
            <div className='space-y-4'>
              {buckets.map((b) => {
                const list = attention.filter((a) => a.when === b.id)
                if (b.id === 'later' && list.length === 0) return null
                const collapsed = b.id === 'later' && !showLater
                return (
                  <div key={b.id}>
                    <div className='mb-1.5 flex items-baseline gap-2'>
                      <h3 className='text-sm font-semibold text-muted-foreground'>{b.label}</h3>
                      <span className='text-xs text-muted-foreground'>{list.length || ''}</span>
                      {b.id === 'later' && (
                        <button className='ms-auto text-xs font-medium text-heading hover:underline' onClick={() => setShowLater(!showLater)}>
                          {showLater ? 'Hide' : 'Show'}
                        </button>
                      )}
                    </div>
                    {!collapsed && (
                      <ul className='divide-y rounded-xl border bg-card'>
                        {list.map((a) => (
                          <li key={a.id} className='flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3'>
                            <a.icon
                              className={cn(
                                'size-5 shrink-0',
                                a.tone === 'danger' && 'text-destructive',
                                a.tone === 'signal' && 'text-signal',
                                a.tone === 'neutral' && 'text-muted-foreground'
                              )}
                              aria-hidden='true'
                            />
                            <div className='min-w-0 flex-1 basis-56'>
                              <p className='text-sm font-medium'>{a.title}</p>
                              <p className='line-clamp-2 text-xs text-muted-foreground'>{a.detail}</p>
                            </div>
                            {a.action}
                          </li>
                        ))}
                        {list.length === 0 && <li className='px-4 py-4 text-sm text-muted-foreground'>All clear.</li>}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        </div>

        <aside className='space-y-8'>
          <section aria-labelledby='at-a-glance'>
            <h2 id='at-a-glance' className='mb-3 text-lg font-semibold'>
              At a glance
            </h2>
            <dl className='grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border'>
              {[
                ['Sailors this week', week.kids, `${thisWeek.length} sessions`],
                ['Here today', week.expected ? `${week.here}/${week.expected}` : '—', week.out ? `${week.out} out` : 'Nobody out'],
                ['Parent notes today', dayNotes.filter((d) => d.date === today).length, 'Shown to coaches'],
                ['Evaluations shared', week.shared, 'This summer'],
              ].map(([label, value, sub]) => (
                <div key={label as string} className='bg-card p-3.5'>
                  <dt className='text-xs text-muted-foreground'>{label}</dt>
                  <dd className='font-display text-2xl font-semibold text-heading'>{value}</dd>
                  <dd className='text-xs text-muted-foreground'>{sub}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby='coming-up'>
            <div className='mb-3 flex items-baseline justify-between'>
              <h2 id='coming-up' className='text-lg font-semibold'>
                Coming up
              </h2>
              <Link to='/admin/calendar' className='text-sm font-medium text-heading hover:underline'>
                Calendar
              </Link>
            </div>
            <ul className='divide-y rounded-xl border bg-card'>
              {upcoming.map((e) => {
                const going = regattaResponses.filter((r) => r.eventId === e.id && r.status === 'going').length
                const maybe = regattaResponses.filter((r) => r.eventId === e.id && r.status === 'interested').length
                const d = new Date(`${e.date}T12:00:00`)
                return (
                  <li key={e.id}>
                    <Link
                      to={e.kind === 'regatta' ? '/admin/regattas' : '/admin/calendar'}
                      search={e.kind === 'regatta' ? { regatta: e.id } : undefined}
                      className='flex gap-3 px-4 py-3 hover:bg-muted/40'
                    >
                      <span className='w-10 shrink-0 text-center leading-tight'>
                        <span className='block text-[11px] text-muted-foreground'>{format(d, 'MMM')}</span>
                        <span className='block font-display text-lg font-semibold text-heading'>{format(d, 'd')}</span>
                      </span>
                      <span className='min-w-0'>
                        <span className='block text-sm font-medium'>{e.title}</span>
                        <span className='block text-xs text-muted-foreground'>
                          {e.kind === 'regatta' ? `${going} going, ${maybe} interested` : (e.location ?? KIND[e.kind].label)}
                        </span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        </aside>
      </div>
    </Main>
  )
}

/** Each team practicing today, its call, live counts, and one tap to change the call. */
function TodayOnTheWater({ sessions, now }: { sessions: Session[]; now: Date }) {
  const calls = useStore((s) => s.practiceCalls)
  const attendance = useStore((s) => s.attendance)
  const regs = useStore((s) => s.registrations)
  const [dialog, setDialog] = useState<{ status: CallStatus; sessionIds: string[] } | null>(null)
  const today = format(now, 'yyyy-MM-dd')
  return (
    <section aria-labelledby='today-water'>
      <div className='mb-3 flex flex-wrap items-baseline justify-between gap-2'>
        <h2 id='today-water' className='text-lg font-semibold'>
          Today on the water
        </h2>
        {sessions.length > 1 && (
          <Button size='sm' variant='outline' onClick={() => setDialog({ status: 'cancelled', sessionIds: sessions.map((s) => s.id) })}>
            Call all teams
          </Button>
        )}
      </div>
      {sessions.length === 0 ? (
        <p className='rounded-xl border bg-card px-4 py-6 text-sm text-muted-foreground'>No practices today.</p>
      ) : (
        <ul className='divide-y rounded-xl border bg-card'>
          {sessions.map((s) => {
            const program = programById.get(s.programId)!
            const call = calls.find((c) => c.sessionId === s.id && c.date === today)
            const ids = regs.filter((r) => r.sessionId === s.id && r.status === 'confirmed').map((r) => r.sailorId)
            const c = dayCounts(Object.values(attendance).filter((e) => e.sessionId === s.id && e.date === today), ids)
            const started = c.notIn < ids.length
            return (
              <li key={s.id} className='flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5'>
                <Pennant status={call?.status ?? 'none'} className='h-6 w-9' />
                <Link to='/admin/sessions/$sessionId' params={{ sessionId: s.id }} className='min-w-0 flex-1 basis-48 hover:underline'>
                  <span className='block font-medium'>{program.name}</span>
                  <span className='block text-xs text-muted-foreground'>
                    {s.time.split('·')[0].replace('Weekdays ', '')} ·{' '}
                    {started ? `${c.present + c.ashore + c.onWater} here, ${c.onWater} on the water` : `${ids.length} sailors`}
                  </span>
                </Link>
                <div className='ms-auto flex rounded-lg border p-0.5' role='group' aria-label={`Call for ${program.name}`}>
                  {(Object.keys(CALL) as CallStatus[]).map((st) => (
                    <button
                      key={st}
                      onClick={() => setDialog({ status: st, sessionIds: [s.id] })}
                      aria-pressed={call?.status === st}
                      className={cn(
                        'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                        call?.status === st ? cn(CALL[st].soft, CALL[st].text) : 'text-muted-foreground hover:bg-muted'
                      )}
                    >
                      {CALL[st].label}
                    </button>
                  ))}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <PracticeCallDialog
        open={!!dialog}
        onClose={() => setDialog(null)}
        sessions={sessions}
        initial={dialog ?? { status: 'on', sessionIds: [] }}
        by={PERSONAS.director.name}
      />
    </section>
  )
}
