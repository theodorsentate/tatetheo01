import { addDays, format } from 'date-fns'
import type {
  AttendanceEntry,
  AttendanceStatus,
  FormRequest,
  FormSubmission,
  FormTemplate,
  Sailor,
  Session,
  SwimCheck,
} from './types'

/* ───────────────────────── Schedule ───────────────────────── */

const DAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

/** Does a session meet on this date? Handles "Mon–Fri", "Tue–Fri (…)" and "Tue, Thu, Sat". */
export function meetsOn(session: Pick<Session, 'days' | 'startDate' | 'endDate'>, date: Date): boolean {
  const d = format(date, 'yyyy-MM-dd')
  if (d < session.startDate || d > session.endDate) return false
  const range = session.days.match(/^(Mon|Tue)–Fri/)
  if (range) return date.getDay() >= DAY_INDEX[range[1]] && date.getDay() <= 5
  return session.days.split(/,\s*/).some((x) => DAY_INDEX[x.trim()] === date.getDay())
}

/** The next day (today included) a session meets, within the next three weeks. */
export function nextPractice(session: Pick<Session, 'days' | 'startDate' | 'endDate'>, from: Date): string | undefined {
  for (let i = 0; i < 21; i++) {
    const d = new Date(from)
    d.setDate(d.getDate() + i)
    if (meetsOn(session, d)) return format(d, 'yyyy-MM-dd')
  }
  return undefined
}

/** Every date a session met (or meets) from its start through `until`, inclusive. */
export function practiceDates(session: Session, until: Date): string[] {
  const out: string[] = []
  let d = new Date(`${session.startDate}T12:00:00`)
  // Compare by calendar day so a practice later today still counts as today.
  const untilDay = new Date(`${format(until, 'yyyy-MM-dd')}T12:00:00`)
  const end = new Date(Math.min(untilDay.getTime(), new Date(`${session.endDate}T12:00:00`).getTime()))
  while (d <= end) {
    if (meetsOn(session, d)) out.push(format(d, 'yyyy-MM-dd'))
    d = addDays(d, 1)
  }
  return out
}

/* ───────────────────────── Attendance ───────────────────────── */

export const attendanceKey = (date: string, sessionId: string, sailorId: string) => `${date}|${sessionId}|${sailorId}`

export const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: 'Checked in',
  absent: 'Absent',
  'on-water': 'On the water',
  ashore: 'Ashore',
  'picked-up': 'Went home',
}

/** Counts for one session on one date. `notIn` = rostered but not yet marked. */
export function dayCounts(entries: AttendanceEntry[], sailorIds: string[]) {
  const by = new Map(entries.map((e) => [e.sailorId, e.status]))
  const c = { notIn: 0, present: 0, absent: 0, onWater: 0, ashore: 0, pickedUp: 0, launchedToday: false }
  for (const id of sailorIds) {
    const s = by.get(id)
    if (!s) c.notIn++
    else if (s === 'present') c.present++
    else if (s === 'absent') c.absent++
    else if (s === 'on-water') c.onWater++
    else if (s === 'ashore') c.ashore++
    else if (s === 'picked-up') c.pickedUp++
  }
  c.launchedToday = entries.some((e) => e.launchedAt)
  return c
}

/** Season attendance for one sailor in one session. Attended = anything but absent. */
export function attendanceRecord(entries: AttendanceEntry[], sailorId: string, sessionId: string, dates: string[]) {
  const mine = new Map(entries.filter((e) => e.sailorId === sailorId && e.sessionId === sessionId).map((e) => [e.date, e.status]))
  const marks = dates.map((date) => ({ date, status: mine.get(date) }))
  const counted = marks.filter((m) => m.status)
  const missed = counted.filter((m) => m.status === 'absent').length
  return {
    marks,
    attended: counted.length - missed,
    missed,
    rate: counted.length ? (counted.length - missed) / counted.length : undefined,
    missedLast3: marks.slice(-3).length === 3 && marks.slice(-3).every((m) => m.status === 'absent'),
  }
}

/* ───────────────────────── Swim checks ───────────────────────── */

export function latestSwimCheck(checks: SwimCheck[], sailorId: string): SwimCheck | undefined {
  return checks.filter((c) => c.sailorId === sailorId).sort((a, b) => b.date.localeCompare(a.date))[0]
}

export const swimPassed = (checks: SwimCheck[], sailorId: string) => latestSwimCheck(checks, sailorId)?.result === 'passed'

/* ───────────────────────── Form requests ───────────────────────── */

export type PendingForm = { template: FormTemplate; sailor?: Sailor; dueDate?: string; requestId?: string }

/**
 * Everything a family still has to sign: missing season forms for registered
 * sailors, plus any form the director sent them that isn't signed yet.
 */
export function pendingForFamily(opts: {
  familyId: string
  kids: Sailor[]
  activeSailorIds: Set<string>
  templates: FormTemplate[]
  submissions: FormSubmission[]
  requests: FormRequest[]
  season: string
}): PendingForm[] {
  const { familyId, kids, activeSailorIds, templates, submissions, requests, season } = opts
  const signed = (t: FormTemplate, sailorId?: string) =>
    submissions.some(
      (s) => s.templateId === t.id && s.season === season && s.familyId === familyId && (t.scope === 'family' || s.sailorId === sailorId)
    )
  const dueFor = (t: FormTemplate, sailorId?: string) =>
    requests
      .filter((r) => r.templateId === t.id && r.familyIds.includes(familyId) && (t.scope === 'family' || !sailorId || r.sailorIds.includes(sailorId)))
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt))[0]

  const out: PendingForm[] = []
  for (const t of templates) {
    if (t.scope === 'family') {
      const req = dueFor(t)
      const needed = (t.required !== false && kids.some((k) => activeSailorIds.has(k.id))) || !!req
      if (needed && !signed(t)) out.push({ template: t, dueDate: req?.dueDate, requestId: req?.id })
      continue
    }
    for (const k of kids) {
      const req = dueFor(t, k.id)
      const needed = (t.required !== false && activeSailorIds.has(k.id)) || (!!req && req.sailorIds.includes(k.id))
      if (needed && !signed(t, k.id)) out.push({ template: t, sailor: k, dueDate: req?.dueDate, requestId: req?.id })
    }
  }
  return out
}

/** Completion of one request: how many of the sailors (or families) it went to have signed. */
export function requestProgress(req: FormRequest, template: FormTemplate, submissions: FormSubmission[], season: string) {
  const targets = template.scope === 'family' ? req.familyIds.map((f) => ({ familyId: f })) : req.sailorIds.map((s) => ({ sailorId: s }))
  const done = targets.filter((t) =>
    submissions.some(
      (s) =>
        s.templateId === template.id &&
        s.season === season &&
        ('familyId' in t ? s.familyId === t.familyId : s.sailorId === t.sailorId)
    )
  ).length
  return { done, total: targets.length }
}
