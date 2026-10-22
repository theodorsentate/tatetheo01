import { useState } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { programById } from '@/data/hooks'
import { useStore } from '@/data/store'
import { meetsOn } from '@/domain/attendance'
import type { PracticeCall, Session } from '@/domain/types'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export type CallStatus = PracticeCall['status']

export const CALL: Record<CallStatus, { label: string; sentence: string; fill: string; soft: string; text: string }> = {
  on: { label: 'On', sentence: 'Practice is on', fill: 'var(--ok)', soft: 'bg-ok-soft', text: 'text-ok' },
  delayed: { label: 'Delayed', sentence: 'Practice is delayed', fill: 'var(--signal)', soft: 'bg-signal-soft', text: 'text-signal' },
  cancelled: { label: 'Cancelled', sentence: 'Practice is cancelled', fill: 'var(--destructive)', soft: 'bg-destructive/10', text: 'text-destructive' },
}

const DEFAULT_NOTE: Record<CallStatus, string> = {
  on: 'Practice is on. See you at the dock.',
  delayed: 'Thunderstorms nearby. We’re holding ashore for 30 minutes and will post an update by 4:30.',
  cancelled: 'Small craft advisory this afternoon. Practice is cancelled. See you next practice.',
}

/** A swallowtail pennant in the status color: the one loud thing on a practice day. */
export function Pennant({ status, className }: { status: CallStatus | 'none'; className?: string }) {
  const fill = status === 'none' ? 'var(--muted-foreground)' : CALL[status].fill
  return (
    <svg viewBox='0 0 40 28' className={cn('shrink-0', className)} aria-hidden='true'>
      <rect x='0' y='0' width='2.5' height='28' rx='1' fill='var(--heading)' />
      <path d='M2.5 2 H38 L29 13 L38 24 H2.5 Z' fill={fill} />
    </svg>
  )
}

/** Sessions that meet today (fall teams in this demo). */
export function sessionsOn(sessions: Session[], date: Date) {
  return sessions.filter((s) => meetsOn(s, date))
}

export function useCallFor(sessionId: string, date: string) {
  return useStore((s) => s.practiceCalls.find((c) => c.sessionId === sessionId && c.date === date))
}

/** Pick sessions, a status and a note; sends a text + email to every family on those teams. */
export function PracticeCallDialog({
  open,
  onClose,
  sessions,
  initial,
  by,
}: {
  open: boolean
  onClose: () => void
  sessions: Session[]
  initial: { status: CallStatus; sessionIds: string[] }
  by: string
}) {
  const call = useStore((s) => s.callPractice)
  const [status, setStatus] = useState<CallStatus>(initial.status)
  const [ids, setIds] = useState<string[]>(initial.sessionIds)
  const [note, setNote] = useState(DEFAULT_NOTE[initial.status])
  const [key, setKey] = useState('')
  const k = `${open}-${initial.status}-${initial.sessionIds.join()}`
  if (k !== key) {
    setKey(k)
    setStatus(initial.status)
    setIds(initial.sessionIds)
    setNote(DEFAULT_NOTE[initial.status])
  }
  const today = format(new Date(), 'yyyy-MM-dd')
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Make the call for today</DialogTitle>
          <DialogDescription>Families get a text and an email, and it shows at the top of their app.</DialogDescription>
        </DialogHeader>
        <div className='grid grid-cols-3 gap-2' role='radiogroup' aria-label='Practice status'>
          {(Object.keys(CALL) as CallStatus[]).map((st) => (
            <button
              key={st}
              type='button'
              role='radio'
              aria-checked={status === st}
              onClick={() => {
                setStatus(st)
                setNote(DEFAULT_NOTE[st])
              }}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-sm font-medium transition-colors',
                status === st ? cn('border-transparent ring-2', CALL[st].soft, CALL[st].text) : 'hover:bg-muted'
              )}
              style={status === st ? ({ '--tw-ring-color': CALL[st].fill } as React.CSSProperties) : undefined}
            >
              <Pennant status={st} className='h-5 w-7' />
              {CALL[st].label}
            </button>
          ))}
        </div>
        {sessions.length > 1 && (
          <fieldset className='grid gap-2'>
            <legend className='mb-1 text-sm font-medium'>Teams</legend>
            {sessions.map((s) => (
              <label key={s.id} className='flex items-center gap-2 text-sm'>
                <Checkbox checked={ids.includes(s.id)} onCheckedChange={(v) => setIds(v ? [...ids, s.id] : ids.filter((x) => x !== s.id))} />
                {programById.get(s.programId)?.name}
              </label>
            ))}
          </fieldset>
        )}
        <div className='grid gap-1.5'>
          <Label htmlFor='call-note'>Message</Label>
          <Textarea id='call-note' value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!ids.length}
            onClick={() => {
              const n = call(ids, today, status, note.trim(), by)
              toast.success(`${CALL[status].sentence}. Sent to ${n} famil${n === 1 ? 'y' : 'ies'}.`)
              onClose()
            }}
          >
            Send to families
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
