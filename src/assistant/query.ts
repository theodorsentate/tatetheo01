/**
 * Ask Burgee — the data tools.
 *
 * Pure functions over a snapshot of club state. Claude calls them as tools
 * (see claude.ts); the offline engine (local.ts) calls the same functions, so
 * both answer from identical numbers. In production these run server-side
 * against Postgres-loaded state with the same signatures.
 */
import { format } from 'date-fns'
import { CERT_TYPES, FORM_TEMPLATES, PROGRAMS, TERMS } from '@/data/catalog'
import type { DemoState } from '@/data/seed'
import { ACTIVE_STATUSES } from '@/domain/pricing'
import {
  ageOn,
  coachCertRows,
  groupLoad,
  LEVELS,
  outstandingForms,
} from '@/domain/rules'
import type { Audience, Channel, ClubSettings, Level, Session } from '@/domain/types'
import { waitlistFor } from '@/domain/waitlist'
import { eligibleSailors, regattaSummary, termForDate } from '@/domain/regattas'
import { SKILLS, TRACKS, trackFor } from '@/data/curriculum'
import { attendanceKey, attendanceRecord, dayCounts, latestSwimCheck, meetsOn, practiceDates, requestProgress, STATUS_LABEL } from '@/domain/attendance'

export type ClubSnapshot = DemoState & { settings: ClubSettings }
export type Ctx = { s: ClubSnapshot; now: Date }

/** Something the director can click after an answer: open a page, or review a draft. */
export type AssistantAction =
  | { kind: 'link'; label: string; href: string }
  | { kind: 'draft'; label: string; title: string; body: string; audience: Audience; channels: Channel[] }

const d = (iso: string) => format(new Date(`${iso}T12:00:00`), 'MMM d')
const programById = new Map(PROGRAMS.map((p) => [p.id, p]))
const termById = new Map(TERMS.map((t) => [t.id, t]))

/* ───────────────────────── Name resolution ───────────────────────── */

const PROGRAM_ALIASES: [RegExp, string[]][] = [
  [/learn[- ]to[- ]sail|\blts\b|beginner/, ['lts']],
  [/green\s*(fleet\s*)?camp/, ['green-camp']],
  [/green\s*team/, ['green-team']],
  [/\bgreen\b/, ['green-camp', 'green-team']],
  [/race\s*camp|rwb\s*camp|red,?\s*white|championship\s*camp/, ['rwb-camp']],
  [/race\s*team|rwb\s*team/, ['rwb-team']],
  [/\brwb\b|opti\s*race|\brace\b/, ['rwb-camp', 'rwb-team']],
  [/420/, ['420-camp', '420-team']],
  [/ilca|laser/, ['ilca-camp', 'ilca-team']],
]

/** Program ids a phrase refers to ("green camp", "420", "race team"…). */
export function matchPrograms(text?: string): string[] {
  if (!text) return []
  const t = text.toLowerCase()
  const exact = PROGRAMS.find((p) => p.id === t || p.name.toLowerCase() === t)
  if (exact) return [exact.id]
  for (const [re, ids] of PROGRAM_ALIASES) {
    if (re.test(t)) {
      if (/\bcamps?\b/.test(t)) return ids.filter((id) => programById.get(id)!.format === 'camp')
      if (/\bteams?\b/.test(t)) return ids.filter((id) => programById.get(id)!.format === 'team')
      return ids
    }
  }
  return []
}

export function matchTerm(text?: string): string | undefined {
  if (!text) return undefined
  const t = text.toLowerCase()
  if (TERMS.some((x) => x.id === t)) return t
  if (/this week|right now|today|this season|currently/.test(t)) return 'now'
  if (/summer|camp week|\bweek\s*\d/.test(t)) return 'summer-27'
  if (/fall|autumn/.test(t)) return 'fall-27'
  if (/spring/.test(t)) return 'spring-27'
  return undefined
}

