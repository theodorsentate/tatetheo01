import { useState } from 'react'
import { cn } from '@/lib/utils'
import { PERSONAS } from '@/data/catalog'
import { useLookups } from '@/data/hooks'
import type { Announcement, Participant } from '@/domain/types'
import { MessageList } from './message-list'
import { Inbox, NewMessage, useUnreadCount, type Me, type Recipient } from './inbox'

/**
 * The Messages tab on a phone: conversations (two-way) and club updates
 * (announcements, which anyone can reply to).
 */
export function PhoneMessages({
  me,
  recipients,
  updates,
  intro,
  sailorId,
  familyId,
}: {
  me: Me
  recipients: Recipient[]
  updates: Announcement[]
  intro: string
  /** When a sailor replies to a club message, their parents are copied. */
  sailorId?: string
  familyId?: string
}) {
  const [tab, setTab] = useState<'chats' | 'updates'>('chats')
  const [replyTo, setReplyTo] = useState<Announcement | null>(null)
  const unread = useUnreadCount(me.id)
  const look = useLookups()

  // Replying to a club message starts a conversation with whoever sent it.
  const sender: Participant | null = replyTo
    ? replyTo.sentBy === PERSONAS.director.name
      ? 'director'
      : (() => {
          const c = [...look.coach.values()].find((x) => x.name === replyTo.sentBy)
          return c ? (`coach:${c.id}` as Participant) : 'director'
        })()
    : null
  const replyRecipient: Recipient | null =
    replyTo && sender
      ? {
          key: `reply-${replyTo.id}`,
          label: replyTo.sentBy,
          detail: sender === 'director' ? 'Program director' : 'Coach',
          participants: [me.id, sender, ...(sailorId && familyId ? ([`family:${familyId}`] as Participant[]) : [])],
          familyId,
          sailorId,
        }
      : null

  return (
    <div className='py-5'>
      <h1 className='px-4 text-2xl font-semibold'>Messages</h1>
      <p className='px-4 text-sm text-muted-foreground'>{intro}</p>
      <div className='mx-4 mt-3 grid grid-cols-2 rounded-lg bg-muted p-0.5 text-sm' role='tablist' aria-label='Messages'>
        {(
          [
            ['chats', `Conversations${unread ? ` (${unread})` : ''}`],
            ['updates', 'Club updates'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role='tab'
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn('rounded-md py-1.5 text-muted-foreground', tab === id && 'bg-card font-medium text-foreground shadow-sm')}
          >
            {label}
          </button>
        ))}
      </div>
      <div className='mt-2'>
        {tab === 'chats' ? (
          <Inbox me={me} recipients={recipients} layout='phone' />
        ) : (
          <MessageList items={updates} empty='No club updates yet' onReply={(a) => setReplyTo(a)} />
        )}
      </div>
      {replyRecipient && (
        <NewMessage
          open={!!replyTo}
          onClose={() => setReplyTo(null)}
          me={me}
          recipients={[replyRecipient]}
          initial={{ recipientKey: replyRecipient.key, subject: `Re: ${replyTo!.title}`, announcementId: replyTo!.id }}
          onSent={() => {
            setReplyTo(null)
            setTab('chats')
          }}
        />
      )}
    </div>
  )
}
