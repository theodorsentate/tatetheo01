import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { format } from 'date-fns'
import { Banknote } from 'lucide-react'
import { toast } from 'sonner'
import { TERMS } from '@/data/catalog'
import { programById, useLookups } from '@/data/hooks'
import { useStore } from '@/data/store'
import { money } from '@/domain/pricing'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/burgee/marks'

type Row = { id: string; at: string; familyId: string; text: string; amount: number; method: string; termId?: string }

export function AdminPayments() {
  const regs = useStore((s) => s.registrations)
  const ledger = useStore((s) => s.ledger)
  const look = useLookups()
  const [term, setTerm] = useState('all')
  const [q, setQ] = useState('')
  const [recording, setRecording] = useState<string | null>(null)

  const { rows, outstanding, byTerm } = useMemo(() => {
    const viaLedger = new Set(ledger.flatMap((l) => l.registrationIds))
    const card: Row[] = regs
      .filter((r) => r.paid > 0 && !viaLedger.has(r.id))
      .map((r) => {
        const se = look.session.get(r.sessionId)!
        const k = look.sailor.get(r.sailorId)!
        return { id: r.id, at: r.createdAt, familyId: k.familyId, text: `${k.firstName}: ${programById.get(se.programId)?.name}, ${se.name}`, amount: r.paid, method: 'Card', termId: se.termId }
      })
    const manual: Row[] = ledger.map((l) => {
      const first = regs.find((r) => r.id === l.registrationIds[0])
      return { id: l.id, at: l.at, familyId: l.familyId, text: l.memo, amount: l.amount, method: l.method === 'check' ? 'Check' : l.method === 'cash' ? 'Cash' : 'Refund', termId: first ? look.session.get(first.sessionId)?.termId : undefined }
    })
    const all = [...card, ...manual].sort((a, b) => b.at.localeCompare(a.at))
    const owing = new Map<string, { due: number; ids: string[]; items: string[] }>()
    for (const r of regs.filter((x) => x.status === 'pending-payment')) {
      const k = look.sailor.get(r.sailorId)!
      const se = look.session.get(r.sessionId)!
      const e = owing.get(k.familyId) ?? { due: 0, ids: [], items: [] }
      e.due += r.price - r.paid
      e.ids.push(r.id)
      e.items.push(`${k.firstName}: ${programById.get(se.programId)?.name}, ${se.name}`)
      owing.set(k.familyId, e)
    }
    const terms = TERMS.map((t) => ({
      t,
      collected: all.filter((r) => r.termId === t.id).reduce((n, r) => n + r.amount, 0),
      due: regs.filter((r) => r.status === 'pending-payment' && look.session.get(r.sessionId)?.termId === t.id).reduce((n, r) => n + r.price - r.paid, 0),
    }))
    return { rows: all, outstanding: [...owing.entries()].sort((a, b) => b[1].due - a[1].due), byTerm: terms }
  }, [regs, ledger, look])

  const shown = rows
    .filter((r) => term === 'all' || r.termId === term)
    .filter((r) => `${look.family.get(r.familyId)?.name} ${r.text}`.toLowerCase().includes(q.toLowerCase()))
  const totalCollected = byTerm.reduce((n, t) => n + t.collected, 0)
  const totalDue = byTerm.reduce((n, t) => n + t.due, 0)

  return (
    <Main>
      <PageHeader title='Payments' description='Card payments come in through registration automatically. Record checks and cash here so balances stay right.' />
      <div className='mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'>
        <div className='rounded-lg border bg-card p-4'>
          <p className='text-sm text-muted-foreground'>Collected, all terms</p>
          <p className='font-display text-2xl font-semibold text-heading'>{money(Math.round(totalCollected))}</p>
        </div>
        <div className='rounded-lg border bg-card p-4'>
          <p className='text-sm text-muted-foreground'>Still owed</p>
          <p className='font-display text-2xl font-semibold text-signal'>{money(Math.round(totalDue))}</p>
        </div>
        {byTerm.map(({ t, collected, due }) => (
            <div key={t.id} className='rounded-lg border bg-card p-4'>
              <p className='text-sm text-muted-foreground'>{t.name}</p>
              <p className='font-display text-2xl font-semibold text-heading'>{money(Math.round(collected))}</p>
              <p className='text-xs text-muted-foreground'>{due ? `${money(Math.round(due))} owed` : 'Nothing owed'}</p>
            </div>
          ))}
      </div>

      <section className='mb-8'>
        <h2 className='mb-3 text-lg font-semibold'>Balances due</h2>
        <ul className='divide-y rounded-lg border bg-card'>
          {outstanding.map(([fid, e]) => (
            <li key={fid} className='flex flex-wrap items-center gap-3 px-4 py-3 text-sm'>
              <span className='min-w-0 flex-1'>
                <Link to='/admin/families' search={{ family: fid }} className='font-medium hover:underline'>
                  {look.family.get(fid)?.name} family
                </Link>
                <span className='block text-xs text-muted-foreground'>{e.items.join('; ')}</span>
              </span>
              <span className='font-semibold'>{money(e.due)}</span>
              <Button size='sm' variant='outline' onClick={() => setRecording(fid)}>
                <Banknote className='size-4' /> Record check or cash
              </Button>
            </li>
          ))}
          {outstanding.length === 0 && <li className='px-4 py-6 text-center text-sm text-muted-foreground'>Nobody owes anything.</li>}
        </ul>
      </section>

      <section>
        <div className='mb-3 flex flex-wrap items-center gap-2'>
          <h2 className='me-auto text-lg font-semibold'>All payments</h2>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder='Search family or session' className='h-9 w-56' aria-label='Search payments' />
          <Select value={term} onValueChange={setTerm}>
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
        </div>
        <div className='overflow-x-auto rounded-lg border bg-card'>
          <table className='w-full min-w-[680px] text-sm'>
            <thead className='border-b text-xs text-muted-foreground'>
              <tr>
                <th className='px-4 py-2 text-start font-medium'>Date</th>
                <th className='px-4 py-2 text-start font-medium'>Family</th>
                <th className='px-4 py-2 text-start font-medium'>For</th>
                <th className='px-4 py-2 text-start font-medium'>Method</th>
                <th className='px-4 py-2 text-end font-medium'>Amount</th>
              </tr>
            </thead>
            <tbody className='divide-y'>
              {shown.slice(0, 80).map((r) => (
                <tr key={r.id}>
                  <td className='px-4 py-2 text-muted-foreground'>{format(new Date(r.at), 'MMM d, yyyy')}</td>
                  <td className='px-4 py-2'>{look.family.get(r.familyId)?.name}</td>
                  <td className='px-4 py-2'>{r.text}</td>
                  <td className='px-4 py-2'>{r.method}</td>
                  <td className='px-4 py-2 text-end font-medium'>{money(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {shown.length > 80 && <p className='mt-2 text-xs text-muted-foreground'>Showing the latest 80 of {shown.length}. Download everything from Reports.</p>}
      </section>
      <RecordPaymentDialog familyId={recording} onClose={() => setRecording(null)} />
    </Main>
  )
}

function RecordPaymentDialog({ familyId, onClose }: { familyId: string | null; onClose: () => void }) {
  const regs = useStore((s) => s.registrations)
  const record = useStore((s) => s.recordPayment)
  const look = useLookups()
  const [method, setMethod] = useState<'check' | 'cash'>('check')
  const fam = familyId ? look.family.get(familyId) : undefined
  const due = familyId ? regs.filter((r) => r.status === 'pending-payment' && look.sailor.get(r.sailorId)?.familyId === familyId) : []
  const total = due.reduce((n, r) => n + r.price - r.paid, 0)
  return (
    <Dialog open={!!familyId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form
          key={familyId ?? 'none'}
          className='grid gap-4'
          onSubmit={(e) => {
            e.preventDefault()
            const memo = String(new FormData(e.currentTarget).get('memo') ?? '').trim()
            record({ familyId: familyId!, registrationIds: due.map((r) => r.id), method, memo: memo || (method === 'check' ? 'Check' : 'Cash') })
            toast.success(`${money(total)} recorded for the ${fam?.name} family`)
            onClose()
          }}
        >
          <DialogHeader>
            <DialogTitle>Record a payment from the {fam?.name} family</DialogTitle>
            <DialogDescription>Marks {due.length} registration{due.length === 1 ? '' : 's'} paid in full: {money(total)}.</DialogDescription>
          </DialogHeader>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='grid gap-1.5'>
              <Label htmlFor='pay-method'>Paid by</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as 'check' | 'cash')}>
                <SelectTrigger id='pay-method'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='check'>Check</SelectItem>
                  <SelectItem value='cash'>Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className='grid gap-1.5'>
              <Label htmlFor='pay-memo'>{method === 'check' ? 'Check number' : 'Note'}</Label>
              <Input id='pay-memo' name='memo' placeholder={method === 'check' ? 'Check #1042' : 'Paid at the front desk'} />
            </div>
          </div>
          <DialogFooter>
            <Button type='button' variant='outline' onClick={onClose}>
              Cancel
            </Button>
            <Button type='submit'>Record {money(total)}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