export function matchWeek(text?: string | number): number | undefined {
  if (text === undefined || text === null || text === '') return undefined
  if (typeof text === 'number') return text
  const m = String(text).toLowerCase().match(/\b(?:week|wk|w)\s*#?\s*(\d)\b/) ?? String(text).match(/^\s*(\d)\s*$/)
  return m ? Number(m[1]) : undefined
}

/** Sessions matching any combination of program / term / week. */
export function findSessions(ctx: Ctx, q: { program?: string; term?: string; week?: string | number; sessionId?: string }): Session[] {
  if (q.sessionId) return ctx.s.sessions.filter((s) => s.id === q.sessionId)
  const programs = matchPrograms(q.program)
  const week = matchWeek(q.week)
  const today = format(ctx.now, 'yyyy-MM-dd')
  let term = matchTerm(q.term) ?? (week ? 'summer-27' : undefined)
  // Teams: the season running now, else the next one.
  if (!term && programs.length && programs.every((id) => programById.get(id)!.format === 'team'))
    term = TERMS.find((t) => t.season !== 'summer' && t.endDate >= today)?.id
  // A camp with no week named means this week's session.
  if (!term && !week && programs.length && programs.every((id) => programById.get(id)!.format === 'camp')) term = 'now'
  return ctx.s.sessions.filter(
    (s) =>
      (!programs.length || programs.includes(s.programId)) &&
      (term === 'now' ? s.startDate <= today && s.endDate >= today : !term || s.termId === term) &&
      (!week || s.name === `Week ${week}`)
  )
}

const sessionLabel = (s: Session) => {
  const p = programById.get(s.programId)!
  return `${p.name}, ${s.name.startsWith('Week') ? s.name : termById.get(s.termId)?.name}`
}
const sessionHref = (s: Session) => `/admin/sessions/${s.id}`
const familyHref = (id: string) => `/admin/families?family=${id}`

function seatCounts(ctx: Ctx, sessionId: string) {
  let taken = 0
  let confirmed = 0
  let waitlist = 0
  let offers = 0
  let pending = 0
  for (const r of ctx.s.registrations) {
    if (r.sessionId !== sessionId) continue
    if (ACTIVE_STATUSES.has(r.status)) taken++
    if (r.status === 'confirmed') confirmed++
    if (r.status === 'waitlisted') waitlist++
    if (r.status === 'offered') offers++
    if (r.status === 'pending-payment') pending++
  }
  return { taken, confirmed, waitlist, offers, pending }
}

/* ───────────────────────── Tools ───────────────────────── */

export function clubOverview(ctx: Ctx) {
  const { s, now } = ctx
  return {
    club: s.settings.clubName,
    today: format(now, 'EEEE, MMMM d, yyyy'),
    season: s.settings.season,
    terms: TERMS.map((t) => ({
      name: t.name,
      dates: `${d(t.startDate)} – ${d(t.endDate)}`,
      status: now < new Date(`${t.startDate}T00:00:00`) ? 'upcoming' : now > new Date(`${t.endDate}T23:59:59`) ? 'ended' : 'in progress',
      registrationOpened: d(t.registrationOpens),
      membersOnlyUntil: t.memberPriorityUntil ? d(t.memberPriorityUntil) : undefined,
      earlyBirdUntil: t.earlyBirdUntil ? d(t.earlyBirdUntil) : undefined,
    })),
    programs: PROGRAMS.map((p) => ({ name: p.name, format: p.format, ages: `${p.minAge}–${p.maxAge}`, fleets: p.levels.map((l) => LEVELS[l].label), coachRatio: `1:${p.ratio}` })),
    pricing: {
      tiers: s.settings.pricing.tiers.map((t) => ({ name: t.name, per: t.unit, member: t.member, nonMember: t.nonMember })),
      siblingDiscountPct: s.settings.pricing.siblingDiscountPct,
      earlyBirdPct: s.settings.pricing.earlyBirdPct,
      multiWeek: `${s.settings.pricing.multiWeekDiscountPct}% off at ${s.settings.pricing.multiWeekMin}+ weeks`,
      processingFeePct: s.settings.pricing.processingFeePct,
    },
    waitlistRules: s.settings.waitlist,
    counts: { families: s.families.length, sailors: s.sailors.length, staff: s.coaches.length },
  }
}

const CERT_ALIASES: [RegExp, string][] = [
  [/safe\s*sport/, 'safesport'],
  [/first\s*aid|cpr|aed/, 'fa'],
  [/background/, 'bg'],
  [/power\s*boat|safe\s*power|\bpwr\b|boat\s*handling/, 'pwr'],
  [/level\s*2|\bl2\b|race\s*coach/, 'l2'],
  [/level\s*1|\bl1\b|instructor\s*cert/, 'l1'],
]
export function matchCert(text?: string): string | undefined {
  if (!text) return undefined
  const t = text.toLowerCase()
  if (CERT_TYPES.some((c) => c.id === t)) return t
  return CERT_ALIASES.find(([re]) => re.test(t))?.[1]
}

export function staffCertifications(ctx: Ctx, q: { person?: string; cert?: string; status?: string }) {
  const certId = matchCert(q.cert)
  const want = (q.status ?? 'needs-action').toLowerCase()
  const person = q.person?.toLowerCase().trim()
  const rows = ctx.s.coaches
    .filter((c) => !person || c.name.toLowerCase().includes(person))
    .flatMap((c) =>
      coachCertRows(c, CERT_TYPES, ctx.now, ctx.s.settings.certWarningDays)
        .filter((r) => !certId || r.certType.id === certId)
        .map((r) => ({
          staff: c.name,
          role: c.role,
          cert: r.certType.name,
          status: r.status,
          expires: r.expires ? d(r.expires) + `, ${r.expires.slice(0, 4)}` : undefined,
          daysLeft: r.daysLeft,
          onRoster: ctx.s.groups.some((g) => g.coachIds.includes(c.id)),
        }))
    )
    .filter((r) =>
      want === 'all' ? true : want === 'needs-action' ? r.status !== 'valid' : r.status === want
    )
    .sort((a, b) => (a.daysLeft ?? -999) - (b.daysLeft ?? -999))
  return {
    cert: certId ? CERT_TYPES.find((c) => c.id === certId)!.name : 'all certifications',
    warningWindowDays: ctx.s.settings.certWarningDays,
    filter: want,
    rows,
    staffPage: '/admin/staff',
    requiredFor: certId ? CERT_TYPES.find((c) => c.id === certId)!.requiredFor : undefined,
  }
}

export function sessionsInfo(ctx: Ctx, q: { program?: string; term?: string; week?: string | number; filter?: string }) {
  const list = findSessions(ctx, q)
  const rows = list
    .map((s) => {
      const c = seatCounts(ctx, s.id)
      return {
        session: sessionLabel(s),
        term: termById.get(s.termId)!.name,
        dates: `${d(s.startDate)}–${d(s.endDate)}`,
        when: `${s.days}, ${s.time}`,
        capacity: s.capacity,
        taken: c.taken,
        spotsLeft: Math.max(0, s.capacity - c.taken),
        confirmed: c.confirmed,
        unpaid: c.pending,
        waitlist: c.waitlist,
        offersOut: c.offers,
        registrationOpen: s.status === 'open',
        href: sessionHref(s),
      }
    })
    .filter((r) =>
      q.filter === 'full' ? r.spotsLeft === 0 : q.filter === 'waitlist' ? r.waitlist + r.offersOut > 0 : q.filter === 'open' ? r.spotsLeft > 0 : true
    )
  return { matched: rows.length, rows: rows.slice(0, 70) }
}

export function waitlistInfo(ctx: Ctx, q: { program?: string; term?: string; week?: string | number; sessionId?: string }) {
  const { s, now } = ctx
  const sailorById = new Map(s.sailors.map((x) => [x.id, x]))
  const famById = new Map(s.families.map((x) => [x.id, x]))
  const list = findSessions(ctx, q)
  const out = list
    .map((se) => {
      const queue = waitlistFor(se.id, s.registrations, s.sailors, s.families, s.settings.waitlist)
      const offers = s.registrations.filter((r) => r.sessionId === se.id && r.status === 'offered')
      return {
        session: sessionLabel(se),
        href: sessionHref(se),
        spotsLeft: Math.max(0, se.capacity - seatCounts(ctx, se.id).taken),
        offersOut: offers.map((r) => {
          const k = sailorById.get(r.sailorId)!
          const hrs = r.offerExpiresAt ? Math.max(0, Math.round((new Date(r.offerExpiresAt).getTime() - now.getTime()) / 3600000)) : undefined
          return { sailor: `${k.firstName} ${k.lastName}`, family: famById.get(k.familyId)!.name, holdEndsInHours: hrs }
        }),
        inLine: queue.map((r, i) => {
          const k = sailorById.get(r.sailorId)!
          const f = famById.get(k.familyId)!
          return { position: i + 1, sailor: `${k.firstName} ${k.lastName}`, family: f.name, member: f.membership === 'member', joined: format(new Date(r.createdAt), 'MMM d') }
        }),
      }
    })
    .filter((x) => x.inLine.length || x.offersOut.length || list.length === 1)
  return {
    rules: s.settings.waitlist.memberPriority ? 'Members first, then first come first served' : 'First come first served',
    holdHours: s.settings.waitlist.holdHours,
    sessions: out,
  }
}

export function sailorsInfo(
  ctx: Ctx,
  q: { name?: string; program?: string; term?: string; week?: string | number; level?: string; withMedical?: boolean; missingForms?: boolean; limit?: number }
) {
  const { s, now } = ctx
  const famById = new Map(s.families.map((x) => [x.id, x]))
  const sessionIds = q.program || q.term || q.week ? new Set(findSessions(ctx, q).map((x) => x.id)) : undefined
  const activeRegs = s.registrations.filter((r) => r.status !== 'cancelled')
  const needle = q.name?.toLowerCase().trim()
  const level = q.level ? (Object.keys(LEVELS) as Level[]).find((l) => LEVELS[l].label.toLowerCase().includes(q.level!.toLowerCase()) || l === q.level) : undefined
  const today = format(now, 'yyyy-MM-dd')
  const rows = s.sailors
    .filter((k) => !needle || `${k.firstName} ${k.lastName}`.toLowerCase().includes(needle) || k.lastName.toLowerCase() === needle)
    .filter((k) => !level || k.level === level)
    .filter((k) => !sessionIds || activeRegs.some((r) => r.sailorId === k.id && sessionIds.has(r.sessionId) && r.status !== 'waitlisted'))
    .filter((k) => !q.withMedical || k.medicalAlerts.length > 0)
    .map((k) => {
      const missing = activeRegs.some((r) => r.sailorId === k.id) ? outstandingForms(k, FORM_TEMPLATES, s.submissions, s.settings.season).map((t) => t.short) : []
      const medForm = s.submissions.find((x) => x.templateId === 'medical' && x.sailorId === k.id && x.season === s.settings.season)
      return {
        name: `${k.firstName} ${k.lastName}`,
        age: ageOn(k.dob, today),
        fleet: LEVELS[k.level].label,
        family: famById.get(k.familyId)!.name,
        familyHref: familyHref(k.familyId),
        medicalAlerts: k.medicalAlerts,
        parentNote: k.parentNote?.text,
        authorizedPickups: k.authorizedPickups ?? [],
        swimCheck: (() => {
          const sc = latestSwimCheck(s.swimChecks, k.id)
          return sc ? `${sc.result} ${d(sc.date)} (${sc.by})` : 'not done'
        })(),
        emergencyContact: medForm ? `${medForm.values.emergencyName} ${medForm.values.emergencyPhone}` : undefined,
        formsMissing: missing,
        registrations: activeRegs
          .filter((r) => r.sailorId === k.id)
          .map((r) => {
            const se = s.sessions.find((x) => x.id === r.sessionId)!
            return `${sessionLabel(se)} (${r.status})`
          }),
      }
    })
    .filter((r) => !q.missingForms || r.formsMissing.length > 0)
  return { matched: rows.length, rows: rows.slice(0, q.limit ?? 40) }
}

export function familyInfo(ctx: Ctx, q: { name: string }) {
  const { s } = ctx
  const needle = q.name.toLowerCase().replace(/\bfamily\b|'s\b/g, '').trim()
  const fams = s.families.filter(
    (f) => f.name.toLowerCase() === needle || needle.split(/\s+/).includes(f.name.toLowerCase()) || f.guardians.some((g) => g.name.toLowerCase().includes(needle))
  )
  return {
    matched: fams.length,
    families: fams.slice(0, 3).map((f) => {
      const kids = s.sailors.filter((k) => k.familyId === f.id)
      const regs = s.registrations.filter((r) => kids.some((k) => k.id === r.sailorId) && r.status !== 'cancelled')
      return {
        family: f.name,
        href: familyHref(f.id),
        membership: f.membership === 'member' ? `Member ${f.memberNumber}` : 'Non-member',
        guardians: f.guardians.map((g) => ({ name: g.name, phone: g.phone, email: g.email, texts: g.smsOptIn })),
        sailors: kids.map((k) => ({
          name: k.firstName,
          fleet: LEVELS[k.level].label,
          medicalAlerts: k.medicalAlerts,
          formsMissing: regs.some((r) => r.sailorId === k.id) ? outstandingForms(k, FORM_TEMPLATES, s.submissions, s.settings.season).map((t) => t.short) : [],
        })),
        registrations: regs.map((r) => ({
          sailor: kids.find((k) => k.id === r.sailorId)!.firstName,
          session: sessionLabel(s.sessions.find((x) => x.id === r.sessionId)!),
          status: r.status === 'pending-payment' ? 'confirmed' : r.status,
        })),
      }
    }),
  }
}

export function rostersInfo(ctx: Ctx, q: { program?: string; term?: string; week?: string | number; coach?: string; problemsOnly?: boolean }) {
  const { s } = ctx
  const coachNeedle = q.coach?.toLowerCase()
  const sessionIds = q.program || q.term || q.week ? new Set(findSessions(ctx, q).map((x) => x.id)) : undefined
  const sailorById = new Map(s.sailors.map((x) => [x.id, x]))
  const groups = s.groups
    .filter((g) => !sessionIds || sessionIds.has(g.sessionId))
    .filter((g) => !coachNeedle || g.coachIds.some((id) => s.coaches.find((c) => c.id === id)!.name.toLowerCase().includes(coachNeedle)))
    .map((g) => {
      const se = s.sessions.find((x) => x.id === g.sessionId)!
      const p = programById.get(se.programId)!
      const load = groupLoad(g, p.ratio)
      return {
        group: g.name,
        session: sessionLabel(se),
        href: sessionHref(se),
        coaches: g.coachIds.map((id) => s.coaches.find((c) => c.id === id)!.name),
        sailors: load.sailors,
        ratio: `1:${p.ratio}`,
        problem: load.noCoach ? 'no coach' : load.overRatio ? `over ratio by ${load.sailors - load.capacity}` : undefined,
        boat: g.resource,
        sailorNames: g.sailorIds.map((id) => {
          const k = sailorById.get(id)
          return k ? `${k.firstName} ${k.lastName}${k.medicalAlerts.length ? ` [${k.medicalAlerts.join('; ')}]` : ''}` : ''
        }),
      }
    })
    .filter((g) => !q.problemsOnly || g.problem)
  const ungrouped = (sessionIds ? [...sessionIds] : [])
    .filter((id) => !s.groups.some((g) => g.sessionId === id) && seatCounts(ctx, id).confirmed > 0)
    .map((id) => sessionLabel(s.sessions.find((x) => x.id === id)!))
  return { groups, sessionsWithoutGroupsYet: ungrouped }
}

export function formsInfo(ctx: Ctx, q: { form?: string; program?: string; term?: string; week?: string | number }) {
  const { s } = ctx
  const t = q.form ? FORM_TEMPLATES.find((x) => x.id === q.form || x.name.toLowerCase().includes(q.form!.toLowerCase()) || x.short.toLowerCase().includes(q.form!.toLowerCase().replace(/ form$/, ''))) : undefined
  const sessionIds = q.program || q.term || q.week ? new Set(findSessions(ctx, q).map((x) => x.id)) : undefined
  const active = s.registrations.filter((r) => ACTIVE_STATUSES.has(r.status) && (!sessionIds || sessionIds.has(r.sessionId)))
  const ids = new Set(active.map((r) => r.sailorId))
  const famById = new Map(s.families.map((f) => [f.id, f]))
  const rows = s.sailors
    .filter((k) => ids.has(k.id))
    .map((k) => ({ k, missing: outstandingForms(k, FORM_TEMPLATES, s.submissions, s.settings.season).filter((x) => !t || x.id === t.id) }))
    .filter((x) => x.missing.length)
    .map(({ k, missing }) => ({
      sailor: `${k.firstName} ${k.lastName}`,
      guardian: famById.get(k.familyId)!.guardians[0].name,
      phone: famById.get(k.familyId)!.guardians[0].phone,
      missing: missing.map((m) => m.short),
      familyHref: familyHref(k.familyId),
    }))
  return {
    season: s.settings.season,
    form: t?.name ?? 'any form',
    activeSailors: ids.size,
    sailorsMissing: rows.length,
    families: new Set(rows.map((r) => r.guardian)).size,
    rows: rows.slice(0, 50),
    formsPage: '/admin/forms',
  }
}

/** Today's attendance (live) and season attendance problems for team sessions. */
export function attendanceInfo(ctx: Ctx, q: { program?: string; term?: string; week?: string | number }) {
  const { s, now } = ctx
  const today = format(now, 'yyyy-MM-dd')
  const sessions = (q.program || q.term || q.week ? findSessions(ctx, q) : s.sessions).filter((x) => today >= x.startDate && today <= x.endDate)
  const all = Object.values(s.attendance)
  const sailorById = new Map(s.sailors.map((x) => [x.id, x]))
  const name = (id: string) => `${sailorById.get(id)!.firstName} ${sailorById.get(id)!.lastName}`
  return {
    date: format(now, 'EEE MMM d'),
    sessions: sessions.map((se) => {
      const ids = s.registrations.filter((r) => r.sessionId === se.id && r.status === 'confirmed').map((r) => r.sailorId)
      const todays = ids.map((id) => s.attendance[attendanceKey(today, se.id, id)]).filter(Boolean)
      const dates = practiceDates(se, now).filter((x) => x < today)
      const c = dayCounts(todays, ids)
      return {
        session: sessionLabel(se),
        href: sessionHref(se),
        practiceToday: meetsOn(se, now),
        today: {
          onTheWater: todays.filter((e) => e.status === 'on-water').map((e) => name(e.sailorId)),
          here: todays.filter((e) => e.status === 'present' || e.status === 'ashore').map((e) => name(e.sailorId)),
          absent: todays.filter((e) => e.status === 'absent').map((e) => name(e.sailorId)),
          wentHome: todays.filter((e) => e.status === 'picked-up').map((e) => `${name(e.sailorId)} with ${e.pickedUpBy}`),
          notCheckedIn: c.notIn,
        },
        attendanceConcerns: ids
          .map((id) => ({ id, rec: attendanceRecord(all, id, se.id, dates) }))
          .filter((x) => x.rec.missedLast3 || (x.rec.rate !== undefined && x.rec.rate < 0.7))
          .map((x) => `${name(x.id)}: ${x.rec.attended}/${x.rec.attended + x.rec.missed} practices${x.rec.missedLast3 ? ', missed the last 3' : ''}`),
      }
    }),
    statusLabels: STATUS_LABEL,
  }
}

/** Registered sailors (in water programs) without a passed swim check. */
export function swimChecksInfo(ctx: Ctx, q: { program?: string; term?: string; week?: string | number }) {
  const { s } = ctx
  const sessionIds = new Set((q.program || q.term || q.week ? findSessions(ctx, q) : s.sessions).map((x) => x.id))
  const ids = new Set(s.registrations.filter((r) => ACTIVE_STATUSES.has(r.status) && sessionIds.has(r.sessionId)).map((r) => r.sailorId))
  const rows = [...ids]
    .map((id) => s.sailors.find((k) => k.id === id)!)
    .map((k) => ({ k, sc: latestSwimCheck(s.swimChecks, k.id) }))
    .filter((x) => x.sc?.result !== 'passed')
    .map(({ k, sc }) => ({ sailor: `${k.firstName} ${k.lastName}`, familyHref: familyHref(k.familyId), status: sc ? `did not pass ${d(sc.date)}` : 'not done' }))
  return { sailorsChecked: ids.size, needSwimCheck: rows.length, rows: rows.slice(0, 50) }
}

/** Forms the director pushed to families and how many have signed. */
export function formRequestsInfo(ctx: Ctx) {
  const { s } = ctx
  const templates = [...FORM_TEMPLATES, ...s.customTemplates]
  return s.formRequests.map((r) => {
    const t = templates.find((x) => x.id === r.templateId)!
    const p = requestProgress(r, t, s.submissions, s.settings.season)
    const unsigned = r.sailorIds
      .filter((sid) => !s.submissions.some((x) => x.templateId === t.id && x.sailorId === sid))
      .map((sid) => {
        const k = s.sailors.find((x) => x.id === sid)!
        return `${k.firstName} ${k.lastName}`
      })
    return { form: t.name, sentTo: r.audienceLabel, sent: format(new Date(r.sentAt), 'MMM d'), due: r.dueDate ? d(r.dueDate) : undefined, signed: p.done, of: p.total, notSignedYet: unsigned.slice(0, 40), formsPage: '/admin/forms' }
  })
}

const findStaff = (ctx: Ctx, text?: string) => {
  if (!text) return undefined
  const t = text.toLowerCase()
  return ctx.s.coaches.find((c) => t.includes(c.name.toLowerCase())) ?? ctx.s.coaches.find((c) => new RegExp(`\\b${c.name.split(' ')[0].toLowerCase()}('s)?\\b`).test(t))
}
export { findStaff }

/** Staff directory: contacts, emergency contact, rosters, notes. */
export function staffDirectoryInfo(ctx: Ctx, q: { name?: string; role?: string }) {
  const { s } = ctx
  const person = findStaff(ctx, q.name)
  return {
    directoryPage: '/admin/directory',
    rows: s.coaches
      .filter((c) => !q.name || c === person || c.name.toLowerCase().includes(q.name.toLowerCase()))
      .filter((c) => !q.role || c.role.includes(q.role.toLowerCase().replace(/\s+/g, '-')))
      .map((c) => ({
        name: c.name,
        role: c.role,
        phone: c.phone,
        email: c.email,
        emergencyContact: c.emergencyContact ? `${c.emergencyContact.name} (${c.emergencyContact.relationship}) ${c.emergencyContact.phone}` : undefined,
        onStaffSince: c.startedSeason,
        notes: c.notes,
        groups: s.groups.filter((g) => g.coachIds.includes(c.id)).map((g) => g.name),
      })),
    formerStaff: s.formerCoaches.map((c) => c.name),
  }
}

/** Certification files and club documents. */
export function documentsInfo(ctx: Ctx, q: { person?: string; cert?: string; missingOnly?: boolean }) {
  const { s, now } = ctx
  const certId = matchCert(q.cert)
  const person = findStaff(ctx, q.person)
  const rows = s.coaches
    .filter((c) => !q.person || c === person)
    .flatMap((c) =>
      coachCertRows(c, CERT_TYPES, now, s.settings.certWarningDays)
        .filter((r) => !certId || r.certType.id === certId)
        .map((r) => {
          const doc = s.documents.find((d) => d.coachId === c.id && d.certTypeId === r.certType.id)
          return {
            staff: c.name,
            cert: r.certType.name,
            status: r.status,
            expires: r.expires ? d(r.expires) + `, ${r.expires.slice(0, 4)}` : undefined,
            file: doc ? `${doc.fileName} (uploaded ${format(new Date(doc.uploadedAt), 'MMM d, yyyy')})` : null,
            href: `/admin/documents?person=${c.id}${certId ? `&cert=${certId}` : ''}`,
          }
        })
    )
    .filter((r) => !q.missingOnly || !r.file)
  return {
    rows: rows.slice(0, 60),
    missingFiles: rows.filter((r) => !r.file).length,
    clubDocuments: s.documents.filter((x) => x.kind === 'club').map((x) => x.title),
    documentsPage: '/admin/documents',
  }
}

/** Club calendar: regattas, deadlines, meetings, socials, trainings. */
export function calendarInfo(ctx: Ctx, q: { days?: number; kind?: string; search?: string }) {
  const today = format(ctx.now, 'yyyy-MM-dd')
  const until = format(new Date(ctx.now.getTime() + (q.days ?? 60) * 86400000), 'yyyy-MM-dd')
  return {
    events: ctx.s.calendar
      .filter((e) => (e.endDate ?? e.date) >= today && (q.search ? true : e.date <= until))
      .filter((e) => !q.kind || e.kind === q.kind)
      .filter((e) => !q.search || `${e.title} ${e.location ?? ''}`.toLowerCase().includes(q.search.toLowerCase()))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) => ({
        title: e.title,
        kind: e.kind,
        date: `${format(new Date(`${e.date}T12:00:00`), 'EEE MMM d')}${e.endDate ? `–${d(e.endDate)}` : ''}`,
        time: e.time,
        location: e.location,
        programs: e.programIds?.map((p) => programById.get(p)?.name),
        notes: e.notes,
      })),
    calendarPage: '/admin/calendar',
  }
}

