import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { format } from 'date-fns'
import { Copy, FileText, Mail, Pencil, Phone, Plus, RotateCcw, UserMinus } from 'lucide-react'
import { toast } from 'sonner'
import { CERT_TYPES } from '@/data/catalog'
import { useLookups, useNow } from '@/data/hooks'
import { useStore } from '@/data/store'
import { coachCertRows, coachCertSummary } from '@/domain/rules'
import type { Coach, StaffRole } from '@/domain/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { Main } from '@/components/layout/main'
import { CertStatusLabel, EmptyState, Initials, PageHeader } from '@/components/burgee/marks'
import { ROLE_LABEL } from './staff'

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${what} copied`)
  } catch {
    toast(text)
  }
}

export function StaffDirectory() {
  const coaches = useStore((s) => s.coaches)
  const former = useStore((s) => s.formerCoaches)
  const groups = useStore((s) => s.groups)
  const warn = useStore((s) => s.settings.certWarningDays)
  const now = useNow(60_000)
  const [q, setQ] = useState('')
  const [role, setRole] = useState('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Coach | 'new' | null>(null)

  const rows = useMemo(
    () =>
      coaches
        .filter((c) => role === 'all' || c.role === role)
        .filter((c) => `${c.name} ${c.email} ${c.phone}`.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [coaches, role, q]
  )
  const open = coaches.find((c) => c.id === openId)

  return (
    <Main>
      <PageHeader
        title='Staff'
        description={`${coaches.length} people on staff this season.`}
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus className='size-4' /> Add staff member
          </Button>
        }
      />
      <div className='mb-4 flex flex-wrap items-center gap-2'>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder='Search name, email or phone' className='h-9 w-64' aria-label='Search staff' />
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className='h-9 w-48' aria-label='Role'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All roles</SelectItem>
            {(Object.keys(ROLE_LABEL) as StaffRole[]).map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABEL[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
        {rows.map((c) => {
          const status = coachCertSummary(coachCertRows(c, CERT_TYPES, now, warn))
          const assigned = groups.filter((g) => g.coachIds.includes(c.id)).length
          return (
            <article key={c.id} className='flex flex-col rounded-lg border bg-card'>
              <button className='flex items-start gap-3 p-4 text-start' onClick={() => setOpenId(c.id)}>
                <Initials name={c.name} hue={c.avatarHue} className='size-11 text-sm' />
                <span className='min-w-0 flex-1'>
                  <span className='block font-semibold text-heading'>{c.name}</span>
                  <span className='block text-sm text-muted-foreground'>
                    {ROLE_LABEL[c.role]}
                    {c.startedSeason ? `, since ${c.startedSeason}` : ''}
                  </span>
                  <span className='mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs'>
                    <CertStatusLabel status={status} detail={status === 'valid' ? 'Certs current' : undefined} />
                    <span className='text-muted-foreground'>{assigned ? `${assigned} group${assigned > 1 ? 's' : ''}` : 'Not on a roster'}</span>
                  </span>
                </span>
              </button>
              <div className='mt-auto flex flex-wrap gap-x-4 gap-y-1 border-t px-4 py-2.5 text-sm'>
                <a href={`tel:${c.phone}`} className='inline-flex items-center gap-1.5 text-primary hover:underline'>
                  <Phone className='size-3.5' /> {c.phone}
                </a>
                <button className='inline-flex min-w-0 items-center gap-1.5 text-muted-foreground hover:text-foreground' onClick={() => copy(c.email, 'Email')}>
                  <Mail className='size-3.5 shrink-0' /> <span className='truncate'>{c.email}</span>
                </button>
              </div>
            </article>
          )
        })}
        {rows.length === 0 && <EmptyState title='No staff match that search' className='md:col-span-2 xl:col-span-3' />}
      </div>

      {former.length > 0 && <FormerStaff />}

      <ProfileSheet coach={open} onClose={() => setOpenId(null)} onEdit={(c) => setEditing(c)} />
      <CoachForm
        value={editing}
        onClose={() => setEditing(null)}
        onSaved={(c) => {
          setEditing(null)
          setOpenId(c.id)
        }}
      />
    </Main>
  )
}

function FormerStaff() {
  const former = useStore((s) => s.formerCoaches)
  const restore = useStore((s) => s.restoreCoach)
  return (
    <section className='mt-10'>
      <h2 className='mb-3 text-lg font-semibold'>Former staff</h2>
      <ul className='divide-y rounded-lg border bg-card'>
        {former.map((c) => (
          <li key={c.id} className='flex items-center gap-3 px-4 py-3 text-sm'>
            <Initials name={c.name} hue={c.avatarHue} />
            <span className='min-w-0 flex-1'>
              <span className='block font-medium'>{c.name}</span>
              <span className='text-xs text-muted-foreground'>{ROLE_LABEL[c.role]}</span>
            </span>
            <Button
              size='sm'
              variant='outline'
              onClick={() => {
                restore(c.id)
                toast.success(`${c.name} is back on staff`)
              }}
            >
              <RotateCcw className='size-4' /> Restore
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ProfileSheet({ coach, onClose, onEdit }: { coach?: Coach; onClose: () => void; onEdit: (c: Coach) => void }) {
  const groups = useStore((s) => s.groups)
  const docs = useStore((s) => s.documents)
  const warn = useStore((s) => s.settings.certWarningDays)
  const remove = useStore((s) => s.removeCoach)
  const look = useLookups()
  const now = useNow(60_000)
  const [confirming, setConfirming] = useState(false)
  if (!coach)
    return (
      <Sheet open={false}>
        <SheetContent />
      </Sheet>
    )
  const assigned = groups.filter((g) => g.coachIds.includes(coach.id))
  const certRows = coachCertRows(coach, CERT_TYPES, now, warn)
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className='w-full overflow-y-auto sm:max-w-md'>
        <SheetHeader>
          <div className='flex items-center gap-3'>
            <Initials name={coach.name} hue={coach.avatarHue} className='size-12 text-base' />
            <div>
              <SheetTitle className='font-display text-xl'>{coach.name}</SheetTitle>
              <SheetDescription>
                {ROLE_LABEL[coach.role]}
                {coach.startedSeason ? `, on staff since ${coach.startedSeason}` : ''}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <div className='space-y-6 px-4 pb-8 text-sm'>
          <section className='grid gap-2'>
            <a href={`tel:${coach.phone}`} className='flex items-center justify-between rounded-md border px-3 py-2'>
              <span className='inline-flex items-center gap-2'>
                <Phone className='size-4 text-muted-foreground' /> {coach.phone}
              </span>
              <span className='text-xs text-primary'>Call</span>
            </a>
            <div className='flex items-center justify-between rounded-md border px-3 py-2'>
              <span className='inline-flex min-w-0 items-center gap-2'>
                <Mail className='size-4 shrink-0 text-muted-foreground' /> <span className='truncate'>{coach.email}</span>
              </span>
              <button className='text-xs text-primary' onClick={() => copy(coach.email, 'Email')}>
                <Copy className='inline size-3.5' /> Copy
              </button>
            </div>
          </section>
          <dl className='grid grid-cols-2 gap-x-4 gap-y-3'>
            <div>
              <dt className='text-xs text-muted-foreground'>School / work</dt>
              <dd>{coach.school ?? '—'}</dd>
            </div>
            <div className='col-span-2'>
              <dt className='text-xs text-muted-foreground'>Emergency contact</dt>
              <dd>
                {coach.emergencyContact ? `${coach.emergencyContact.name} (${coach.emergencyContact.relationship.toLowerCase()}), ${coach.emergencyContact.phone}` : '—'}
              </dd>
            </div>
            {coach.notes && (
              <div className='col-span-2'>
                <dt className='text-xs text-muted-foreground'>Notes</dt>
                <dd>{coach.notes}</dd>
              </div>
            )}
          </dl>
          <section>
            <h3 className='mb-2 font-semibold'>Certifications</h3>
            <ul className='divide-y rounded-md border'>
              {certRows.map((r) => {
                const doc = docs.find((d) => d.coachId === coach.id && d.certTypeId === r.certType.id)
                return (
                  <li key={r.certType.id} className='flex items-center gap-3 px-3 py-2'>
                    <span className='min-w-0 flex-1'>
                      <span className='block'>{r.certType.name}</span>
                      <span className='text-xs text-muted-foreground'>
                        {r.expires ? `Expires ${format(new Date(`${r.expires}T12:00:00`), 'MMM d, yyyy')}` : 'Nothing on file'}
                        {doc ? '' : r.expires ? ', no file uploaded' : ''}
                      </span>
                    </span>
                    {doc && <FileText className='size-4 text-muted-foreground' aria-label='File on record' />}
                    <CertStatusLabel status={r.status} />
                  </li>
                )
              })}
            </ul>
            <Button asChild variant='link' className='mt-1 h-auto p-0'>
              <Link to='/admin/documents' search={{ person: coach.id }}>
                Open {coach.name.split(' ')[0]}’s documents
              </Link>
            </Button>
          </section>
          <section>
            <h3 className='mb-2 font-semibold'>On rosters</h3>
            {assigned.length ? (
              <ul className='space-y-1'>
                {assigned.map((g) => {
                  const se = look.session.get(g.sessionId)!
                  return (
                    <li key={g.id}>
                      <Link to='/admin/sessions/$sessionId' params={{ sessionId: se.id }} className='text-primary hover:underline'>
                        {g.name}
                      </Link>
                      <span className='text-muted-foreground'>, {look.program.get(se.programId)?.name} {se.name}</span>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className='text-muted-foreground'>Not assigned to any group yet.</p>
            )}
          </section>
          <div className='flex flex-wrap gap-2 border-t pt-4'>
            <Button variant='outline' onClick={() => onEdit(coach)}>
              <Pencil className='size-4' /> Edit details
            </Button>
            <Button variant='outline' className='text-destructive hover:text-destructive' onClick={() => setConfirming(true)}>
              <UserMinus className='size-4' /> Remove from staff
            </Button>
          </div>
        </div>
      </SheetContent>
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {coach.name} from staff?</DialogTitle>
            <DialogDescription>
              {assigned.length
                ? `They’ll come off ${assigned.length} group${assigned.length > 1 ? 's' : ''} (${assigned.map((g) => g.name).join(', ')}). Check those rosters still have enough coaches.`
                : 'They aren’t on any roster.'}{' '}
              Their attendance history and documents stay on file, and you can restore them later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setConfirming(false)}>
              Keep on staff
            </Button>
            <Button
              variant='destructive'
              onClick={() => {
                remove(coach.id)
                toast.success(`${coach.name} removed from staff`)
                setConfirming(false)
                onClose()
              }}
            >
              Remove from staff
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  )
}

function CoachForm({ value, onClose, onSaved }: { value: Coach | 'new' | null; onClose: () => void; onSaved: (c: Coach) => void }) {
  const add = useStore((s) => s.addCoach)
  const update = useStore((s) => s.updateCoach)
  const editing = value && value !== 'new' ? value : undefined
  const [role, setRole] = useState<StaffRole>('instructor')
  const [key, setKey] = useState<string | null>(null)
  const formKey = value === 'new' ? 'new' : (editing?.id ?? null)
  if (formKey !== key) {
    setKey(formKey)
    setRole(editing?.role ?? 'instructor')
  }
  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className='max-h-[90svh] overflow-y-auto sm:max-w-lg'>
        <form
          key={formKey ?? 'closed'}
          className='grid gap-4'
          onSubmit={(e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            const v = (k: string) => String(fd.get(k) ?? '').trim()
            if (!v('name') || !v('phone') || !v('email')) return toast.error('Name, phone and email are required.')
            const data = {
              name: v('name'),
              role,
              phone: v('phone'),
              email: v('email'),
              activities: ['sailing'] as Coach['activities'],
              startedSeason: v('started') || undefined,
              school: v('school') || undefined,
              notes: v('notes') || undefined,
              emergencyContact: v('ecName') ? { name: v('ecName'), phone: v('ecPhone'), relationship: v('ecRel') || 'Contact' } : undefined,
            }
            if (editing) {
              update(editing.id, data)
              toast.success('Details saved')
              onSaved({ ...editing, ...data })
            } else {
              const c = add({ ...data, active: true })
              toast.success(`${c.name} added. Next: record their certifications.`)
              onSaved(c)
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : 'Add a staff member'}</DialogTitle>
            <DialogDescription>Contact details show in the directory and on coach rosters. Certifications are recorded on the Certifications page.</DialogDescription>
          </DialogHeader>
          <div className='grid gap-1.5'>
            <Label htmlFor='cf-name'>Full name</Label>
            <Input id='cf-name' name='name' defaultValue={editing?.name} autoComplete='off' />
          </div>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='grid gap-1.5'>
              <Label htmlFor='cf-phone'>Mobile</Label>
              <Input id='cf-phone' name='phone' type='tel' defaultValue={editing?.phone} placeholder='(843) 555-0123' />
            </div>
            <div className='grid gap-1.5'>
              <Label htmlFor='cf-email'>Email</Label>
              <Input id='cf-email' name='email' type='email' defaultValue={editing?.email} />
            </div>
          </div>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='grid gap-1.5'>
              <Label htmlFor='cf-role'>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as StaffRole)}>
                <SelectTrigger id='cf-role'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABEL) as StaffRole[]).map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='grid gap-1.5'>
              <Label htmlFor='cf-started'>On staff since</Label>
              <Input id='cf-started' name='started' defaultValue={editing?.startedSeason ?? 'Fall 2026'} />
            </div>
          </div>
          <div className='grid gap-1.5'>
            <Label htmlFor='cf-school'>School or day job</Label>
            <Input id='cf-school' name='school' defaultValue={editing?.school} placeholder='College junior' />
          </div>
          <fieldset className='grid gap-2 rounded-md border p-3'>
            <legend className='px-1 text-sm font-medium'>Emergency contact</legend>
            <div className='grid gap-2 sm:grid-cols-3'>
              <Input aria-label='Emergency contact name' name='ecName' defaultValue={editing?.emergencyContact?.name} placeholder='Name' />
              <Input aria-label='Emergency contact phone' name='ecPhone' type='tel' defaultValue={editing?.emergencyContact?.phone} placeholder='Phone' />
              <Input aria-label='Relationship' name='ecRel' defaultValue={editing?.emergencyContact?.relationship} placeholder='Relationship' />
            </div>
          </fieldset>
          <div className='grid gap-1.5'>
            <Label htmlFor='cf-notes'>Notes</Label>
            <Textarea id='cf-notes' name='notes' rows={2} defaultValue={editing?.notes} placeholder='Availability, preferences, anything the director should know' />
          </div>
          <DialogFooter>
            <Button type='button' variant='outline' onClick={onClose}>
              Cancel
            </Button>
            <Button type='submit'>{editing ? 'Save details' : 'Add to staff'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
