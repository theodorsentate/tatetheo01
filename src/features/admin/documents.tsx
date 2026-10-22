import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { format } from 'date-fns'
import { Download, Eye, FileImage, FileText, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { dataUrlToBlob, fileSize, readFile, saveFile } from '@/lib/files'
import { CERT_TYPES } from '@/data/catalog'
import { useNow } from '@/data/hooks'
import { useStore } from '@/data/store'
import { certStatus, coachCertRows } from '@/domain/rules'
import type { ClubDocument } from '@/domain/types'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Main } from '@/components/layout/main'
import { CertStatusLabel, Initials, PageHeader } from '@/components/burgee/marks'
import { now as clockNow } from '@/lib/clock'

const SHORT: Record<string, string> = {
  l1: 'Level 1',
  l2: 'Level 2',
  pwr: 'Powerboat',
  fa: 'First Aid & CPR',
  safesport: 'SafeSport',
  bg: 'Background',
}

export function AdminDocuments({ person, cert, tab = 'certs' }: { person?: string; cert?: string; tab?: string }) {
  const navigate = useNavigate()
  const coaches = useStore((s) => s.coaches)
  const former = useStore((s) => s.formerCoaches)
  const docs = useStore((s) => s.documents)
  const warn = useStore((s) => s.settings.certWarningDays)
  const now = useNow(60_000)
  const [q, setQ] = useState('')
  const [missingOnly, setMissingOnly] = useState(false)
  const [viewing, setViewing] = useState<ClubDocument | null>(null)
  const [uploading, setUploading] = useState<null | { kind: 'certification'; coachId?: string; certTypeId?: string } | { kind: 'club' }>(null)

  const setSearch = (patch: Record<string, string | undefined>) =>
    navigate({ to: '/admin/documents', search: (prev: Record<string, unknown>) => ({ ...prev, ...patch }) })

  // One row per staff member × certification they hold or need.
  const rows = useMemo(() => {
    const all = [...coaches, ...former]
    return all
      .filter((c) => !person || c.id === person)
      .filter((c) => c.name.toLowerCase().includes(q.toLowerCase()))
      .flatMap((c) =>
        coachCertRows(c, CERT_TYPES, now, warn)
          .filter((r) => !cert || r.certType.id === cert)
          .map((r) => ({
            coach: c,
            former: former.includes(c),
            row: r,
            doc: docs
              .filter((d) => d.coachId === c.id && d.certTypeId === r.certType.id)
              .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))[0],
          }))
      )
      .filter((x) => !missingOnly || !x.doc)
      .sort((a, b) => a.coach.name.localeCompare(b.coach.name) || a.row.certType.name.localeCompare(b.row.certType.name))
  }, [coaches, former, docs, person, cert, q, missingOnly, now, warn])

  const missingCount = rows.filter((r) => !r.doc).length
  const clubDocs = docs.filter((d) => d.kind !== 'certification')
  const personName = person ? [...coaches, ...former].find((c) => c.id === person)?.name : undefined

  return (
    <Main>
      <PageHeader
        title='Documents'
        description='Every staff certificate and club document. Coaches upload their own from their phone.'
        actions={
          <Button onClick={() => setUploading(tab === 'club' ? { kind: 'club' } : { kind: 'certification', coachId: person, certTypeId: cert })}>
            <Upload className='size-4' /> Upload
          </Button>
        }
      />
      <Tabs value={tab} onValueChange={(v) => setSearch({ tab: v })}>
        <TabsList>
          <TabsTrigger value='certs'>Staff certifications</TabsTrigger>
          <TabsTrigger value='club'>Club documents ({clubDocs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value='certs' className='mt-5'>
          <div className='mb-3 flex flex-wrap gap-1.5' role='group' aria-label='Certification type'>
            <Chip active={!cert} onClick={() => setSearch({ cert: undefined })}>
              All
            </Chip>
            {CERT_TYPES.map((ct) => (
              <Chip key={ct.id} active={cert === ct.id} onClick={() => setSearch({ cert: ct.id })}>
                {SHORT[ct.id] ?? ct.name}
              </Chip>
            ))}
          </div>
          <div className='mb-4 flex flex-wrap items-center gap-3'>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder='Search staff' className='h-9 w-56' aria-label='Search staff' />
            {personName && (
              <Button variant='outline' size='sm' onClick={() => setSearch({ person: undefined })}>
                Showing {personName} ✕
              </Button>
            )}
            <label className='flex items-center gap-2 text-sm'>
              <Checkbox checked={missingOnly} onCheckedChange={(v) => setMissingOnly(!!v)} /> Only missing files
            </label>
            <span className='ms-auto text-sm text-muted-foreground'>{missingCount ? `${missingCount} without a file` : 'Every certificate has a file'}</span>
          </div>
          {/* Phone: one compact row per certificate so View and Upload stay in reach. */}
          <ul className='divide-y rounded-lg border bg-card md:hidden'>
            {rows.map(({ coach, former: isFormer, row, doc }) => (
              <li key={`${coach.id}-${row.certType.id}`} className={cn('flex items-center gap-3 px-3 py-2.5 text-sm', isFormer && 'text-muted-foreground')}>
                <Initials name={coach.name} hue={coach.avatarHue} className='size-8 shrink-0 text-[11px]' />
                <span className='min-w-0 flex-1'>
                  <span className='block truncate font-medium'>
                    {coach.name}
                    {isFormer && <span className='font-normal'> (former)</span>}
                  </span>
                  <span className='block truncate text-xs text-muted-foreground'>{row.certType.name}</span>
                  <span className='flex flex-wrap items-center gap-x-2 text-xs'>
                    <CertStatusLabel status={row.status} />
                    {row.expires && <span className='text-muted-foreground'>{format(new Date(`${row.expires}T12:00:00`), 'MMM d, yyyy')}</span>}
                    {!doc && <span className='font-medium text-signal'>No file</span>}
                  </span>
                </span>
                {doc ? (
                  <Button size='sm' variant='ghost' onClick={() => setViewing(doc)} aria-label={`View ${coach.name}'s ${row.certType.name}`}>
                    <Eye className='size-4' /> View
                  </Button>
                ) : (
                  !isFormer && (
                    <Button size='sm' variant='outline' onClick={() => setUploading({ kind: 'certification', coachId: coach.id, certTypeId: row.certType.id })} aria-label={`Upload ${coach.name}'s ${row.certType.name}`}>
                      <Upload className='size-4' /> Upload
                    </Button>
                  )
                )}
              </li>
            ))}
          </ul>
          <div className='hidden overflow-x-auto rounded-lg border bg-card md:block'>
            <table className='w-full min-w-[760px] text-sm'>
              <thead className='border-b text-xs text-muted-foreground'>
                <tr>
                  <th className='px-4 py-2 text-start font-medium'>Staff</th>
                  <th className='px-4 py-2 text-start font-medium'>Certification</th>
                  <th className='px-4 py-2 text-start font-medium'>Status</th>
                  <th className='px-4 py-2 text-start font-medium'>File</th>
                  <th className='px-4 py-2'>
                    <span className='sr-only'>Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className='divide-y'>
                {rows.map(({ coach, former: isFormer, row, doc }) => (
                  <tr key={`${coach.id}-${row.certType.id}`} className={isFormer ? 'text-muted-foreground' : ''}>
                    <td className='px-4 py-2.5'>
                      <span className='flex items-center gap-2.5'>
                        <Initials name={coach.name} hue={coach.avatarHue} className='size-7 text-[11px]' />
                        <span>
                          <span className='block font-medium'>{coach.name}</span>
                          {isFormer && <span className='text-xs'>Former staff</span>}
                        </span>
                      </span>
                    </td>
                    <td className='px-4 py-2.5'>{row.certType.name}</td>
                    <td className='px-4 py-2.5'>
                      <CertStatusLabel status={row.status} />
                      <span className='block text-xs text-muted-foreground'>
                        {row.expires ? `Expires ${format(new Date(`${row.expires}T12:00:00`), 'MMM d, yyyy')}` : 'Never recorded'}
                      </span>
                    </td>
                    <td className='px-4 py-2.5'>
                      {doc ? (
                        <button className='flex items-center gap-2 text-start hover:underline' onClick={() => setViewing(doc)}>
                          {doc.mime.startsWith('image/') ? <FileImage className='size-4 text-muted-foreground' /> : <FileText className='size-4 text-muted-foreground' />}
                          <span>
                            <span className='block max-w-56 truncate'>{doc.fileName}</span>
                            <span className='text-xs text-muted-foreground'>
                              {fileSize(doc.sizeBytes)}, added {format(new Date(doc.uploadedAt), 'MMM d, yyyy')}
                            </span>
                          </span>
                        </button>
                      ) : (
                        <span className='text-xs font-medium text-signal'>No file on record</span>
                      )}
                    </td>
                    <td className='px-4 py-2.5 text-end'>
                      {doc ? (
                        <Button size='sm' variant='ghost' onClick={() => setViewing(doc)}>
                          <Eye className='size-4' /> View
                        </Button>
                      ) : (
                        !isFormer && (
                          <Button size='sm' variant='outline' onClick={() => setUploading({ kind: 'certification', coachId: coach.id, certTypeId: row.certType.id })}>
                            <Upload className='size-4' /> Upload
                          </Button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value='club' className='mt-5'>
          <ul className='grid gap-3 md:grid-cols-2'>
            {clubDocs.map((d) => (
              <li key={d.id} className='flex gap-3 rounded-lg border bg-card p-4'>
                <span className='flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-primary'>
                  <FileText className='size-5' />
                </span>
                <span className='min-w-0 flex-1'>
                  <span className='block font-semibold text-heading'>{d.title}</span>
                  {d.description && <span className='mt-0.5 block text-sm text-muted-foreground'>{d.description}</span>}
                  <span className='mt-1 block text-xs text-muted-foreground'>
                    {d.fileName}, {fileSize(d.sizeBytes)}. Updated {format(new Date(d.uploadedAt), 'MMM d')} by {d.uploadedBy}
                  </span>
                </span>
                <Button size='sm' variant='ghost' onClick={() => setViewing(d)}>
                  <Eye className='size-4' /> View
                </Button>
              </li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>

      <DocViewer doc={viewing} onClose={() => setViewing(null)} />
      <UploadDialog target={uploading} onClose={() => setUploading(null)} />
    </Main>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-3 py-1 text-sm transition-colors',
        active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:border-primary hover:text-foreground'
      )}
    >
      {children}
    </button>
  )
}

function DocViewer({ doc, onClose }: { doc: ClubDocument | null; onClose: () => void }) {
  const coaches = useStore((s) => s.coaches)
  const former = useStore((s) => s.formerCoaches)
  const remove = useStore((s) => s.removeDocument)
  const holder = doc?.coachId ? [...coaches, ...former].find((c) => c.id === doc.coachId) : undefined
  const now = useNow(60_000)
  return (
    <Dialog open={!!doc} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className='max-h-[92svh] overflow-y-auto sm:max-w-xl'>
        {doc && (
          <>
            <DialogHeader>
              <DialogTitle>{holder ? `${holder.name}: ${doc.title}` : doc.title}</DialogTitle>
              <DialogDescription>
                {doc.fileName}, {fileSize(doc.sizeBytes)}. Uploaded {format(new Date(doc.uploadedAt), 'MMMM d, yyyy')} by {doc.uploadedBy}.
                {doc.expires && ` Expires ${format(new Date(`${doc.expires}T12:00:00`), 'MMMM d, yyyy')}.`}
              </DialogDescription>
            </DialogHeader>
            {doc.dataUrl && doc.mime.startsWith('image/') ? (
              <img src={doc.dataUrl} alt={doc.title} className='max-h-[60svh] w-full rounded-md border object-contain' />
            ) : doc.sample ? (
              <SamplePreview doc={doc} holder={holder?.name} expiredStatus={doc.expires ? certStatus(doc.expires, now, 0) : undefined} />
            ) : (
              <div className='flex items-center gap-3 rounded-md border bg-muted p-6 text-sm'>
                <FileText className='size-8 text-muted-foreground' />
                {doc.dataUrl ? 'PDFs open in your PDF reader. Download it to view.' : 'This file was too large to keep in the demo, so only its details were saved.'}
              </div>
            )}
            <DialogFooter className='gap-2 sm:justify-between'>
              <Button
                variant='ghost'
                className='text-destructive hover:text-destructive'
                onClick={() => {
                  remove(doc.id)
                  toast.success('Document removed')
                  onClose()
                }}
              >
                <Trash2 className='size-4' /> Remove
              </Button>
              <Button
                variant='outline'
                disabled={!doc.dataUrl}
                title={doc.dataUrl ? undefined : 'Sample documents have no file to download'}
                onClick={async () => {
                  const ok = await saveFile(doc.fileName, dataUrlToBlob(doc.dataUrl!))
                  if (ok) toast.success('Download started')
                }}
              >
                <Download className='size-4' /> Download
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Placeholder page for seeded example files (no real file behind them). */
function SamplePreview({ doc, holder, expiredStatus }: { doc: ClubDocument; holder?: string; expiredStatus?: string }) {
  return (
    <div className='rounded-md border bg-mist p-6'>
      <div className='mx-auto aspect-[1.4] max-w-md rounded-sm border bg-card p-6 shadow-sm'>
        <p className='text-[11px] font-medium tracking-wide text-muted-foreground'>{doc.kind === 'certification' ? 'Certificate of completion' : 'Club document'}</p>
        <p className='mt-3 font-display text-xl font-semibold text-heading'>{doc.title}</p>
        {holder && <p className='mt-4 text-sm'>Awarded to <span className='font-semibold'>{holder}</span></p>}
        {doc.expires && (
          <p className={cn('mt-1 text-sm', expiredStatus === 'expired' ? 'text-destructive' : 'text-muted-foreground')}>
            Valid through {format(new Date(`${doc.expires}T12:00:00`), 'MMMM d, yyyy')}
          </p>
        )}
        {doc.description && <p className='mt-3 text-sm text-muted-foreground'>{doc.description}</p>}
        <div className='mt-6 space-y-1.5' aria-hidden='true'>
          <div className='h-1.5 w-11/12 rounded bg-muted' />
          <div className='h-1.5 w-9/12 rounded bg-muted' />
          <div className='h-1.5 w-10/12 rounded bg-muted' />
        </div>
      </div>
      <p className='mt-3 text-center text-xs text-muted-foreground'>Sample file in the demo. Real uploads show here as the actual image or PDF.</p>
    </div>
  )
}

function UploadDialog({
  target,
  onClose,
}: {
  target: null | { kind: 'certification'; coachId?: string; certTypeId?: string } | { kind: 'club' }
  onClose: () => void
}) {
  const coaches = useStore((s) => s.coaches)
  const renew = useStore((s) => s.renewCert)
  const addDocument = useStore((s) => s.addDocument)
  const [coachId, setCoachId] = useState('')
  const [certTypeId, setCertTypeId] = useState('')
  const [issued, setIssued] = useState(format(clockNow(), 'yyyy-MM-dd'))
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState<typeof target>(null)
  if (target !== loaded) {
    setLoaded(target)
    if (target?.kind === 'certification') {
      setCoachId(target.coachId ?? '')
      setCertTypeId(target.certTypeId ?? '')
    }
    setFile(null)
    setTitle('')
    setDescription('')
  }
  const isCert = target?.kind === 'certification'
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form
          className='grid gap-4'
          onSubmit={async (e) => {
            e.preventDefault()
            if (!file) return toast.error('Choose a file to upload.')
            setBusy(true)
            const info = await readFile(file)
            setBusy(false)
            if (isCert) {
              if (!coachId || !certTypeId) return toast.error('Pick the staff member and the certification.')
              renew(coachId, certTypeId, issued, { ...info, uploadedBy: 'Jordan Hale' })
              toast.success('Certificate uploaded and expiry updated')
            } else {
              if (!title.trim()) return toast.error('Give the document a title.')
              addDocument({ ...info, title: title.trim(), description: description.trim() || undefined, kind: 'club', uploadedBy: 'Jordan Hale' })
              toast.success(`${title.trim()} uploaded`)
            }
            if (!info.dataUrl) toast('Large file: its details were saved, the file itself isn’t kept in the demo.')
            onClose()
          }}
        >
          <DialogHeader>
            <DialogTitle>{isCert ? 'Upload a certificate' : 'Upload a club document'}</DialogTitle>
            <DialogDescription>
              {isCert ? 'A photo of the card or the PDF. Burgee updates the expiry from the issue date.' : 'Policies, plans and handbooks your staff and families need.'}
            </DialogDescription>
          </DialogHeader>
          {isCert ? (
            <>
              <div className='grid gap-4 sm:grid-cols-2'>
                <div className='grid gap-1.5'>
                  <Label htmlFor='up-coach'>Staff member</Label>
                  <Select value={coachId} onValueChange={setCoachId}>
                    <SelectTrigger id='up-coach'>
                      <SelectValue placeholder='Choose' />
                    </SelectTrigger>
                    <SelectContent>
                      {coaches.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className='grid gap-1.5'>
                  <Label htmlFor='up-cert'>Certification</Label>
                  <Select value={certTypeId} onValueChange={setCertTypeId}>
                    <SelectTrigger id='up-cert'>
                      <SelectValue placeholder='Choose' />
                    </SelectTrigger>
                    <SelectContent>
                      {CERT_TYPES.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className='grid gap-1.5'>
                <Label htmlFor='up-issued'>Date issued</Label>
                <Input id='up-issued' type='date' value={issued} onChange={(e) => setIssued(e.target.value)} />
              </div>
            </>
          ) : (
            <>
              <div className='grid gap-1.5'>
                <Label htmlFor='up-title'>Title</Label>
                <Input id='up-title' value={title} onChange={(e) => setTitle(e.target.value)} placeholder='Lightning policy' />
              </div>
              <div className='grid gap-1.5'>
                <Label htmlFor='up-desc'>What’s in it</Label>
                <Textarea id='up-desc' rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </>
          )}
          <div className='grid gap-1.5'>
            <Label htmlFor='up-file'>File</Label>
            <Input id='up-file' type='file' accept='image/*,application/pdf' onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <DialogFooter>
            <Button type='button' variant='outline' onClick={onClose}>
              Cancel
            </Button>
            <Button type='submit' disabled={busy}>
              <Upload className='size-4' /> Upload
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
