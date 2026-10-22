import { useEffect, useMemo, useState } from 'react'
import { now, subscribeClock } from '@/lib/clock'
import { ACTIVE_STATUSES } from '@/domain/pricing'
import type { Program, Registration, Sailor, Session, Term } from '@/domain/types'
import { seatsTaken, waitlistFor } from '@/domain/waitlist'
import { PROGRAMS, TERMS } from './catalog'
import { useStore } from './store'

/** Current (demo) time, refreshed every 30s so countdowns stay live. */
export function useNow(intervalMs = 30_000) {
  const [current, setCurrent] = useState(() => now())
  useEffect(() => {
    const t = setInterval(() => setCurrent(now()), intervalMs)
    const off = subscribeClock(() => setCurrent(now()))
    return () => {
      clearInterval(t)
      off()
    }
  }, [intervalMs])
  return current
}

export const programById = new Map<string, Program>(PROGRAMS.map((p) => [p.id, p]))
export const termById = new Map<string, Term>(TERMS.map((t) => [t.id, t]))

export function useLookups() {
  const sessions = useStore((s) => s.sessions)
  const sailors = useStore((s) => s.sailors)
  const families = useStore((s) => s.families)
  const coaches = useStore((s) => s.coaches)
  return useMemo(
    () => ({
      session: new Map(sessions.map((s) => [s.id, s])),
      sailor: new Map(sailors.map((s) => [s.id, s])),
      family: new Map(families.map((f) => [f.id, f])),
      coach: new Map(coaches.map((c) => [c.id, c])),
      program: programById,
      term: termById,
    }),
    [sessions, sailors, families, coaches]
  )
}

export type SessionStat = {
  session: Session
  program: Program
  taken: number
  confirmed: number
  waitlist: number
  offers: number
}

/** Seat counts per session, recomputed when registrations change. */
export function useSessionStats(): Map<string, SessionStat> {
  const sessions = useStore((s) => s.sessions)
  const regs = useStore((s) => s.registrations)
  return useMemo(() => {
    const m = new Map<string, SessionStat>()
    for (const session of sessions) {
      m.set(session.id, {
        session,
        program: programById.get(session.programId)!,
        taken: 0,
        confirmed: 0,
        waitlist: 0,
        offers: 0,
      })
    }
    for (const r of regs) {
      const st = m.get(r.sessionId)
      if (!st) continue
      if (ACTIVE_STATUSES.has(r.status)) st.taken++
      if (r.status === 'confirmed') st.confirmed++
      if (r.status === 'waitlisted') st.waitlist++
      if (r.status === 'offered') st.offers++
    }
    return m
  }, [sessions, regs])
}

export function useWaitlistPosition() {
  const regs = useStore((s) => s.registrations)
  const sailors = useStore((s) => s.sailors)
  const families = useStore((s) => s.families)
  const settings = useStore((s) => s.settings.waitlist)
  return useMemo(() => {
    const pos = new Map<string, number>()
    const bySession = new Set(regs.filter((r) => r.status === 'waitlisted').map((r) => r.sessionId))
    for (const sid of bySession) {
      waitlistFor(sid, regs, sailors, families, settings).forEach((r, i) => pos.set(r.id, i + 1))
    }
    return pos
  }, [regs, sailors, families, settings])
}

export const sailorName = (s?: Sailor) => (s ? `${s.firstName} ${s.lastName}` : 'Unknown sailor')

export function familyRegs(regs: Registration[], sailors: Sailor[], familyId: string) {
  const ids = new Set(sailors.filter((s) => s.familyId === familyId).map((s) => s.id))
  return regs.filter((r) => ids.has(r.sailorId))
}

export { seatsTaken }