export function equipmentInfo(ctx: Ctx, q: { status?: string; kind?: string }) {
  const boats = ctx.s.boats
    .filter((b) => !q.kind || b.kind.toLowerCase().includes(q.kind.toLowerCase()))
    .filter((b) => (q.status === 'all' ? true : q.status ? b.status === q.status : b.status !== 'ready'))
  return {
    totals: { all: ctx.s.boats.length, ready: ctx.s.boats.filter((b) => b.status === 'ready').length, needsRepair: ctx.s.boats.filter((b) => b.status === 'needs-repair').length, outOfService: ctx.s.boats.filter((b) => b.status === 'out-of-service').length },
    boats: boats.map((b) => ({ name: b.name, kind: b.kind, status: b.status, issue: b.issue, usedBy: b.assignedTo, lastChecked: b.lastInspected })),
    equipmentPage: '/admin/equipment',
  }
}

export function incidentsInfo(ctx: Ctx, q: { status?: string }) {
  const { s } = ctx
  return {
    incidents: s.incidents
      .filter((i) => !q.status || q.status === 'all' || i.status === q.status)
      .map((i) => ({
        when: format(new Date(i.at), 'EEE MMM d, h:mm a'),
        type: i.type,
        severity: i.severity,
        status: i.status,
        session: i.sessionId ? sessionLabel(s.sessions.find((x) => x.id === i.sessionId)!) : undefined,
        sailors: i.sailorIds.map((id) => {
          const k = s.sailors.find((x) => x.id === id)
          return k ? `${k.firstName} ${k.lastName}` : ''
        }),
        description: i.description,
        actionTaken: i.actionTaken,
        parentsNotified: i.parentsNotified ? (i.notifiedHow ?? 'yes') : 'no',
        reportedBy: i.reportedBy,
      })),
    incidentsPage: '/admin/incidents',
  }
}

