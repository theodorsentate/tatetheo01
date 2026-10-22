import { useState } from 'react'
import { format } from 'date-fns'
import { Check, CircleDashed } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { SKILLS, TRACKS, trackFor } from '@/data/curriculum'
import { useStore } from '@/data/store'
import type { Evaluation, Sailor, SkillMark } from '@/domain/types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

export function skillProgress(sailor: Sailor, marks: SkillMark[]) {
  const track = trackFor(sailor.level)
  const list = SKILLS.filter((k) => k.track === track)
  const mine = new Map(marks.filter((m) => m.sailorId === sailor.id).map((m) => [m.skillId, m]))
  const got = list.filter((k) => mine.get(k.id)?.status === 'got-it').length
  const working = list.filter((k) => mine.get(k.id)?.status === 'working')
  return { track, trackInfo: TRACKS[track], list, mine, got, total: list.length, working, done: got === list.length }
}

/** A thin progress bar for skills: navy for got-it, brass for working on. */
export function SkillBar({ got, working, total, className }: { got: number; working: number; total: number; className?: string }) {
  return (
    <div className={cn('flex h-2 overflow-hidden rounded-full bg-muted', className)} role='img' aria-label={`${got} of ${total} skills, ${working} in progress`}>
      <div className='bg-heading' style={{ width: `${(got / total) * 100}%` }} />
      <div className='bg-brass/60' style={{ width: `${(working / total) * 100}%` }} />
    </div>
  )
}

/**
 * The sailor's skill list for their level. Coaches tap to move a skill from
 * not started → working on → got it. Parents see the same list read-only.
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
          const next: SkillMark['status'] | null = !m ? 'working' : m.status === 'working' ? 'got-it' : null
          const body = (
            <>
              <span
                className={cn(
                  'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border',
                  m?.status === 'got-it' && 'border-heading bg-heading text-white',
                  m?.status === 'working' && 'border-brass text-brass'
                )}
                aria-hidden='true'
              >
                {m?.status === 'got-it' ? <Check className='size-3.5' /> : m?.status === 'working' ? <CircleDashed className='size-3.5' /> : null}
              </span>
              <span className='min-w-0 flex-1'>
                <span className='block text-sm font-medium'>{k.name}</span>
                <span className='block text-xs text-muted-foreground'>{k.detail}</span>
                {m && (
                  <span className={cn('mt-0.5 block text-xs font-medium', m.status === 'got-it' ? 'text-heading' : 'text-brass')}>
                    {m.status === 'got-it' ? 'Got it' : 'Working on it'}, {format(new Date(`${m.date}T12:00:00`), 'MMM d')}
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
                  aria-label={`${k.name}: ${m ? (m.status === 'got-it' ? 'got it' : 'working on it') : 'not started'}. Tap to change.`}
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
      {editableBy && <p className='mt-2 text-xs text-muted-foreground'>Tap a skill: not started → working on it → got it.</p>}
    </div>
  )
}

/** Write or edit a coach evaluation; sharing makes it visible in the family's app. */
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
  const [shared, setShared] = useState(existing?.shared ?? true)
  return (
    <form
      className='grid gap-4'
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        const v = (k: string) => String(fd.get(k) ?? '').trim()
        if (!v('strengths') || !v('workOn')) return toast.error('Add what’s going well and what to work on.')
        save({
          id: existing?.id,
          sailorId: sailor.id,
          sessionId,
          coachId,
          date: format(new Date(), 'yyyy-MM-dd'),
          strengths: v('strengths'),
          workOn: v('workOn'),
          nextStep: v('nextStep'),
          shared,
        })
        toast.success(shared ? `Shared with the ${sailor.lastName} family` : 'Saved as a draft')
        onDone()
      }}
    >
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
      <label className='flex items-center justify-between gap-3 text-sm'>
        <span>
          <span className='block font-medium'>Share with the family</span>
          <span className='text-xs text-muted-foreground'>They’ll see it in their app.</span>
        </span>
        <Switch checked={shared} onCheckedChange={setShared} />
      </label>
      <Button type='submit'>{shared ? 'Share evaluation' : 'Save draft'}</Button>
    </form>
  )
}
