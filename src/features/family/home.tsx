import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { format } from 'date-fns'
import { ChevronRight, ClipboardList, Clock, CreditCard, HeartPulse, Plus, Waves, X } from 'lucide-react'
import { toast } from 'sonner'
import { FORM_TEMPLATES, PERSONAS } from '@/data/catalog'
import { familyRegs, programById, termById, useLookups, useNow, useWaitlistPosition } from '@/data/hooks'
import { useStore } from '@/data/store'
import { cn } from '@/lib/utils'
import { latestSwimCheck, pendingForFamily } from '@/domain/attendance'
import { ACTIVE_STATUSES, money } from '@/domain/pricing'
import { ageOn } from '@/domain/rules'
import type { Announcement, Registration, Sailor } from '@/domain/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { MessageList } from '@/features/coach/coach'
import { FleetChip, OfferCountdown, RegStatus } from '@/components/burgee/marks'
import { DemoCardForm } from './payment'

export function useFamily() {
  const families = useStore((s) => s.families)
  const sailors = useStore((s) => s.sailors)
  const family = families.find((f) => f.id === PERSONAS.familyId)!
  const kids = useMemo(() => sailors.filter((s) => s.familyId === family.id), [sailors, family.id])
  return { family, kids }
}

/** Season forms plus any one-off forms the club has created. */
export function useAllTemplates() {
  const custom = useStore((s) => s.customTemplates)
  return useMemo(() => [...FORM_TEMPLATES, ...custom], [custom])
}

/** Everything the persona family still has to sign, with due dates. */
export function useFamilyPending() {
  const { family, kids } = useFamily()
  const regs = useStore((s) => s.registrations)
  const submissions = useStore((s) => s.submissions)
  const requests = useStore((s) => s.formRequests)
  const season = useStore((s) => s.settings.season)
  const templates = useAllTemplates()
  return useMemo(() => {
    const active = new Set(regs.filter((r) => ACTIVE_STATUSES.has(r.status)).map((r) => r.sailorId))
    return pendingForFamily({ familyId: family.id, kids, activeSailorIds: active, templates, submissions, requests, season })
  }, [family.id, kids, regs, submissions, requests, season, templates])
}