/** Regattas with who's going, interested, not answered, and chaperones. */
export function regattasInfo(ctx: Ctx, q: { search?: string }) {
  const { s } = ctx
  const today = format(ctx.now, 'yyyy-MM-dd')
  const name = (id: string) => {
    const k = s.sailors.find((x) => x.id === id)
    return k ? `${k.firstName} ${k.lastName}` : ''
  }
  const list = s.regattas
    .map((r) => ({ r, e: s.calendar.find((e) => e.id === r.eventId)! }))
    .filter((x) => x.e && (x.e.endDate ?? x.e.date) >= today)
    .filter((x) => !q.search || x.e.title.toLowerCase().includes(q.search.toLowerCase()) || q.search.toLowerCase().split(/\s+/).some((w) => w.length > 3 && x.e.title.toLowerCase().includes(w)))
    .sort((a, b) => a.e.date.localeCompare(b.e.date))
  return {
    regattas: list.map(({ r, e }) => {
      const term = termForDate(TERMS, e.date)
      const eligible = eligibleSailors(r, s.sailors, s.registrations, s.sessions, term.id)
      const sum = regattaSummary(e.id, eligible, s.regattaResponses)
      return {
        id: e.id,
        title: e.title,
        date: `${format(new Date(`${e.date}T12:00:00`), 'EEE MMM d')}${e.endDate ? `–${d(e.endDate)}` : ''}`,
        location: e.location,
        fleets: r.levels.map((l) => LEVELS[l].label),
        entryDeadline: r.entryDeadline ? d(r.entryDeadline) : undefined,
        going: sum.going.map((x) => name(x.sailorId)),
        interested: sum.interested.map((x) => name(x.sailorId)),
        notGoing: sum.notGoing.map((x) => name(x.sailorId)),
        noAnswer: sum.noAnswer.map((k) => `${k.firstName} ${k.lastName}`),
        chaperones: `${sum.chaperones.length} of ${r.chaperonesNeeded} (${sum.chaperones.map((c) => c.by).join(', ') || 'none yet'})`,
        coaches: r.coachIds.map((id) => s.coaches.find((c) => c.id === id)?.name).filter(Boolean),
        page: `/admin/regattas?regatta=${e.id}`,
      }
    }),
  }
}

