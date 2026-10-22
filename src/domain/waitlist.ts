import type {
  Family,
  Registration,
  Sailor,
  Session,
  Term,
  WaitlistSettings,
} from './types'

/** Statuses that hold a seat in a session. */
export const SEAT_HOLDING = new Set(['confirmed', 'pending-payment', 'offered'])

export function seatsTaken(sessionId: string, regs: Registration[]): number {
  return regs.filter(
    (r) => r.sessionId === sessionId && SEAT_HOLDING.has(r.status)
  ).length
}

export function seatsLeft(session: Session, regs: Registration[]): number {
  return Math.max(0, session.capacity - seatsTaken(session.id, regs))
}

/**
 * Waitlist order for a session: members first (when member priority is on),
 * then first-come, first-served.
 */
export function waitlistFor(
  sessionId: string,
  regs: Registration[],
  sailors: Sailor[],
  families: Family[],
  settings: WaitlistSettings
): Registration[] {
  const familyBySailor = new Map(
    sailors.map((s) => [s.id, families.find((f) => f.id === s.familyId)])
  )
  return regs
    .filter((r) => r.sessionId === sessionId && r.status === 'waitlisted')
    .sort((a, b) => {
      if (settings.memberPriority) {
        const am = familyBySailor.get(a.sailorId)?.membership === 'member'
        const bm = familyBySailor.get(b.sailorId)?.membership === 'member'
        if (am !== bm) return am ? -1 : 1
      }
      return a.createdAt.localeCompare(b.createdAt)
    })
}

export type WaitlistChange = { registrationId: string; offerExpiresAt: string }

/**
 * Fills open seats in a session from the waitlist by issuing offers that hold
 * the seat for `holdHours`. Returns the offers to apply (pure — no mutation).
 */
export function offersToIssue(
  session: Session,
  regs: Registration[],
  sailors: Sailor[],
  families: Family[],
  settings: WaitlistSettings,
  now: Date
): WaitlistChange[] {
  if (!settings.autoOffer) return []
  const open = seatsLeft(session, regs)
  if (open <= 0) return []
  const queue = waitlistFor(session.id, regs, sailors, families, settings)
  const expires = new Date(
    now.getTime() + settings.holdHours * 3600 * 1000
  ).toISOString()
  return queue
    .slice(0, open)
    .map((r) => ({ registrationId: r.id, offerExpiresAt: expires }))
}

/** Offers past their hold time. */
export function expiredOffers(regs: Registration[], now: Date): Registration[] {
  return regs.filter(
    (r) =>
      r.status === 'offered' &&
      r.offerExpiresAt &&
      new Date(r.offerExpiresAt).getTime() < now.getTime()
  )
}

export type RegistrationWindow =
  | { open: true }
  | { open: false; reason: string; opensOn?: string }

/** Whether a family can register for a term right now. */
export function registrationWindow(
  term: Term,
  family: Family,
  now: Date
): RegistrationWindow {
  const opens = new Date(`${term.registrationOpens}T00:00:00`)
  if (now < opens)
    return {
      open: false,
      reason: 'Registration has not opened yet',
      opensOn: term.registrationOpens,
    }
  if (now > new Date(`${term.endDate}T23:59:59`))
    return { open: false, reason: 'This term has ended' }
  if (
    term.memberPriorityUntil &&
    family.membership !== 'member' &&
    now < new Date(`${term.memberPriorityUntil}T00:00:00`)
  )
    return {
      open: false,
      reason: 'Members-only registration window',
      opensOn: term.memberPriorityUntil,
    }
  return { open: true }
}
