import { useMemo } from 'react'
import { differenceInCalendarDays, format } from 'date-fns'
import { CERT_TYPES, FORM_TEMPLATES, PERSONAS, PROGRAMS, TERMS } from '@/data/catalog'
import { useNow } from '@/data/hooks'
import { useStore } from '@/data/store'
import { coachCertRows, coachCertSummary, outstandingForms } from '@/domain/rules'
import { meetsOn } from '@/domain/attendance'
import { BurgeeMark } from '@/components/burgee/marks'
import { RoleSwitcher } from '@/components/burgee/role-switcher'

/**
 * What the junior committee sees: how the season is going, without names,
 * phone numbers or medical details. Read-only.
 */
export function CommitteeReport() {
  const s = useStore()
  const now = useNow(60_000)
  const today = format(now, 'yyyy-MM-dd')
  const term = TERMS.find((t) => t.startDate <= today && t.endDate >= today) ?? TERMS.find((t) => t.season === 'summer')!
  const week = Math.floor(differenceInCalendarDays(now, new Date(`${term.startDate}T12:00:00`)) / 7) + 1
  const weeks = Math.ceil((differenceInCalendarDays(new Date(`${term.endDate}T12:00:00`), new Date(`${term.startDate}T12:00:00`)) + 1) / 7)

  const r = useMemo(() => {
    const termSessions = s.sessions.filter((x) => x.termId === term.id)
    const ids = new Set(termSessions.map((x) => x.id))
    const regs = s.registrations.filter((x) => ids.has(x.sessionId) && x.status === 'confirmed')
    const kids = new Set(regs.map((x) => x.sailorId))
    const families = new Set([...kids].map((k) => s.sailors.find((x) => x.id === k)?.familyId))
    const entries = Object.values(s.attendance).filter((e) => ids.has(e.sessionId) && e.date <= today)
    const came = entries.filter((e) => e.status !== 'absent').length
    const calls = s.practiceCalls.filter((c) => ids.has(c.sessionId))
    // Every day at least one program met, from the first day of the term through today.
    const days = new Set<string>()
    for (let d = new Date(`${term.startDate}T12:00:00`); format(d, 'yyyy-MM-dd') <= today; d = new Date(d.getTime() + 86400000))
      if (termSessions.some((x) => meetsOn(x, d))) days.add(format(d, 'yyyy-MM-dd'))
    const callsBy = { on: 0, delayed: 0, cancelled: 0 }
    for (const c of calls) callsBy[c.status]++
    const inc = s.incidents.filter((i) => i.at.slice(0, 10) >= term.startDate)
    const sev = { minor: 0, moderate: 0, serious: 0 }
    for (const i of inc) sev[i.severity]++
    const staff = s.coaches.filter((c) => c.role !== 'program-director')
    const current = staff.filter((c) => coachCertSummary(coachCertRows(c, CERT_TYPES, now, s.settings.certWarningDays)) !== 'expired' && coachCertSummary(coachCertRows(c, CERT_TYPES, now, s.settings.certWarningDays)) !== 'missing').length
    const kidList = s.sailors.filter((k) => kids.has(k.id))
    const formsDone = kidList.filter((k) => !outstandingForms(k, FORM_TEMPLATES, s.submissions, s.settings.season).length).length
    const swim = new Set(s.swimChecks.filter((c) => c.result === 'passed').map((c) => c.sailorId))
    const byProgram = PROGRAMS.filter((p) => termSessions.some((x) => x.programId === p.id)).map((p) => {
      const sess = termSessions.filter((x) => x.programId === p.id)
      const pr = regs.filter((x) => sess.some((y) => y.id === x.sessionId))
      const cap = sess.reduce((n, x) => n + x.capacity, 0)
      return { p, weeks: sess.length, sailors: new Set(pr.map((x) => x.sailorId)).size, seats: pr.length, fill: cap ? pr.length / cap : 0 }
    })
    const recipients = s.announcements.filter((a) => a.sentAt.slice(0, 10) >= term.startDate)
    return {
      kids: kids.size,
      families: families.size,
      attendance: entries.length ? came / entries.length : undefined,
      days: days.size,
      callsBy,
      notified: recipients.reduce((n, a) => n + a.recipients, 0),
      announcements: recipients.length,
      conversations: s.threads.length,
      messages: s.threads.reduce((n, t) => n + t.messages.length, 0),
      dayNotes: s.dayNotes.length,
      evaluations: s.evaluations.filter((e) => e.status === 'shared').length,
      incidents: inc.length,
      sev,
      openIncidents: inc.filter((i) => i.status === 'open').length,
      staff: staff.length,
      current,
      formsDone,
      swim: kidList.filter((k) => swim.has(k.id)).length,
      byProgram,
    }
  }, [s, term, today, now])

  const pct = (n?: number) => (n === undefined ? '—' : `${Math.round(n * 100)}%`)
  const upcoming = s.regattas
    .map((d) => ({ d, e: s.calendar.find((x) => x.id === d.eventId)! }))
    .filter((x) => x.e && x.e.date >= today)
    .sort((a, b) => a.e.date.localeCompare(b.e.date))
    .slice(0, 4)

  return (
    <div className='min-h-svh bg-mist'>
      <header className='border-b bg-card'>
        <div className='mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6'>
          <BurgeeMark className='size-7 text-heading' />
          <span className='min-w-0 flex-1 truncate font-semibold'>{s.settings.clubName}</span>
          <RoleSwitcher />
        </div>
      </header>
      <main id='content' className='mx-auto max-w-6xl px-4 py-8 sm:px-6'>
        <p className='text-sm text-muted-foreground'>
          For {PERSONAS.committee.name}, {PERSONAS.committee.title}
        </p>
        <h1 className='mt-1 text-3xl font-semibold'>Junior program report</h1>
        <p className='mt-1 max-w-[70ch] text-sm text-muted-foreground'>
          {term.name}, through {format(now, 'EEEE, MMMM d')} (week {Math.min(week, weeks)} of {weeks}). A read-only summary for the junior committee: no names, phone numbers or medical details.
        </p>

        <dl className='mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-4'>
          {[
            ['Sailors this summer', r.kids, `${r.families} families`],
            ['Attendance so far', pct(r.attendance), 'Of sailors expected each day'],
            ['Sailing days run', r.days, `${r.callsBy.cancelled} cancelled, ${r.callsBy.delayed} delayed`],
            ['Staff fully certified', `${r.current} of ${r.staff}`, 'SafeSport, first aid, background checks'],
          ].map(([label, value, sub]) => (
            <div key={label as string} className='bg-card p-4'>
              <dt className='text-sm text-muted-foreground'>{label}</dt>
              <dd className='font-display text-3xl font-semibold text-heading'>{value}</dd>
              <dd className='text-xs text-muted-foreground'>{sub}</dd>
            </div>
          ))}
        </dl>

        <div className='mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]'>
          <section aria-labelledby='programs' className='min-w-0'>
            <h2 id='programs' className='mb-3 text-lg font-semibold'>
              Programs
            </h2>
            <div className='overflow-x-auto rounded-xl border bg-card'>
              <table className='w-full min-w-[520px] text-sm'>
                <thead className='border-b text-xs text-muted-foreground'>
                  <tr>
                    <th className='px-4 py-2 text-start font-medium'>Program</th>
                    <th className='px-4 py-2 text-end font-medium'>Weeks</th>
                    <th className='px-4 py-2 text-end font-medium'>Sailors</th>
                    <th className='px-4 py-2 text-end font-medium'>Sailor-weeks</th>
                    <th className='px-4 py-2 text-end font-medium'>Seats filled</th>
                  </tr>
                </thead>
                <tbody className='divide-y'>
                  {r.byProgram.map(({ p, weeks, sailors, seats, fill }) => (
                    <tr key={p.id}>
                      <td className='px-4 py-2.5'>
                        <span className='me-2 inline-block size-2.5 rounded-full align-middle' style={{ background: p.color }} aria-hidden='true' />
                        {p.name}
                      </td>
                      <td className='px-4 py-2.5 text-end'>{weeks}</td>
                      <td className='px-4 py-2.5 text-end'>{sailors}</td>
                      <td className='px-4 py-2.5 text-end'>{seats}</td>
                      <td className='px-4 py-2.5 text-end'>{pct(fill)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 className='mt-8 mb-3 text-lg font-semibold'>Handled in Burgee this summer</h2>
            <ul className='grid gap-3 sm:grid-cols-2'>
              {[
                [r.announcements, 'club updates', `reaching families ${r.notified.toLocaleString()} times by app and email`],
                [r.conversations, 'conversations', `${r.messages} messages between families, coaches and the director`],
                [r.dayNotes, 'parent notes', 'absences, late arrivals and pickup changes, straight to the coach’s roster'],
                [r.evaluations, 'evaluations shared', 'written by coaches, approved by the director'],
              ].map(([n, label, detail]) => (
                <li key={label as string} className='rounded-xl border bg-card p-4'>
                  <p className='font-display text-2xl font-semibold text-heading'>
                    {n} <span className='text-base font-medium text-foreground'>{label}</span>
                  </p>
                  <p className='text-sm text-muted-foreground'>{detail}</p>
                </li>
              ))}
            </ul>
          </section>

          <aside className='space-y-6'>
            <section aria-labelledby='safety' className='rounded-xl border bg-card p-4'>
              <h2 id='safety' className='font-semibold'>
                Safety
              </h2>
              <dl className='mt-3 grid gap-2 text-sm'>
                <div className='flex justify-between gap-2'>
                  <dt className='text-muted-foreground'>Incident reports</dt>
                  <dd className='font-medium'>
                    {r.incidents} ({r.sev.minor} minor, {r.sev.moderate} moderate, {r.sev.serious} serious)
                  </dd>
                </div>
                <div className='flex justify-between gap-2'>
                  <dt className='text-muted-foreground'>Still open</dt>
                  <dd className='font-medium'>{r.openIncidents}</dd>
                </div>
                <div className='flex justify-between gap-2'>
                  <dt className='text-muted-foreground'>Swim checks passed</dt>
                  <dd className='font-medium'>
                    {r.swim} of {r.kids}
                  </dd>
                </div>
                <div className='flex justify-between gap-2'>
                  <dt className='text-muted-foreground'>Forms complete</dt>
                  <dd className='font-medium'>
                    {r.formsDone} of {r.kids}
                  </dd>
                </div>
              </dl>
            </section>
            <section aria-labelledby='regattas' className='rounded-xl border bg-card p-4'>
              <h2 id='regattas' className='font-semibold'>
                Coming regattas
              </h2>
              <ul className='mt-3 divide-y text-sm'>
                {upcoming.map(({ e }) => (
                  <li key={e.id} className='flex justify-between gap-3 py-2'>
                    <span>
                      <span className='block font-medium'>{e.title}</span>
                      <span className='text-xs text-muted-foreground'>{format(new Date(`${e.date}T12:00:00`), 'EEE, MMM d')}</span>
                    </span>
                    <span className='text-muted-foreground'>{s.regattaResponses.filter((x) => x.eventId === e.id && x.status === 'going').length} going</span>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      </main>
    </div>
  )
}