/** Today's practice calls (on / delayed / cancelled) for every team that meets today. */
export function practiceTodayInfo(ctx: Ctx) {
  const { s } = ctx
  const today = format(ctx.now, 'yyyy-MM-dd')
  const meeting = s.sessions.filter((x) => meetsOn(x, ctx.now))
  return {
    date: format(ctx.now, 'EEEE, MMMM d'),
    teams: meeting.map((x) => {
      const call = s.practiceCalls.find((c) => c.sessionId === x.id && c.date === today)
      const plan = s.lessonPlans.find((p) => p.sessionId === x.id && p.date === today)
      return {
        team: programById.get(x.programId)?.name,
        time: x.time.split('·')[0].replace('Weekdays ', '').trim(),
        call: call ? call.status : 'no call yet',
        note: call?.note,
        calledBy: call?.by,
        lessonPlan: plan ? `${plan.title} (${plan.by})` : 'none yet',
      }
    }),
    homePage: '/admin',
  }
}

/** Skill progress and evaluations by team: who's ready to move up, who has no evaluation. */
export function progressInfo(ctx: Ctx, q: { program?: string; sailor?: string }) {
  const { s } = ctx
  const programs = matchPrograms(q.program)
  const today = format(ctx.now, 'yyyy-MM-dd')
  const sessions = s.sessions.filter((x) => x.startDate <= today && x.endDate >= today && (!programs.length || programs.includes(x.programId)))
  const rows = sessions.flatMap((se) =>
    s.registrations
      .filter((r) => r.sessionId === se.id && r.status === 'confirmed')
      .map((r) => s.sailors.find((k) => k.id === r.sailorId)!)
      .filter((k) => k && (!q.sailor || `${k.firstName} ${k.lastName}`.toLowerCase().includes(q.sailor.toLowerCase())))
      .map((k) => {
        const track = trackFor(k.level)
        const list = SKILLS.filter((x) => x.track === track)
        const mine = s.skillMarks.filter((m) => m.sailorId === k.id)
        const got = list.filter((x) => mine.some((m) => m.skillId === x.id && m.status === 'got-it'))
        const working = list.filter((x) => mine.some((m) => m.skillId === x.id && m.status === 'working'))
        const ev = s.evaluations.filter((e) => e.sailorId === k.id && e.sessionId === se.id).sort((a, b) => b.date.localeCompare(a.date))[0]
        return {
          sailor: `${k.firstName} ${k.lastName}`,
          team: programById.get(se.programId)?.name,
          track: TRACKS[track].name,
          skills: `${got.length} of ${list.length}`,
          readyToMoveUp: got.length === list.length,
          workingOn: working.map((x) => x.name),
          evaluation: ev ? (ev.status === 'shared' ? `shared ${d(ev.date)}` : ev.status === 'pending' ? 'waiting for director approval' : 'draft') : 'not written',
          evaluationText: q.sailor && ev ? { strengths: ev.strengths, workOn: ev.workOn, nextStep: ev.nextStep } : undefined,
        }
      })
  )
  const pending = s.evaluations
    .filter((e) => e.status === 'pending')
    .map((e) => {
      const k = s.sailors.find((x) => x.id === e.sailorId)
      return { sailor: k ? `${k.firstName} ${k.lastName}` : '', coach: s.coaches.find((c) => c.id === e.coachId)?.name, written: d(e.date) }
    })
  return { rows, waitingForApproval: pending, progressPage: '/admin/progress' }
}

