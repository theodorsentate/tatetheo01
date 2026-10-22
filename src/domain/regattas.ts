import type { RegattaDetails, RegattaResponse, Registration, Sailor, Session } from './types'

/**
 * Who a regatta is for: sailors on a current team whose fleet is racing.
 * `termId` is the term the regatta falls in.
 */
export function eligibleSailors(
  regatta: Pick<RegattaDetails, 'levels'>,
  sailors: Sailor[],
  registrations: Registration[],
  sessions: Session[],
  termId: string
): Sailor[] {
  const teamSessions = new Set(sessions.filter((s) => s.termId === termId && !/Week/.test(s.name)).map((s) => s.id))
  const onTeam = new Set(registrations.filter((r) => r.status === 'confirmed' && teamSessions.has(r.sessionId)).map((r) => r.sailorId))
  return sailors.filter((k) => onTeam.has(k.id) && regatta.levels.includes(k.level))
}

export type RegattaSummary = {
  going: RegattaResponse[]
  interested: RegattaResponse[]
  notGoing: RegattaResponse[]
  noAnswer: Sailor[]
  chaperones: RegattaResponse[]
}

export function regattaSummary(eventId: string, eligible: Sailor[], responses: RegattaResponse[]): RegattaSummary {
  const mine = responses.filter((r) => r.eventId === eventId)
  const answered = new Set(mine.map((r) => r.sailorId))
  return {
    going: mine.filter((r) => r.status === 'going'),
    interested: mine.filter((r) => r.status === 'interested'),
    notGoing: mine.filter((r) => r.status === 'not-going'),
    noAnswer: eligible.filter((k) => !answered.has(k.id)),
    chaperones: mine.filter((r) => r.chaperone),
  }
}

/**
 * Which term's teams a regatta draws from: the term it falls in, or the term
 * that just ended (a late-November regatta is still for the fall teams).
 */
export function termForDate<T extends { id: string; startDate: string; endDate: string }>(terms: T[], date: string): T {
  const containing = terms.find((t) => date >= t.startDate && date <= t.endDate)
  if (containing) return containing
  const ended = terms.filter((t) => t.endDate < date).sort((a, b) => b.endDate.localeCompare(a.endDate))[0]
  return ended ?? terms[0]
}
