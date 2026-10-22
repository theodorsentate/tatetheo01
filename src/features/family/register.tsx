import { useMemo, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { format } from 'date-fns'
import { ArrowLeft, Check, ChevronDown, Info, ShoppingBag, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PROGRAMS, TERMS } from '@/data/catalog'
import { familyRegs, programById, useLookups, useSessionStats } from '@/data/hooks'
import { useStore } from '@/data/store'
import { basePrice, money, quoteCart } from '@/domain/pricing'
import { eligibility } from '@/domain/rules'
import { registrationWindow } from '@/domain/waitlist'
import { Button } from '@/components/ui/button'
import { FleetChip } from '@/components/burgee/marks'
import { DemoCardForm } from './payment'
import { useFamily } from './home'

const d = (iso: string) => format(new Date(`${iso}T12:00:00`), 'MMM d')

export function FamilyRegister() {
  const { family, kids } = useFamily()
  const [sailorId, setSailorId] = useState(kids[0]?.id)
  const [termId, setTermId] = useState('summer-27')
  const [openProgram, setOpenProgram] = useState<string | null>(null)
  const sessions = useStore((s) => s.sessions)
  const regs = useStore((s) => s.registrations)
  const sailors = useStore((s) => s.sailors)
  const cart = useStore((s) => s.cart)
  const pricing = useStore((s) => s.settings.pricing)
  const add = useStore((s) => s.addToCart)
  const remove = useStore((s) => s.removeFromCart)
  const stats = useSessionStats()
  const navigate = useNavigate()

  const sailor = kids.find((k) => k.id === sailorId)!
  const term = TERMS.find((t) => t.id === termId)!
  const window = registrationWindow(term, family, new Date())
  const mine = familyRegs(regs, sailors, family.id)

  const programs = useMemo(() => {
    const termSessions = sessions.filter((s) => s.termId === termId && s.status === 'open')
    return PROGRAMS.map((p) => {
      const list = termSessions.filter((s) => s.programId === p.id)
      if (!list.length) return null
      const elig = eligibility(sailor, p, list[0])
      return { p, list, elig }
    }).filter(Boolean) as { p: (typeof PROGRAMS)[number]; list: typeof sessions; elig: ReturnType<typeof eligibility> }[]
  }, [sessions, termId, sailor])

  const quote = quoteCart(cart, {
    pricing,
    family,
    sailors,
    sessions,
    programs: PROGRAMS,
    terms: TERMS,
    existing: mine,
    now: new Date(),
  })

  const eligible = programs.filter((x) => x.elig.ok)
  const notEligible = programs.filter((x) => !x.elig.ok)

  return (
    <div className='pb-28'>
      <div className='px-4 pt-5'>
        <h1 className='text-2xl font-bold'>Sign up</h1>
        <p className='text-sm text-muted-foreground'>Pick a sailor, then tap the weeks you want. Full weeks join the waitlist at no charge.</p>
      </div>

      <div className='mt-4 flex gap-2 overflow-x-auto px-4' role='tablist' aria-label='Sailor'>
        {kids.map((k) => (
          <button
            key={k.id}
            role='tab'
            aria-selected={k.id === sailorId}
            onClick={() => setSailorId(k.id)}
            className='flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium aria-selected:border-primary aria-selected:bg-primary aria-selected:text-primary-foreground'
          >
            {k.firstName}
          </button>
        ))}
      </div>
      <div className='mt-2 flex gap-4 border-b px-4' role='tablist' aria-label='Term'>
        {TERMS.filter((t) => t.season !== 'fall').reverse().map((t) => (
          <button
            key={t.id}
            role='tab'
            aria-selected={t.id === termId}
            onClick={() => setTermId(t.id)}
            className='-mb-px border-b-2 border-transparent py-2 text-sm font-medium text-muted-foreground aria-selected:border-primary aria-selected:text-foreground'
          >
            {t.name}
          </button>
        ))}
      </div>

      <div className='px-4 pt-4'>
        <p className='mb-3 flex items-center gap-2 text-sm'>
          {sailor.firstName} sails in <FleetChip level={sailor.level} />
        </p>
        {!window.open ? (
          <div className='rounded-lg border bg-muted p-4 text-sm'>
            <p className='font-medium'>{window.reason}</p>
            {window.opensOn && <p className='text-muted-foreground'>Opens to you on {format(new Date(`${window.opensOn}T12:00:00`), 'MMMM d')}.</p>}
          </div>
        ) : (
          <>
            {term.earlyBirdUntil && new Date() <= new Date(`${term.earlyBirdUntil}T23:59:59`) && pricing.earlyBirdPct > 0 && (
              <p className='mb-3 flex items-start gap-2 rounded-lg bg-ok-soft p-3 text-sm text-ok'>
                <Info className='mt-0.5 size-4 shrink-0' />
                Early-bird pricing: {pricing.earlyBirdPct}% off through {format(new Date(`${term.earlyBirdUntil}T12:00:00`), 'MMMM d')}.
              </p>
            )}
            <ul className='space-y-3'>
              {eligible.map(({ p, list }) => {
                const open = openProgram === p.id || eligible.length === 1
                const tier = pricing.tiers.find((t) => t.id === p.pricingTierId)!
                return (
                  <li key={p.id} className='rounded-lg border bg-card'>
                    <button
                      className='flex w-full items-start gap-3 p-4 text-start'
                      onClick={() => setOpenProgram(open ? null : p.id)}
                      aria-expanded={open}
                    >
                      <span className='mt-1 h-9 w-1 shrink-0 rounded-full' style={{ background: p.color }} aria-hidden='true' />
                      <span className='min-w-0 flex-1'>
                        <span className='block font-semibold'>{p.name}</span>
                        <span className='block text-sm text-muted-foreground'>
                          {money(basePrice(list[0], p, pricing, family))} per {tier.unit}. {list[0].time}
                        </span>
                      </span>
                      <ChevronDown className={cn('mt-1 size-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
                    </button>
                    {open && (
                      <div className='border-t px-4 py-3'>
                        <p className='mb-3 text-sm text-muted-foreground'>{p.description}</p>
                        <div className={cn('grid gap-2', p.format === 'camp' ? 'grid-cols-2' : 'grid-cols-1')}>
                          {list.map((s) => {
                            const st = stats.get(s.id)!
                            const left = s.capacity - st.taken
                            const already = mine.find((r) => r.sailorId === sailor.id && r.sessionId === s.id && r.status !== 'cancelled')
                            const inCart = cart.some((c) => c.sailorId === sailor.id && c.sessionId === s.id)
                            const full = left <= 0
                            return (
                              <button
                                key={s.id}
                                disabled={!!already}
                                onClick={() =>
                                  inCart ? remove({ sailorId: sailor.id, sessionId: s.id }) : add({ sailorId: sailor.id, sessionId: s.id })
                                }
                                aria-pressed={inCart}
                                className={cn(
                                  'rounded-md border p-2.5 text-start text-sm transition-colors',
                                  inCart && 'border-primary bg-primary text-primary-foreground',
                                  !!already && 'bg-muted text-muted-foreground'
                                )}
                              >
                                <span className='flex items-center justify-between gap-1 font-medium'>
                                  {s.name}
                                  {inCart && <Check className='size-4' />}
                                </span>
                                <span className={cn('block text-xs', inCart ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                                  {d(s.startDate)}
                                  {p.format === 'camp' ? `–${d(s.endDate)}` : ` – ${d(s.endDate)}, ${s.days}`}
                                </span>
                                <span
                                  className={cn(
                                    'mt-1 block text-xs font-medium',
                                    !inCart && !already && (full ? 'text-signal' : left <= 4 ? 'text-destructive' : 'text-ok')
                                  )}
                                >
                                  {already
                                    ? already.status === 'waitlisted'
                                      ? 'On the waitlist'
                                      : 'Signed up'
                                    : full
                                      ? `Full, join waitlist${st.waitlist ? ` (${st.waitlist} ahead)` : ''}`
                                      : left <= 4
                                        ? `${left} spot${left > 1 ? 's' : ''} left`
                                        : 'Open'}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
            {notEligible.length > 0 && (
              <details className='mt-5 text-sm'>
                <summary className='cursor-pointer text-muted-foreground'>
                  {notEligible.length} programs aren’t a fit for {sailor.firstName} this term
                </summary>
                <ul className='mt-2 space-y-1.5'>
                  {notEligible.map(({ p, elig }) => (
                    <li key={p.id} className='flex justify-between gap-3 rounded-md bg-muted px-3 py-2'>
                      <span>{p.name}</span>
                      <span className='text-xs text-muted-foreground'>{!elig.ok && elig.reason}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </div>

      {cart.length > 0 && (
        <div className='fixed inset-x-0 bottom-16 z-10 px-3 md:absolute md:bottom-16'>
          <Button size='lg' className='h-14 w-full justify-between rounded-xl shadow-lg' onClick={() => navigate({ to: '/family/checkout' })}>
            <span className='flex items-center gap-2'>
              <ShoppingBag className='size-5' />
              {cart.length} {cart.length === 1 ? 'session' : 'sessions'}
            </span>
            <span className='font-semibold'>Review {money(quote.total)}</span>
          </Button>
        </div>
      )}
    </div>
  )
}

export function FamilyCheckout() {
  const { family } = useFamily()
  const cart = useStore((s) => s.cart)
  const sessions = useStore((s) => s.sessions)
  const regs = useStore((s) => s.registrations)
  const sailors = useStore((s) => s.sailors)
  const pricing = useStore((s) => s.settings.pricing)
  const remove = useStore((s) => s.removeFromCart)
  const checkout = useStore((s) => s.checkout)
  const stats = useSessionStats()
  const look = useLookups()
  const [done, setDone] = useState<null | { confirmed: number; waitlisted: number; charged: number }>(null)

  const quote = quoteCart(cart, {
    pricing,
    family,
    sailors,
    sessions,
    programs: PROGRAMS,
    terms: TERMS,
    existing: familyRegs(regs, sailors, family.id),
    now: new Date(),
  })
  const willWaitlist = new Set(
    cart.filter((c) => {
      const st = stats.get(c.sessionId)!
      // seats left after earlier cart items for the same session
      const ahead = cart.filter((x) => x.sessionId === c.sessionId)
      return st.session.capacity - st.taken < ahead.indexOf(c) + 1
    }).map((c) => `${c.sailorId}:${c.sessionId}`)
  )
  const chargeNow = quote.items.filter((i) => !willWaitlist.has(`${i.sailorId}:${i.sessionId}`)).reduce((s, i) => s + i.total, 0)
  const fee = Math.round(chargeNow * pricing.processingFeePct) / 100

  if (done)
    return (
      <div className='px-4 py-10 text-center'>
        <div className='mx-auto flex size-14 items-center justify-center rounded-full bg-ok-soft text-ok'>
          <Check className='size-7' />
        </div>
        <h1 className='mt-4 text-2xl font-bold'>You’re all set</h1>
        <p className='mx-auto mt-2 max-w-xs text-sm text-muted-foreground'>
          {done.confirmed > 0 && `${done.confirmed} session${done.confirmed > 1 ? 's' : ''} confirmed${done.charged ? ` and ${money(done.charged)} paid` : ''}. `}
          {done.waitlisted > 0 &&
            `${done.waitlisted} added to the waitlist. If a spot opens we’ll text and email you, and hold it for you while you decide.`}
        </p>
        <div className='mt-6 grid gap-2'>
          <Button asChild>
            <Link to='/family'>Back to home</Link>
          </Button>
          <Button asChild variant='outline'>
            <Link to='/family/forms'>Check forms</Link>
          </Button>
        </div>
      </div>
    )

  return (
    <div className='px-4 py-5'>
      <Link to='/family/register' className='mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground'>
        <ArrowLeft className='size-4' /> Keep browsing
      </Link>
      <h1 className='text-2xl font-bold'>Review & pay</h1>
      {cart.length === 0 ? (
        <p className='mt-4 text-sm text-muted-foreground'>
          Nothing selected yet.{' '}
          <Link to='/family/register' className='text-primary underline'>
            Pick some sessions
          </Link>
          .
        </p>
      ) : (
        <>
          <ul className='mt-4 divide-y rounded-lg border bg-card'>
            {quote.items.map((it) => {
              const se = look.session.get(it.sessionId)!
              const p = programById.get(se.programId)!
              const k = look.sailor.get(it.sailorId)!
              const wl = willWaitlist.has(`${it.sailorId}:${it.sessionId}`)
              return (
                <li key={`${it.sailorId}:${it.sessionId}`} className='p-3'>
                  <div className='flex items-start gap-2'>
                    <span className='min-w-0 flex-1'>
                      <span className='block text-sm font-semibold'>
                        {k.firstName}: {p.name}, {se.name}
                      </span>
                      <span className='block text-xs text-muted-foreground'>
                        {d(se.startDate)}–{d(se.endDate)}
                      </span>
                    </span>
                    <span className={cn('text-sm font-semibold', wl && 'text-muted-foreground line-through')}>{money(it.total)}</span>
                    <button onClick={() => remove(it)} className='text-muted-foreground' aria-label={`Remove ${p.name} ${se.name}`}>
                      <X className='size-4' />
                    </button>
                  </div>
                  {wl ? (
                    <p className='mt-1 text-xs font-medium text-signal'>Full. Joins the waitlist, nothing charged now.</p>
                  ) : (
                    it.lines.slice(1).map((l) => (
                      <p key={l.label} className='flex justify-between text-xs text-ok'>
                        <span>{l.label}</span>
                        <span>{money(l.amount)}</span>
                      </p>
                    ))
                  )}
                </li>
              )
            })}
          </ul>
          <dl className='mt-4 space-y-1 text-sm'>
            {quote.discounts > 0 && (
              <div className='flex justify-between text-ok'>
                <dt>You save</dt>
                <dd>{money(quote.discounts)}</dd>
              </div>
            )}
            {fee > 0 && (
              <div className='flex justify-between text-muted-foreground'>
                <dt>Card processing</dt>
                <dd>{money(fee)}</dd>
              </div>
            )}
            <div className='flex justify-between text-lg font-semibold'>
              <dt>Due today</dt>
              <dd>{money(chargeNow + fee)}</dd>
            </div>
          </dl>
          <div className='mt-5'>
            <DemoCardForm
              amount={chargeNow + fee}
              label={chargeNow > 0 ? undefined : 'Join waitlist'}
              onPaid={() => setDone(checkout(family.id))}
            />
          </div>
        </>
      )}
    </div>
  )
}