/** Conversations: what's waiting on the director, and recent threads (optionally matching a search). */
export function inboxInfo(ctx: Ctx, q: { search?: string }) {
  const { s } = ctx
  const name = (p: string) => {
    if (p === 'director') return 'Jordan Hale (director)'
    const [kind, id] = p.split(':')
    if (kind === 'coach') return s.coaches.find((c) => c.id === id)?.name ?? 'coach'
    if (kind === 'family') return `${s.families.find((f) => f.id === id)?.name} family`
    if (kind === 'sailor') {
      const k = s.sailors.find((x) => x.id === id)
      return k ? `${k.firstName} ${k.lastName} (sailor)` : 'sailor'
    }
    return p
  }
  const needle = q.search?.toLowerCase()
  const rows = s.threads
    .filter((t) => !needle || `${t.subject} ${t.messages.map((m) => `${m.name} ${m.text}`).join(' ')}`.toLowerCase().includes(needle))
    .map((t) => {
      const last = t.messages[t.messages.length - 1]
      const unread = t.participants.includes('director') && last.from !== 'director' && (!t.reads.director || t.reads.director < last.at)
      return { subject: t.subject, with: t.participants.map(name), lastFrom: last.name, lastMessage: last.text, at: last.at.slice(0, 16).replace('T', ' '), waitingForDirector: unread, directorIsIn: t.participants.includes('director') }
    })
    .sort((a, b) => b.at.localeCompare(a.at))
  return { waitingForYou: rows.filter((r) => r.waitingForDirector).length, rows: rows.slice(0, 20), inboxPage: '/admin/inbox' }
}

