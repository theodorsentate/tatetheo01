import { format } from 'date-fns'
import { Check, CircleDashed, CircleDot } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { SKILLS, TRACKS, trackFor } from '@/data/curriculum'
import { useStore } from '@/data/store'
import type { Evaluation, Sailor, SkillMark } from '@/domain/types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { now as clockNow } from '@/lib/clock'

export const EVAL_LABEL: Record<Evaluation['status'], string> = {
  draft: 'Draft',
  pending: 'Waiting for approval',
  shared: 'Shared with family',
}

/** US Sailing Skill Up's three steps. */
export const SKILL_STATUS_LABEL: Record<SkillMark['status'], string> = {
  introduced: 'Introduced',
  working: 'In progress',
  'got-it': 'Completed',
}

export function skillProgress(sailor: Sailor, marks: SkillMark[]) {
  const track = trackFor(sailor.level)
  const list = SKILLS.filter((k) => k.track === track)
  const mine = new Map(marks.filter((m) => m.sailorId === sailor.id).map((m) => [m.skillId, m]))
  const got = list.filter((k) => mine.get(k.id)?.status === 'got-it').length
  const working = list.filter((k) => {
    const st = mine.get(k.id)?.status
    return st === 'working' || st === 'introduced'
  })
  return { track, trackInfo: TRACKS[track], list, mine, got, total: list.length, working, done: got === list.length }
}

/** A thin progress bar for skills: navy for completed, brass for introduced or in progress. */
export function SkillBar({ got, working, total, className }: { got: number; working: number; total: number; className?: string }) {
  return (
    <div className={cn('flex h-2 overflow-hidden rounded-full bg-muted', className)} role='img' aria-label={`${got} of ${total} skills, ${working} in progress`}>
      <div className='bg-heading' style={{ width: `${(got / total) * 100}%` }} />
      <div className='bg-brass/60' style={{ width: `${(working / total) * 100}%` }} />
    </div>
  )
}

/**
 * The sailor's skill list for their level, marked the way US Sailing Skill Up
 * does: Introduced → In progress → Completed. Coaches tap to move a skill
 * along; parents see the same list read-only.
 */
export function SkillChecklist({ sailor, editableBy }: { sailor: Sailor; editableBy?: string }) {
  const marks = useStore((s) => s.skillMarks)
  const mark = useStore((s) => s.markSkill)
  const p = skillProgress(sailor, marks)
  return (
    <div>
      <div className='flex items-baseline justify-between gap-2'>
        <p className='text-sm font-medium'>{p.trackInfo.name}</p>
        <p className='text-sm text-muted-foreground'>
          {p.got} of {p.total}
        </p>
      </div>
      <SkillBar got={p.got} working={p.working.length} total={p.total} className='mt-2' />
      <ul className='mt-3 divide-y rounded-lg border'>
        {p.list.map((k) => {
          const m = p.mine.get(k.id)
          const next: SkillMark['status'] | null = !m ? 'introduced' : m.status === 'introduced' ? 'working' : m.status === 'working' ? 'got-it' : null
          const body = (
            <>
              <span
                className={cn(
                  'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border',
                  m?.status === 'got-it' && 'border-heading bg-heading text-white',
                  m?.status === 'working' && 'border-brass text-brass',
                  m?.status === 'introduced' && 'border-muted-foreground/50 text-muted-foreground'
                )}
                aria-hidden='true'
              >
                {m?.status === 'got-it' ? <Check className='size-3.5' /> : m?.status === 'working' ? <CircleDashed className='size-3.5' /> : m?.status === 'introduced' ? <CircleDot className='size-3' /> : null}
              </span>
              <span className='min-w-0 flex-1'>
                <span className='block text-sm font-medium'>{k.name}</span>
                <span className='block text-xs text-muted-foreground'>{k.detail}</span>
                {m && (
                  <span className={cn('mt-0.5 block text-xs font-medium', m.status === 'got-it' ? 'text-heading' : m.status === 'working' ? 'text-brass' : 'text-muted-foreground')}>
                    {SKILL_STATUS_LABEL[m.status]}, {format(new Date(`${m.date}T12:00:00`), 'MMM d')}
                  </span>
                )}
              </span>
            </>
          )
          return (
            <li key={k.id}>
              {editableBy ? (
                <button
                  className='flex w-full gap-3 px-3 py-2.5 text-start hover:bg-muted/40'
                  onClick={() => mark(sailor.id, k.id, next, editableBy)}
                  aria-label={`${k.name}: ${m ? SKILL_STATUS_LABEL[m.status].toLowerCase() : 'not started'}. Tap to change.`}
                >
                  {body}
                </button>
              ) : (
                <div className='flex gap-3 px-3 py-2.5'>{body}</div>
              )}
            </li>
          )
        })}
      </ul>
      {editableBy && <p className='mt-2 text-xs text-muted-foreground'>Tap a skill to move it along: Introduced → In progress → Completed, the same steps as US Sailing Skill Up.</p>}
    </div>
  )
}

/** Write or edit a coach evaluation. The director approves it before the family sees it. */
export function EvaluationForm({
  sailor,
  sessionId,
  coachId,
  existing,
  onDone,
}: {
  sailor: Sailor
  sessionId: string
  coachId: string
  existing?: Evaluation
  onDone: () => void
}) {
  const save = useStore((s) => s.saveEvaluation)
  const locked = existing?.status === 'shared'
  return (
    <form
      className='grid gap-4'
      onSubmit={(e) => {
        e.preventDefault()
        // Which button sent the form decides whether it goes to the director.
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
        const status: 'draft' | 'pending' = submitter?.value === 'draft' ? 'draft' : 'pending'
        const fd = new FormData(e.currentTarget)
        const v = (k: string) => String(fd.get(k) ?? '').trim()
        if (!v('strengths') || !v('workOn')) return toast.error('Add what’s going well and what to work on.')
        save({
          id: existing?.id,
          sailorId: sailor.id,
          sessionId,
          coachId,
          date: format(clockNow(), 'yyyy-MM-dd'),
          strengths: v('strengths'),
          workOn: v('workOn'),
          nextStep: v('nextStep'),
          status,
        })
        toast.success(status === 'pending' ? 'Sent to the director to approve' : 'Saved as a draft')
        onDone()
      }}
    >
      {locked && (
        <p className='rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground'>
          The family can already see this one. Saving changes sends it back to the director to approve.
        </p>
      )}
      <div className='grid gap-1.5'>
        <Label htmlFor='ev-strengths'>What’s going well</Label>
        <Textarea id='ev-strengths' name='strengths' rows={3} defaultValue={existing?.strengths} placeholder={`${sailor.firstName} has…`} />
      </div>
      <div className='grid gap-1.5'>
        <Label htmlFor='ev-work'>What to work on</Label>
        <Textarea id='ev-work' name='workOn' rows={3} defaultValue={existing?.workOn} />
      </div>
      <div className='grid gap-1.5'>
        <Label htmlFor='ev-next'>Next step</Label>
        <Textarea id='ev-next' name='nextStep' rows={2} defaultValue={existing?.nextStep} placeholder='Ready for…' />
      </div>
      <div className='grid grid-cols-2 gap-2'>
        <Button type='submit' name='intent' value='draft' variant='outline'>
          Save draft
        </Button>
        <Button type='submit' name='intent' value='pending'>
          Send for approval
        </Button>
      </div>
      <p className='text-xs text-muted-foreground'>The director reads every evaluation before it reaches the family.</p>
    </form>
  )
}
