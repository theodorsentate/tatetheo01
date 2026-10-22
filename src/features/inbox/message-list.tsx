import { useState } from 'react'
import { format, isSameDay } from 'date-fns'
import { CalendarDays, CloudLightning } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Announcement } from '@/domain/types'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/burgee/marks'
import { now as clockNow } from '@/lib/clock'

/** Club updates (announcements), newest first. Tap to expand. */
export function MessageList({
  items,
  empty,
  onReply,
}: {
  items: Announcement[]
  empty: string
  /** Families and sailors can answer a club message; it starts a conversation with whoever sent it. */
  onReply?: (a: Announcement) => void
}) {
  const [open, setOpen] = useState<string | null>(null)
  if (!items.length) return <EmptyState title={empty} className='mx-4' />
  return (
    <ul className='divide-y'>
      {items.map((a) => {
        const expanded = open === a.id
        return (
          <li key={a.id}>
            <button
              className='w-full px-4 py-3 text-start'
              onClick={() => setOpen(expanded ? null : a.id)}
              aria-expanded={expanded}
            >
              <span className='flex items-start gap-2'>
                {a.category === 'weather' ? (
                  <CloudLightning
                    className='mt-0.5 size-4 shrink-0 text-signal'
                    aria-label='Weather'
                  />
                ) : (
                  <CalendarDays
                    className='mt-0.5 size-4 shrink-0 text-muted-foreground'
                    aria-hidden='true'
                  />
                )}
                <span className='min-w-0 flex-1'>
                  <span className='block font-medium'>
                    {a.title}
                    {a.urgent && <span className='ms-2 rounded bg-destructive/10 px-1.5 py-0.5 align-middle text-[11px] font-semibold text-destructive'>Urgent</span>}
                  </span>
                  <span
                    className={cn(
                      'block text-sm text-muted-foreground',
                      !expanded && 'line-clamp-2'
                    )}
                  >
                    {a.body}
                  </span>
                  <span className='mt-1 block text-xs text-muted-foreground'>
                    {a.sentBy},{' '}
                    {isSameDay(new Date(a.sentAt), clockNow())
                      ? format(new Date(a.sentAt), 'h:mm a')
                      : format(new Date(a.sentAt), 'MMM d')}
                  </span>
                </span>
              </span>
            </button>
            {expanded && onReply && (
              <div className='px-4 pb-3 ps-10'>
                <Button size='sm' variant='outline' onClick={() => onReply(a)}>
                  Reply to {a.sentBy.split(' ')[0]}
                </Button>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

