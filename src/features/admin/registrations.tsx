import { useMemo, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { format } from 'date-fns'
import { MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { PROGRAMS, TERMS } from '@/data/catalog'
import { programById, termById, useLookups, useNow, useWaitlistPosition } from '@/data/hooks'
import { useStore } from '@/data/store'
import { money } from '@/domain/pricing'
import type { RegistrationStatus } from '@/domain/types'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Main } from '@/components/layout/main'
import { FleetChip, OfferCountdown, PageHeader, RegStatus } from '@/components/burgee/marks'

const STATUS_TABS: { value: RegistrationStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All active' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'pending-payment', label: 'Balance due' },
  { value: 'waitlisted', label: 'Waitlist' },
  { value: 'offered', label: 'Offers out' },
  { value: 'cancelled', label: 'Cancelled' },
]

const PAGE = 25

export function AdminRegistrations({ status = 'all' }: { status?: string }) {
  const navigate = useNavigate()
  const regs = useStore((s) => s.registrations)
  const look = useLookups()
  const positions = useWaitlistPosition()
  const now = useNow()
  const confirm = useStore((s) => s.confirmRegistration)
  const cancel = useStore((s) => s.cancelRegistration)
  const offer = useStore((s) => s.offerSpot)
  const holdHours = useStore((s) => s.settings.waitlist.holdHours)
  const [term, setTerm] = useState('all')
  const [program, setProgram] = useState('all')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0 }
    for (const r of regs) {
      c[r.status] = (c[r.status] ?? 0) + 1
      if (r.status !== 'cancelled') c.all++
    }
    return c
  }, [regs])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return regs
      .filter((r) => (status === 'all' ? r.status !== 'cancelled' : r.status === status))
      .filter((r) => {
        const se = look.session.get(r.sessionId)!
        if (term !== 'all' && se.termId !== term) return false
        if (program !== 'all' && se.programId !== program) return false
        if (needle) {
          const s = look.sailor.get(r.sailorId)!
          const f = look.family.get(s.familyId)!
          const hay = `${s.firstName} ${s.lastName} ${f.name} ${f.guardians.map((g) => g.name).join(' ')}`.toLowerCase()
          if (!hay.includes(needle)) return false
        }
        return true
      })
      .sort((a, b) => {
        if (status === 'waitlisted') return (positions.get(a.id) ?? 0) - (positions.get(b.id) ?? 0) || a.sessionId.localeCompare(b.sessionId)
        return b.createdAt.localeCompare(a.createdAt)
      })
  }, [regs, status, term, program, q, look, positions])

  const pageRows = rows.slice(page * PAGE, page * PAGE + PAGE)
  const pages = Math.max(1, Math.ceil(rows.length / PAGE))

  return (
    <Main>
      <PageHeader
        title='Registrations'
        description='Every sign-up across camps and teams. Cancelling a confirmed seat re-runs that session’s waitlist right away.'
      />
      <div className='mb-4 flex flex-wrap gap-1 rounded-lg bg-muted p-1' role='tablist' aria-label='Status'>
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            role='tab'
            aria-selected={status === t.value}
            onClick={() => {
              setPage(0)
              navigate({ to: '/admin/registrations', search: t.value === 'all' ? {} : { status: t.value } })
            }}
            className='rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground aria-selected:bg-card aria-selected:text-foreground aria-selected:shadow-sm'
          >
            {t.label}
            <span className='ms-1.5 text-xs opacity-70'>{counts[t.value] ?? 0}</span>
          </button>
        ))}
      </div>
      <div className='mb-4 flex flex-wrap items-center gap-2'>
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(0)
          }}
          placeholder='Search sailor or family'
          className='h-9 w-64'
          aria-label='Search registrations'
        />
        <Select value={term} onValueChange={(v) => { setTerm(v); setPage(0) }}>
          <SelectTrigger className='h-9 w-40' aria-label='Term'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All terms</SelectItem>
            {TERMS.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={program} onValueChange={(v) => { setProgram(v); setPage(0) }}>
          <SelectTrigger className='h-9 w-52' aria-label='Program'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All programs</SelectItem>
            {PROGRAMS.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className='ms-auto text-sm text-muted-foreground'>{rows.length} registrations</span>
      </div>

      <div className='overflow-x-auto rounded-lg border bg-card'>
        <table className='w-full min-w-[900px] text-sm'>
          <thead className='border-b text-xs text-muted-foreground'>
            <tr>
              <th className='px-4 py-2 text-start font-medium'>Sailor</th>
              <th className='px-4 py-2 text-start font-medium'>Family</th>
              <th className='px-4 py-2 text-start font-medium'>Session</th>
              <th className='px-4 py-2 text-start font-medium'>Signed up</th>
              <th className='px-4 py-2 text-start font-medium'>Status</th>
              <th className='px-4 py-2 text-end font-medium'>Paid</th>
              <th className='w-12 px-2 py-2'>
                <span className='sr-only'>Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className='divide-y'>
            {pageRows.map((r) => {
              const s = look.sailor.get(r.sailorId)!
              const f = look.family.get(s.familyId)!
              const se = look.session.get(r.sessionId)!
              const p = programById.get(se.programId)!
              return (
                <tr key={r.id} className='hover:bg-muted/40'>
                  <td className='px-4 py-2.5'>
                    <span className='block font-medium'>
                      {s.firstName} {s.lastName}
                    </span>
                    <FleetChip level={s.level} />
                  </td>
                  <td className='px-4 py-2.5'>
                    <Link to='/admin/families' search={{ family: f.id }} className='hover:underline'>
                      {f.name}
                    </Link>
                    <span className='block text-xs text-muted-foreground'>{f.membership === 'member' ? 'Member' : 'Non-member'}</span>
                  </td>
                  <td className='px-4 py-2.5'>
                    <Link to='/admin/sessions/$sessionId' params={{ sessionId: se.id }} className='hover:underline'>
                      {p.name}, {se.name}
                    </Link>
                    <span className='block text-xs text-muted-foreground'>{termById.get(se.termId)?.name}</span>
                  </td>
                  <td className='px-4 py-2.5 text-muted-foreground'>{format(new Date(r.createdAt), 'MMM d')}</td>
                  <td className='px-4 py-2.5'>
                    <RegStatus status={r.status} position={positions.get(r.id)} />
                    {r.status === 'offered' && r.offerExpiresAt && (
                      <span className='block text-xs'>
                        <OfferCountdown expiresAt={r.offerExpiresAt} now={now} />
                      </span>
                    )}
                  </td>
                  <td className='px-4 py-2.5 text-end'>
                    {money(r.paid)}
                    <span className='block text-xs text-muted-foreground'>of {money(r.price)}</span>
                  </td>
                  <td className='px-2 py-2.5 text-end'>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant='ghost' size='icon' className='size-8' aria-label={`Actions for ${s.firstName}`}>
                          <MoreHorizontal className='size-4' />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align='end'>
                        {(r.status === 'pending-payment' || r.status === 'offered') && (
                          <DropdownMenuItem onClick={() => { confirm(r.id); toast.success(`${s.firstName} confirmed and marked paid`) }}>
                            Confirm and mark paid
                          </DropdownMenuItem>
                        )}
                        {r.status === 'waitlisted' && (
                          <DropdownMenuItem onClick={() => { offer(r.id); toast.success(`Spot offered to the ${f.name} family, held ${holdHours}h`) }}>
                            Offer a spot now
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem asChild>
                          <Link to='/admin/sessions/$sessionId' params={{ sessionId: se.id }}>
                            Open session
                          </Link>
                        </DropdownMenuItem>
                        {r.status !== 'cancelled' && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant='destructive'
                              onClick={() => {
                                cancel(r.id)
                                toast(`Registration cancelled${r.status === 'confirmed' || r.status === 'offered' ? '. The next family on the waitlist was offered the seat.' : ''}`)
                              }}
                            >
                              Cancel registration
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              )
            })}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={7} className='px-4 py-10 text-center text-muted-foreground'>
                  No registrations match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className='mt-3 flex items-center justify-end gap-2 text-sm'>
          <span className='text-muted-foreground'>
            Page {page + 1} of {pages}
          </span>
          <Button variant='outline' size='sm' disabled={page === 0} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <Button variant='outline' size='sm' disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      )}
    </Main>
  )
}
