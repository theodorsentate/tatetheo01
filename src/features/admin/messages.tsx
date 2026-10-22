import { useEffect, useMemo, useState } from 'react'
import { format, formatDistanceStrict } from 'date-fns'
import { CloudLightning, Mail, MessageSquare, Send } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { PROGRAMS } from '@/data/catalog'
import { programById, useLookups } from '@/data/hooks'
import { audienceFamilyIds, useStore } from '@/data/store'
import type { Announcement, Audience, Channel } from '@/domain/types'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/burgee/marks'
import { useAsk } from '@/assistant/ask-store'
import { now as clockNow } from '@/lib/clock'

const TEMPLATES: { id: Announcement['category']; label: string; title: string; body: string }[] = [
  {
    id: 'weather',
    label: 'Weather call',
    title: 'Today’s sailing is cancelled — weather',
    body: 'Winds are forecast above our limit for junior programs this afternoon, so we are keeping everyone off the water. Sailors already at the club will do a chalk talk in the junior room until pickup. We will share make-up details soon.',
  },
  {
    id: 'schedule',
    label: 'Schedule change',
    title: 'Schedule change',
    body: 'A quick update on timing: ',
  },
  {
    id: 'reminder',
    label: 'Reminder',
    title: 'Reminder',
    body: '',
  },
  { id: 'general', label: 'Blank message', title: '', body: '' },
]

export function audienceLabel(a: Audience, look: ReturnType<typeof useLookups>): string {
  switch (a.kind) {
    case 'everyone':
      return 'All families'
    case 'program':
      return programById.get(a.programId)?.name ?? 'Program'
    case 'session': {
      const s = look.session.get(a.sessionId)
      return s ? `${programById.get(s.programId)?.name}, ${s.name}` : 'Session'
    }
    case 'group':
      return 'One group'
    case 'staff':
      return 'Coaches & staff'
    case 'outstanding-forms':
      return 'Families with forms due'
    case 'waitlisted':
      return 'Families on a waitlist'
    case 'families':
      return a.label
  }
}

const encode = (a: Audience) => JSON.stringify(a)