export function FamilyHome() {
  const { family, kids } = useFamily()
  const regs = useStore((s) => s.registrations)
  const sailors = useStore((s) => s.sailors)
  const announcements = useStore((s) => s.announcements)
  const accept = useStore((s) => s.acceptOffer)
  const decline = useStore((s) => s.declineOffer)
  const pay = useStore((s) => s.payBalance)
  const positions = useWaitlistPosition()
  const look = useLookups()
  const now = useNow()
  const [paying, setPaying] = useState<null | { kind: 'offer'; reg: Registration } | { kind: 'balance'; regs: Registration[] }>(null)

  const mine = familyRegs(regs, sailors, family.id)
  const offers = mine.filter((r) => r.status === 'offered')
  const due = mine.filter((r) => r.status === 'pending-payment')
  const pending = useFamilyPending()
  const soonest = pending.map((p) => p.dueDate).filter(Boolean).sort()[0]
  const attendance = useStore((s) => s.attendance)
  const swimChecks = useStore((s) => s.swimChecks)
  const [notesFor, setNotesFor] = useState<Sailor | null>(null)
  const todayIso = format(now, 'yyyy-MM-dd')
  const todayStatus = (sid: string) =>
    Object.values(attendance)
      .filter((e) => e.sailorId === sid && e.date === todayIso)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
  const guardian = family.guardians[0]
  const familyMessages = useFamilyMessages(announcements)

  const describe = (r: Registration) => {
    const se = look.session.get(r.sessionId)!
    const p = programById.get(se.programId)!
    return { se, p, sailor: look.sailor.get(r.sailorId)! }
  }

  return (
    <div className='px-4 py-5'>
      <h1 className='text-2xl font-semibold'>Hi, {guardian.name.split(' ')[0]}</h1>
      <p className='text-sm text-muted-foreground'>
        The {family.name} family{family.membership === 'member' ? `, member ${family.memberNumber}` : ''}
      </p>

      {(offers.length > 0 || due.length > 0 || pending.length > 0) && (
        <section className='mt-5 space-y-3' aria-label='To do'>
          {offers.map((r) => {
            const { se, p, sailor } = describe(r)
            return (
              <div key={r.id} className='rounded-lg border border-signal/50 bg-signal-soft p-4'>
                <p className='flex items-center gap-1.5 text-xs font-semibold text-signal'>
                  <Clock className='size-3.5' /> Spot opened, <OfferCountdown expiresAt={r.offerExpiresAt!} now={now} />
                </p>
                <p className='mt-1.5 font-display text-lg leading-snug font-semibold'>
                  {sailor.firstName} got off the waitlist for {p.name}, {se.name}
                </p>
                <p className='mt-1 text-sm text-muted-foreground'>
                  {format(new Date(`${se.startDate}T12:00:00`), 'MMM d')}–{format(new Date(`${se.endDate}T12:00:00`), 'MMM d')}. We are holding the
                  spot until {format(new Date(r.offerExpiresAt!), 'EEE h:mm a')}. After that it goes to the next family.
                </p>
                <div className='mt-3 flex gap-2'>
                  <Button className='flex-1' onClick={() => setPaying({ kind: 'offer', reg: r })}>
                    Accept and pay {money(r.price)}
                  </Button>
                  <Button
                    variant='outline'
                    onClick={() => {
                      decline(r.id)
                      toast(`Spot released. ${sailor.firstName} is off this waitlist.`)
                    }}
                  >
                    Decline
                  </Button>
                </div>
              </div>
            )
          })}
          {due.length > 0 && (
            <div className='flex items-center gap-3 rounded-lg border bg-card p-4'>
              <CreditCard className='size-5 shrink-0 text-muted-foreground' />
              <div className='min-w-0 flex-1'>
                <p className='font-medium'>{money(due.reduce((s, r) => s + r.price - r.paid, 0))} balance due</p>
                <p className='text-sm text-muted-foreground'>
                  {due.map((r) => { const d = describe(r); return `${d.sailor.firstName}, ${d.p.name} (${termById.get(d.se.termId)?.name})` }).join('; ')}
                </p>
              </div>
              <Button size='sm' onClick={() => setPaying({ kind: 'balance', regs: due })}>
                Pay
              </Button>
            </div>
          )}
          {pending.length > 0 && (
            <Link to='/family/forms' className='flex items-center gap-3 rounded-lg border bg-card p-4'>
              <ClipboardList className='size-5 shrink-0 text-muted-foreground' />
              <span className='min-w-0 flex-1'>
                <span className='block font-medium'>
                  {pending.length} {pending.length === 1 ? 'form' : 'forms'} to sign
                  {soonest && <span className='font-normal text-signal'>, first due {format(new Date(`${soonest}T12:00:00`), 'MMM d')}</span>}
                </span>
                <span className='block text-sm text-muted-foreground'>
                  {pending.map((p) => `${p.template.short}${p.sailor ? ` (${p.sailor.firstName})` : ''}`).join(', ')}
                </span>
              </span>
              <ChevronRight className='size-4 text-muted-foreground' />
            </Link>
          )}
        </section>
      )}

      <section className='mt-7' aria-labelledby='sailors'>
        <div className='mb-2 flex items-baseline justify-between'>
          <h2 id='sailors' className='text-lg font-semibold'>
            Your sailors
          </h2>
          <Link to='/family/register' className='text-sm font-medium text-primary'>
            Sign up for more
          </Link>
        </div>
        <div className='space-y-4'>
          {kids.map((k) => {
            const kr = mine
              .filter((r) => r.sailorId === k.id && r.status !== 'cancelled')
              .sort((a, b) => look.session.get(a.sessionId)!.startDate.localeCompare(look.session.get(b.sessionId)!.startDate))
            return (
              <article key={k.id} className='rounded-lg border bg-card'>
                <header className='flex items-center justify-between gap-2 border-b px-4 py-3'>
                  <div>
                    <h3 className='font-display text-lg font-semibold'>{k.firstName}</h3>
                    <p className='text-xs text-muted-foreground'>Age {ageOn(k.dob, format(now, 'yyyy-MM-dd'))}</p>
                  </div>
                  <FleetChip level={k.level} size='md' />
                </header>
                {(() => {
                  const t = todayStatus(k.id)
                  if (!t) return null
                  const time = format(new Date(t.status === 'on-water' && t.launchedAt ? t.launchedAt : t.updatedAt), 'h:mm a')
                  const text =
                    t.status === 'on-water' ? `On the water since ${time}` : t.status === 'ashore' ? `Back ashore at ${time}` : t.status === 'present' ? `Checked in at ${time}` : t.status === 'picked-up' ? `Went home with ${t.pickedUpBy} at ${time}` : 'Marked absent today'
                  return (
                    <p className={cn('flex items-center gap-1.5 border-b px-4 py-2 text-sm font-medium', t.status === 'on-water' ? 'bg-signal-soft text-signal' : 'bg-ok-soft text-ok')}>
                      <Waves className='size-4' /> {text}
                    </p>
                  )
                })()}
                <div className='space-y-1.5 border-b px-4 py-3 text-sm'>
                  <div className='flex items-start justify-between gap-3'>
                    <p className='text-xs font-medium text-muted-foreground'>For {k.firstName}’s coaches</p>
                    <button className='text-xs font-medium text-primary' onClick={() => setNotesFor(k)}>
                      {k.parentNote ? 'Edit' : 'Add a note'}
                    </button>
                  </div>
                  {k.parentNote ? <p>{k.parentNote.text}</p> : <p className='text-muted-foreground'>Anything coaches should know: nerves, glasses, early pickups.</p>}
                  {k.medicalAlerts.length > 0 && (
                    <p className='flex items-center gap-1.5 text-xs text-muted-foreground'>
                      <HeartPulse className='size-3.5 text-destructive' /> From the medical form: {k.medicalAlerts.join(', ')}
                    </p>
                  )}
                  <p className='text-xs text-muted-foreground'>
                    Pickup: guardians{k.authorizedPickups?.length ? `, ${k.authorizedPickups.join(', ')}` : ' only'}.{' '}
                    {(() => {
                      const sc = latestSwimCheck(swimChecks, k.id)
                      return sc?.result === 'passed'
                        ? `Swim check passed ${format(new Date(`${sc.date}T12:00:00`), 'MMM d')}.`
                        : 'Swim check: coaches will do it at the first session.'
                    })()}
                  </p>
                </div>
                <ul className='divide-y'>
                  {kr.map((r) => {
                    const { se, p } = describe(r)
                    return (
                      <li key={r.id} className='flex items-center gap-3 px-4 py-2.5'>
                        <span className='h-7 w-1 rounded-full' style={{ background: p.color }} aria-hidden='true' />
                        <span className='min-w-0 flex-1'>
                          <span className='block text-sm font-medium'>
                            {p.name}, {se.name}
                          </span>
                          <span className='block text-xs text-muted-foreground'>
                            {termById.get(se.termId)?.name}, {format(new Date(`${se.startDate}T12:00:00`), 'MMM d')}
                          </span>
                        </span>
                        <RegStatus status={r.status} position={positions.get(r.id)} />
                      </li>
                    )
                  })}
                  {kr.length === 0 && <li className='px-4 py-3 text-sm text-muted-foreground'>Not signed up for anything yet.</li>}
                </ul>
              </article>
            )
          })}
        </div>
      </section>

      <section className='mt-7' aria-labelledby='latest'>
        <div className='mb-1 flex items-baseline justify-between'>
          <h2 id='latest' className='text-lg font-semibold'>
            From the club
          </h2>
          <Link to='/family/messages' className='text-sm font-medium text-primary'>
            All messages
          </Link>
        </div>
        <div className='-mx-4'>
          <MessageList items={familyMessages.slice(0, 2)} empty='No messages yet' />
        </div>
      </section>

      <NotesSheet sailor={notesFor} onClose={() => setNotesFor(null)} />

      <Sheet open={!!paying} onOpenChange={(o) => !o && setPaying(null)}>
        <SheetContent side='bottom' className='max-h-[90svh] overflow-y-auto rounded-t-2xl'>
          {paying && (
            <>
              <SheetHeader>
                <SheetTitle>
                  {paying.kind === 'offer' ? `Claim ${describe(paying.reg).sailor.firstName}'s spot` : 'Pay your balance'}
                </SheetTitle>
                <SheetDescription>
                  {paying.kind === 'offer'
                    ? `${describe(paying.reg).p.name}, ${describe(paying.reg).se.name}`
                    : `${paying.regs.length} registration${paying.regs.length > 1 ? 's' : ''}`}
                </SheetDescription>
              </SheetHeader>
              <div className='px-4 pb-6'>
                <ul className='mb-4 space-y-1 text-sm'>
                  {(paying.kind === 'offer' ? [paying.reg] : paying.regs).flatMap((r) =>
                    r.priceLines.map((l) => (
                      <li key={r.id + l.label} className='flex justify-between gap-3'>
                        <span className='text-muted-foreground'>{l.label}</span>
                        <span>{money(l.amount)}</span>
                      </li>
                    ))
                  )}
                </ul>
                <DemoCardForm
                  amount={(paying.kind === 'offer' ? [paying.reg] : paying.regs).reduce((s, r) => s + r.price - r.paid, 0)}
                  onPaid={() => {
                    if (paying.kind === 'offer') {
                      accept(paying.reg.id)
                      toast.success(`${describe(paying.reg).sailor.firstName} is in! Confirmation sent to ${guardian.email}.`)
                    } else {
                      pay(paying.regs.map((r) => r.id))
                      toast.success('Payment received. Thank you!')
                    }
                    setPaying(null)
                  }}
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

/** Announcements that would have reached the persona family. */
export function useFamilyMessages(announcements: Announcement[]) {
  const regs = useStore((s) => s.registrations)
  const sailors = useStore((s) => s.sailors)
  const groups = useStore((s) => s.groups)
  const look = useLookups()
  return useMemo(() => {
    const mine = familyRegs(regs, sailors, PERSONAS.familyId).filter((r) => r.status !== 'cancelled')
    const sessionIds = new Set(mine.map((r) => r.sessionId))
    const programIds = new Set([...sessionIds].map((id) => look.session.get(id)?.programId))
    const kidIds = new Set(mine.map((r) => r.sailorId))
    return announcements.filter((a) => {
      switch (a.audience.kind) {
        case 'everyone':
        case 'outstanding-forms':
          return true
        case 'waitlisted':
          return mine.some((r) => r.status === 'waitlisted')
        case 'families':
          return a.audience.familyIds.includes(PERSONAS.familyId)
        case 'program':
          return programIds.has(a.audience.programId)
        case 'session':
          return sessionIds.has(a.audience.sessionId)
        case 'group': {
          const g = groups.find((x) => x.id === (a.audience as { groupId: string }).groupId)
          return !!g?.sailorIds.some((id) => kidIds.has(id))
        }
        default:
          return false
      }
    })
  }, [announcements, regs, sailors, groups, look])
}

export function FamilyMessages() {
  const announcements = useStore((s) => s.announcements)
  const items = useFamilyMessages(announcements)
  return (
    <div className='py-5'>
      <h1 className='px-4 text-2xl font-semibold'>Messages</h1>
      <p className='mb-3 px-4 text-sm text-muted-foreground'>Everything the club has sent you, newest first.</p>
      <MessageList items={items} empty='No messages yet' />
    </div>
  )
}

function NotesSheet({ sailor, onClose }: { sailor: Sailor | null; onClose: () => void }) {
  const { family } = useFamily()
  const update = useStore((s) => s.updateSailor)
  const [text, setText] = useState('')
  const [pickups, setPickups] = useState<string[]>([])
  const [newPickup, setNewPickup] = useState('')
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  if (sailor && loadedFor !== sailor.id) {
    setLoadedFor(sailor.id)
    setText(sailor.parentNote?.text ?? '')
    setPickups(sailor.authorizedPickups ?? [])
    setNewPickup('')
  }
  return (
    <Sheet open={!!sailor} onOpenChange={(o) => { if (!o) { onClose(); setLoadedFor(null) } }}>
      <SheetContent side='bottom' className='max-h-[90svh] overflow-y-auto rounded-t-2xl'>
        {sailor && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const extra = newPickup.trim() ? [...pickups, newPickup.trim()] : pickups
              update(sailor.id, {
                parentNote: text.trim() ? { text: text.trim(), updatedAt: new Date().toISOString(), by: family.guardians[0].name } : undefined,
                authorizedPickups: extra,
              })
              toast.success(`${sailor.firstName}’s coaches will see this`)
              onClose()
              setLoadedFor(null)
            }}
          >
            <SheetHeader>
              <SheetTitle>For {sailor.firstName}’s coaches</SheetTitle>
              <SheetDescription>Coaches see this on their roster. Medical details belong on the medical form.</SheetDescription>
            </SheetHeader>
            <div className='grid gap-4 px-4 pb-6'>
              <div className='grid gap-1.5'>
                <Label htmlFor='note'>Note</Label>
                <Textarea id='note' rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder='e.g. Gets nervous in big breeze. A quick check-in before launching helps.' />
              </div>
              <div className='grid gap-1.5'>
                <Label htmlFor='pickup'>Who else can pick {sailor.firstName} up?</Label>
                <ul className='grid gap-1.5'>
                  {pickups.map((p) => (
                    <li key={p} className='flex items-center justify-between rounded-md border px-3 py-2 text-sm'>
                      {p}
                      <button type='button' onClick={() => setPickups(pickups.filter((x) => x !== p))} aria-label={`Remove ${p}`}>
                        <X className='size-4 text-muted-foreground' />
                      </button>
                    </li>
                  ))}
                </ul>
                <div className='flex gap-2'>
                  <Input id='pickup' value={newPickup} onChange={(e) => setNewPickup(e.target.value)} placeholder='Name (relationship)' />
                  <Button
                    type='button'
                    variant='outline'
                    size='icon'
                    disabled={!newPickup.trim()}
                    onClick={() => {
                      setPickups([...pickups, newPickup.trim()])
                      setNewPickup('')
                    }}
                    aria-label='Add pickup'
                  >
                    <Plus className='size-4' />
                  </Button>
                </div>
                <p className='text-xs text-muted-foreground'>Guardians on the account can always pick up.</p>
              </div>
              <Button type='submit' size='lg'>
                Save for coaches
              </Button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  )
}
