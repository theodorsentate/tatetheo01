import { HeartPulse, MapPin, Phone, Radio, Stethoscope } from 'lucide-react'
import { useLookups } from '@/data/hooks'
import { useStore } from '@/data/store'
import type { Sailor } from '@/domain/types'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'

const tel = (n: string) => `tel:${n.replace(/[^\d+]/g, '')}`

/**
 * Everything a coach needs in an emergency, for their own group only:
 * where to send EMS, the radio channel, then each sailor's contacts and
 * medical details. Coaches never see families outside their groups.
 */
export function EmergencyCard({ open, onClose, sailors, groupName }: { open: boolean; onClose: () => void; sailors: Sailor[]; groupName: string }) {
  const settings = useStore((s) => s.settings)
  const submissions = useStore((s) => s.submissions)
  const look = useLookups()
  const e = settings.emergency
  const medicalFor = (id: string) => submissions.find((x) => x.templateId === 'medical' && x.sailorId === id && x.season === settings.season)?.values

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side='bottom' className='max-h-[92svh] overflow-y-auto rounded-t-2xl'>
        <SheetHeader>
          <SheetTitle className='text-destructive'>Emergency card</SheetTitle>
          <SheetDescription>{groupName}. Call 911 first for anything serious.</SheetDescription>
        </SheetHeader>
        <div className='space-y-5 px-4 pb-8'>
          <a href='tel:911' className='flex items-center justify-center gap-2 rounded-xl bg-destructive py-3 text-lg font-semibold text-white'>
            <Phone className='size-5' /> Call 911
          </a>
          <dl className='grid gap-2 rounded-xl border p-3 text-sm'>
            <div className='flex gap-2'>
              <MapPin className='mt-0.5 size-4 shrink-0 text-muted-foreground' />
              <div>
                <dt className='text-xs text-muted-foreground'>Tell EMS to come to</dt>
                <dd className='font-medium'>{e.address}</dd>
              </div>
            </div>
            <div className='flex gap-2'>
              <Radio className='mt-0.5 size-4 shrink-0 text-muted-foreground' />
              <div>
                <dt className='text-xs text-muted-foreground'>Radio</dt>
                <dd className='font-medium'>{e.vhf}</dd>
              </div>
            </div>
            <div className='flex gap-2'>
              <Stethoscope className='mt-0.5 size-4 shrink-0 text-muted-foreground' />
              <div>
                <dt className='text-xs text-muted-foreground'>Nearest hospital</dt>
                <dd className='font-medium'>{e.hospital}</dd>
              </div>
            </div>
            <div className='flex gap-2'>
              <Phone className='mt-0.5 size-4 shrink-0 text-muted-foreground' />
              <div>
                <dt className='text-xs text-muted-foreground'>Harbormaster</dt>
                <dd>
                  <a href={tel(e.harbormaster)} className='font-medium text-heading underline'>
                    {e.harbormaster}
                  </a>
                </dd>
              </div>
            </div>
          </dl>

          <section aria-label='Sailors'>
            <h3 className='mb-2 text-sm font-semibold'>Your sailors</h3>
            <ul className='space-y-2'>
              {sailors.map((k) => {
                const fam = look.family.get(k.familyId)
                const med = medicalFor(k.id)
                const real = (v?: string) => (v && !/^(none|n\/?a|no|nothing)\.?$/i.test(v.trim()) ? v.trim() : undefined)
                const special = [real(med?.allergies), real(med?.medications) && `Takes ${real(med?.medications)}`, real(med?.conditions)].filter(Boolean)
                return (
                  <li key={k.id} className='rounded-xl border p-3 text-sm'>
                    <p className='font-semibold'>
                      {k.firstName} {k.lastName}
                    </p>
                    {(k.medicalAlerts.length > 0 || special.length > 0) && (
                      <p className='mt-1 flex items-start gap-1.5 font-medium text-destructive'>
                        <HeartPulse className='mt-0.5 size-4 shrink-0' />
                        {[...new Set([...k.medicalAlerts, ...special])].join('. ')}
                      </p>
                    )}
                    {!med && <p className='mt-1 text-xs font-medium text-signal'>No medical form on file yet.</p>}
                    <ul className='mt-2 grid grid-cols-1 gap-1'>
                      {fam?.guardians.map((g) => (
                        <li key={g.phone} className='flex min-w-0 items-center justify-between gap-2'>
                          <span className='min-w-0 truncate'>
                            {g.name} <span className='text-muted-foreground'>({g.relationship.toLowerCase()})</span>
                          </span>
                          <a href={tel(g.phone)} className='flex shrink-0 items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium'>
                            <Phone className='size-3.5' /> {g.phone}
                          </a>
                        </li>
                      ))}
                      {med?.emergencyName && (
                        <li className='flex min-w-0 items-center justify-between gap-2'>
                          <span className='min-w-0 truncate'>
                            {med.emergencyName} <span className='text-muted-foreground'>(emergency contact)</span>
                          </span>
                          {med.emergencyPhone && (
                            <a href={tel(med.emergencyPhone)} className='flex shrink-0 items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium'>
                              <Phone className='size-3.5' /> {med.emergencyPhone}
                            </a>
                          )}
                        </li>
                      )}
                    </ul>
                    {med?.physician && <p className='mt-1.5 text-xs text-muted-foreground'>Doctor: {med.physician}</p>}
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
