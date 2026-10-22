import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowUp, Check, Loader2, MessageSquareText, PenLine, Square, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { BurgeeMark } from '@/components/burgee/marks'
import { useAsk, type ChatMessage } from './ask-store'
import { askClaude, ctxNow, getClaude, type SampleError, type Turn } from './claude'
import { answerLocally, SUGGESTIONS } from './local'
import { AnswerText } from './markdown'
import type { AssistantAction } from './query'

const uid = () => Math.random().toString(36).slice(2, 10)
const HIDE_CLAUDE = new Set(['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed', 'session_expired'])

/** Header button that opens the assistant. */
export function AskButton({ className }: { className?: string }) {
  const setOpen = useAsk((s) => s.setOpen)
  return (
    <Button variant='outline' size='sm' className={cn('gap-2', className)} onClick={() => setOpen(true)} aria-label='Ask Burgee'>
      <MessageSquareText className='size-4' />
      <span className='hidden sm:inline'>Ask Burgee</span>
    </Button>
  )
}

/** Inline ask bar (Today page): type a question, it opens the panel and asks. */
export function AskBar() {
  const ask = useAsk((s) => s.ask)
  const [q, setQ] = useState('')
  return (
    <form
      className='flex items-center gap-2 rounded-lg border bg-card p-1.5 ps-3 shadow-xs focus-within:ring-2 focus-within:ring-ring/40'
      onSubmit={(e) => {
        e.preventDefault()
        if (!q.trim()) return
        ask(q.trim())
        setQ('')
      }}
    >
      <MessageSquareText className='size-4 shrink-0 text-muted-foreground' aria-hidden='true' />
      <label htmlFor='askbar' className='sr-only'>
        Ask Burgee a question
      </label>
      <input
        id='askbar'
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder='Ask anything, like “who still needs their SafeSport?”'
        className='h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground'
      />
      <Button type='submit' size='sm' disabled={!q.trim()}>
        Ask
      </Button>
    </form>
  )
}

