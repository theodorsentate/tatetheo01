import { useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { PROGRAMS, TERMS } from '@/data/catalog'
import { useStore } from '@/data/store'
import { money, quoteCart } from '@/domain/pricing'
import type { Family, Sailor } from '@/domain/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/burgee/marks'

function NumberField({
  id,
  label,
  value,
  onChange,
  suffix,
  prefix,
  min = 0,
  max,
  hint,
}: {
  id: string
  label: string
  value: number
  onChange: (n: number) => void
  suffix?: string
  prefix?: string
  min?: number
  max?: number
  hint?: string
}) {
  return (
    <div className='grid gap-1.5'>
      <Label htmlFor={id}>{label}</Label>
      <div className='flex items-center gap-2'>
        {prefix && <span className='text-sm text-muted-foreground'>{prefix}</span>}
        <Input
          id={id}
          type='number'
          inputMode='decimal'
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
          className='h-9 w-28'
        />
        {suffix && <span className='text-sm text-muted-foreground'>{suffix}</span>}
      </div>
      {hint && <p className='text-xs text-muted-foreground'>{hint}</p>}
    </div>
  )
}

/** A made-up family used to preview how the current rules price a real cart. */
const PREVIEW_FAMILY: Family = {
  id: 'preview',
  name: 'Preview',
  membership: 'member',
  guardians: [],
  address: '',
  createdAt: '',
}
const PREVIEW_SAILORS: Sailor[] = [
  { id: 'p1', familyId: 'preview', firstName: 'Older sibling', lastName: '', dob: '2015-03-01', level: 'opti-white', shirtSize: 'YL', medicalAlerts: [] },
  { id: 'p2', familyId: 'preview', firstName: 'Younger sibling', lastName: '', dob: '2018-06-01', level: 'opti-green', shirtSize: 'YS', medicalAlerts: [] },
]

export function AdminSettings({ tab = 'pricing' }: { tab?: string }) {
  const navigate = useNavigate()
  const settings = useStore((s) => s.settings)
  const sessions = useStore((s) => s.sessions)
  const updatePricing = useStore((s) => s.updatePricing)
  const updateTier = useStore((s) => s.updateTier)
  const updateSettings = useStore((s) => s.updateSettings)
  const p = settings.pricing

  const preview = useMemo(() => {
    const items = [
      ...[1, 2, 3, 4].map((w) => ({ sailorId: 'p1', sessionId: `rwb-camp-w${w}` })),
      { sailorId: 'p2', sessionId: 'green-camp-w2' },
    ]
    const now = new Date()
    const run = (membership: Family['membership']) =>
      quoteCart(items, {
        pricing: p,
        family: { ...PREVIEW_FAMILY, membership },
        sailors: PREVIEW_SAILORS,
        sessions,
        programs: PROGRAMS,
        terms: TERMS,
        existing: [],
        now,
      })
    return { member: run('member'), nonMember: run('non-member') }
  }, [p, sessions])

  return (
    <Main>
      <PageHeader title='Settings' description='Changes apply to new registrations. Existing ones keep their price.' />
      <Tabs value={tab} onValueChange={(v) => navigate({ to: '/admin/settings', search: { tab: v } })}>
        <TabsList>
          <TabsTrigger value='pricing'>Pricing</TabsTrigger>
          <TabsTrigger value='waitlist'>Waitlist</TabsTrigger>
          <TabsTrigger value='club'>Club & staff rules</TabsTrigger>
        </TabsList>

        <TabsContent value='pricing' className='mt-6'>
          <div className='grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]'>
            <div className='space-y-6'>
              <section className='rounded-lg border bg-card'>
                <h2 className='border-b px-4 py-3 font-semibold'>Rates</h2>
                <table className='w-full text-sm'>
                  <thead className='text-xs text-muted-foreground'>
                    <tr>
                      <th className='px-4 py-2 text-start font-medium'>Pricing tier</th>
                      <th className='px-4 py-2 text-start font-medium'>Used by</th>
                      <th className='px-4 py-2 text-start font-medium'>Member</th>
                      <th className='px-4 py-2 text-start font-medium'>Non-member</th>
                    </tr>
                  </thead>
                  <tbody className='divide-y'>
                    {p.tiers.map((t) => (
                      <tr key={t.id}>
                        <td className='px-4 py-2.5 font-medium'>
                          {t.name}
                          <span className='block text-xs font-normal text-muted-foreground'>per {t.unit}</span>
                        </td>
                        <td className='px-4 py-2.5 text-xs text-muted-foreground'>
                          {PROGRAMS.filter((x) => x.pricingTierId === t.id)
                            .map((x) => x.name)
                            .join(', ')}
                        </td>
                        {(['member', 'nonMember'] as const).map((k) => (
                          <td key={k} className='px-4 py-2.5'>
                            <span className='flex items-center gap-1'>
                              <span className='text-muted-foreground'>$</span>
                              <Input
                                type='number'
                                min={0}
                                step={5}
                                aria-label={`${t.name} ${k === 'member' ? 'member' : 'non-member'} rate`}
                                value={t[k]}
                                onChange={(e) => updateTier(t.id, { [k]: Math.max(0, Number(e.target.value) || 0) })}
                                className='h-9 w-24'
                              />
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
              <section className='rounded-lg border bg-card p-4'>
                <h2 className='mb-4 font-semibold'>Discounts & fees</h2>
                <div className='grid gap-5 sm:grid-cols-2'>
                  <NumberField id='sib' label='Sibling discount' suffix='% off each additional child' value={p.siblingDiscountPct} max={100} onChange={(n) => updatePricing({ siblingDiscountPct: n })} />
                  <NumberField id='eb' label='Early bird' suffix='% off' value={p.earlyBirdPct} max={100} onChange={(n) => updatePricing({ earlyBirdPct: n })} hint='Applies until each term’s early-bird date.' />
                  <div className='grid gap-1.5'>
                    <Label htmlFor='mw'>Multi-week discount</Label>
                    <div className='flex flex-wrap items-center gap-2 text-sm text-muted-foreground'>
                      <Input id='mw' type='number' min={0} max={100} value={p.multiWeekDiscountPct} onChange={(e) => updatePricing({ multiWeekDiscountPct: Math.max(0, Number(e.target.value) || 0) })} className='h-9 w-20' />
                      % off when a sailor books
                      <Input aria-label='Minimum weeks' type='number' min={2} value={p.multiWeekMin} onChange={(e) => updatePricing({ multiWeekMin: Math.max(2, Number(e.target.value) || 2) })} className='h-9 w-16' />
                      or more camp weeks
                    </div>
                  </div>
                  <NumberField id='fee' label='Card processing fee passed to families' suffix='%' value={p.processingFeePct} max={5} onChange={(n) => updatePricing({ processingFeePct: n })} hint='Set to 0 to absorb card fees.' />
                </div>
              </section>
            </div>

            <aside className='h-fit rounded-lg border bg-card p-4 xl:sticky xl:top-20'>
              <h2 className='font-semibold'>What a family would pay</h2>
              <p className='mt-1 text-xs text-muted-foreground'>
                Two siblings booked today: four weeks of Opti Race Camp and one week of Opti Green Camp. Updates as you edit.
              </p>
              <ul className='mt-4 space-y-2 text-sm'>
                {preview.member.items.map((it, i) => (
                  <li key={i}>
                    <div className='flex justify-between gap-2'>
                      <span>{it.sailorId === 'p1' ? 'Older sibling' : 'Younger sibling'}, {it.sessionId.includes('green') ? 'Green' : 'Race'} week {it.sessionId.slice(-1)}</span>
                      <span className='font-medium'>{money(it.total)}</span>
                    </div>
                    {it.lines.slice(1).map((l) => (
                      <div key={l.label} className='flex justify-between gap-2 text-xs text-muted-foreground'>
                        <span>{l.label}</span>
                        <span>{money(l.amount)}</span>
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
              <dl className='mt-4 space-y-1 border-t pt-3 text-sm'>
                <div className='flex justify-between'>
                  <dt className='text-muted-foreground'>Before discounts</dt>
                  <dd>{money(preview.member.subtotal)}</dd>
                </div>
                <div className='flex justify-between'>
                  <dt className='text-muted-foreground'>Discounts</dt>
                  <dd>−{money(preview.member.discounts)}</dd>
                </div>
                {preview.member.fee > 0 && (
                  <div className='flex justify-between'>
                    <dt className='text-muted-foreground'>Processing fee</dt>
                    <dd>{money(preview.member.fee)}</dd>
                  </div>
                )}
                <div className='flex justify-between text-base font-semibold'>
                  <dt>Member family pays</dt>
                  <dd>{money(preview.member.total)}</dd>
                </div>
                <div className='flex justify-between text-muted-foreground'>
                  <dt>Non-member family pays</dt>
                  <dd>{money(preview.nonMember.total)}</dd>
                </div>
              </dl>
            </aside>
          </div>
        </TabsContent>

        <TabsContent value='waitlist' className='mt-6 max-w-2xl'>
          <section className='divide-y rounded-lg border bg-card'>
            <div className='flex items-start justify-between gap-6 p-4'>
              <div>
                <Label htmlFor='mp' className='text-base'>Members go first</Label>
                <p className='mt-1 text-sm text-muted-foreground'>Members move ahead of non-members on every waitlist. Within each group it is first come, first served.</p>
              </div>
              <Switch id='mp' checked={settings.waitlist.memberPriority} onCheckedChange={(v) => updateSettings({ waitlist: { ...settings.waitlist, memberPriority: v } })} />
            </div>
            <div className='flex items-start justify-between gap-6 p-4'>
              <div>
                <Label htmlFor='ao' className='text-base'>Offer open spots automatically</Label>
                <p className='mt-1 text-sm text-muted-foreground'>When someone cancels or you raise capacity, the next family gets an email and text with a link to claim the spot.</p>
              </div>
              <Switch id='ao' checked={settings.waitlist.autoOffer} onCheckedChange={(v) => updateSettings({ waitlist: { ...settings.waitlist, autoOffer: v } })} />
            </div>
            <div className='p-4'>
              <NumberField
                id='hold'
                label='Hold a spot for'
                suffix='hours before offering it to the next family'
                min={1}
                max={168}
                value={settings.waitlist.holdHours}
                onChange={(n) => updateSettings({ waitlist: { ...settings.waitlist, holdHours: Math.max(1, n) } })}
              />
            </div>
          </section>
        </TabsContent>

        <TabsContent value='club' className='mt-6 max-w-2xl'>
          <form
            className='grid gap-4 rounded-lg border bg-card p-4'
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              updateSettings({
                clubName: String(fd.get('clubName')),
                shortName: String(fd.get('shortName')),
                supportEmail: String(fd.get('supportEmail')),
                certWarningDays: Number(fd.get('warn')) || 45,
              })
              toast.success('Club settings saved')
            }}
          >
            <div className='grid gap-1.5'>
              <Label htmlFor='clubName'>Club name</Label>
              <Input id='clubName' name='clubName' defaultValue={settings.clubName} />
            </div>
            <div className='grid gap-1.5 sm:grid-cols-2 sm:gap-4'>
              <div className='grid gap-1.5'>
                <Label htmlFor='shortName'>Short name</Label>
                <Input id='shortName' name='shortName' defaultValue={settings.shortName} />
              </div>
              <div className='grid gap-1.5'>
                <Label htmlFor='supportEmail'>Reply-to email for families</Label>
                <Input id='supportEmail' name='supportEmail' type='email' defaultValue={settings.supportEmail} />
              </div>
            </div>
            <div className='grid gap-1.5'>
              <Label htmlFor='warn'>Warn about expiring certifications</Label>
              <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                <Input id='warn' name='warn' type='number' min={7} max={180} defaultValue={settings.certWarningDays} className='h-9 w-24' />
                days ahead
              </div>
            </div>
            <div>
              <Button type='submit'>Save club settings</Button>
            </div>
          </form>
        </TabsContent>
      </Tabs>
    </Main>
  )
}