/** What parents told the coaches about a day: out, late, leaving early, someone else picking up. */
export function parentNotesInfo(ctx: Ctx, q: { date?: string }) {
  const { s } = ctx
  const today = format(ctx.now, 'yyyy-MM-dd')
  const date = q.date && /^\d{4}-\d{2}-\d{2}$/.test(q.date) ? q.date : today
  const rows = s.dayNotes
    .filter((n) => (q.date === 'upcoming' ? n.date >= today : n.date === date))
    .map((n) => {
      const k = s.sailors.find((x) => x.id === n.sailorId)
      const group = s.groups.find((g) => g.sailorIds.includes(n.sailorId) && s.sessions.some((x) => x.id === g.sessionId && x.startDate <= n.date && x.endDate >= n.date))
      return {
        date: d(n.date),
        sailor: k ? `${k.firstName} ${k.lastName}` : '',
        what: n.kind === 'absent' ? 'out' : n.kind === 'late' ? `late${n.detail ? `, about ${n.detail}` : ''}` : n.kind === 'early' ? `leaving at ${n.detail}` : `picked up by ${n.detail}`,
        note: n.note,
        toldBy: n.by,
        coach: group?.coachIds.map((c) => s.coaches.find((x) => x.id === c)?.name).join(', '),
      }
    })
  return { date: q.date === 'upcoming' ? 'today and later' : d(date), rows, attendancePage: '/admin/attendance' }
}

