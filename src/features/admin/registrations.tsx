import { useMemo, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Download, FileUp, MoreHorizontal, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { csvObjects } from '@/lib/csv'
import { saveFile, toCsv } from '@/lib/files'
import { PROGRAMS, TERMS } from '@/data/catalog'
import { programById, useLookups, useNow, useWaitlistPosition } from '@/data/hooks'
import { useStore, type ImportRow } from '@/data/store'
import { IMPORT_TEMPLATE, matchImportRows, type ImportMatch } from '@/domain/import'
import { LEVELS } from '@/domain/rules'
import type { Registration } from '@/domain/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Main } from '@/components/layout/main'
import { FleetChip, PageHeader } from '@/components/burgee/marks'
import { format } from 'date-fns'

type Tab = 'signed-up' | 'waitlist' | 'cancelled'
const TABS: { value: Tab; label: string }[] = [
  { value: 'signed-up', label: 'Signed up' },
  { value: 'waitlist', label: 'Waitlist' },
  { value: 'cancelled', label: 'Cancelled' },
]
const inTab = (r: Registration, t: Tab) =>
  t === 'signed-up' ? r.status === 'confirmed' || r.status === 'pending-payment' || r.status === 'offered' : t === 'waitlist' ? r.status === 'waitlisted' : r.status === 'cancelled'

const PAGE = 30

/**
 * Who is signed up for which weeks, one row per sailor. Sign-ups and payments
 * happen in the club's registration system; Burgee imports them so coaches,
 * parents and the director all work from the same roster.
 */
export function AdminRegistrations({ status }: { status?: string }) {
  const navigate = useNavigate()
  const regs = useStore((s) => s.registrations)
  const cancel = useStore((s) => s.cancelRegistration)
  const look = useLookups()
  const positions = useWaitlistPosition()
  const today = format(useNow(60_000), 'yyyy-MM-dd')
  const tab: Tab = status === 'waitlist' || status === 'cancelled' ? status : 'signed-up'
  const currentTerm = TERMS.find((t) => t.endDate >= today)?.id ?? 'all'
  const [term, setTerm] = useState(currentTerm)
  const [program, setProgram] = useState('all')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const [importing, setImporting] = useState(false)

  const filtered = useMemo(
    () =>
      regs.filter((r) => {
        const se = look.session.get(r.sessionId)
        if (!se) return false
        if (term !== 'all' && se.termId !== term) return false
        if (program !== 'all' && se.programId !== program) return false
        return true
      }),
    [regs, term, program, look]
  )
  const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t.value, new Set(filtered.filter((r) => inTab(r, t.value)).map((r) => r.sailorId)).size])), [filtered])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const by = new Map<string, Registration[]>()
    for (const r of filtered.filter((x) => inTab(x, tab))) by.set(r.sailorId, [...(by.get(r.sailorId) ?? []), r])
    return [...by.entries()]
      .map(([sid, list]) => ({
        k: look.sailor.get(sid)!,
        list: list.sort((a, b) => look.session.get(a.sessionId)!.startDate.localeCompare(look.session.get(b.sessionId)!.startDate)),
      }))
      .filter(({ k }) => {
        if (!k) return false
        if (!needle) return true
        const f = look.family.get(k.familyId)
        return `${k.firstName} ${k.lastName} ${f?.name} ${f?.guardians.map((g) => g.name).join(' ')}`.toLowerCase().includes(needle)
      })
      .sort((a, b) => a.k.lastName.localeCompare(b.k.lastName) || a.k.firstName.localeCompare(b.k.firstName))
  }, [filtered, tab, q, look])

  const pageRows = rows.slice(page * PAGE, page * PAGE + PAGE)
  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  const weekLabel = (r: Registration) => {
    const se = look.session.get(r.sessionId)!
    const p = programById.get(se.programId)!
    return { p, text: p.format === 'camp' ? `${p.name.replace(/ Camp$/, '')} · W${se.name.replace('Week ', '')}` : `${p.name}, ${se.name}` }
  }

  return (
    <Main>
      <PageHeader
        title='Registrations'
        description='Who is signed up for which weeks. Sign-ups and payments stay in your registration system; bring them in here so coaches and parents work from the same roster.'
        actions={
          <Button onClick={() => setImporting(true)}>
            <Upload className='size-4' /> Import roster
          </Button>
        }
      />
      <div className='mb-4 flex flex-wrap gap-1 rounded-lg bg-muted p-1' role='tablist' aria-label='Status'>
        {TABS.map((t) => (
          <button
            key={t.value}
            role='tab'
            aria-selected={tab === t.value}
            onClick={() => {
              setPage(0)
              navigate({ to: '/admin/registrations', search: t.value === 'signed-up' ? {} : { status: t.value } })
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
          className='h-9 w-full sm:w-64'
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
        <span className='ms-auto text-sm text-muted-foreground'>{rows.length} sailors</span>
      </div>

      <ul className='divide-y rounded-lg border bg-card'>
        {pageRows.map(({ k, list }) => {
          const f = look.family.get(k.familyId)
          return (
            <li key={k.id} className='flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3'>
              <div className='w-48 min-w-0'>
                <p className='truncate font-medium'>
                  {k.firstName} {k.lastName}
                </p>
                <FleetChip level={k.level} />
              </div>
              <div className='w-48 min-w-0 text-sm'>
                <Link to='/admin/families' search={{ family: k.familyId }} className='block truncate hover:underline'>
                  {f?.guardians[0]?.name}
                </Link>
                <span className='block text-xs text-muted-foreground'>{f?.guardians[0]?.phone}</span>
              </div>
              <ul className='flex min-w-0 flex-1 flex-wrap gap-1.5'>
                {list.map((r) => {
                  const { p, text } = weekLabel(r)
                  const isNow = look.session.get(r.sessionId)!.startDate <= today && look.session.get(r.sessionId)!.endDate >= today
                  return (
                    <li key={r.id}>
                      <Link
                        to='/admin/sessions/$sessionId'
                        params={{ sessionId: r.sessionId }}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs hover:bg-muted',
                          isNow && 'border-heading font-medium',
                          r.status === 'waitlisted' && 'border-dashed text-muted-foreground'
                        )}
                      >
                        <span className='size-2 rounded-full' style={{ background: p.color }} aria-hidden='true' />
                        {text}
                        {r.status === 'waitlisted' && <span>#{positions.get(r.id)}</span>}
                      </Link>
                    </li>
                  )
                })}
              </ul>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant='ghost' size='icon' className='size-8' aria-label={`Actions for ${k.firstName}`}>
                    <MoreHorizontal className='size-4' />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end'>
                  <DropdownMenuItem asChild>
                    <Link to='/admin/families' search={{ family: k.familyId }}>
                      Open family
                    </Link>
                  </DropdownMenuItem>
                  {tab !== 'cancelled' && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className='text-xs font-normal text-muted-foreground'>Take off a week</DropdownMenuLabel>
                      {list.map((r) => (
                        <DropdownMenuItem
                          key={r.id}
                          variant='destructive'
                          onClick={() => {
                            cancel(r.id)
                            toast(`${k.firstName} is off ${weekLabel(r).text}`)
                          }}
                        >
                          {weekLabel(r).text}
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          )
        })}
        {pageRows.length === 0 && <li className='px-4 py-10 text-center text-sm text-muted-foreground'>No sailors match these filters.</li>}
      </ul>
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
      <ImportDialog open={importing} onClose={() => setImporting(false)} />
    </Main>
  )
}

function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const sessions = useStore((s) => s.sessions)
  const importRoster = useStore((s) => s.importRoster)
  const [rows, setRows] = useState<ImportMatch[] | null>(null)
  const [fileName, setFileName] = useState('')
  const good = rows?.filter((r) => !r.error) ?? []
  const bad = rows?.filter((r) => r.error) ?? []
  const reset = () => {
    setRows(null)
    setFileName('')
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onClose()
          reset()
        }
      }}
    >
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>Import a roster</DialogTitle>
          <DialogDescription>
            A spreadsheet saved as CSV, or the registration export from Clubspot or another system. One row per sailor per week. Families are matched by parent email, so importing twice won’t create duplicates.
          </DialogDescription>
        </DialogHeader>
        {!rows ? (
          <div className='grid gap-3'>
            <label className='flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center hover:bg-muted/40'>
              <FileUp className='size-6 text-muted-foreground' />
              <span className='text-sm font-medium'>Choose a CSV file</span>
              <span className='text-xs text-muted-foreground'>Columns: first name, last name, birthdate, level, parent name, email, phone, program, week, status</span>
              <input
                type='file'
                accept='.csv,text/csv'
                className='sr-only'
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const text = await file.text()
                  const matched = matchImportRows(csvObjects(text), PROGRAMS, sessions)
                  if (!matched.length) return toast.error('That file has no rows under the header.')
                  setFileName(file.name)
                  setRows(matched)
                }}
              />
            </label>
            <Button variant='link' className='justify-self-start px-0' onClick={() => saveFile('burgee-roster-template.csv', toCsv(IMPORT_TEMPLATE), 'text/csv')}>
              <Download className='size-4' /> Download a template
            </Button>
          </div>
        ) : (
          <div className='grid gap-3'>
            <p className='text-sm'>
              <span className='font-medium'>{fileName}</span>: {good.length} row{good.length === 1 ? '' : 's'} ready
              {bad.length > 0 && <span className='text-signal'>, {bad.length} need fixing</span>}.
            </p>
            <div className='max-h-72 overflow-auto rounded-md border'>
              <table className='w-full text-xs'>
                <thead className='sticky top-0 bg-card text-muted-foreground'>
                  <tr className='border-b'>
                    <th className='px-2 py-1.5 text-start font-medium'>Line</th>
                    <th className='px-2 py-1.5 text-start font-medium'>Sailor</th>
                    <th className='px-2 py-1.5 text-start font-medium'>Parent</th>
                    <th className='px-2 py-1.5 text-start font-medium'>Week</th>
                  </tr>
                </thead>
                <tbody className='divide-y'>
                  {rows.map((r) => (
                    <tr key={r.line} className={cn(r.error && 'bg-signal-soft')}>
                      <td className='px-2 py-1.5 text-muted-foreground'>{r.line}</td>
                      <td className='px-2 py-1.5'>
                        {r.firstName} {r.lastName} <span className='text-muted-foreground'>· {LEVELS[r.level].short}</span>
                      </td>
                      <td className='px-2 py-1.5'>{r.email}</td>
                      <td className='px-2 py-1.5'>
                        {r.error ? (
                          <span className='font-medium text-signal'>{r.error}</span>
                        ) : (
                          (() => {
                            const se = sessions.find((s) => s.id === r.sessionId)!
                            return `${programById.get(se.programId)?.name}, ${se.name}${r.status === 'waitlisted' ? ' (waitlist)' : ''}`
                          })()
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {bad.length > 0 && <p className='text-xs text-muted-foreground'>Rows that need fixing are skipped. Fix them in the spreadsheet and import again.</p>}
          </div>
        )}
        <DialogFooter>
          {rows && (
            <Button variant='outline' onClick={reset}>
              Choose another file
            </Button>
          )}
          <Button
            disabled={!good.length}
            onClick={() => {
              const res = importRoster(good.map((r) => ({ ...r, sessionId: r.sessionId! }) as ImportRow))
              toast.success(`Imported ${res.registrations} weeks for ${res.sailors} new and existing sailors${res.families ? `, ${res.families} new families` : ''}`)
              onClose()
              reset()
            }}
          >
            Import {good.length || ''} row{good.length === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