export function AdminMessages({ sessionId }: { sessionId?: string }) {
  const state = useStore()
  const look = useLookups()
  // A draft written by Ask Burgee arrives pre-filled, for review before sending.
  const [draft] = useState(() => useAsk.getState().draft)
  useEffect(() => {
    if (draft) useAsk.getState().set({ draft: undefined })
  }, [draft])
  const [audience, setAudience] = useState<Audience>(draft?.audience ?? (sessionId ? { kind: 'session', sessionId } : { kind: 'everyone' }))
  // Everyone gets an app notification and an email; urgent messages also go out by text.
  const [urgent, setUrgent] = useState<boolean>(draft ? draft.channels.includes('sms') : false)
  const channels: Channel[] = urgent ? ['push', 'email', 'sms'] : ['push', 'email']
  const [category, setCategory] = useState<Announcement['category']>(draft?.category ?? 'general')
  const [title, setTitle] = useState(draft?.title ?? '')
  const [body, setBody] = useState(draft?.body ?? '')

  const recipients = useMemo(
    () => (audience.kind === 'staff' ? state.coaches.length : audienceFamilyIds(audience, state, state.settings.season).length),
    [audience, state]
  )
  const smsText = `${state.settings.shortName} Juniors: ${title || 'Your message title'}. Details: burgee.app/m/7Qx`
  const smsReach = useMemo(() => {
    if (audience.kind === 'staff') return state.coaches.length
    const ids = new Set(audienceFamilyIds(audience, state, state.settings.season))
    return state.families.filter((f) => ids.has(f.id) && f.guardians.some((g) => g.smsOptIn)).length
  }, [audience, state])

  const activeSessions = state.sessions.filter((s) => s.termId !== 'spring-27')

  const send = () => {
    if (!title.trim() || !body.trim()) {
      toast.error('Add a subject and a message before sending.')
      return
    }
    const n = state.sendAnnouncement({ title, body, category, audience, channels, urgent, sentBy: 'Jordan Hale' })
    toast.success(`Sent to ${n} ${audience.kind === 'staff' ? 'staff' : 'families'}`)
    setTitle('')
    setBody('')
    setCategory('general')
    setUrgent(false)
  }

  return (
    <Main>
      <PageHeader
        title='Announcements'
        description='Tell families by team, week or everyone. They get an app notification and an email; mark it urgent to text them too.'
      />
      {draft && (
        <p className='mb-4 rounded-lg border border-signal/40 bg-signal-soft px-4 py-2.5 text-sm'>
          Ask Burgee drafted this message. Check the audience and wording, then send it yourself.
        </p>
      )}
      <div className='grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]'>
        <section className='rounded-lg border bg-card p-5' aria-labelledby='compose'>
          <h2 id='compose' className='sr-only'>
            New message
          </h2>
          <div className='mb-5 flex flex-wrap gap-2'>
            {TEMPLATES.map((t) => (
              <Button
                key={t.id}
                variant={category === t.id ? 'default' : 'outline'}
                size='sm'
                onClick={() => {
                  setCategory(t.id)
                  setTitle(t.title)
                  setBody(t.body)
                  setUrgent(t.id === 'weather')
                }}
              >
                {t.id === 'weather' && <CloudLightning className='size-4' />}
                {t.label}
              </Button>
            ))}
          </div>
          <div className='grid gap-4'>
            <div className='grid gap-1.5'>
              <Label htmlFor='audience'>To</Label>
              <Select value={encode(audience)} onValueChange={(v) => setAudience(JSON.parse(v))}>
                <SelectTrigger id='audience' className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className='max-h-80'>
                  <SelectGroup>
                    <SelectItem value={encode({ kind: 'everyone' })}>All families</SelectItem>
                    <SelectItem value={encode({ kind: 'outstanding-forms' })}>Families with forms due</SelectItem>
                    <SelectItem value={encode({ kind: 'staff' })}>Coaches & staff</SelectItem>
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Programs</SelectLabel>
                    {PROGRAMS.map((p) => (
                      <SelectItem key={p.id} value={encode({ kind: 'program', programId: p.id })}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Single session</SelectLabel>
                    {(sessionId && !activeSessions.some((s) => s.id === sessionId)
                      ? [look.session.get(sessionId)!, ...activeSessions]
                      : activeSessions
                    ).map((s) => (
                      <SelectItem key={s.id} value={encode({ kind: 'session', sessionId: s.id })}>
                        {programById.get(s.programId)?.name}, {s.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <p className='text-xs text-muted-foreground'>
                Reaches {recipients} {audience.kind === 'staff' ? 'staff' : 'families'}
                {channels.includes('sms') && `, ${smsReach} by text`}.
              </p>
            </div>
            <label className='flex items-start gap-3 rounded-md border px-3 py-2.5'>
              <Switch checked={urgent} onCheckedChange={setUrgent} className='mt-0.5' />
              <span className='text-sm'>
                <span className='block font-medium'>Urgent: also send a text</span>
                <span className='text-xs text-muted-foreground'>For weather calls and same-day changes. Everything else is an app notification and an email.</span>
              </span>
            </label>
            <div className='grid gap-1.5'>
              <Label htmlFor='subject'>Subject</Label>
              <Input id='subject' value={title} onChange={(e) => setTitle(e.target.value)} placeholder='Saturday practice moves to 10 AM' />
            </div>
            <div className='grid gap-1.5'>
              <Label htmlFor='body'>Message</Label>
              <Textarea id='body' rows={7} value={body} onChange={(e) => setBody(e.target.value)} placeholder='What families need to know, and what they should do.' />
            </div>
            <div className='flex justify-end'>
              <Button onClick={send}>
                <Send className='size-4' /> Send to {recipients} {audience.kind === 'staff' ? 'staff' : 'families'}
              </Button>
            </div>
          </div>
        </section>

        <aside className='space-y-4' aria-label='Preview'>
          {channels.includes('sms') && (
            <div className='rounded-lg border bg-card p-4'>
              <p className='mb-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground'>
                <MessageSquare className='size-3.5' /> Text preview
              </p>
              <div className='max-w-[85%] rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm'>{smsText}</div>
              <p className='mt-2 text-xs text-muted-foreground'>{smsText.length} characters. The full message opens from the link.</p>
            </div>
          )}
          {channels.includes('email') && (
            <div className='rounded-lg border bg-card p-4'>
              <p className='mb-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground'>
                <Mail className='size-3.5' /> Email preview
              </p>
              <p className='text-xs text-muted-foreground'>From {state.settings.clubName} Juniors</p>
              <p className='mt-1 font-semibold'>{title || 'Subject'}</p>
              <p className='mt-2 text-sm whitespace-pre-line text-muted-foreground'>{body || 'Your message appears here.'}</p>
            </div>
          )}
        </aside>
      </div>

      <section className='mt-10' aria-labelledby='sent'>
        <h2 id='sent' className='mb-3 text-lg font-semibold'>
          Sent
        </h2>
        <ul className='divide-y rounded-lg border bg-card'>
          {state.announcements.map((a) => (
            <li key={a.id} className='grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-6'>
              <div className='min-w-0'>
                <p className='flex flex-wrap items-center gap-2 font-medium'>
                  {a.category === 'weather' && <CloudLightning className='size-4 text-signal' aria-label='Weather' />}
                  {a.title}
                  {a.urgent && <span className='rounded bg-destructive/10 px-1.5 py-0.5 text-[11px] font-semibold text-destructive'>Urgent</span>}
                </p>
                <p className='line-clamp-1 text-sm text-muted-foreground'>{a.body}</p>
                <p className='mt-1 text-xs text-muted-foreground'>
                  {audienceLabel(a.audience, look)}, by {a.channels.map((c) => (c === 'sms' ? 'text' : c === 'push' ? 'app' : c)).join(', ')}. Sent by {a.sentBy}.
                </p>
              </div>
              <div className='text-sm sm:text-end'>
                <time dateTime={a.sentAt} title={format(new Date(a.sentAt), 'PPpp')} className='text-muted-foreground'>
                  {formatDistanceStrict(new Date(a.sentAt), clockNow(), { addSuffix: true })}
                </time>
                <p className={cn('text-xs', a.opened ? 'text-foreground' : 'text-muted-foreground')}>
                  {a.opened ? `${Math.round((a.opened / a.recipients) * 100)}% opened of ${a.recipients}` : `Delivering to ${a.recipients}`}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </Main>
  )
}
