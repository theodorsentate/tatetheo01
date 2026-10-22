import { useState } from 'react'
import { format } from 'date-fns'
import { CheckCheck, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useStore } from '@/data/store'
import type { Boat } from '@/domain/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/burgee/marks'
import { now as clockNow } from '@/lib/clock'

const STATUS: Record<Boat['status'], { label: string; dot: string }> = {
  ready: { label: 'Ready', dot: 'bg-ok' },
  'needs-repair': { label: 'Needs repair', dot: 'bg-signal' },
  'out-of-service': { label: 'Out of service', dot: 'bg-destructive' },
}
const KINDS: Boat['kind'][] = ['Opti', 'Club 420', 'ILCA', 'RIB', 'Whaler', 'Other']

export function AdminEquipment() {
  const boats = useStore((s) => s.boats)
  const update = useStore((s) => s.updateBoat)
  const remove = useStore((s) => s.removeBoat)
  const [status, setStatus] = useState<'all' | Boat['status']>('all')
  const [adding, setAdding] = useState(false)
  const count = (st: Boat['status']) => boats.filter((b) => b.status === st).length
  const today = format(clockNow(), 'yyyy-MM-dd')

  return (
    <Main>
      <PageHeader
        title='Boats'
        description='Boats that need work show on Home until they’re fixed.'
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus className='size-4' /> Add a boat
          </Button>
        }
      />
      <div className='mb-6 flex flex-wrap gap-2'>
        {(['all', 'ready', 'needs-repair', 'out-of-service'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            aria-pressed={status === s}
            className={cn('flex items-center gap-2 rounded-lg border bg-card px-4 py-2.5 text-start', status === s && 'border-primary ring-2 ring-primary/20')}
          >
            {s !== 'all' && <span className={cn('size-2.5 rounded-full', STATUS[s].dot)} />}
            <span>
              <span className='block font-display text-xl leading-none font-semibold text-heading'>{s === 'all' ? boats.length : count(s)}</span>
              <span className='text-xs text-muted-foreground'>{s === 'all' ? 'All boats' : STATUS[s].label}</span>
            </span>
          </button>
        ))}
      </div>
      <div className='space-y-6'>
        {KINDS.map((kind) => {
          const list = boats.filter((b) => b.kind === kind && (status === 'all' || b.status === status))
          if (!list.length) return null
          return (
            <section key={kind}>
              <h2 className='mb-2 font-semibold'>
                {kind === 'RIB' || kind === 'Whaler' ? `${kind}s (coach boats)` : `${kind}s`}
                <span className='ms-2 text-sm font-normal text-muted-foreground'>{list.length}</span>
              </h2>
              <div className='overflow-x-auto rounded-lg border bg-card'>
                <table className='w-full min-w-[760px] text-sm'>
                  <thead className='border-b text-xs text-muted-foreground'>
                    <tr>
                      <th className='px-4 py-2 text-start font-medium'>Boat</th>
                      <th className='px-4 py-2 text-start font-medium'>Used by</th>
                      <th className='w-44 px-4 py-2 text-start font-medium'>Status</th>
                      <th className='px-4 py-2 text-start font-medium'>Issue</th>
                      <th className='px-4 py-2 text-start font-medium'>Last checked</th>
                      <th className='px-4 py-2'>
                        <span className='sr-only'>Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className='divide-y'>
                    {list.map((b) => (
                      <tr key={b.id}>
                        <td className='px-4 py-2 font-medium'>{b.name}</td>
                        <td className='px-4 py-2 text-muted-foreground'>{b.assignedTo ?? '—'}</td>
                        <td className='px-4 py-2'>
                          <Select
                            value={b.status}
                            onValueChange={(v) => {
                              update(b.id, { status: v as Boat['status'], issue: v === 'ready' ? undefined : b.issue })
                              toast(`${b.name}: ${STATUS[v as Boat['status']].label.toLowerCase()}`)
                            }}
                          >
                            <SelectTrigger className='h-8' aria-label={`Status of ${b.name}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.keys(STATUS) as Boat['status'][]).map((s) => (
                                <SelectItem key={s} value={s}>
                                  <span className='flex items-center gap-2'>
                                    <span className={cn('size-2 rounded-full', STATUS[s].dot)} /> {STATUS[s].label}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className='px-4 py-2'>
                          <Input
                            defaultValue={b.issue ?? ''}
                            placeholder={b.status === 'ready' ? '' : 'What’s wrong?'}
                            aria-label={`Issue with ${b.name}`}
                            className='h-8'
                            onBlur={(e) => e.target.value !== (b.issue ?? '') && update(b.id, { issue: e.target.value || undefined })}
                          />
                        </td>
                        <td className='px-4 py-2 text-muted-foreground'>{b.lastInspected ? format(new Date(`${b.lastInspected}T12:00:00`), 'MMM d') : '—'}</td>
                        <td className='px-4 py-2 text-end whitespace-nowrap'>
                          <Button size='sm' variant='ghost' onClick={() => { update(b.id, { lastInspected: today }); toast.success(`${b.name} checked today`) }}>
                            <CheckCheck className='size-4' /> Checked
                          </Button>
                          <Button
                            size='icon'
                            variant='ghost'
                            className='size-8 text-muted-foreground hover:text-destructive'
                            aria-label={`Remove ${b.name}`}
                            onClick={() => { remove(b.id); toast(`${b.name} removed from the fleet`) }}
                          >
                            <Trash2 className='size-4' />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )
        })}
      </div>
      <AddBoatDialog open={adding} onClose={() => setAdding(false)} />
    </Main>
  )
}

function AddBoatDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const add = useStore((s) => s.addBoat)
  const [kind, setKind] = useState<Boat['kind']>('Opti')
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form
          key={String(open)}
          className='grid gap-4'
          onSubmit={(e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            const name = String(fd.get('name') ?? '').trim()
            if (!name) return toast.error('Give the boat a name or sail number.')
            add({ kind, name, status: 'ready', assignedTo: String(fd.get('assigned') ?? '').trim() || undefined, lastInspected: format(clockNow(), 'yyyy-MM-dd') })
            toast.success(`${name} added`)
            onClose()
          }}
        >
          <DialogHeader>
            <DialogTitle>Add a boat</DialogTitle>
            <DialogDescription>New boats start as ready and checked today.</DialogDescription>
          </DialogHeader>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='grid gap-1.5'>
              <Label htmlFor='bt-kind'>Type</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as Boat['kind'])}>
                <SelectTrigger id='bt-kind'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {k}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='grid gap-1.5'>
              <Label htmlFor='bt-name'>Name or sail number</Label>
              <Input id='bt-name' name='name' placeholder='Opti #2125' />
            </div>
          </div>
          <div className='grid gap-1.5'>
            <Label htmlFor='bt-assigned'>Used by</Label>
            <Input id='bt-assigned' name='assigned' placeholder='Opti Green Team' />
          </div>
          <DialogFooter>
            <Button type='button' variant='outline' onClick={onClose}>
              Cancel
            </Button>
            <Button type='submit'>Add boat</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
