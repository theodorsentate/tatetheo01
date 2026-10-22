import { Link } from '@tanstack/react-router'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { PROGRAMS } from '@/data/catalog'
import { type SessionStat } from '@/data/hooks'
import type { Session } from '@/domain/types'

/**
 * Weeks × programs grid, read like a regatta results board. Each cell is one
 * camp week: fill shown as a tide line, waitlist as an amber count.
 */
export function SeasonBoard({
  termId,
  sessions,
  stats,
}: {
  termId: string
  sessions: Session[]
  stats: Map<string, SessionStat>
}) {
  const termSessions = sessions.filter((s) => s.termId === termId)
  const weeks = [...new Set(termSessions.map((s) => s.name))].sort(
    (a, b) => Number(a.split(' ')[1]) - Number(b.split(' ')[1])
  )
  const programs = PROGRAMS.filter((p) => termSessions.some((s) => s.programId === p.id))
  const firstByWeek = new Map(weeks.map((w) => [w, termSessions.find((s) => s.name === w)!]))

  return (
    <div className='overflow-x-auto'>
      <table className='w-full min-w-[760px] table-fixed border-separate border-spacing-1 text-sm'>
        <thead>
          <tr>
            <th className='w-44 px-2 text-start text-xs font-medium text-muted-foreground'>Program</th>
            {weeks.map((w) => (
              <th key={w} className='px-1 text-start font-normal'>
                <span className='block text-xs font-semibold'>{w}</span>
                <span className='block text-[11px] text-muted-foreground'>
                  {format(new Date(`${firstByWeek.get(w)!.startDate}T12:00:00`), 'MMM d')}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {programs.map((p) => (
            <tr key={p.id}>
              <th scope='row' className='px-2 text-start font-medium'>
                <span className='flex items-center gap-2'>
                  <span className='h-4 w-1 rounded-full' style={{ background: p.color }} aria-hidden='true' />
                  <span className='truncate'>{p.name}</span>
                </span>
              </th>
              {weeks.map((w) => {
                const session = termSessions.find((s) => s.programId === p.id && s.name === w)
                if (!session)
                  return (
                    <td key={w} className='rounded-md bg-muted/40 text-center text-xs text-muted-foreground/60'>
                      <span className='sr-only'>No session</span>—
                    </td>
                  )
                const st = stats.get(session.id)!
                const pct = st.taken / session.capacity
                const full = pct >= 1
                return (
                  <td key={w} className='p-0'>
                    <Link
                      to='/admin/sessions/$sessionId'
                      params={{ sessionId: session.id }}
                      className={cn(
                        'relative block h-14 overflow-hidden rounded-md border px-2 py-1.5 transition-colors hover:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                        full ? 'border-primary/40 bg-card' : 'bg-card'
                      )}
                      aria-label={`${p.name} ${w}: ${st.taken} of ${session.capacity} filled${st.waitlist ? `, ${st.waitlist} waitlisted` : ''}`}
                    >
                      {/* tide line */}
                      <span
                        className={cn('absolute inset-x-0 bottom-0', full ? 'bg-primary/25' : 'bg-primary/12')}
                        style={{ height: `${Math.max(4, pct * 100)}%` }}
                        aria-hidden='true'
                      />
                      <span className='relative flex items-baseline justify-between gap-1'>
                        <span className={cn('font-semibold', full && 'text-primary')}>
                          {st.taken}
                          <span className='font-normal text-muted-foreground'>/{session.capacity}</span>
                        </span>
                        {st.waitlist > 0 && (
                          <span className='rounded bg-signal-soft px-1 text-[11px] font-semibold text-signal'>
                            +{st.waitlist}
                          </span>
                        )}
                      </span>
                      {full && <span className='relative text-[11px] font-medium text-primary'>Full</span>}
                    </Link>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
