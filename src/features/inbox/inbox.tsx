import { useEffect, useMemo, useRef, useState } from 'react'
import { format, isSameDay } from 'date-fns'
import { ArrowLeft, PenSquare, Search, Send, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { PERSONAS } from '@/data/catalog'
import { useLookups, useNow } from '@/data/hooks'
import { useStore } from '@/data/store'
import type { Group, Participant, Thread } from '@/domain/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState, Initials } from '@/components/burgee/marks'

/**
 * Conversations between families, coaches, the director and older sailors.
 *
 * SafeSport's rule for youth sports: an adult's messages to a minor stay open
 * and transparent, with a parent copied. Burgee enforces it: any conversation
 * that includes a sailor always includes that sailor's family, and nobody can
 * remove them.
 */

export type Me = { id: Participant; name: string }

export type Recipient = {
  key: string
  label: string
  detail?: string
  participants: Participant[]
  familyId?: string
  sailorId?: string
}

type Look = ReturnType<typeof useLookups>

export function participantName(p: Participant, look: Look): string {
  if (p === 'director') return PERSONAS.director.name
  const [kind, id] = p.split(':')
  if (kind === 'coach') return look.coach.get(id)?.name ?? 'Former coach'
  if (kind === 'family') return `${look.family.get(id)?.name ?? ''} family`
  if (kind === 'sailor') {
    const k = look.sailor.get(id)
    return k ? `${k.firstName} ${k.lastName}` : 'Sailor'
  }
  return p
}

export function participantRole(p: Participant, look: Look): string {
  if (p === 'director') return 'Program director'
  const [kind, id] = p.split(':')
  if (kind === 'coach') return 'Coach'
  if (kind === 'family') return look.family.get(id)?.guardians.map((g) => g.name.split(' ')[0]).join(' & ') ?? 'Family'
  if (kind === 'sailor') return 'Sailor'
  return ''
}

/** Adds the sailor's family to any conversation that includes a sailor (SafeSport). */
export function withParentsCopied(participants: Participant[], look: Look): Participant[] {
  const out = new Set(participants)
  for (const p of participants) {
    if (p.startsWith('sailor:')) {
      const famId = look.sailor.get(p.slice(7))?.familyId
      if (famId) out.add(`family:${famId}`)
    }
  }
  return [...out]
}

const last = (t: Thread) => t.messages[t.messages.length - 1]

export function isUnread(t: Thread, me: Participant) {
  const m = last(t)
  if (!m || m.from === me) return false
  const seen = t.reads[me]
  return !seen || seen < m.at
}

export function useThreads(me: Participant, all = false) {
  const threads = useStore((s) => s.threads)
  return useMemo(
    () =>
      threads
        .filter((t) => all || t.participants.includes(me))
        .sort((a, b) => last(b).at.localeCompare(last(a).at)),
    [threads, me, all]
  )
}

export function useUnreadCount(me: Participant) {
  const threads = useThreads(me)
  return threads.filter((t) => isUnread(t, me)).length
}

function when(iso: string, now: Date) {
  const d = new Date(iso)
  return isSameDay(d, now) ? format(d, 'h:mm a') : format(d, 'MMM d')
}

/* ───────────── Who each person can write to ───────────── */

/** Groups whose session is running this week (or the team session for the term). */
export function currentGroups(groups: Group[], look: Look, today: string) {
  return groups.filter((g) => {
    const se = look.session.get(g.sessionId)
    return se && se.startDate <= today && se.endDate >= today
  })
}

export function useFamilyRecipients(familyId: string): Recipient[] {
  const groups = useStore((s) => s.groups)
  const sailors = useStore((s) => s.sailors)
  const look = useLookups()
  const today = format(useNow(60_000), 'yyyy-MM-dd')
  return useMemo(() => {
    const me: Participant = `family:${familyId}`
    const out: Recipient[] = [{ key: 'director', label: PERSONAS.director.name, detail: 'Program director', participants: [me, 'director'] }]
    const kids = sailors.filter((k) => k.familyId === familyId)
    const seen = new Set<string>()
    for (const k of kids) {
      for (const g of currentGroups(groups, look, today).filter((x) => x.sailorIds.includes(k.id))) {
        for (const cid of g.coachIds) {
          if (seen.has(cid + k.id)) continue
          seen.add(cid + k.id)
          const c = look.coach.get(cid)
          if (!c) continue
          const prog = look.program.get(look.session.get(g.sessionId)!.programId)
          out.push({ key: `${cid}-${k.id}`, label: c.name, detail: `${k.firstName}’s coach, ${prog?.name}`, participants: [me, `coach:${cid}`], familyId, sailorId: k.id })
        }
      }
    }
    return out
  }, [familyId, groups, sailors, look, today])
}

export function useCoachRecipients(coachId: string): Recipient[] {
  const groups = useStore((s) => s.groups)
  const look = useLookups()
  const today = format(useNow(60_000), 'yyyy-MM-dd')
  return useMemo(() => {
    const me: Participant = `coach:${coachId}`
    const out: Recipient[] = [{ key: 'director', label: PERSONAS.director.name, detail: 'Program director', participants: [me, 'director'] }]
    const mine = currentGroups(groups, look, today).filter((g) => g.coachIds.includes(coachId))
    const seen = new Set<string>()
    for (const g of mine) {
      for (const sid of g.sailorIds) {
        if (seen.has(sid)) continue
        seen.add(sid)
        const k = look.sailor.get(sid)
        if (!k) continue
        const fam = look.family.get(k.familyId)
        out.push({ key: `fam-${sid}`, label: `${k.firstName} ${k.lastName}’s parents`, detail: fam?.guardians.map((x) => x.name).join(', '), participants: [me, `family:${k.familyId}`], familyId: k.familyId, sailorId: k.id })
        if (k.login) out.push({ key: `kid-${sid}`, label: `${k.firstName} ${k.lastName}`, detail: 'Sailor, parents copied', participants: [me, `sailor:${k.id}`, `family:${k.familyId}`], familyId: k.familyId, sailorId: k.id })
      }
    }
    return out
  }, [coachId, groups, look, today])
}

export function useSailorRecipients(sailorId: string): Recipient[] {
  const groups = useStore((s) => s.groups)
  const look = useLookups()
  const today = format(useNow(60_000), 'yyyy-MM-dd')
  return useMemo(() => {
    const k = look.sailor.get(sailorId)
    if (!k) return []
    const base: Participant[] = [`sailor:${sailorId}`, `family:${k.familyId}`]
    const out: Recipient[] = []
    const seen = new Set<string>()
    for (const g of currentGroups(groups, look, today).filter((x) => x.sailorIds.includes(sailorId))) {
      for (const cid of g.coachIds) {
        if (seen.has(cid)) continue
        seen.add(cid)
        const c = look.coach.get(cid)
        if (c) out.push({ key: cid, label: c.name, detail: 'Your coach, parents copied', participants: [...base, `coach:${cid}`], familyId: k.familyId, sailorId })
      }
    }
    out.push({ key: 'director', label: PERSONAS.director.name, detail: 'Program director, parents copied', participants: [...base, 'director'], familyId: k.familyId, sailorId })
    return out
  }, [sailorId, groups, look, today])
}

export function useDirectorRecipients(): Recipient[] {
  const coaches = useStore((s) => s.coaches)
  const sailors = useStore((s) => s.sailors)
  const look = useLookups()
  return useMemo(() => {
    const out: Recipient[] = coaches
      .filter((c) => c.role !== 'program-director')
      .map((c) => ({ key: c.id, label: c.name, detail: 'Coach', participants: ['director', `coach:${c.id}`] as Participant[] }))
    for (const k of [...sailors].sort((a, b) => a.lastName.localeCompare(b.lastName))) {
      const fam = look.family.get(k.familyId)
      out.push({ key: `fam-${k.id}`, label: `${k.firstName} ${k.lastName}’s parents`, detail: fam?.guardians.map((x) => x.name).join(', '), participants: ['director', `family:${k.familyId}`], familyId: k.familyId, sailorId: k.id })
    }
    return out
  }, [coaches, sailors, look])
}

/* ───────────── Inbox ───────────── */

export function Inbox({
  me,
  recipients,
  layout,
  canSeeAll,
}: {
  me: Me
  recipients: Recipient[]
  layout: 'phone' | 'desktop'
  /** The director can read every conversation in the program. */
  canSeeAll?: boolean
}) {
  const [all, setAll] = useState(false)
  const threads = useThreads(me.id, all)
  const [openId, setOpenId] = useState<string | null>(() => (layout === 'desktop' ? threads[0]?.id ?? null : null))
  const [composing, setComposing] = useState(false)
  const now = useNow(60_000)
  const look = useLookups()
  const open = threads.find((t) => t.id === openId) ?? null

  const list = (
    <div className={cn(layout === 'desktop' && 'flex min-h-0 flex-col border-e')}>
      <div className='flex items-center gap-2 px-4 py-3'>
        {canSeeAll ? (
          <div className='flex rounded-lg bg-muted p-0.5 text-sm' role='group' aria-label='Which conversations'>
            {[
              [false, 'Mine'],
              [true, 'Whole program'],
            ].map(([v, label]) => (
              <button
                key={String(v)}
                onClick={() => setAll(v as boolean)}
                aria-pressed={all === v}
                className={cn('rounded-md px-3 py-1 text-muted-foreground', all === v && 'bg-card font-medium text-foreground shadow-sm')}
              >
                {label as string}
              </button>
            ))}
          </div>
        ) : (
          <p className='text-sm text-muted-foreground'>{threads.length ? `${threads.length} conversation${threads.length === 1 ? '' : 's'}` : ''}</p>
        )}
        <Button size='sm' className='ms-auto' onClick={() => setComposing(true)}>
          <PenSquare className='size-4' /> New message
        </Button>
      </div>
      {threads.length === 0 ? (
        <EmptyState title='No conversations yet' className='mx-4'>
          Questions and replies show up here.
        </EmptyState>
      ) : (
        <ul className={cn('divide-y border-t', layout === 'desktop' && 'min-h-0 flex-1 overflow-y-auto')}>
          {threads.map((t) => {
            const m = last(t)
            const unread = isUnread(t, me.id)
            const others = t.participants.filter((p) => p !== me.id)
            return (
              <li key={t.id}>
                <button
                  onClick={() => setOpenId(t.id)}
                  className={cn('flex w-full gap-3 px-4 py-3 text-start hover:bg-muted/40', open?.id === t.id && layout === 'desktop' && 'bg-muted/60')}
                  aria-current={open?.id === t.id ? 'true' : undefined}
                >
                  <span className={cn('mt-2 size-2 shrink-0 rounded-full', unread ? 'bg-burgee' : 'bg-transparent')} aria-label={unread ? 'Unread' : undefined} />
                  <span className='min-w-0 flex-1'>
                    <span className='flex items-baseline gap-2'>
                      <span className={cn('min-w-0 flex-1 truncate', unread ? 'font-semibold' : 'font-medium')}>{t.subject}</span>
                      <span className='shrink-0 text-xs text-muted-foreground'>{when(m.at, now)}</span>
                    </span>
                    <span className='block truncate text-xs text-muted-foreground'>With {others.map((p) => participantName(p, look)).join(', ')}</span>
                    <span className={cn('mt-0.5 line-clamp-2 text-sm', unread ? 'text-foreground' : 'text-muted-foreground')}>
                      {m.from === me.id ? 'You' : m.name.split(' ')[0]}: {m.text}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )

  const compose = (
    <NewMessage
      open={composing}
      onClose={() => setComposing(false)}
      me={me}
      recipients={recipients}
      onSent={(id) => {
        setComposing(false)
        setOpenId(id)
      }}
    />
  )

  if (layout === 'phone') {
    return (
      <>
        {open ? <ThreadView thread={open} me={me} onBack={() => setOpenId(null)} layout='phone' /> : list}
        {compose}
      </>
    )
  }
  return (
    <div className='grid min-h-[560px] overflow-hidden rounded-lg border bg-card md:grid-cols-[minmax(280px,380px)_1fr]'>
      {list}
      {open ? (
        <ThreadView thread={open} me={me} layout='desktop' />
      ) : (
        <div className='hidden items-center justify-center p-8 text-sm text-muted-foreground md:flex'>Pick a conversation</div>
      )}
      {compose}
    </div>
  )
}

export function ThreadView({ thread, me, onBack, layout }: { thread: Thread; me: Me; onBack?: () => void; layout: 'phone' | 'desktop' }) {
  const look = useLookups()
  const send = useStore((s) => s.sendMessage)
  const markRead = useStore((s) => s.markThreadRead)
  const now = useNow(60_000)
  const [text, setText] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const isMember = thread.participants.includes(me.id)
  const sailorIn = thread.participants.find((p) => p.startsWith('sailor:'))
  const kid = sailorIn ? look.sailor.get(sailorIn.slice(7)) : undefined
  const lastAt = last(thread).at

  useEffect(() => {
    if (isMember && isUnread(thread, me.id)) markRead(thread.id, me.id)
  }, [thread, me.id, isMember, markRead])
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' })
  }, [thread.id, lastAt])

  return (
    <section className={cn('flex min-h-0 flex-col', layout === 'desktop' && 'max-h-[720px]')} aria-label={thread.subject}>
      <header className='border-b px-4 py-3'>
        {onBack && (
          <button onClick={onBack} className='mb-1 flex items-center gap-1 text-sm text-muted-foreground'>
            <ArrowLeft className='size-4' /> Messages
          </button>
        )}
        <h2 className='text-lg leading-snug font-semibold'>{thread.subject}</h2>
        <ul className='mt-1.5 flex flex-wrap gap-1.5'>
          {thread.participants.map((p) => (
            <li key={p} className='rounded-full bg-muted px-2 py-0.5 text-xs'>
              {p === me.id ? 'You' : participantName(p, look)}
              <span className='text-muted-foreground'> · {participantRole(p, look)}</span>
            </li>
          ))}
        </ul>
        {kid && (
          <p className='mt-2 flex items-start gap-1.5 rounded-md bg-ok/10 px-2.5 py-1.5 text-xs text-ok'>
            <ShieldCheck className='mt-px size-3.5 shrink-0' />
            {kid.firstName}’s parents see every message here. SafeSport requires adults’ messages to young sailors to copy a parent.
          </p>
        )}
      </header>
      <ol className='flex-1 space-y-3 overflow-y-auto px-4 py-4'>
        {thread.messages.map((m) => {
          const mine = m.from === me.id
          return (
            <li key={m.id} className={cn('flex gap-2', mine && 'flex-row-reverse')}>
              {!mine && <Initials name={m.name} hue={(m.name.charCodeAt(0) * 37) % 360} className='mt-5 size-7 shrink-0 text-[10px]' />}
              <div className={cn('max-w-[85%]', mine && 'text-end')}>
                <p className='mb-0.5 text-xs text-muted-foreground'>
                  {mine ? 'You' : m.name} · {when(m.at, now)}
                </p>
                <p className={cn('inline-block rounded-2xl px-3.5 py-2 text-start text-sm whitespace-pre-wrap', mine ? 'bg-primary text-primary-foreground' : 'bg-muted')}>{m.text}</p>
              </div>
            </li>
          )
        })}
        <div ref={endRef} />
      </ol>
      {isMember ? (
        <form
          className='flex items-end gap-2 border-t bg-background p-3'
          onSubmit={(e) => {
            e.preventDefault()
            if (!text.trim()) return
            send(thread.id, me.id, me.name, text.trim())
            setText('')
          }}
        >
          <Label htmlFor={`reply-${thread.id}`} className='sr-only'>
            Reply
          </Label>
          <Textarea
            id={`reply-${thread.id}`}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                e.currentTarget.form?.requestSubmit()
              }
            }}
            placeholder='Write a reply'
            className='max-h-32 min-h-10 flex-1 resize-none'
          />
          <Button type='submit' size='icon' aria-label='Send' disabled={!text.trim()}>
            <Send className='size-4' />
          </Button>
        </form>
      ) : (
        <p className='border-t px-4 py-3 text-xs text-muted-foreground'>You can read this conversation because you run the program. Only people in it can reply.</p>
      )}
    </section>
  )
}

export function NewMessage({
  open,
  onClose,
  me,
  recipients,
  onSent,
  initial,
}: {
  open: boolean
  onClose: () => void
  me: Me
  recipients: Recipient[]
  onSent: (threadId: string) => void
  initial?: { recipientKey?: string; subject?: string; announcementId?: string }
}) {
  const start = useStore((s) => s.startThread)
  const look = useLookups()
  const [pickedKey, setPickedKey] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [loaded, setLoaded] = useState(false)
  if (open && !loaded) {
    setLoaded(true)
    setPickedKey(initial?.recipientKey ?? (recipients.length === 1 ? recipients[0].key : null))
    setQ('')
  }
  if (!open && loaded) setLoaded(false)
  const picked = recipients.find((r) => r.key === pickedKey)
  const shown = recipients.filter((r) => `${r.label} ${r.detail ?? ''}`.toLowerCase().includes(q.toLowerCase())).slice(0, 40)
  const copiesParents = picked?.participants.some((p) => p.startsWith('sailor:'))

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side='bottom' className='max-h-[92svh] overflow-y-auto rounded-t-2xl sm:mx-auto sm:max-w-lg'>
        <form
          key={String(open)}
          onSubmit={(e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            const subject = String(fd.get('subject') ?? '').trim()
            const text = String(fd.get('text') ?? '').trim()
            if (!picked) return toast.error('Pick who this is for.')
            if (!text) return toast.error('Write your message.')
            const id = start({
              subject: subject || text.slice(0, 48),
              participants: withParentsCopied(picked.participants, look),
              familyId: picked.familyId,
              sailorId: picked.sailorId,
              announcementId: initial?.announcementId,
              from: me.id,
              name: me.name,
              text,
            })
            toast.success(`Sent to ${picked.label}`)
            onSent(id)
          }}
        >
          <SheetHeader>
            <SheetTitle>New message</SheetTitle>
            <SheetDescription>Replies come back here, and you get a notification.</SheetDescription>
          </SheetHeader>
          <div className='grid gap-4 px-4 pb-6'>
            <fieldset className='grid gap-1.5'>
              <legend className='mb-1.5 text-sm font-medium'>To</legend>
              {picked ? (
                <div className='flex items-center justify-between gap-2 rounded-md border px-3 py-2'>
                  <span className='min-w-0'>
                    <span className='block truncate text-sm font-medium'>{picked.label}</span>
                    {picked.detail && <span className='block truncate text-xs text-muted-foreground'>{picked.detail}</span>}
                  </span>
                  {recipients.length > 1 && (
                    <Button type='button' size='sm' variant='ghost' onClick={() => setPickedKey(null)}>
                      Change
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  {recipients.length > 8 && (
                    <div className='relative'>
                      <Search className='pointer-events-none absolute start-2.5 top-2.5 size-4 text-muted-foreground' />
                      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder='Search people' className='ps-8' aria-label='Search people' />
                    </div>
                  )}
                  <ul className='max-h-64 divide-y overflow-y-auto rounded-md border'>
                    {shown.map((r) => (
                      <li key={r.key}>
                        <button type='button' onClick={() => setPickedKey(r.key)} className='w-full px-3 py-2 text-start hover:bg-muted/50'>
                          <span className='block text-sm font-medium'>{r.label}</span>
                          {r.detail && <span className='block text-xs text-muted-foreground'>{r.detail}</span>}
                        </button>
                      </li>
                    ))}
                    {shown.length === 0 && <li className='px-3 py-3 text-sm text-muted-foreground'>Nobody matches.</li>}
                  </ul>
                </>
              )}
              {copiesParents && (
                <p className='flex items-start gap-1.5 text-xs text-ok'>
                  <ShieldCheck className='mt-px size-3.5 shrink-0' /> Parents are copied automatically (SafeSport).
                </p>
              )}
            </fieldset>
            <div className='grid gap-1.5'>
              <Label htmlFor='nm-subject'>Subject</Label>
              <Input id='nm-subject' name='subject' defaultValue={initial?.subject} placeholder='Optional' />
            </div>
            <div className='grid gap-1.5'>
              <Label htmlFor='nm-text'>Message</Label>
              <Textarea id='nm-text' name='text' rows={4} />
            </div>
            <Button type='submit'>
              <Send className='size-4' /> Send
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
