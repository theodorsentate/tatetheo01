import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { differenceInCalendarDays, differenceInHours, format } from 'date-fns'
import {
  type AlertTriangle,
  Anchor,
  Banknote,
  ClipboardCheck,
  Clock,
  ShieldAlert,
  TriangleAlert,
  Trophy,
  UserRoundX,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { CERT_TYPES, FORM_TEMPLATES, PERSONAS, TERMS } from '@/data/catalog'
import { programById, useLookups, useNow, useSessionStats } from '@/data/hooks'
import { useStore } from '@/data/store'
import { ACTIVE_STATUSES, money } from '@/domain/pricing'
import { coachCertRows, groupLoad, outstandingForms } from '@/domain/rules'
import { Button } from '@/components/ui/button'
import { Main } from '@/components/layout/main'
import { AskBar } from '@/assistant/ask-panel'
import { dayCounts } from '@/domain/attendance'
import type { Session } from '@/domain/types'
import { CALL, type CallStatus, Pennant, PracticeCallDialog, sessionsOn } from '@/components/burgee/practice'
import { KIND } from './calendar'

type Attention = {
  id: string
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
  const [showAll, setShowAll] = useState(false)
  const stats = useSessionStats()
  const look = useLookups()

  const fall = TERMS[0]
  const fallWeek = Math.min(
    11,
    Math.max(1, Math.ceil((differenceInCalendarDays(now, new Date(`${fall.startDate}T12:00:00`)) + 1) / 7))
  )
  const summer = TERMS[2]

  const attention = useMemo<Attention[]>(() => {
    const items: Attention[] = []

    // Coach coverage on grouped sessions
    for (const g of groups) {
      const session = look.session.get(g.sessionId)
      if (!session) continue
      const program = programById.get(session.programId)!
      const load = groupLoad(g, program.ratio)
      if (load.noCoach || load.overRatio) {
        items.push({
          id: `g-${g.id}`,
          tone: 'danger',
          icon: UserRoundX,
          title: `${g.name} has ${load.noCoach ? 'no coach' : `${load.sailors} sailors for ${g.coachIds.length} coach`}`,
          detail: `${program.name} · ${session.name}. Ratio is 1:${program.ratio}.`,
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

    // Certifications
    for (const c of coaches) {
      const rows = coachCertRows(c, CERT_TYPES, now, settings.certWarningDays).filter((r) => r.status !== 'valid')
      if (rows.length > 2) {
        // A brand-new hire missing everything gets one line, not six.
        const names = (st: string) => rows.filter((r) => r.status === st).map((r) => r.certType.name)
        const parts = [
          names('missing').length && `Missing: ${names('missing').join(', ')}.`,
          names('expired').length && `Expired: ${names('expired').join(', ')}.`,
          names('expiring').length && `Expiring soon: ${names('expiring').join(', ')}.`,
        ].filter(Boolean)
        items.push({
          id: `c-${c.id}`,
          tone: rows.some((r) => r.status !== 'expiring') ? 'danger' : 'signal',
          icon: ShieldAlert,
          title: `${c.name} needs ${rows.length} certifications`,
          detail: parts.join(' '),
          action: (
            <Button asChild size='sm' variant='outline'>
              <Link to='/admin/documents' search={{ person: c.id }}>
                View files
              </Link>
            </Button>
          ),
        })
        continue
      }
      for (const row of rows) {
        items.push({
          id: `c-${c.id}-${row.certType.id}`,
          tone: row.status === 'expiring' ? 'signal' : 'danger',
          icon: ShieldAlert,
          title:
            row.status === 'expiring'
              ? `${c.name}'s ${row.certType.name} expires in ${row.daysLeft} days`
              : row.status === 'expired'
                ? `${c.name}'s ${row.certType.name} expired`
                : `${c.name} has no ${row.certType.name} on file`,
          detail: row.status === 'expiring' ? `Expires ${format(new Date(`${row.expires}T12:00:00`), 'MMM d')}.` : 'Keep them off the water until it is on file.',
          action: (
            <Button asChild size='sm' variant='outline'>
              <Link to='/admin/staff'>View staff</Link>
            </Button>
          ),
        })
      }
    }

    // Offers expiring soon
    const offers = regs.filter((r) => r.status === 'offered' && r.offerExpiresAt)
    if (offers.length) {
      const soonest = offers.sort((a, b) => a.offerExpiresAt!.localeCompare(b.offerExpiresAt!))[0]
      items.push({
        id: 'offers',
        tone: 'signal',
        icon: Clock,
        title: `${offers.length} waitlist offer${offers.length > 1 ? 's' : ''} waiting on families`,
        detail: `Next hold ends in ${Math.max(0, differenceInHours(new Date(soonest.offerExpiresAt!), now))}h. Unclaimed spots roll to the next family automatically.`,
        action: (
          <Button asChild size='sm' variant='outline'>
            <Link to='/admin/registrations' search={{ status: 'offered' }}>
              See offers
            </Link>
          </Button>
        ),
      })
    }

    // Balances
    const due = regs.filter((r) => r.status === 'pending-payment')
    if (due.length) {
      items.push({
        id: 'due',
        tone: 'neutral',
        icon: Banknote,
        title: `${money(due.reduce((s, r) => s + r.price - r.paid, 0))} in unpaid balances`,
        detail: `${due.length} registrations are holding seats without payment.`,
        action: (
          <Button asChild size='sm' variant='outline'>
            <Link to='/admin/registrations' search={{ status: 'pending-payment' }}>
              Review
            </Link>
          </Button>
        ),
      })
    }

    // Forms
    const active = new Set(regs.filter((r) => ACTIVE_STATUSES.has(r.status)).map((r) => r.sailorId))
    const missing = sailors.filter(
      (s) => active.has(s.id) && outstandingForms(s, FORM_TEMPLATES, submissions, settings.season).length
    )
    if (missing.length) {
      const fams = [...new Set(missing.map((s) => s.familyId))]
      items.push({
        id: 'forms',
        tone: 'neutral',
        icon: ClipboardCheck,
        title: `${missing.length} sailors are missing ${settings.season} forms`,
        detail: `Across ${fams.length} families. Coaches see a flag on the roster until forms are in.`,
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

    // Equipment and open incident reports
    const down = boats.filter((b) => b.status !== 'ready')
    if (down.length) {
      const out = down.filter((b) => b.status === 'out-of-service')
      items.push({
        id: 'boats',
        tone: out.some((b) => b.kind === 'RIB' || b.kind === 'Whaler') ? 'danger' : 'signal',
        icon: Anchor,
        title: `${down.length} boats need work${out.length ? `, ${out.length} out of service` : ''}`,
        detail: down.slice(0, 3).map((b) => `${b.name}: ${b.issue ?? 'needs attention'}`).join('. '),
        action: (
          <Button asChild size='sm' variant='outline'>
            <Link to='/admin/equipment'>Open fleet</Link>
          </Button>
        ),
      })
    }
    const openInc = incidents.filter((i) => i.status === 'open')
    if (openInc.length) {
      items.push({
        id: 'incidents',
        tone: openInc.some((i) => i.severity === 'serious') ? 'danger' : 'neutral',
        icon: TriangleAlert,
        title: `${openInc.length} incident report${openInc.length > 1 ? 's' : ''} to review`,
        detail: openInc.map((i) => `${i.reportedBy.split(' ')[0]}: ${i.description}`).slice(0, 2).join(' '),
        action: (
          <Button asChild size='sm' variant='outline'>
            <Link to='/admin/incidents'>Review</Link>
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

    const order = { danger: 0, signal: 1, neutral: 2 }
    return items.sort((a, b) => order[a.tone] - order[b.tone])
  }, [groups, look, coaches, now, settings, regs, sailors, submissions, sendFormReminders, boats, incidents, regattas, calendar, regattaResponses])

  const numbers = useMemo(() => {
    const summerSessions = sessions.filter((s) => s.termId === 'summer-27')
    const cap = summerSessions.reduce((s, x) => s + x.capacity, 0)
    const taken = summerSessions.reduce((s, x) => s + (stats.get(x.id)?.taken ?? 0), 0)
    const waitlist = summerSessions.reduce((s, x) => s + (stats.get(x.id)?.waitlist ?? 0), 0)
    const summerIds = new Set(summerSessions.map((s) => s.id))
    const live = regs.filter((r) => ACTIVE_STATUSES.has(r.status))
    const fams = new Set(live.filter((r) => summerIds.has(r.sessionId)).map((r) => look.sailor.get(r.sailorId)?.familyId))
    return { cap, taken, waitlist, families: fams.size }
  }, [sessions, stats, regs, look])

  const today = format(now, 'yyyy-MM-dd')
  const todays = sessionsOn(sessions, now)
  const upcoming = calendar
    .filter((e) => (e.endDate ?? e.date) >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5)
  const membersOnly = summer.memberPriorityUntil && now < new Date(`${summer.memberPriorityUntil}T00:00:00`)
  const hour = now.getHours()

  return (
    <Main>
      <div className='mb-8'>
        <p className='text-sm text-muted-foreground'>
          {format(now, 'EEEE, MMMM d')} · Fall week {fallWeek} of 11
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
              {attention.length > 0 && <span className='ms-2 text-sm font-normal text-muted-foreground'>{attention.length}</span>}
            </h2>
            <ul className='divide-y rounded-xl border bg-card'>
              {(showAll ? attention : attention.slice(0, 5)).map((a) => (
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
                  <div className='min-w-0 flex-1'>
                    <p className='text-sm font-medium'>{a.title}</p>
                    <p className='text-xs text-muted-foreground'>{a.detail}</p>
                  </div>
                  {a.action}
                </li>
              ))}
              {attention.length > 5 && (
                <li>
                  <button className='w-full px-4 py-2.5 text-start text-sm font-medium text-heading hover:bg-muted/50' onClick={() => setShowAll(!showAll)}>
                    {showAll ? 'Show fewer' : `Show all ${attention.length}`}
                  </button>
                </li>
              )}
              {attention.length === 0 && (
                <li className='px-4 py-6 text-center text-sm text-muted-foreground'>
                  Nothing needs you right now. Rosters are covered, forms are in and staff are current.
                </li>
              )}
            </ul>
          </section>
        </div>

        <aside className='space-y-8'>
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

          <section aria-labelledby='summer'>
            <div className='mb-3 flex items-baseline justify-between'>
              <h2 id='summer' className='text-lg font-semibold'>
                Summer 2027
              </h2>
              <Link to='/admin/programs' className='text-sm font-medium text-heading hover:underline'>
                Programs
              </Link>
            </div>
            <div className='rounded-xl border bg-card p-4'>
              <p className='text-sm text-muted-foreground'>
                {membersOnly ? `Members only until ${format(new Date(`${summer.memberPriorityUntil}T12:00:00`), 'MMMM d')}` : 'Open to everyone'}
              </p>
              <p className='mt-2 font-display text-2xl font-semibold text-heading'>
                {numbers.taken}
                <span className='text-base font-normal text-muted-foreground'> of {numbers.cap} seats</span>
              </p>
              <div className='mt-2 h-2 overflow-hidden rounded-full bg-muted' aria-hidden='true'>
                <div className='h-full rounded-full bg-heading' style={{ width: `${Math.round((numbers.taken / numbers.cap) * 100)}%` }} />
              </div>
              <dl className='mt-3 grid grid-cols-2 gap-2 text-sm'>
                <div>
                  <dt className='text-muted-foreground'>Families</dt>
                  <dd className='font-semibold'>{numbers.families}</dd>
                </div>
                <div>
                  <dt className='text-muted-foreground'>Waitlisted</dt>
                  <dd className='font-semibold'>{numbers.waitlist}</dd>
                </div>
              </dl>
            </div>
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
