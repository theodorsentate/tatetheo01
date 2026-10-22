import { Link } from '@tanstack/react-router'
import { format } from 'date-fns'
import { Lock, LockOpen } from 'lucide-react'
import { toast } from 'sonner'
import { PROGRAMS, TERMS } from '@/data/catalog'
import { useSessionStats } from '@/data/hooks'
import { useStore } from '@/data/store'
import { money } from '@/domain/pricing'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Main } from '@/components/layout/main'
import { FillBar, FleetChip, PageHeader } from '@/components/burgee/marks'
import { SeasonBoard } from './season-board'

const d = (iso: string) => format(new Date(`${iso}T12:00:00`), 'MMM d')

export function AdminPrograms() {
  const sessions = useStore((s) => s.sessions)
  const tiers = useStore((s) => s.settings.pricing.tiers)
  const updateSession = useStore((s) => s.updateSession)
  const stats = useSessionStats()

  return (
    <Main>
      <PageHeader
        title='Programs'
        description='Raise capacity and new seats go straight to the waitlist.'
        actions={
          <Button asChild variant='outline'>
            <Link to='/admin/settings'>Edit pricing</Link>
          </Button>
        }
      />
      <Tabs defaultValue='summer-27'>
        <TabsList>
          {[...TERMS].reverse().map((t) => (
            <TabsTrigger key={t.id} value={t.id}>
              {t.name}
            </TabsTrigger>
          ))}
        </TabsList>
        {TERMS.map((term) => {
          const termSessions = sessions.filter((s) => s.termId === term.id)
          const programs = PROGRAMS.filter((p) => termSessions.some((s) => s.programId === p.id))
          return (
            <TabsContent key={term.id} value={term.id} className='mt-6 space-y-8'>
              <p className='text-sm text-muted-foreground'>
                {d(term.startDate)} – {d(term.endDate)}, {term.startDate.slice(0, 4)}. Registration opened {d(term.registrationOpens)}
                {term.memberPriorityUntil ? `, members only until ${d(term.memberPriorityUntil)}` : ''}
                {term.earlyBirdUntil ? `. Early-bird pricing through ${d(term.earlyBirdUntil)}.` : '.'}
              </p>
              {term.season === 'summer' && (
                <div className='rounded-lg border bg-card p-2'>
                  <SeasonBoard termId={term.id} sessions={sessions} stats={stats} />
                </div>
              )}
              {programs.map((p) => {
                const tier = tiers.find((t) => t.id === p.pricingTierId)!
                const list = termSessions.filter((s) => s.programId === p.id)
                return (
                  <section key={p.id} aria-labelledby={`p-${p.id}-${term.id}`}>
                    <div className='mb-2 flex flex-wrap items-start gap-x-6 gap-y-2'>
                      <div className='flex min-w-0 flex-1 gap-3'>
                        <span className='mt-1 h-10 w-1 shrink-0 rounded-full' style={{ background: p.color }} aria-hidden='true' />
                        <div>
                          <h2 id={`p-${p.id}-${term.id}`} className='text-lg font-semibold'>
                            {p.name}
                          </h2>
                          <p className='max-w-[70ch] text-sm text-muted-foreground'>{p.description}</p>
                        </div>
                      </div>
                      <dl className='grid grid-cols-3 gap-x-6 text-sm'>
                        <div>
                          <dt className='text-xs text-muted-foreground'>Ages</dt>
                          <dd className='font-medium'>
                            {p.minAge}–{p.maxAge}
                          </dd>
                        </div>
                        <div>
                          <dt className='text-xs text-muted-foreground'>Coach ratio</dt>
                          <dd className='font-medium'>1:{p.ratio}</dd>
                        </div>
                        <div>
                          <dt className='text-xs text-muted-foreground'>Per {tier.unit}</dt>
                          <dd className='font-medium'>
                            {money(tier.member)}
                            <span className='font-normal text-muted-foreground'> / {money(tier.nonMember)}</span>
                          </dd>
                        </div>
                      </dl>
                    </div>
                    {p.activity === 'sailing' && (
                      <div className='mb-2 ms-4 flex flex-wrap gap-3'>
                        {p.levels.map((l) => (
                          <FleetChip key={l} level={l} />
                        ))}
                      </div>
                    )}
                    <div className='overflow-x-auto rounded-lg border bg-card'>
                      <table className='w-full min-w-[720px] text-sm'>
                        <thead className='border-b text-xs text-muted-foreground'>
                          <tr>
                            <th className='px-4 py-2 text-start font-medium'>Session</th>
                            <th className='px-4 py-2 text-start font-medium'>When</th>
                            <th className='w-56 px-4 py-2 text-start font-medium'>Filled</th>
                            <th className='w-28 px-4 py-2 text-start font-medium'>Capacity</th>
                            <th className='w-28 px-4 py-2 text-end font-medium'>
                              <span className='sr-only'>Actions</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody className='divide-y'>
                          {list.map((s) => {
                            const st = stats.get(s.id)!
                            return (
                              <tr key={s.id} className={s.status === 'closed' ? 'text-muted-foreground' : ''}>
                                <td className='px-4 py-2.5 font-medium'>
                                  <Link to='/admin/sessions/$sessionId' params={{ sessionId: s.id }} className='hover:underline'>
                                    {s.name}
                                  </Link>
                                  {s.status === 'closed' && <span className='ms-2 text-xs font-normal'>Closed</span>}
                                </td>
                                <td className='px-4 py-2.5'>
                                  {d(s.startDate)}
                                  {s.startDate !== s.endDate && `–${d(s.endDate)}`}
                                  <span className='block text-xs text-muted-foreground'>
                                    {s.days}, {s.time}
                                  </span>
                                </td>
                                <td className='px-4 py-2.5'>
                                  <FillBar taken={st.taken} capacity={s.capacity} waitlist={st.waitlist} />
                                </td>
                                <td className='px-4 py-2.5'>
                                  <label className='sr-only' htmlFor={`cap-${s.id}`}>
                                    Capacity for {p.name} {s.name}
                                  </label>
                                  <input
                                    id={`cap-${s.id}`}
                                    type='number'
                                    min={1}
                                    max={80}
                                    defaultValue={s.capacity}
                                    className='h-8 w-20 rounded-md border bg-background px-2 text-sm'
                                    onBlur={(e) => {
                                      const v = Number(e.target.value)
                                      if (!v || v === s.capacity) return
                                      const before = stats.get(s.id)!.waitlist
                                      updateSession(s.id, { capacity: v })
                                      toast.success(
                                        v > s.capacity && before
                                          ? `Capacity raised to ${v}. Offers sent to the next ${Math.min(before, v - s.capacity)} on the waitlist.`
                                          : `Capacity set to ${v}`
                                      )
                                    }}
                                  />
                                </td>
                                <td className='px-4 py-2.5 text-end'>
                                  <Button
                                    variant='ghost'
                                    size='sm'
                                    onClick={() => {
                                      updateSession(s.id, { status: s.status === 'open' ? 'closed' : 'open' })
                                      toast(`${p.name} ${s.name} ${s.status === 'open' ? 'closed to new registrations' : 'reopened'}`)
                                    }}
                                  >
                                    {s.status === 'open' ? <LockOpen className='size-4' /> : <Lock className='size-4' />}
                                    {s.status === 'open' ? 'Close' : 'Reopen'}
                                  </Button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )
              })}
            </TabsContent>
          )
        })}
      </Tabs>
    </Main>
  )
}
