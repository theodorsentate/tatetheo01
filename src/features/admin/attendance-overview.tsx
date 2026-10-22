import { Link } from '@tanstack/react-router'
import { format } from 'date-fns'
import { Waves } from 'lucide-react'
import { cn } from '@/lib/utils'
import { programById, useLookups, useNow } from '@/data/hooks'
import { useStore } from '@/data/store'
import { attendanceKey, attendanceRecord, dayCounts, meetsOn, practiceDates } from '@/domain/attendance'
import { Main } from '@/components/layout/main'
import { EmptyState, PageHeader } from '@/components/burgee/marks'

/** Club-wide attendance: who is on the water now, and who is slipping. */
export function AttendanceOverview() {
  const now = useNow()
  const sessions = useStore((s) => s.sessions)
  const regs = useStore((s) => s.registrations)
  const attendance = useStore((s) => s.attendance)
  const look = useLookups()
  const today = format(now, 'yyyy-MM-dd')
  const all = Object.values(attendance)

  const running = sessions.filter((s) => today >= s.startDate && today <= s.endDate)
  const rows = running.map((s) => {
    const ids = regs.filter((r) => r.sessionId === s.id && r.status === 'confirmed').map((r) => r.sailorId)
    const todays = ids.map((id) => attendance[attendanceKey(today, s.id, id)]).filter(Boolean)
    const dates = practiceDates(s, now).filter((d) => d < today)
    const recs = ids.map((id) => ({ id, rec: attendanceRecord(all, id, s.id, dates) }))
    const marked = recs.reduce((n, r) => n + r.rec.attended + r.rec.missed, 0)
    const attended = recs.reduce((n, r) => n + r.rec.attended, 0)
    return {
      s,
      program: programById.get(s.programId)!,
      practiceToday: meetsOn(s, now),
      counts: dayCounts(todays, ids),
      onWater: todays.filter((e) => e.status === 'on-water').map((e) => look.sailor.get(e.sailorId)!),
      held: dates.length,
      rate: marked ? attended / marked : undefined,
      concerns: recs
        .filter((r) => r.rec.missedLast3 || (r.rec.rate !== undefined && r.rec.rate < 0.75))
        .map((r) => ({ sailor: look.sailor.get(r.id)!, rec: r.rec })),
    }
  })
  const onWater = rows.flatMap((r) => r.onWater.map((k) => ({ k, r })))

  return (
    <Main>
      <PageHeader title='Attendance' description='Live from coaches’ phones.' />
      <section
        className={cn(
          'mb-8 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-lg border p-5',
          onWater.length ? 'border-signal/40 bg-signal-soft' : 'bg-card'
        )}
        aria-label='On the water now'
      >
        <div className='flex items-center gap-3'>
          <Waves className={cn('size-8', onWater.length ? 'text-signal' : 'text-muted-foreground')} />
          <div>
            <p className='font-display text-3xl font-semibold text-heading'>{onWater.length}</p>
            <p className='text-sm text-muted-foreground'>on the water right now</p>
          </div>
        </div>
        <p className='min-w-0 flex-1 text-sm'>
          {onWater.length
            ? onWater.map(({ k, r }) => `${k.firstName} ${k.lastName} (${r.program.name.replace(/^Opti /, '')})`).join(', ')
            : rows.some((r) => r.practiceToday)
              ? `Practice today for ${rows.filter((r) => r.practiceToday).map((r) => r.program.name).join(', ')}. Nobody has launched yet.`
              : 'No practice on the water today.'}
        </p>
      </section>

      {rows.length === 0 ? (
        <EmptyState title='No sessions are running right now' />
      ) : (
        <div className='grid gap-6 lg:grid-cols-2'>
          {rows.map(({ s, program, practiceToday, counts, held, rate, concerns }) => (
            <section key={s.id} className='rounded-lg border bg-card'>
              <header className='flex items-start justify-between gap-3 border-b px-4 py-3'>
                <div className='flex gap-3'>
                  <span className='mt-1 h-8 w-1 rounded-full' style={{ background: program.color }} aria-hidden='true' />
                  <div>
                    <Link to='/admin/sessions/$sessionId' params={{ sessionId: s.id }} className='font-semibold text-heading hover:underline'>
                      {program.name}
                    </Link>
                    <p className='text-xs text-muted-foreground'>
                      {held} practices so far, {rate === undefined ? 'no attendance yet' : `${Math.round(rate * 100)}% attendance`}
                    </p>
                  </div>
                </div>
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', practiceToday ? 'bg-accent text-primary' : 'bg-muted text-muted-foreground')}>
                  {practiceToday ? 'Practice today' : 'No practice today'}
                </span>
              </header>
              {practiceToday && (
                <dl className='grid grid-cols-4 gap-2 border-b px-4 py-3 text-center text-sm'>
                  {[
                    ['Not in', counts.notIn],
                    ['Here', counts.present + counts.ashore],
                    ['On water', counts.onWater],
                    ['Absent', counts.absent],
                  ].map(([l, n]) => (
                    <div key={l as string}>
                      <dt className='text-xs text-muted-foreground'>{l}</dt>
                      <dd className='font-display text-lg font-semibold'>{n}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <div className='px-4 py-3'>
                <p className='mb-2 text-xs font-medium text-muted-foreground'>Worth a check-in with the family</p>
                {concerns.length ? (
                  <ul className='space-y-1 text-sm'>
                    {concerns.map(({ sailor, rec }) => (
                      <li key={sailor.id} className='flex justify-between gap-3'>
                        <Link to='/admin/families' search={{ family: sailor.familyId }} className='hover:underline'>
                          {sailor.firstName} {sailor.lastName}
                        </Link>
                        <span className={cn('text-xs', rec.missedLast3 ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                          {rec.attended}/{rec.attended + rec.missed}
                          {rec.missedLast3 ? ', missed last 3' : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className='text-sm text-muted-foreground'>Everyone is coming regularly.</p>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </Main>
  )
}
