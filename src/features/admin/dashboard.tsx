import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import {
  differenceInCalendarDays,
  differenceInHours,
  eachDayOfInterval,
  format,
  formatDistanceToNowStrict,
} from 'date-fns'
import {
  type AlertTriangle,
  Anchor,
  Banknote,
  ClipboardCheck,
  Clock,
  ShieldAlert,
  TriangleAlert,
  UserRoundX,
  Users,
} from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { CERT_TYPES, FORM_TEMPLATES, TERMS } from '@/data/catalog'
import { programById, useLookups, useNow, useSessionStats } from '@/data/hooks'
import { useStore } from '@/data/store'
import { ACTIVE_STATUSES, money } from '@/domain/pricing'
import { coachCertRows, groupLoad, outstandingForms } from '@/domain/rules'
import { Button } from '@/components/ui/button'
import { Main } from '@/components/layout/main'
import { AskBar } from '@/assistant/ask-panel'
import { dayCounts, meetsOn } from '@/domain/attendance'
import { SeasonBoard } from './season-board'

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
  const events = useStore((s) => s.events)
  const sendFormReminders = useStore((s) => s.sendFormReminders)
  const attendance = useStore((s) => s.attendance)
  const boats = useStore((s) => s.boats)
  const incidents = useStore((s) => s.incidents)
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

    const order = { danger: 0, signal: 1, neutral: 2 }
    return items.sort((a, b) => order[a.tone] - order[b.tone])
  }, [groups, look, coaches, now, settings, regs, sailors, submissions, sendFormReminders, boats, incidents])

  const numbers = useMemo(() => {
    const summerSessions = sessions.filter((s) => s.termId === 'summer-27')
    const cap = summerSessions.reduce((s, x) => s + x.capacity, 0)
    const taken = summerSessions.reduce((s, x) => s + (stats.get(x.id)?.taken ?? 0), 0)
    const waitlist = summerSessions.reduce((s, x) => s + (stats.get(x.id)?.waitlist ?? 0), 0)
    const summerIds = new Set(summerSessions.map((s) => s.id))
    const live = regs.filter((r) => ACTIVE_STATUSES.has(r.status))
    const booked = live.reduce((s, r) => s + r.price, 0)
    const collected = live.reduce((s, r) => s + r.paid, 0)
    const fams = new Set(
      live.filter((r) => summerIds.has(r.sessionId)).map((r) => look.sailor.get(r.sailorId)?.familyId)
    )
    return { cap, taken, waitlist, booked, collected, families: fams.size }
  }, [sessions, stats, regs, look])

  const pace = useMemo(() => {
    const open = new Date(`${summer.registrationOpens}T00:00:00`)
    if (now < open) return []
    const summerIds = new Set(sessions.filter((s) => s.termId === 'summer-27').map((s) => s.id))
    const times = regs
      .filter((r) => summerIds.has(r.sessionId) && r.status !== 'cancelled')
      .map((r) => r.createdAt.slice(0, 10))
    let running = 0
    return eachDayOfInterval({ start: open, end: now }).map((d) => {
      const key = format(d, 'yyyy-MM-dd')
      running += times.filter((t) => t === key).length
      return { day: format(d, 'MMM d'), total: running }
    })
  }, [regs, sessions, now, summer.registrationOpens])

  const membersOnly = summer.memberPriorityUntil && now < new Date(`${summer.memberPriorityUntil}T00:00:00`)

  return (
    <Main>
      <div className='mb-8'>
        <p className='text-sm text-muted-foreground'>{format(now, 'EEEE, MMMM d')}</p>
        <h1 className='mt-1 text-3xl font-semibold'>Today at {settings.shortName} juniors</h1>
        <p className='mt-2 max-w-[70ch] text-sm text-muted-foreground'>
          Fall teams are in week {fallWeek} of 11. Summer 2027 registration is open
          {membersOnly
            ? ` to members only until ${format(new Date(`${summer.memberPriorityUntil}T12:00:00`), 'MMMM d')}.`
            : ' to everyone.'}
        </p>
        <div className='mt-5 max-w-2xl'>
          <AskBar />
        </div>
      </div>

      <div className='grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]'>
        <section aria-labelledby='attention'>
          <h2 id='attention' className='mb-3 text-lg font-semibold'>
            Needs you
            <span className='ms-2 text-sm font-normal text-muted-foreground'>{attention.length} items</span>
          </h2>
          <ul className='divide-y rounded-lg border bg-card'>
            {attention.slice(0, 8).map((a) => (
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
            {attention.length > 8 && (
              <li className='px-4 py-2 text-xs text-muted-foreground'>
                {attention.length - 8} more on the Staff and Registrations pages.
              </li>
            )}
            {attention.length === 0 && (
              <li className='px-4 py-6 text-center text-sm text-muted-foreground'>
                Nothing needs you right now. Rosters are covered, forms are in, staff are current.
              </li>
            )}
          </ul>
        </section>

        <aside aria-label='Season numbers' className='space-y-6'>
          <dl className='divide-y rounded-lg border bg-card text-sm'>
            <Stat label='Summer seats filled' value={`${numbers.taken} / ${numbers.cap}`} sub={`${Math.round((numbers.taken / numbers.cap) * 100)}% of capacity`} />
            <Stat label='On waitlists' value={String(numbers.waitlist)} sub='Summer 2027' />
            <Stat label='Families registered for summer' value={String(numbers.families)} />
            <Stat label='Tuition booked, all terms' value={money(Math.round(numbers.booked))} sub={`${money(Math.round(numbers.collected))} collected`} />
          </dl>
          <div className='rounded-lg border bg-card p-4'>
            <p className='text-sm font-medium'>Summer sign-ups since opening day</p>
            <div className='mt-3 h-32'>
              <ResponsiveContainer width='100%' height='100%'>
                <AreaChart data={pace} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke='var(--border)' />
                  <XAxis dataKey='day' tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} interval='preserveStartEnd' minTickGap={30} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [`${v} registrations`, '']}
                    separator=''
                  />
                  <Area isAnimationActive={false} type='monotone' dataKey='total' stroke='var(--chart-1)' strokeWidth={2} fill='var(--chart-1)' fillOpacity={0.12} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </aside>
      </div>

      <section className='mt-10' aria-labelledby='board'>
        <div className='mb-3 flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 id='board' className='text-lg font-semibold'>Summer 2027 board</h2>
            <p className='text-sm text-muted-foreground'>
              Seats taken per week. Amber is the waitlist. Open any week to build groups or manage its waitlist.
            </p>
          </div>
          <Button asChild variant='outline' size='sm'>
            <Link to='/admin/programs'>All programs</Link>
          </Button>
        </div>
        <div className='rounded-lg border bg-card p-2'>
          <SeasonBoard termId='summer-27' sessions={sessions} stats={stats} />
        </div>
      </section>

      <section className='mt-10 grid gap-6 lg:grid-cols-2'>
        <div>
          <h2 className='mb-3 text-lg font-semibold'>Fall teams this week</h2>
          <ul className='divide-y rounded-lg border bg-card'>
            {sessions
              .filter((s) => s.termId === 'fall-26')
              .map((s) => {
                const st = stats.get(s.id)!
                const g = groups.filter((x) => x.sessionId === s.id)
                const coachNames = [...new Set(g.flatMap((x) => x.coachIds))]
                  .map((id) => look.coach.get(id)?.name.split(' ')[0])
                  .join(', ')
                return (
                  <li key={s.id}>
                    <Link
                      to='/admin/sessions/$sessionId'
                      params={{ sessionId: s.id }}
                      className='flex items-center gap-3 px-4 py-3 hover:bg-muted/50'
                    >
                      <span className='h-8 w-1 rounded-full' style={{ background: st.program.color }} aria-hidden='true' />
                      <span className='min-w-0 flex-1'>
                        <span className='block text-sm font-medium'>{st.program.name}</span>
                        <span className='block truncate text-xs text-muted-foreground'>
                          {s.days} · {coachNames || 'No coaches assigned'}
                        </span>
                        {(() => {
                          const ids = regs.filter((r) => r.sessionId === s.id && r.status === 'confirmed').map((r) => r.sailorId)
                          const todayIso = format(now, 'yyyy-MM-dd')
                          const c = dayCounts(Object.values(attendance).filter((e) => e.sessionId === s.id && e.date === todayIso), ids)
                          if (!meetsOn(s, now)) return null
                          return (
                            <span className={cn('mt-0.5 block text-xs font-medium', c.onWater ? 'text-signal' : 'text-muted-foreground')}>
                              {c.notIn === ids.length
                                ? `Practice today, ${s.time.split('·')[0].replace('Weekdays ', '')}`
                                : `Today: ${c.present + c.ashore + c.onWater} here, ${c.onWater} on the water, ${c.absent} absent`}
                            </span>
                          )
                        })()}
                      </span>
                      <span className='text-sm font-semibold'>
                        {st.confirmed}
                        <span className='font-normal text-muted-foreground'> sailors</span>
                      </span>
                    </Link>
                  </li>
                )
              })}
          </ul>
        </div>
        <div>
          <h2 className='mb-3 text-lg font-semibold'>Latest activity</h2>
          <ol className='space-y-0 rounded-lg border bg-card'>
            {events.slice(0, 8).map((e) => (
              <li key={e.id} className='flex gap-3 border-b px-4 py-2.5 text-sm last:border-b-0'>
                <Users className='mt-0.5 size-4 shrink-0 text-muted-foreground' aria-hidden='true' />
                <span className='min-w-0 flex-1'>{e.text}</span>
                <time className='shrink-0 text-xs text-muted-foreground' dateTime={e.at}>
                  {formatDistanceToNowStrict(new Date(e.at), { addSuffix: true })}
                </time>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </Main>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className='flex items-baseline justify-between gap-3 px-4 py-3'>
      <dt className='text-muted-foreground'>{label}</dt>
      <dd className='text-end'>
        <span className='font-display text-lg font-semibold'>{value}</span>
        {sub && <span className='block text-xs text-muted-foreground'>{sub}</span>}
      </dd>
    </div>
  )
}
