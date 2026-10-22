import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { format } from 'date-fns'
import { Check, Send, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { programById, useLookups, useNow } from '@/data/hooks'
import { useStore } from '@/data/store'
import type { Evaluation, Sailor } from '@/domain/types'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Main } from '@/components/layout/main'
import { FleetChip, PageHeader } from '@/components/burgee/marks'
import { EVAL_LABEL, SkillBar, SkillChecklist, skillProgress } from '@/components/burgee/skills'

export function AdminProgress({ session }: { session?: string }) {
  const sessions = useStore((s) => s.sessions)
  const regs = useStore((s) => s.registrations)
  const marks = useStore((s) => s.skillMarks)
  const evaluations = useStore((s) => s.evaluations)
  const groups = useStore((s) => s.groups)
  const send = useStore((s) => s.sendAnnouncement)
  const look = useLookups()
  const navigate = useNavigate()
  const approve = useStore((s) => s.approveEvaluations)
  const saveEvaluation = useStore((s) => s.saveEvaluation)
  const [open, setOpen] = useState<Sailor | null>(null)
  const today = format(useNow(60_000), 'yyyy-MM-dd')

  // This week's sessions (camp weeks running now, or a team term).
  const teams = sessions.filter((s) => s.startDate <= today && s.endDate >= today)
  const sessionId = session && sessions.some((s) => s.id === session) ? session : teams[0]?.id
  const pending = evaluations.filter((e) => e.status === 'pending').sort((a, b) => a.date.localeCompare(b.date))
  const sendBack = (e: Evaluation) => {
    saveEvaluation({ ...e, status: 'draft' })
    toast(`Sent back to ${look.coach.get(e.coachId)?.name.split(' ')[0]} to edit`)
  }
  const roster = regs
    .filter((r) => r.sessionId === sessionId && r.status === 'confirmed')
    .map((r) => look.sailor.get(r.sailorId)!)
    .filter(Boolean)
    .sort((a, b) => a.lastName.localeCompare(b.lastName))
  const rows = roster.map((k) => ({
    k,
    p: skillProgress(k, marks),
    ev: evaluations.filter((e) => e.sailorId === k.id && e.sessionId === sessionId).sort((a, b) => b.date.localeCompare(a.date))[0],
  }))
  const written = rows.filter((r) => r.ev).length
  const coachIds = [...new Set(groups.filter((g) => g.sessionId === sessionId).flatMap((g) => g.coachIds))]

  return (
    <Main>
      <PageHeader
        title='Progress'
        description='Skills coaches tick off on the water. Evaluations reach families only after you approve them.'
        actions={
          <Select value={sessionId} onValueChange={(v) => navigate({ to: '/admin/progress', search: { session: v }, replace: true })}>
            <SelectTrigger className='w-56' aria-label='Team'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {programById.get(t.programId)?.name}, {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      {pending.length > 0 && (
        <section className='mb-6' aria-labelledby='approve'>
          <div className='mb-2 flex flex-wrap items-center justify-between gap-2'>
            <h2 id='approve' className='text-lg font-semibold'>
              Waiting for your approval <span className='text-sm font-normal text-muted-foreground'>{pending.length}</span>
            </h2>
            <Button
              size='sm'
              onClick={() => {
                approve(pending.map((e) => e.id), 'Jordan Hale')
                toast.success(`${pending.length} evaluations shared with families`)
              }}
            >
              <Check className='size-4' /> Approve all {pending.length}
            </Button>
          </div>
          <ul className='grid gap-3 lg:grid-cols-2'>
            {pending.map((e) => {
              const k = look.sailor.get(e.sailorId)
              const se = look.session.get(e.sessionId)
              return (
                <li key={e.id} className='flex flex-col rounded-xl border bg-card p-4 text-sm'>
                  <p className='font-semibold'>
                    {k?.firstName} {k?.lastName}
                  </p>
                  <p className='text-xs text-muted-foreground'>
                    From {look.coach.get(e.coachId)?.name}, {se ? `${programById.get(se.programId)?.name}, ${se.name}` : ''} · {format(new Date(`${e.date}T12:00:00`), 'MMM d')}
                  </p>
                  <p className='mt-2'>
                    <span className='font-medium'>Going well: </span>
                    {e.strengths}
                  </p>
                  <p className='mt-1'>
                    <span className='font-medium'>Working on: </span>
                    {e.workOn}
                  </p>
                  {e.nextStep && (
                    <p className='mt-1'>
                      <span className='font-medium'>Next step: </span>
                      {e.nextStep}
                    </p>
                  )}
                  <div className='mt-3 flex gap-2 pt-1'>
                    <Button
                      size='sm'
                      onClick={() => {
                        approve([e.id], 'Jordan Hale')
                        toast.success(`Shared with the ${k?.lastName} family`)
                      }}
                    >
                      <Check className='size-4' /> Approve and share
                    </Button>
                    <Button size='sm' variant='outline' onClick={() => sendBack(e)}>
                      <Undo2 className='size-4' /> Send back
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}
      <div className='mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-sm'>
        <span>
          <span className='font-semibold'>{written}</span> of {rows.length} evaluations written this season
          {rows.length - written > 0 && <span className='text-muted-foreground'> · {rows.length - written} to go</span>}
        </span>
        {rows.length - written > 0 && (
          <Button
            size='sm'
            variant='outline'
            onClick={() => {
              send({
                title: `${programById.get(look.session.get(sessionId)!.programId)?.name}: evaluations`,
                body: `${rows.length - written} sailors still need a season evaluation. Open the team in Burgee, tap Skills, then a sailor’s name.`,
                category: 'reminder',
                audience: { kind: 'staff' },
                channels: ['push', 'email'],
                sentBy: 'Jordan Hale',
              })
              toast.success(`Reminder sent to ${coachIds.map((id) => look.coach.get(id)?.name.split(' ')[0]).join(', ') || 'coaches'}`)
            }}
          >
            <Send className='size-4' /> Remind coaches
          </Button>
        )}
      </div>
      <div className='overflow-x-auto rounded-xl border bg-card'>
        <table className='w-full min-w-[640px] text-sm'>
          <thead className='border-b text-xs text-muted-foreground'>
            <tr>
              <th className='px-4 py-2 text-start font-medium'>Sailor</th>
              <th className='px-4 py-2 text-start font-medium'>Skills</th>
              <th className='px-4 py-2 text-start font-medium'>Working on</th>
              <th className='px-4 py-2 text-start font-medium'>Evaluation</th>
            </tr>
          </thead>
          <tbody className='divide-y'>
            {rows.map(({ k, p, ev }) => (
              <tr key={k.id} className='cursor-pointer hover:bg-muted/40' onClick={() => setOpen(k)}>
                <td className='px-4 py-2.5'>
                  <button className='text-start font-medium hover:underline' onClick={() => setOpen(k)}>
                    {k.firstName} {k.lastName}
                  </button>
                  <span className='ms-2'>
                    <FleetChip level={k.level} />
                  </span>
                </td>
                <td className='w-48 px-4 py-2.5'>
                  <SkillBar got={p.got} working={p.working.length} total={p.total} />
                  <span className='mt-1 block text-xs text-muted-foreground'>
                    {p.done ? `Ready for ${p.trackInfo.next}` : `${p.got} of ${p.total}`}
                  </span>
                </td>
                <td className='px-4 py-2.5 text-muted-foreground'>{p.working.map((w) => w.name).join(', ') || '—'}</td>
                <td className='px-4 py-2.5'>
                  {ev ? (
                    <span className={cn('text-xs font-medium', ev.status === 'shared' ? 'text-ok' : 'text-signal')}>
                      {ev.status === 'shared' ? `Shared ${format(new Date(`${ev.date}T12:00:00`), 'MMM d')}` : EVAL_LABEL[ev.status]}
                    </span>
                  ) : (
                    <span className='text-xs text-muted-foreground'>Not written</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className='w-full overflow-y-auto sm:max-w-md'>
          {open && (
            <>
              <SheetHeader>
                <SheetTitle>
                  {open.firstName} {open.lastName}
                </SheetTitle>
                <SheetDescription>Tick skills here or from the coach app.</SheetDescription>
              </SheetHeader>
              <div className='space-y-6 px-4 pb-6'>
                <SkillChecklist sailor={open} editableBy='Jordan Hale' />
                {evaluations
                  .filter((e) => e.sailorId === open.id)
                  .map((e) => (
                    <section key={e.id} className='rounded-lg border p-3 text-sm'>
                      <p className='text-xs text-muted-foreground'>
                        {look.coach.get(e.coachId)?.name}, {format(new Date(`${e.date}T12:00:00`), 'MMM d')} · {e.status === 'shared' ? 'Shared with family' : EVAL_LABEL[e.status]}
                      </p>
                      <p className='mt-2 font-medium'>Going well</p>
                      <p>{e.strengths}</p>
                      <p className='mt-2 font-medium'>Working on</p>
                      <p>{e.workOn}</p>
                      {e.nextStep && (
                        <>
                          <p className='mt-2 font-medium'>Next step</p>
                          <p>{e.nextStep}</p>
                        </>
                      )}
                    </section>
                  ))}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </Main>
  )
}