export function AskPanel() {
  const { open, setOpen, messages, claude, queued, set, update } = useAsk()
  const navigate = useNavigate()
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const ctlRef = useRef<AbortController | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Find out once whether Claude is reachable in this view.
  useEffect(() => {
    if (claude !== 'unknown') return
    getClaude().then((s) => set({ claude: s ? 'available' : 'unavailable' }))
  }, [claude, set])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  const run = async (question: string) => {
    const q = question.trim()
    if (!q || busy) return
    const userMsg: ChatMessage = { id: uid(), role: 'user', text: q }
    const id = uid()
    const sample = await getClaude()
    const engine = sample && useAsk.getState().claude !== 'unavailable' ? 'claude' : 'local'
    set({
      messages: [
        ...useAsk.getState().messages,
        userMsg,
        { id, role: 'assistant', text: '', engine, status: 'thinking', tools: [], actions: [] },
      ],
    })
    setInput('')

    const local = (note?: string) => {
      const a = answerLocally(q, ctxNow())
      update(id, { text: a.text, actions: a.actions, engine: 'local', status: 'done', note })
    }

    if (engine === 'local' || !sample) {
      local()
      return
    }

    setBusy(true)
    const ctl = new AbortController()
    ctlRef.current = ctl
    const history: Turn[] = useAsk
      .getState()
      .messages.filter((m) => m.id !== id && (m.role === 'user' || (m.status === 'done' && m.text)))
      .map((m) => ({ role: m.role, content: m.text }))
    try {
      const res = await askClaude(sample, history, {
        signal: ctl.signal,
        onText: (text) => update(id, { text, status: 'streaming' }),
        onTool: (e) => {
          const cur = useAsk.getState().messages.find((m) => m.id === id)
          if (cur?.role === 'assistant' && !cur.tools.some((t) => t.tool === e.tool)) update(id, { tools: [...cur.tools, e] })
        },
      })
      update(id, { text: res.text, actions: res.actions, status: 'done', note: res.truncated ? 'Cut short. Ask for less at a time.' : undefined })
    } catch (err) {
      const e = err as SampleError
      if (e.code === 'cancelled') {
        update(id, { text: e.text ?? '', status: 'done', note: 'Stopped.' })
      } else if (HIDE_CLAUDE.has(e.code)) {
        set({ claude: 'unavailable' })
        local('Claude isn’t turned on for this page, so this is a quick lookup from club data.')
      } else if (e.code === 'rate_limited') {
        local('Claude is at its limit right now, so this is a quick lookup from club data.')
      } else {
        local('Claude couldn’t answer just now, so this is a quick lookup from club data.')
      }
    } finally {
      setBusy(false)
      ctlRef.current = null
    }
  }

  // Questions queued from ⌘K or the Today page.
  useEffect(() => {
    if (!open || !queued || busy) return
    const question = queued
    const t = setTimeout(() => {
      set({ queued: undefined })
      run(question)
    }, 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, queued])

  const go = (href: string) => {
    setOpen(false)
    navigate({ href })
  }
  const doAction = (a: AssistantAction) => {
    if (a.kind === 'link') return go(a.href)
    set({ draft: { title: a.title, body: a.body, audience: a.audience, channels: a.channels, category: 'reminder' } })
    go('/admin/messages')
  }

  const empty = messages.length === 0

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className='flex w-full flex-col gap-0 p-0 sm:max-w-md'>
        <SheetHeader className='border-b px-5 py-4'>
          <SheetTitle className='flex items-center gap-2 font-display text-lg'>
            <BurgeeMark className='size-6 text-foreground' /> Ask Burgee
          </SheetTitle>
          <SheetDescription className='text-xs'>
            {claude === 'available'
              ? 'Claude answers from your club’s live data: rosters, attendance, parent notes, messages, certs and forms.'
              : claude === 'unavailable'
                ? 'Quick lookups from your club’s live data.'
                : 'Answers from your club’s live data.'}
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-y-auto px-5 py-4' aria-live='polite'>
          {empty ? (
            <div>
              <p className='text-sm text-muted-foreground'>
                Ask the way you’d ask your assistant director. Names link straight to the right page, and if you ask
                me to remind people, I’ll draft the message for you to review.
              </p>
              <ul className='mt-4 grid gap-2'>
                {SUGGESTIONS.map((s) => (
                  <li key={s}>
                    <button
                      onClick={() => run(s)}
                      className='w-full rounded-lg border bg-card px-3 py-2 text-start text-sm transition-colors hover:border-primary hover:bg-accent'
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <ol className='space-y-5'>
              {messages.map((m) =>
                m.role === 'user' ? (
                  <li key={m.id} className='flex justify-end'>
                    <p className='max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground'>{m.text}</p>
                  </li>
                ) : (
                  <li key={m.id}>
                    {m.status === 'thinking' || (m.status === 'streaming' && !m.text) ? (
                      <div className='space-y-1.5 text-sm text-muted-foreground'>
                        {m.tools.length === 0 && (
                          <p className='flex items-center gap-2'>
                            <Loader2 className='size-4 animate-spin' /> Thinking…
                          </p>
                        )}
                        {m.tools.map((t, i) => (
                          <p key={t.tool} className='flex items-center gap-2'>
                            {i === m.tools.length - 1 ? <Loader2 className='size-4 animate-spin' /> : <Check className='size-4 text-ok' />}
                            {t.label}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <>
                        {m.text && <AnswerText text={m.text} onLink={go} />}
                        {m.actions.length > 0 && m.status === 'done' && (
                          <div className='mt-3 flex flex-wrap gap-2'>
                            {m.actions.map((a, i) => (
                              <Button key={i} size='sm' variant={a.kind === 'draft' ? 'default' : 'outline'} onClick={() => doAction(a)}>
                                {a.kind === 'draft' && <PenLine className='size-4' />}
                                {a.label}
                              </Button>
                            ))}
                          </div>
                        )}
                        <p className='mt-2 text-[11px] text-muted-foreground'>
                          {m.engine === 'claude' ? `Claude${m.tools.length ? `, checked ${m.tools.map((t) => t.label.toLowerCase().replace(/^(checking|reading|looking up|drafting) /, '')).join(', ')}` : ''}` : 'Quick lookup'}
                          {m.note ? `. ${m.note}` : ''}
                        </p>
                      </>
                    )}
                  </li>
                )
              )}
            </ol>
          )}
          <div ref={endRef} />
        </div>

        <form
          className='border-t p-3'
          onSubmit={(e) => {
            e.preventDefault()
            run(input)
          }}
        >
          <div className='flex items-end gap-2 rounded-xl border bg-background p-1.5 focus-within:ring-2 focus-within:ring-ring/40'>
            <label htmlFor='ask-input' className='sr-only'>
              Your question
            </label>
            <textarea
              id='ask-input'
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  run(input)
                }
              }}
              placeholder='Ask about your program…'
              className='max-h-32 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground'
            />
            {busy ? (
              <Button type='button' size='icon' variant='outline' className='size-9 shrink-0' onClick={() => ctlRef.current?.abort()} aria-label='Stop'>
                <Square className='size-3.5 fill-current' />
              </Button>
            ) : (
              <Button type='submit' size='icon' className='size-9 shrink-0' disabled={!input.trim()} aria-label='Ask'>
                <ArrowUp className='size-4' />
              </Button>
            )}
          </div>
          {!empty && (
            <button type='button' onClick={() => set({ messages: [] })} className='mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground' disabled={busy}>
              <Trash2 className='size-3' /> Clear conversation
            </button>
          )}
        </form>
      </SheetContent>
    </Sheet>
  )
}
