import { format } from 'date-fns'
import { ShieldCheck, Trophy, Waves } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PERSONAS } from '@/data/catalog'
import { programById, useLookups, useNow } from '@/data/hooks'
import { useStore } from '@/data/store'
import { meetsOn } from '@/domain/attendance'
import { CALL, Pennant } from '@/components/burgee/practice'
import { SkillChecklist } from '@/components/burgee/skills'
import { currentGroups, useSailorRecipients } from '@/features/inbox/inbox'
import { PhoneMessages } from '@/features/inbox/messages-screen'
import { useFamilyMessages } from '@/features/family/home'

function useMe() {
  const look = useLookups()
  return look.sailor.get(PERSONAS.sailorId)!
}

/**
 * An older sailor's own login: today's call and plan, their skills and
 * evaluation, regattas, and messages with their coaches (parents copied).
 */
export function SailorHome() {
  const me = useMe()
  const look = useLookups()
  const now = useNow()
  const groups = useStore((s) => s.groups)
  const calls = useStore((s) => s.practiceCalls)
  const plans = useStore((s) => s.lessonPlans)
  const attendance = useStore((s) => s.attendance)
  const evaluations = useStore((s) => s.evaluations)
  const calendar = useStore((s) => s.calendar)
  const responses = useStore((s) => s.regattaResponses)
  const regattas = useStore((s) => s.regattas)
  const today = format(now, 'yyyy-MM-dd')
  const group = currentGroups(groups, look, today).find((g) => g.sailorIds.includes(me.id))
  const session = group ? look.session.get(group.sessionId) : undefined
  const program = session ? programById.get(session.programId) : undefined
  const sailingToday = !!session && meetsOn(session, now)
  const call = session && calls.find((c) => c.sessionId === session.id && c.date === today)
  const plan = session && plans.find((p) => p.sessionId === session.id && p.date === today && (!p.groupId || p.groupId === group?.id))
  const live = Object.values(attendance)
    .filter((e) => e.sailorId === me.id && e.date === today)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
  const evaluation = evaluations.filter((e) => e.sailorId === me.id && e.status === 'shared').sort((a, b) => b.date.localeCompare(a.date))[0]
  const myRegattas = regattas
    .map((d) => ({ d, e: calendar.find((x) => x.id === d.eventId)! }))
    .filter((x) => x.e && x.e.date >= today && responses.some((r) => r.eventId === x.e.id && r.sailorId === me.id))
    .sort((a, b) => a.e.date.localeCompare(b.e.date))

  return (
    <div className='px-4 py-5'>
      <p className='text-sm text-muted-foreground'>{format(now, 'EEEE, MMMM d')}</p>
      <h1 className='mt-0.5 text-2xl font-semibold'>Hi, {me.firstName}</h1>

      <section className={cn('mt-4 overflow-hidden rounded-2xl border', sailingToday && call ? CALL[call.status].soft : 'bg-card')} aria-label='Today'>
        <div className='flex items-start gap-3 p-4'>
          <Pennant status={sailingToday ? (call?.status ?? 'none') : 'none'} className='mt-0.5 h-8 w-12' />
          <div className='min-w-0 flex-1'>
            <p className={cn('font-display text-xl leading-tight font-semibold', call && CALL[call.status].text)}>
              {sailingToday ? (call ? CALL[call.status].sentence : 'Sailing today') : 'No sailing today'}
            </p>
            {session && program && (
              <p className='text-sm text-muted-foreground'>
                {program.name}, {session.time}. {group?.name} with {group?.coachIds.map((c) => look.coach.get(c)?.name.split(' ')[0]).join(' & ')}
              </p>
            )}
            {call?.note && <p className='mt-1.5 text-sm'>{call.note}</p>}
          </div>
        </div>
        {live?.status === 'on-water' && (
          <p className='flex items-center gap-2 border-t bg-signal-soft px-4 py-2.5 text-sm font-medium text-signal'>
            <Waves className='size-4' /> You’re checked out on the water
          </p>
        )}
        {plan && (
          <div className='border-t bg-card/70 px-4 py-3 text-sm'>
            <p className='text-xs font-medium text-muted-foreground'>Today’s plan</p>
            <p className='font-medium'>{plan.title}</p>
            <p className='text-muted-foreground'>{plan.focus}</p>
          </div>
        )}
      </section>

      {myRegattas.length > 0 && (
        <section className='mt-6' aria-labelledby='regattas'>
          <h2 id='regattas' className='mb-2 text-lg font-semibold'>
            Your regattas
          </h2>
          <ul className='divide-y rounded-xl border bg-card'>
            {myRegattas.map(({ e }) => {
              const r = responses.find((x) => x.eventId === e.id && x.sailorId === me.id)!
              return (
                <li key={e.id} className='flex items-start gap-3 p-4'>
                  <Trophy className='mt-0.5 size-5 shrink-0 text-brass' />
                  <div className='min-w-0 flex-1'>
                    <p className='font-medium'>{e.title}</p>
                    <p className='text-sm text-muted-foreground'>
                      {format(new Date(`${e.date}T12:00:00`), 'EEE, MMM d')}
                      {e.location ? `, ${e.location}` : ''}
                    </p>
                  </div>
                  <span className={cn('text-sm font-medium', r.status === 'going' ? 'text-ok' : 'text-muted-foreground')}>
                    {r.status === 'going' ? 'Going' : r.status === 'interested' ? 'Interested' : 'Not going'}
                  </span>
                </li>
              )
            })}
          </ul>
          <p className='mt-1.5 text-xs text-muted-foreground'>Your parents answer for you in their app.</p>
        </section>
      )}

      {evaluation && (
        <section className='mt-6' aria-labelledby='eval'>
          <h2 id='eval' className='mb-2 text-lg font-semibold'>
            From {look.coach.get(evaluation.coachId)?.name.split(' ')[0]}
          </h2>
          <div className='space-y-2 rounded-xl border bg-card p-4 text-sm'>
            <p>
              <span className='font-medium'>Going well: </span>
              {evaluation.strengths}
            </p>
            <p>
              <span className='font-medium'>Work on: </span>
              {evaluation.workOn}
            </p>
            {evaluation.nextStep && (
              <p>
                <span className='font-medium'>Next: </span>
                {evaluation.nextStep}
              </p>
            )}
          </div>
        </section>
      )}

      <section className='mt-6' aria-labelledby='skills'>
        <h2 id='skills' className='mb-2 text-lg font-semibold'>
          Your skills
        </h2>
        <div className='rounded-xl border bg-card p-4'>
          <SkillChecklist sailor={me} />
        </div>
      </section>

      <p className='mt-6 flex items-start gap-2 rounded-xl bg-muted px-4 py-3 text-xs text-muted-foreground'>
        <ShieldCheck className='mt-0.5 size-4 shrink-0 text-ok' />
        Your parents can see your messages with coaches. That’s a SafeSport rule for every youth sport, and it keeps everyone on the same page.
      </p>
    </div>
  )
}

export function SailorMessages() {
  const me = useMe()
  const announcements = useStore((s) => s.announcements)
  const recipients = useSailorRecipients(me.id)
  const updates = useFamilyMessages(announcements, me.familyId).filter((a) => a.audience.kind !== 'outstanding-forms')
  return (
    <PhoneMessages
      me={{ id: `sailor:${me.id}`, name: `${me.firstName} ${me.lastName}` }}
      recipients={recipients}
      updates={updates}
      intro='Message your coaches. Your parents are copied on every conversation.'
      sailorId={me.id}
      familyId={me.familyId}
    />
  )
}
