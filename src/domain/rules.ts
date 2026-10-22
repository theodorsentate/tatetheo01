import { differenceInCalendarDays, differenceInYears } from 'date-fns'
import type {
  CertType,
  Coach,
  FormSubmission,
  FormTemplate,
  Group,
  Level,
  Program,
  Registration,
  Sailor,
  Session,
} from './types'
import { ACTIVE_STATUSES } from './pricing'

/* ───────────────────────── Levels ───────────────────────── */

export const LEVELS: Record<Level, { label: string; short: string; color: string }> = {
  'learn-to-sail': { label: 'Learn to Sail', short: 'LTS', color: '#0ea5e9' },
  'opti-green': { label: 'Opti Green', short: 'Green', color: '#16a34a' },
  'opti-red': { label: 'Opti Red', short: 'Red', color: '#dc2626' },
  'opti-white': { label: 'Opti White', short: 'White', color: '#94a3b8' },
  'opti-blue': { label: 'Opti Blue', short: 'Blue', color: '#2563eb' },
  'club-420': { label: 'Club 420', short: '420', color: '#7c3aed' },
  ilca: { label: 'ILCA', short: 'ILCA', color: '#ea580c' },
  swim: { label: 'Swim', short: 'Swim', color: '#06b6d4' },
  tennis: { label: 'Tennis', short: 'Tennis', color: '#ca8a04' },
}

/* ─────────────────────── Eligibility ─────────────────────── */

export function ageOn(dob: string, date: string): number {
  return differenceInYears(new Date(`${date}T12:00:00`), new Date(`${dob}T12:00:00`))
}

export type Eligibility = { ok: true } | { ok: false; reason: string }

export function eligibility(
  sailor: Sailor,
  program: Program,
  session: Session
): Eligibility {
  const age = ageOn(sailor.dob, session.startDate)
  if (age < program.minAge || age > program.maxAge)
    return {
      ok: false,
      reason: `Ages ${program.minAge}–${program.maxAge} (${sailor.firstName} will be ${age})`,
    }
  // Swim and tennis are open to any junior in the age band.
  if (program.activity !== 'sailing') return { ok: true }
  if (!program.levels.includes(sailor.level))
    return {
      ok: false,
      reason: `For ${program.levels.map((l) => LEVELS[l].short).join(' / ')} sailors`,
    }
  return { ok: true }
}

/* ───────────────────── Certifications ───────────────────── */

export type CertStatus = 'valid' | 'expiring' | 'expired' | 'missing'

export function certStatus(
  expires: string | undefined,
  now: Date,
  warningDays: number
): CertStatus {
  if (!expires) return 'missing'
  const days = differenceInCalendarDays(new Date(`${expires}T12:00:00`), now)
  if (days < 0) return 'expired'
  if (days <= warningDays) return 'expiring'
  return 'valid'
}

export type CoachCertRow = {
  certType: CertType
  status: CertStatus
  expires?: string
  daysLeft?: number
}

export function coachCertRows(
  coach: Coach,
  certTypes: CertType[],
  now: Date,
  warningDays: number
): CoachCertRow[] {
  return certTypes
    .filter(
      (ct) =>
        ct.requiredFor.includes(coach.role) ||
        coach.certs.some((c) => c.certTypeId === ct.id)
    )
    .map((ct) => {
      const cert = coach.certs
        .filter((c) => c.certTypeId === ct.id)
        .sort((a, b) => b.expires.localeCompare(a.expires))[0]
      return {
        certType: ct,
        status: certStatus(cert?.expires, now, warningDays),
        expires: cert?.expires,
        daysLeft: cert
          ? differenceInCalendarDays(new Date(`${cert.expires}T12:00:00`), now)
          : undefined,
      }
    })
}

/** Worst status across a coach's required certs. */
export function coachCertSummary(rows: CoachCertRow[]): CertStatus {
  const required = rows
  if (required.some((r) => r.status === 'expired' || r.status === 'missing'))
    return required.some((r) => r.status === 'expired') ? 'expired' : 'missing'
  if (required.some((r) => r.status === 'expiring')) return 'expiring'
  return 'valid'
}

/* ───────────────────────── Forms ───────────────────────── */

export function activeSailorIds(regs: Registration[]): Set<string> {
  return new Set(
    regs.filter((r) => ACTIVE_STATUSES.has(r.status)).map((r) => r.sailorId)
  )
}

/** Forms a sailor still needs this season (family-scope forms checked per family). */
export function outstandingForms(
  sailor: Sailor,
  templates: FormTemplate[],
  submissions: FormSubmission[],
  season: string
): FormTemplate[] {
  return templates.filter((t) => {
    if (t.required === false) return false
    const done = submissions.some(
      (s) =>
        s.templateId === t.id &&
        s.season === season &&
        (t.scope === 'family'
          ? s.familyId === sailor.familyId
          : s.sailorId === sailor.id)
    )
    return !done
  })
}

/* ───────────────────────── Rosters ───────────────────────── */

export type GroupLoad = {
  sailors: number
  capacity: number
  overRatio: boolean
  noCoach: boolean
}

export function groupLoad(group: Group, ratio: number): GroupLoad {
  const capacity = group.coachIds.length * ratio
  return {
    sailors: group.sailorIds.length,
    capacity,
    noCoach: group.coachIds.length === 0 && group.sailorIds.length > 0,
    overRatio: group.sailorIds.length > capacity,
  }
}

/**
 * Splits a session's confirmed sailors into age-banded groups that respect the
 * coach ratio, then hands out coaches round-robin.
 */
export function autoGroups(
  session: Session,
  program: Program,
  sailors: Sailor[],
  coaches: Coach[],
  makeId: () => string,
  resources: string[] = []
): Group[] {
  const sorted = [...sailors].sort((a, b) => b.dob.localeCompare(a.dob))
  const count = Math.max(1, Math.ceil(sorted.length / program.ratio))
  const size = Math.ceil(sorted.length / count)
  const prefix = groupPrefix(program)
  return Array.from({ length: count }, (_, i) => ({
    id: makeId(),
    sessionId: session.id,
    name: `${prefix} ${String.fromCharCode(65 + i)}`,
    coachIds: coaches[i % Math.max(1, coaches.length)]
      ? [coaches[i % coaches.length].id]
      : [],
    sailorIds: sorted.slice(i * size, (i + 1) * size).map((s) => s.id),
    resource: resources[i],
  }))
}

/** Short label used to name roster groups ("Green A", "Race B", "420 A"). */
export function groupPrefix(program: Program): string {
  return program.name
    .replace(/ (Camp|Team|Clinic)$/, '')
    .replace(/^(Opti|Junior|High School) /, '')
}
