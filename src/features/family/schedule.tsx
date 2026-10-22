import { addDays, format } from 'date-fns'
import { MapPin, Sailboat, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { familyRegs, programById, useLookups, useNow } from '@/data/hooks'
import { useStore } from '@/data/store'
import { meetsOn } from '@/domain/attendance'
import { CALL, Pennant } from '@/components/burgee/practice'
import { useFamily, useKidRegattas } from './home'

type Item = { key: string; kind: 'practice' | 'regatta' | 'event'; title: string; detail: string; who: string[]; status?: keyof typeof CALL; note?: string }

/** The next three weeks for every sailor in the family, in one list. */
export function FamilySchedule() {
  const { family, kids } = useFamily()
  const regs = useStore((s) => s.registrations)
  const sailors = useStore((s) => s.sailors)
  const calendar = useStore((s) => s.calendar)
  const calls = useStore((s) => s.practiceCalls)
  const look = useLookups()
  const now = useNow(60_000)
  const regattas = useKidRegattas()

  const mine = familyRegs(regs, sailors, family.id).filter((r) => r.status === 'confirmed')
  const programIds = new Set(mine.map((r) => look.session.get(r.sessionId)?.programId))
  const days = Array.from({ length: 21 }, (_, i) => addDays(now, i))

  const byDay = days
    .map((d) => {
      const iso = format(d, 'yyyy-MM-dd')
      const items: Item[] = []
      const sessions = new Map<string, string[]>()
      for (const r of mine) {
        const se = look.session.get(r.sessionId)
        if (!se || !meetsOn(se, d)) continue
        // A team's regatta replaces practice that day.
        if (calendar.some((e) => e.kind === 'regatta' && iso >= e.date && iso <= (e.endDate ?? e.date) && e.programIds?.includes(se.programId))) continue
        sessions.set(se.id, [...(sessions.get(se.id) ?? []), look.sailor.get(r.sailorId)!.firstName])
      }
      for (const [sid, who] of sessions) {
        const se = look.session.get(sid)!
        const call = calls.find((c) => c.sessionId === sid && c.date === iso)
        const sat = d.getDay() === 6 || d.getDay() === 0
        const parts = se.time.split('·').map((x) => x.trim())
        const time = (sat ? parts.find((p) => /^Sat|^Weekends/.test(p)) : parts.find((p) => /^Weekdays/.test(p))) ?? parts[0]
        items.push({ key: sid, kind: 'practice', title: programById.get(se.programId)!.name, detail: time.replace(/^(Weekdays|Sat|Weekends)\s*/, ''), who, status: call?.status, note: call?.note })
      }
      for (const r of regattas) {
        if (iso < r.event.date || iso > (r.event.endDate ?? r.event.date)) continue
        const who = [...r.eligible].map((id) => kids.find((k) => k.id === id)!.firstName)
        const answers = [...r.responses.values()].map((x) => x.status)
        items.push({
          key: r.event.id,
          kind: 'regatta',
          title: r.event.title,
          detail: [r.event.time, r.event.location].filter(Boolean).join(', '),
          who,
          note: answers.includes('going') ? 'Going' : answers.includes('interested') ? 'Interested' : 'Not answered yet',
        })
      }
      for (const e of calendar) {
        if (e.kind === 'regatta' || iso < e.date || iso > (e.endDate ?? e.date)) continue
        if (e.programIds?.length && !e.programIds.some((p) => programIds.has(p))) continue
        if (e.kind === 'meeting' || e.kind === 'training') continue
        items.push({ key: e.id, kind: 'event', title: e.title, detail: [e.time, e.location].filter(Boolean).join(', '), who: [] })
      }
      return { d, iso, items }
    })
    .filter((x) => x.items.length)

  return (
    <div className='px-4 py-5'>
      <h1 className='text-2xl font-semibold'>Schedule</h1>
      <p className='text-sm text-muted-foreground'>The next three weeks for {kids.map((k) => k.firstName).join(' and ')}.</p>
      <ol className='mt-5 space-y-5'>
        {byDay.map(({ d, iso, items }) => (
          <li key={iso}>
            <h2 className='mb-2 text-sm font-semibold text-muted-foreground'>
              {iso === format(now, 'yyyy-MM-dd') ? 'Today' : format(d, 'EEEE, MMM d')}
            </h2>
            <ul className='divide-y rounded-xl border bg-card'>
              {items.map((it) => (
                <li key={it.key} className={cn('flex items-start gap-3 px-3 py-2.5', it.kind === 'regatta' && 'bg-brass/5')}>
                  {it.kind === 'practice' ? (
                    it.status ? <Pennant status={it.status} className='mt-0.5 h-4 w-6' /> : <Sailboat className='mt-0.5 size-4 shrink-0 text-muted-foreground' />
                  ) : it.kind === 'regatta' ? (
                    <Trophy className='mt-0.5 size-4 shrink-0 text-brass' />
                  ) : (
                    <MapPin className='mt-0.5 size-4 shrink-0 text-muted-foreground' />
                  )}
                  <span className='min-w-0 flex-1'>
                    <span className='flex items-baseline justify-between gap-2'>
                      <span className='font-medium'>{it.title}</span>
                      {it.kind === 'practice' && <span className='shrink-0 text-sm text-muted-foreground'>{it.detail}</span>}
                    </span>
                    {it.kind !== 'practice' && it.detail && <span className='block text-sm text-muted-foreground'>{it.detail}</span>}
                    {it.who.length > 0 && kids.length > 1 && <span className='block text-xs text-muted-foreground'>{it.who.join(' and ')}</span>}
                    {it.kind === 'practice' && it.status && <span className={cn('block text-sm font-medium', CALL[it.status].text)}>{CALL[it.status].sentence}</span>}
                    {it.kind === 'regatta' && it.note && <span className='block text-sm font-medium text-heading'>{it.note}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  )
}
