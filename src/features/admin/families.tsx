import { useMemo, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { format } from 'date-fns'
import { HeartPulse, Mail, MessageSquare, Phone } from 'lucide-react'
import { FORM_TEMPLATES } from '@/data/catalog'
import { familyRegs, programById, termById, useLookups, useWaitlistPosition } from '@/data/hooks'
import { useStore } from '@/data/store'
import { money } from '@/domain/pricing'
import { ageOn, outstandingForms } from '@/domain/rules'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Main } from '@/components/layout/main'
import { FleetChip, PageHeader, RegStatus } from '@/components/burgee/marks'

export function AdminFamilies({ familyId }: { familyId?: string }) {
  const navigate = useNavigate()
  const families = useStore((s) => s.families)
  const sailors = useStore((s) => s.sailors)
  const regs = useStore((s) => s.registrations)
  const submissions = useStore((s) => s.submissions)
  const season = useStore((s) => s.settings.season)
  const [q, setQ] = useState('')

  const rows = useMemo(() => {
    const needle = q.toLowerCase()
    return families
      .map((f) => {
        const kids = sailors.filter((s) => s.familyId === f.id)
        const fr = familyRegs(regs, sailors, f.id)
        const live = fr.filter((r) => r.status !== 'cancelled')
        const balance = live.filter((r) => r.status === 'pending-payment').reduce((s, r) => s + r.price - r.paid, 0)
        const formsDue = live.length
          ? kids.reduce((s, k) => s + outstandingForms(k, FORM_TEMPLATES, submissions, season).length, 0)
          : 0
        return { f, kids, registrations: live.length, balance, formsDue }
      })
      .filter(({ f, kids }) =>
        `${f.name} ${f.guardians.map((g) => g.name).join(' ')} ${kids.map((k) => k.firstName).join(' ')}`.toLowerCase().includes(needle)
      )
      .sort((a, b) => a.f.name.localeCompare(b.f.name))
  }, [families, sailors, regs, submissions, season, q])

  return (
    <Main>
      <PageHeader title='Families' description={`${families.length} households, ${sailors.length} junior sailors.`} />
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder='Search family, parent or sailor' className='mb-4 h-9 w-72' aria-label='Search families' />
      <div className='overflow-x-auto rounded-lg border bg-card'>
        <table className='w-full min-w-[760px] text-sm'>
          <thead className='border-b text-xs text-muted-foreground'>
            <tr>
              <th className='px-4 py-2 text-start font-medium'>Family</th>
              <th className='px-4 py-2 text-start font-medium'>Sailors</th>
              <th className='px-4 py-2 text-start font-medium'>Membership</th>
              <th className='px-4 py-2 text-end font-medium'>Registrations</th>
              <th className='px-4 py-2 text-end font-medium'>Forms due</th>
              <th className='px-4 py-2 text-end font-medium'>Balance</th>
            </tr>
          </thead>
          <tbody className='divide-y'>
            {rows.map(({ f, kids, registrations, balance, formsDue }) => (
              <tr key={f.id} className='cursor-pointer hover:bg-muted/40' onClick={() => navigate({ to: '/admin/families', search: { family: f.id } })}>
                <td className='px-4 py-2.5'>
                  <Link to='/admin/families' search={{ family: f.id }} className='font-medium hover:underline'>
                    {f.name}
                  </Link>
                  <span className='block text-xs text-muted-foreground'>{f.guardians.map((g) => g.name.split(' ')[0]).join(' & ')}</span>
                </td>
                <td className='px-4 py-2.5'>
                  <span className='flex flex-wrap gap-x-3 gap-y-1'>
                    {kids.map((k) => (
                      <span key={k.id} className='inline-flex items-center gap-1.5'>
                        {k.firstName}
                        <FleetChip level={k.level} className='text-muted-foreground' />
                      </span>
                    ))}
                  </span>
                </td>
                <td className='px-4 py-2.5'>{f.membership === 'member' ? f.memberNumber : <span className='text-muted-foreground'>Non-member</span>}</td>
                <td className='px-4 py-2.5 text-end'>{registrations}</td>
                <td className='px-4 py-2.5 text-end'>{formsDue ? <span className='font-medium text-signal'>{formsDue}</span> : <span className='text-muted-foreground'>0</span>}</td>
                <td className='px-4 py-2.5 text-end'>{balance ? money(balance) : <span className='text-muted-foreground'>—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <FamilySheet familyId={familyId} onClose={() => navigate({ to: '/admin/families', search: {} })} />
    </Main>
  )
}

function FamilySheet({ familyId, onClose }: { familyId?: string; onClose: () => void }) {
  const look = useLookups()
  const sailors = useStore((s) => s.sailors)
  const regs = useStore((s) => s.registrations)
  const submissions = useStore((s) => s.submissions)
  const season = useStore((s) => s.settings.season)
  const positions = useWaitlistPosition()
  const f = familyId ? look.family.get(familyId) : undefined
  const kids = f ? sailors.filter((s) => s.familyId === f.id) : []
  const fr = f ? familyRegs(regs, sailors, f.id).sort((a, b) => look.session.get(a.sessionId)!.startDate.localeCompare(look.session.get(b.sessionId)!.startDate)) : []

  return (
    <Sheet open={!!f} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className='w-full overflow-y-auto sm:max-w-lg'>
        {f && (
          <>
            <SheetHeader>
              <SheetTitle className='font-display text-xl'>{f.name} family</SheetTitle>
              <SheetDescription>
                {f.membership === 'member' ? `Member ${f.memberNumber}` : 'Non-member'}. {f.address}.
              </SheetDescription>
            </SheetHeader>
            <div className='space-y-6 px-4 pb-8'>
              <section>
                <h3 className='mb-2 text-sm font-semibold'>Guardians</h3>
                <ul className='space-y-3'>
                  {f.guardians.map((g) => (
                    <li key={g.email} className='rounded-md border p-3 text-sm'>
                      <p className='font-medium'>
                        {g.name} <span className='font-normal text-muted-foreground'>({g.relationship})</span>
                      </p>
                      <p className='mt-1 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground'>
                        <a href={`mailto:${g.email}`} className='inline-flex items-center gap-1 hover:text-foreground'>
                          <Mail className='size-3.5' />
                          {g.email}
                        </a>
                        <a href={`tel:${g.phone}`} className='inline-flex items-center gap-1 hover:text-foreground'>
                          <Phone className='size-3.5' />
                          {g.phone}
                        </a>
                        <span className='inline-flex items-center gap-1'>
                          <MessageSquare className='size-3.5' />
                          {g.smsOptIn ? 'Texts on' : 'Email only'}
                        </span>
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
              {kids.map((k) => {
                const due = outstandingForms(k, FORM_TEMPLATES, submissions, season)
                const kr = fr.filter((r) => r.sailorId === k.id && r.status !== 'cancelled')
                return (
                  <section key={k.id}>
                    <div className='mb-2 flex items-baseline justify-between gap-2'>
                      <h3 className='font-semibold'>
                        {k.firstName}, {ageOn(k.dob, format(new Date(), 'yyyy-MM-dd'))}
                      </h3>
                      <FleetChip level={k.level} />
                    </div>
                    {k.medicalAlerts.length > 0 && (
                      <p className='mb-2 flex items-center gap-1.5 text-sm text-destructive'>
                        <HeartPulse className='size-4' /> {k.medicalAlerts.join(', ')}
                      </p>
                    )}
                    <p className='mb-2 text-sm text-muted-foreground'>
                      {due.length ? (
                        <span className='text-signal'>Missing {due.map((d) => d.short.toLowerCase()).join(', ')}</span>
                      ) : (
                        `All ${season} forms signed`
                      )}
                    </p>
                    <ul className='divide-y rounded-md border text-sm'>
                      {kr.map((r) => {
                        const se = look.session.get(r.sessionId)!
                        return (
                          <li key={r.id} className='flex items-center gap-3 px-3 py-2'>
                            <span className='min-w-0 flex-1'>
                              <Link to='/admin/sessions/$sessionId' params={{ sessionId: se.id }} className='hover:underline'>
                                {programById.get(se.programId)?.name}, {se.name}
                              </Link>
                              <span className='block text-xs text-muted-foreground'>{termById.get(se.termId)?.name}</span>
                            </span>
                            <RegStatus status={r.status} position={positions.get(r.id)} />
                          </li>
                        )
                      })}
                      {kr.length === 0 && <li className='px-3 py-2 text-muted-foreground'>No registrations this year</li>}
                    </ul>
                  </section>
                )
              })}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