/** Live "needs attention" list — the same items the Today page shows. */
export function briefing(ctx: Ctx) {
  const certs = staffCertifications(ctx, { status: 'needs-action' }).rows.map(
    (r) => `${r.staff}: ${r.cert} ${r.status === 'expiring' ? `expires in ${r.daysLeft} days` : r.status}`
  )
  const roster = rostersInfo(ctx, { problemsOnly: true }).groups.map((g) => `${g.group} (${g.session}): ${g.problem}`)
  const forms = formsInfo(ctx, {})
  const inbox = inboxInfo(ctx, {})
  const notes = parentNotesInfo(ctx, {})
  const pending = ctx.s.evaluations.filter((e) => e.status === 'pending').length
  const today = format(ctx.now, 'yyyy-MM-dd')
  const term = TERMS.find((t) => t.startDate <= today && t.endDate >= today)
  return [
    `Today is ${format(ctx.now, 'EEEE, MMMM d, yyyy, h:mm a')}.${term ? ` ${term.name} is running; summer camps have morning (AM) and afternoon (PM) groups.` : ''} Registration and payments happen in the club's own registration system; Burgee imports the rosters.`,
    `Staff certification issues: ${certs.join('; ') || 'none'}.`,
    `Roster problems: ${roster.join('; ') || 'none'}.`,
    `Messages waiting for the director: ${inbox.waitingForYou}.`,
    `Parent notes for today: ${notes.rows.map((n) => `${n.sailor} ${n.what}`).join('; ') || 'none'}.`,
    `Evaluations waiting for approval: ${pending}.`,
    `Forms: ${forms.sailorsMissing} of ${forms.activeSailors} registered sailors are missing at least one ${forms.season} form.`,
  ].join('\n')
}

/* ───────────────────────── Drafting ───────────────────────── */

export function resolveAudience(ctx: Ctx, text: string): Audience {
  const t = text.toLowerCase()
  if (/staff|coach|instructor/.test(t)) return { kind: 'staff' }
  if (/form|waiver|missing/.test(t)) return { kind: 'outstanding-forms' }
  if (/waitlist|wait list/.test(t)) return { kind: 'waitlisted' }
  const sessions = findSessions(ctx, { program: t, term: t, week: t })
  const programs = matchPrograms(t)
  if (matchWeek(t) && sessions.length === 1) return { kind: 'session', sessionId: sessions[0].id }
  if (programs.length === 1) return { kind: 'program', programId: programs[0] }
  return { kind: 'everyone' }
}

export function audienceText(a: Audience, ctx: Ctx): string {
  switch (a.kind) {
    case 'everyone':
      return 'all families'
    case 'staff':
      return 'coaches & staff'
    case 'outstanding-forms':
      return 'families with forms due'
    case 'waitlisted':
      return 'families on a waitlist'
    case 'program':
      return `${programById.get(a.programId)?.name} families`
    case 'session': {
      const se = ctx.s.sessions.find((x) => x.id === a.sessionId)
      return se ? `${sessionLabel(se)} families` : 'one session'
    }
    case 'group':
      return 'one group'
    case 'families':
      return a.label
  }
}
