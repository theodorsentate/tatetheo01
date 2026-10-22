import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { format } from 'date-fns'
import { ClipboardX, HeartPulse, LifeBuoy, StickyNote } from 'lucide-react'
import { FORM_TEMPLATES, PROGRAMS } from '@/data/catalog'
import { programById, useLookups } from '@/data/hooks'
import { useStore } from '@/data/store'
import { latestSwimCheck } from '@/domain/attendance'
import { ACTIVE_STATUSES } from '@/domain/pricing'
import { ageOn, LEVELS, outstandingForms } from '@/domain/rules'
import type { Level } from '@/domain/types'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Main } from '@/components/layout/main'
import { FleetChip, PageHeader } from '@/components/burgee/marks'

type Flag = 'medical' | 'forms' | 'swim' | 'note'

export function SailorsDirectory() {
  const navigate = useNavigate()
  const sailors = useStore((s) => s.sailors)
  const regs = useStore((s) => s.registrations)
  const submissions = useStore((s) => s.submissions)
  const swimChecks = useStore((s) => s.swimChecks)
  const season = useStore((s) => s.settings.season)
  const look = useLookups()
  const [q, setQ] = useState('')
  const [level, setLevel] = useState('all')
  const [program, setProgram] = useState('all')
  const [flags, setFlags] = useState<Flag[]>([])
  const today = format(new Date(), 'yyyy-MM-dd')

  const rows = useMemo(() => {
    const live = regs.filter((r) => ACTIVE_STATUSES.has(r.status))
    return sailors
      .map((k) => {
        const mine = live.filter((r) => r.sailorId === k.id)
        const programs = [...new Set(mine.map((r) => look.session.get(r.sessionId)!.programId))]
        return {
          k,
          programs,
          formsDue: mine.length ? outstandingForms(k, FORM_TEMPLATES, submissions, season).length : 0,
          swimOk: latestSwimCheck(swimChecks, k.id)?.result === 'passed',
          fam: look.family.get(k.familyId)!,
        }
      })
      .filter((r) => `${r.k.firstName} ${r.k.lastName} ${r.fam.name}`.toLowerCase().includes(q.toLowerCase()))
      .filter((r) => level === 'all' || r.k.level === level)
      .filter((r) => program === 'all' || r.programs.includes(program))
      .filter((r) =>
        flags.every((f) =>
          f === 'medical' ? r.k.medicalAlerts.length > 0 : f === 'forms' ? r.formsDue > 0 : f === 'swim' ? r.programs.length > 0 && !r.swimOk : !!r.k.parentNote
        )
      )
      .sort((a, b) => a.k.lastName.localeCompare(b.k.lastName) || a.k.firstName.localeCompare(b.k.firstName))
  }, [sailors, regs, submissions, swimChecks, season, look, q, level, program, flags])

  const toggle = (f: Flag) => setFlags(flags.includes(f) ? flags.filter((x) => x !== f) : [...flags, f])

  return (
    <Main>
      <PageHeader title='Sailors' description={`Every junior at the club: ${sailors.length} sailors across ${new Set(sailors.map((s) => s.familyId)).size} families.`} />
      <div className='mb-3 flex flex-wrap items-center gap-2'>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder='Search sailor or family' className='h-9 w-60' aria-label='Search sailors' />
        <Select value={level} onValueChange={setLevel}>
          <SelectTrigger className='h-9 w-44' aria-label='Fleet'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All fleets</SelectItem>
            {(Object.keys(LEVELS) as Level[])
              .filter((l) => l !== 'swim' && l !== 'tennis')
              .map((l) => (
                <SelectItem key={l} value={l}>
                  {LEVELS[l].label}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Select value={program} onValueChange={setProgram}>
          <SelectTrigger className='h-9 w-52' aria-label='Program'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>Any program</SelectItem>
            {PROGRAMS.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className='mb-4 flex flex-wrap items-center gap-4 text-sm'>
        {(
          [
            ['medical', 'Medical alerts'],
            ['forms', 'Forms missing'],
            ['swim', 'Needs swim check'],
            ['note', 'Has a parent note'],
          ] as [Flag, string][]
        ).map(([f, label]) => (
          <label key={f} className='flex items-center gap-2'>
            <Checkbox checked={flags.includes(f)} onCheckedChange={() => toggle(f)} /> {label}
          </label>
        ))}
        <span className='ms-auto text-muted-foreground'>{rows.length} sailors</span>
      </div>
      <div className='overflow-x-auto rounded-lg border bg-card'>
        <table className='w-full min-w-[860px] text-sm'>
          <thead className='border-b text-xs text-muted-foreground'>
            <tr>
              <th className='px-4 py-2 text-start font-medium'>Sailor</th>
              <th className='px-4 py-2 text-start font-medium'>Fleet</th>
              <th className='px-4 py-2 text-start font-medium'>Family</th>
              <th className='px-4 py-2 text-start font-medium'>Signed up for</th>
              <th className='px-4 py-2 text-start font-medium'>Flags</th>
            </tr>
          </thead>
          <tbody className='divide-y'>
            {rows.slice(0, 150).map(({ k, programs, formsDue, swimOk, fam }) => (
              <tr key={k.id} className='cursor-pointer hover:bg-muted/40' onClick={() => navigate({ to: '/admin/families', search: { family: k.familyId } })}>
                <td className='px-4 py-2.5'>
                  <span className='block font-medium'>
                    {k.firstName} {k.lastName}
                  </span>
                  <span className='text-xs text-muted-foreground'>Age {ageOn(k.dob, today)}</span>
                </td>
                <td className='px-4 py-2.5'>
                  <FleetChip level={k.level} />
                </td>
                <td className='px-4 py-2.5'>
                  {fam.name}
                  <span className='block text-xs text-muted-foreground'>{fam.guardians[0].phone}</span>
                </td>
                <td className='px-4 py-2.5 text-xs'>
                  {programs.length ? (
                    <span className='flex flex-wrap gap-1'>
                      {programs.map((p) => (
                        <span key={p} className='rounded-full bg-muted px-2 py-0.5'>
                          {programById.get(p)?.name}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className='text-muted-foreground'>Nothing this year</span>
                  )}
                </td>
                <td className='px-4 py-2.5'>
                  <span className='flex items-center gap-2'>
                    {k.medicalAlerts.length > 0 && (
                      <HeartPulse className='size-4 text-destructive' aria-label={`Medical: ${k.medicalAlerts.join(', ')}`}>
                        <title>{k.medicalAlerts.join(', ')}</title>
                      </HeartPulse>
                    )}
                    {formsDue > 0 && (
                      <ClipboardX className='size-4 text-signal' aria-label={`${formsDue} forms missing`}>
                        <title>{formsDue} forms missing</title>
                      </ClipboardX>
                    )}
                    {programs.length > 0 && !swimOk && (
                      <LifeBuoy className='size-4 text-signal' aria-label='Needs a swim check'>
                        <title>Needs a swim check</title>
                      </LifeBuoy>
                    )}
                    {k.parentNote && (
                      <StickyNote className='size-4 text-muted-foreground' aria-label='Parent note'>
                        <title>{k.parentNote.text}</title>
                      </StickyNote>
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Main>
  )
}
