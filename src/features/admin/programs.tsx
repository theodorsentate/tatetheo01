import { Link } from '@tanstack/react-router'
import { format } from 'date-fns'
import { PROGRAMS, TERMS } from '@/data/catalog'
import { useNow, useSessionStats } from '@/data/hooks'
import { useStore } from '@/data/store'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Main } from '@/components/layout/main'
import { FleetChip, PageHeader } from '@/components/burgee/marks'
import { SeasonBoard } from './season-board'

const d = (iso: string) => format(new Date(`${iso}T12:00:00`), 'MMM d')

export function AdminPrograms() {
  const sessions = useStore((s) => s.sessions)
  const groups = useStore((s) => s.groups)
  const coaches = useStore((s) => s.coaches)
  const stats = useSessionStats()
  const today = format(useNow(60_000), 'yyyy-MM-dd')
  const current = TERMS.find((t) => t.endDate >= today)?.id ?? TERMS[0].id

  return (
    <Main>
      <PageHeader title='Programs' description='Each program week by week. Open a week to see its groups, coaches and roster.' />
      <Tabs defaultValue={current}>
        <TabsList>
          {TERMS.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>
              {t.name}
            </TabsTrigger>
          ))}
        </TabsList>
        {TERMS.map((term) => {
          const termSessions = sessions.filter((s) => s.termId === term.id)
          const programs = PROGRAMS.filter((p) => termSessions.some((s) => s.programId === p.id))
          return (
            <TabsContent key={term.id} value={term.id} className='mt-6 space-y-6'>
              <p className='text-sm text-muted-foreground'>
                {d(term.startDate)} – {d(term.endDate)}, {term.startDate.slice(0, 4)}
              </p>
              {term.season === 'summer' && (
                <div className='rounded-lg border bg-card p-2'>
                  <SeasonBoard termId={term.id} sessions={sessions} stats={stats} />
                </div>
              )}
              <ul className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
                {programs.map((p) => {
                  const list = termSessions.filter((s) => s.programId === p.id)
                  const now = list.find((s) => s.startDate <= today && s.endDate >= today)
                  const nowCoaches = now ? [...new Set(groups.filter((g) => g.sessionId === now.id).flatMap((g) => g.coachIds))] : []
                  return (
                    <li key={p.id} className='flex flex-col rounded-xl border bg-card p-4'>
                      <div className='flex gap-3'>
                        <span className='h-10 w-1 shrink-0 rounded-full' style={{ background: p.color }} aria-hidden='true' />
                        <div className='min-w-0'>
                          <h2 className='font-semibold'>{p.name}</h2>
                          <p className='text-xs text-muted-foreground'>
                            {p.format === 'camp' ? `${p.slot === 'PM' ? 'Afternoons' : 'Mornings'}, ${list[0]?.time}` : list[0]?.time}
                          </p>
                        </div>
                      </div>
                      <p className='mt-2 line-clamp-2 text-sm text-muted-foreground'>{p.description}</p>
                      <div className='mt-3 flex flex-wrap gap-2'>
                        {p.levels.map((l) => (
                          <FleetChip key={l} level={l} />
                        ))}
                      </div>
                      <dl className='mt-3 grid grid-cols-3 gap-2 border-t pt-3 text-sm'>
                        <div>
                          <dt className='text-xs text-muted-foreground'>Ages</dt>
                          <dd className='font-medium'>
                            {p.minAge}–{p.maxAge}
                          </dd>
                        </div>
                        <div>
                          <dt className='text-xs text-muted-foreground'>Ratio</dt>
                          <dd className='font-medium'>1:{p.ratio}</dd>
                        </div>
                        <div>
                          <dt className='text-xs text-muted-foreground'>Plans by</dt>
                          <dd className='font-medium'>{p.planOwner === 'each-coach' ? 'Each coach' : 'Head coach'}</dd>
                        </div>
                      </dl>
                      {now ? (
                        <Link to='/admin/sessions/$sessionId' params={{ sessionId: now.id }} className='mt-3 rounded-lg bg-muted/60 px-3 py-2 text-sm hover:bg-muted'>
                          <span className='font-medium'>This week:</span> {stats.get(now.id)?.taken ?? 0} sailors with{' '}
                          {nowCoaches.map((id) => coaches.find((c) => c.id === id)?.name.split(' ')[0]).join(', ') || 'no coaches yet'}
                        </Link>
                      ) : (
                        <p className='mt-3 text-xs text-muted-foreground'>{list.length} {p.format === 'camp' ? 'weeks' : 'season'}. Open a week above.</p>
                      )}
                    </li>
                  )
                })}
              </ul>
            </TabsContent>
          )
        })}
      </Tabs>
    </Main>
  )
}
