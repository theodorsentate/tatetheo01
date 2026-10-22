import { differenceInHours, differenceInMinutes } from 'date-fns'
import { AlertTriangle, Check, Clock, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LEVELS, type CertStatus } from '@/domain/rules'
import type { Level, RegistrationStatus } from '@/domain/types'

/** Swallowtail burgee on a staff — the product mark. */
export function BurgeeMark({ className }: { className?: string }) {
  return (
    <svg viewBox='0 0 32 32' className={cn('size-7', className)} aria-hidden='true'>
      <path d='M5 3v27' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' />
      <path d='M6 4h22l-9 7 9 7H6z' fill='var(--burgee)' />
    </svg>
  )
}

/**
 * Fleet pennant. Opti fleets race with colored ribbons on the sail, so a
 * small pennant in the fleet color is how sailors and parents already read it.
 */
export function FleetChip({
  level,
  className,
  size = 'sm',
}: {
  level: Level
  className?: string
  size?: 'sm' | 'md'
}) {
  const meta = LEVELS[level]
  const isWhite = level === 'opti-white'
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 font-medium whitespace-nowrap text-foreground',
        size === 'sm' ? 'text-xs' : 'text-sm',
        className
      )}
    >
      <svg
        viewBox='0 0 14 10'
        className={size === 'sm' ? 'h-2.5 w-3.5' : 'h-3 w-4'}
        aria-hidden='true'
      >
        <path
          d='M0.5 0.5h13L9 5l4.5 4.5H0.5z'
          fill={isWhite ? '#ffffff' : meta.color}
          stroke={isWhite ? '#94a3b8' : meta.color}
          strokeWidth='1'
        />
      </svg>
      {meta.label}
    </span>
  )
}

const REG: Record<RegistrationStatus, { label: string; className: string }> = {
  confirmed: { label: 'Confirmed', className: 'bg-ok-soft text-ok' },
  'pending-payment': { label: 'Balance due', className: 'bg-secondary text-foreground' },
  waitlisted: { label: 'Waitlist', className: 'bg-muted text-muted-foreground' },
  offered: { label: 'Offer out', className: 'bg-signal-soft text-signal' },
  cancelled: { label: 'Cancelled', className: 'bg-transparent text-muted-foreground line-through' },
}

export function RegStatus({
  status,
  position,
  className,
}: {
  status: RegistrationStatus
  position?: number
  className?: string
}) {
  const s = REG[status]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        s.className,
        className
      )}
    >
      {s.label}
      {status === 'waitlisted' && position ? ` #${position}` : ''}
    </span>
  )
}

const CERT: Record<CertStatus, { label: string; className: string; icon: typeof Check }> = {
  valid: { label: 'Current', className: 'text-ok', icon: Check },
  expiring: { label: 'Expiring', className: 'text-signal', icon: Clock },
  expired: { label: 'Expired', className: 'text-destructive', icon: X },
  missing: { label: 'Missing', className: 'text-destructive', icon: AlertTriangle },
}

export function CertStatusLabel({
  status,
  detail,
  className,
}: {
  status: CertStatus
  detail?: string
  className?: string
}) {
  const c = CERT[status]
  const Icon = c.icon
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium', c.className, className)}>
      <Icon className='size-3.5' aria-hidden='true' />
      {detail ?? c.label}
    </span>
  )
}

/** Seats used vs capacity, with waitlist overflow shown past the end. */
export function FillBar({
  taken,
  capacity,
  waitlist = 0,
  className,
}: {
  taken: number
  capacity: number
  waitlist?: number
  className?: string
}) {
  const pct = capacity ? Math.min(100, (taken / capacity) * 100) : 0
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className='relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted'
        role='meter'
        aria-valuemin={0}
        aria-valuemax={capacity}
        aria-valuenow={taken}
        aria-label={`${taken} of ${capacity} spots filled`}
      >
        <div
          className={cn('h-full rounded-full', pct >= 100 ? 'bg-foreground' : 'bg-primary')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className='w-14 text-end text-xs text-muted-foreground'>
        {taken}/{capacity}
        {waitlist > 0 && <span className='text-signal'> +{waitlist}</span>}
      </span>
    </div>
  )
}

export function Initials({
  name,
  hue = 205,
  className,
}: {
  name: string
  hue?: number
  className?: string
}) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
  return (
    <span
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
        className
      )}
      style={{
        background: `oklch(0.92 0.04 ${hue})`,
        color: `oklch(0.35 0.08 ${hue})`,
      }}
      aria-hidden='true'
    >
      {initials}
    </span>
  )
}

export function OfferCountdown({ expiresAt, now }: { expiresAt: string; now: Date }) {
  const end = new Date(expiresAt)
  const h = differenceInHours(end, now)
  const m = differenceInMinutes(end, now) - h * 60
  if (end <= now) return <span className='text-destructive'>expired</span>
  return (
    <span className='font-medium text-signal'>
      {h > 0 ? `${h}h ${m}m` : `${m}m`} left
    </span>
  )
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-6 flex flex-wrap items-end justify-between gap-4', className)}>
      <div className='min-w-0'>
        <h1 className='text-2xl font-bold'>{title}</h1>
        {description && (
          <p className='mt-1 max-w-[65ch] text-sm text-muted-foreground'>{description}</p>
        )}
      </div>
      {actions && <div className='flex flex-wrap items-center gap-2'>{actions}</div>}
    </div>
  )
}

export function EmptyState({
  title,
  children,
  className,
}: {
  title: string
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('rounded-lg border border-dashed p-8 text-center', className)}>
      <p className='font-medium'>{title}</p>
      {children && <div className='mt-1 text-sm text-muted-foreground'>{children}</div>}
    </div>
  )
}
