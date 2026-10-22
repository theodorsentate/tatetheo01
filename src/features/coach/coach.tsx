import { useMemo, useState } from 'react'
import { format, isSameDay } from 'date-fns'
import { Link } from '@tanstack/react-router'
import { CERT_TYPES, FORM_TEMPLATES, PERSONAS } from '@/data/catalog'
import { programById, termById, useLookups, useNow } from '@/data/hooks'
import { useStore } from '@/data/store'
import { attendanceKey, dayCounts, meetsOn } from '@/domain/attendance'
import {
  coachCertRows,
  coachCertSummary,
  groupLoad,
  outstandingForms,
} from '@/domain/rules'
import type { Announcement, Group } from '@/domain/types'
import {
  CalendarDays,
  ChevronRight,
  ClipboardX,
  CloudLightning,
  HeartPulse,
  ShieldCheck,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { readFile } from '@/lib/files'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { CertStatusLabel, EmptyState } from '@/components/burgee/marks'

function useCoach() {
  const coaches = useStore((s) => s.coaches)
  return coaches.find((c) => c.id === PERSONAS.coachId)!
}

export function CoachHome() {
  const coach = useCoach()
  const groups = useStore((s) => s.groups)
  const submissions = useStore((s) => s.submissions)
  const season = useStore((s) => s.settings.season)
  const warn = useStore((s) => s.settings.certWarningDays)
  const look = useLookups()
  const now = useNow()

  const mine = groups
    .filter((g) => g.coachIds.includes(coach.id))
    .map((g) => ({ g, s: look.session.get(g.sessionId)! }))
    .sort((a, b) => a.s.startDate.localeCompare(b.s.startDate))
  const today = mine.filter(({ s }) => meetsOn(s, now))
  const later = mine.filter(({ s }) => s.startDate > format(now, 'yyyy-MM-dd'))
  const certRows = coachCertRows(coach, CERT_TYPES, now, warn)
  const certIssue = certRows.filter((r) => r.status !== 'valid')

  const alertsFor = (g: Group) => {
    const kids = g.sailorIds.map((id) => look.sailor.get(id)!).filter(Boolean)
    return {
      medical: kids.filter((k) => k.medicalAlerts.length).length,
      forms: kids.filter(
        (k) => outstandingForms(k, FORM_TEMPLATES, submissions, season).length
      ).length,
    }
  }

  return (
    <div className='px-4 py-5'>
      <p className='text-sm text-muted-foreground'>
        {format(now, 'EEEE, MMMM d')}
      </p>
      <h1 className='mt-0.5 text-2xl font-semibold'>
        {now.getHours() < 12 ? 'Morning' : now.getHours() < 17 ? 'Afternoon' : 'Evening'}, {coach.name.split(' ')[0]}
      </h1>

      {certIssue.length > 0 && (
        <Link
          to='/coach/certs'
          className={cn(
            'mt-4 flex items-start gap-3 rounded-lg border p-3 text-sm',
            certIssue.some((r) => r.status !== 'expiring')
              ? 'border-destructive/50 bg-danger-soft'
              : 'border-signal/40 bg-signal-soft'
          )}
        >
          <ShieldCheck className='mt-0.5 size-5 shrink-0' />
          <span className='flex-1'>
            {certIssue.map((r) => (
              <span key={r.certType.id} className='block'>
                <span className='font-medium'>{r.certType.name}</span>{' '}
                {r.status === 'expiring'
                  ? `expires in ${r.daysLeft} days`
                  : r.status === 'expired'
                    ? 'has expired'
                    : 'is missing'}
              </span>
            ))}
            <span className='text-xs text-muted-foreground'>
              Upload your renewal so you stay on the roster.
            </span>
          </span>
          <ChevronRight className='size-4 self-center' />
        </Link>
      )}

      <section className='mt-6'>
        <h2 className='mb-2 text-sm font-semibold text-muted-foreground'>
          On the water today
        </h2>
        {today.length === 0 ? (
          <EmptyState title='No sessions today'>
            Your next groups are listed below.
          </EmptyState>
        ) : (
          <ul className='space-y-3'>
            {today.map(({ g, s }) => (
              <GroupCard
                key={g.id}
                group={g}
                subtitle={s.time.split('·')[0].trim()}
                alerts={alertsFor(g)}
                featured
              />
            ))}
          </ul>
        )}
      </section>

      <section className='mt-6'>
        <h2 className='mb-2 text-sm font-semibold text-muted-foreground'>
          Coming up
        </h2>
        <ul className='space-y-2'>
          {later.map(({ g, s }) => (
            <GroupCard
              key={g.id}
              group={g}
              subtitle={`${termById.get(s.termId)?.name}, ${s.name} (${format(new Date(`${s.startDate}T12:00:00`), 'MMM d')})`}
              alerts={alertsFor(g)}
            />
          ))}
          {later.length === 0 && <EmptyState title='Nothing scheduled yet' />}
        </ul>
      </section>
    </div>
  )
}

function GroupCard({
  group,
  subtitle,
  alerts,
  featured,
}: {
  group: Group
  subtitle: string
  alerts: { medical: number; forms: number }
  featured?: boolean
}) {
  const look = useLookups()
  const attendance = useStore((s) => s.attendance)
  const now = useNow()
  const session = look.session.get(group.sessionId)!
  const program = programById.get(session.programId)!
  const load = groupLoad(group, program.ratio)
  const today = format(now, 'yyyy-MM-dd')
  const counts = featured
    ? dayCounts(
        group.sailorIds
          .map((id) => attendance[attendanceKey(today, session.id, id)])
          .filter(Boolean),
        group.sailorIds
      )
    : undefined
  return (
    <li>
      <Link
        to='/coach/groups/$groupId'
        params={{ groupId: group.id }}
        className='block overflow-hidden rounded-lg border bg-card'
      >
        <span className={cn('flex gap-3 p-3', featured && 'p-4')}>
          <span
            className='w-1 shrink-0 rounded-full'
            style={{ background: program.color }}
            aria-hidden='true'
          />
          <span className='min-w-0 flex-1'>
            <span
              className={cn(
                'block font-semibold',
                featured && 'text-lg font-display'
              )}
            >
              {group.name}
              <span className='font-normal text-muted-foreground'>
                {' '}
                · {program.name}
              </span>
            </span>
            <span className='block text-sm text-muted-foreground'>
              {subtitle}
            </span>
            <span className='mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs'>
              <span>
                <strong>{load.sailors}</strong> sailors
              </span>
              {group.resource && (
                <span className='text-muted-foreground'>{group.resource}</span>
              )}
              {alerts.medical > 0 && (
                <span className='inline-flex items-center gap-1 text-destructive'>
                  <HeartPulse className='size-3.5' /> {alerts.medical} medical
                </span>
              )}
              {alerts.forms > 0 && (
                <span className='inline-flex items-center gap-1 text-signal'>
                  <ClipboardX className='size-3.5' /> {alerts.forms} missing
                  forms
                </span>
              )}
            </span>
          </span>
          <ChevronRight className='size-4 self-center text-muted-foreground' />
        </span>
        {counts && (
          <span
            className={cn(
              'block border-t px-4 py-2.5 text-sm font-medium',
              counts.onWater
                ? 'bg-signal-soft text-signal'
                : counts.notIn === load.sailors
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
            )}
          >
            {counts.onWater
              ? `${counts.onWater} on the water now`
              : counts.notIn === load.sailors
                ? 'Tap to take attendance'
                : `${load.sailors - counts.notIn - counts.absent} here, ${counts.absent} absent, ${counts.pickedUp} gone home`}
          </span>
        )}
      </Link>
    </li>
  )
}

export function CoachCerts() {
  const coach = useCoach()
  const warn = useStore((s) => s.settings.certWarningDays)
  const renew = useStore((s) => s.renewCert)
  const now = useNow()
  const rows = coachCertRows(coach, CERT_TYPES, now, warn)
  const [uploading, setUploading] = useState<string | null>(null)
  const [issued, setIssued] = useState(format(now, 'yyyy-MM-dd'))
  const [file, setFile] = useState<File | null>(null)
  const summary = coachCertSummary(rows)

  return (
    <div className='px-4 py-5'>
      <h1 className='text-2xl font-semibold'>Certifications</h1>
      <p className='mt-1 text-sm text-muted-foreground'>
        {summary === 'valid'
          ? 'Everything is current.'
          : 'Renew anything flagged so you can keep coaching.'}{' '}
        The program director sees the same list.
      </p>
      <ul className='mt-5 space-y-2'>
        {rows.map((r) => (
          <li key={r.certType.id} className='rounded-lg border bg-card p-3'>
            <div className='flex items-start justify-between gap-3'>
              <div>
                <p className='font-medium'>{r.certType.name}</p>
                <p className='text-xs text-muted-foreground'>
                  {r.expires
                    ? `Expires ${format(new Date(`${r.expires}T12:00:00`), 'MMMM d, yyyy')}`
                    : 'Nothing on file'}
                </p>
              </div>
              <CertStatusLabel
                status={r.status}
                detail={
                  r.status === 'expiring'
                    ? `${r.daysLeft} days left`
                    : undefined
                }
              />
            </div>
            {r.status !== 'valid' && (
              <Button
                size='sm'
                variant='outline'
                className='mt-3 w-full'
                onClick={() => {
                  setFile(null)
                  setIssued(format(now, 'yyyy-MM-dd'))
                  setUploading(r.certType.id)
                }}
              >
                <Upload className='size-4' /> Upload renewal
              </Button>
            )}
          </li>
        ))}
      </ul>
      <Sheet open={!!uploading} onOpenChange={(o) => !o && setUploading(null)}>
        <SheetContent side='bottom' className='rounded-t-2xl'>
          <SheetHeader>
            <SheetTitle>
              {CERT_TYPES.find((c) => c.id === uploading)?.name}
            </SheetTitle>
            <SheetDescription>
              Add a photo or PDF of your card. Burgee works out the expiry date.
            </SheetDescription>
          </SheetHeader>
          <div className='grid gap-3 px-4 pb-6'>
            <div className='grid gap-1.5'>
              <Label htmlFor='file'>Certificate</Label>
              <Input
                id='file'
                type='file'
                accept='image/*,application/pdf'
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className='grid gap-1.5'>
              <Label htmlFor='iss'>Date issued</Label>
              <Input
                id='iss'
                type='date'
                value={issued}
                onChange={(e) => setIssued(e.target.value)}
              />
            </div>
            <Button
              onClick={async () => {
                const info = file ? await readFile(file) : undefined
                renew(coach.id, uploading!, issued, info ? { ...info, uploadedBy: coach.name } : undefined)
                toast.success(
                  file
                    ? `${file.name} uploaded. Certification updated.`
                    : 'Certification updated'
                )
                setUploading(null)
              }}
            >
              Save renewal
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

/** Announcements a family or a coach would have received. */
export function MessageList({
  items,
  empty,
}: {
  items: Announcement[]
  empty: string
}) {
  const [open, setOpen] = useState<string | null>(null)
  if (!items.length) return <EmptyState title={empty} className='mx-4' />
  return (
    <ul className='divide-y'>
      {items.map((a) => {
        const expanded = open === a.id
        return (
          <li key={a.id}>
            <button
              className='w-full px-4 py-3 text-start'
              onClick={() => setOpen(expanded ? null : a.id)}
              aria-expanded={expanded}
            >
              <span className='flex items-start gap-2'>
                {a.category === 'weather' ? (
                  <CloudLightning
                    className='mt-0.5 size-4 shrink-0 text-signal'
                    aria-label='Weather'
                  />
                ) : (
                  <CalendarDays
                    className='mt-0.5 size-4 shrink-0 text-muted-foreground'
                    aria-hidden='true'
                  />
                )}
                <span className='min-w-0 flex-1'>
                  <span className='block font-medium'>{a.title}</span>
                  <span
                    className={cn(
                      'block text-sm text-muted-foreground',
                      !expanded && 'line-clamp-2'
                    )}
                  >
                    {a.body}
                  </span>
                  <span className='mt-1 block text-xs text-muted-foreground'>
                    {a.sentBy},{' '}
                    {isSameDay(new Date(a.sentAt), new Date())
                      ? format(new Date(a.sentAt), 'h:mm a')
                      : format(new Date(a.sentAt), 'MMM d')}
                  </span>
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export function CoachMessages() {
  const announcements = useStore((s) => s.announcements)
  const groups = useStore((s) => s.groups)
  const look = useLookups()
  const myPrograms = useMemo(() => {
    const ids = new Set<string>()
    groups
      .filter((g) => g.coachIds.includes(PERSONAS.coachId))
      .forEach((g) => ids.add(look.session.get(g.sessionId)!.programId))
    return ids
  }, [groups, look])
  const items = announcements.filter(
    (a) =>
      a.audience.kind === 'staff' ||
      a.audience.kind === 'everyone' ||
      (a.audience.kind === 'program' && myPrograms.has(a.audience.programId)) ||
      (a.audience.kind === 'group' &&
        groups
          .find((g) => g.id === (a.audience as { groupId: string }).groupId)
          ?.coachIds.includes(PERSONAS.coachId))
  )
  return (
    <div className='py-5'>
      <h1 className='px-4 text-2xl font-semibold'>Messages</h1>
      <p className='mb-3 px-4 text-sm text-muted-foreground'>
        Staff notes and anything sent to your groups.
      </p>
      <MessageList items={items} empty='No messages yet' />
    </div>
  )
}
