import { addMonths, format } from 'date-fns'
import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { ACTIVE_STATUSES, quoteCart, type CartItem } from '@/domain/pricing'
import { autoGroups } from '@/domain/rules'
import { attendanceKey, meetsOn } from '@/domain/attendance'
import type {
  DayNote,
  Participant,
  Thread,
  ActivityEvent,
  Announcement,
  AttendanceStatus,
  Audience,
  ClubSettings,
  FormSubmission,
  Group,
  Registration,
  Sailor,
  Session,
  FormRequest,
  FormTemplate,
  SwimCheck,
  Boat,
  ClubDocument,
  ClubEvent,
  Coach,
  Evaluation,
  Incident,
  LessonPlan,
  PracticeCall,
  RegattaDetails,
  RegattaResponse,
  SkillMark,
} from '@/domain/types'
import { expiredOffers, offersToIssue, seatsLeft } from '@/domain/waitlist'
import { CERT_TYPES, DEFAULT_SETTINGS, FORM_TEMPLATES, PROGRAMS, TERMS } from './catalog'
import { createSeed, type DemoState } from './seed'
import { now as clockNow, setDemoTime as setClock, type DemoTime } from '@/lib/clock'

/**
 * Demo data store.
 *
 * Every mutation the UI performs goes through an action here. When the app
 * moves to Supabase, each action becomes an RPC / insert against the tables
 * in /supabase/migrations and the selectors become queries — the components
 * do not need to change shape.
 */

export type Role = 'director' | 'coach' | 'family' | 'sailor' | 'committee'

/** One line of an imported roster, already matched to a session. */
export type ImportRow = {
  firstName: string
  lastName: string
  dob?: string
  level: Sailor['level']
  guardianName: string
  email: string
  phone: string
  sessionId: string
  status: 'confirmed' | 'waitlisted'
}

type State = DemoState & {
  settings: ClubSettings
  cart: CartItem[]
  role: Role
}

type Actions = {
  setRole: (role: Role) => void
  resetDemo: () => void
  /** Jump the demo to the morning or afternoon of the camp day (rebuilds the demo data for that moment). */
  setDemoTime: (time: DemoTime) => void

  // Conversations
  startThread: (t: { subject: string; participants: Participant[]; familyId?: string; sailorId?: string; announcementId?: string; from: Participant; name: string; text: string }) => string
  sendMessage: (threadId: string, from: Participant, name: string, text: string) => void
  markThreadRead: (threadId: string, who: Participant) => void

  // Parents tell coaches about a day
  addDayNote: (n: Omit<DayNote, 'id' | 'at'>) => void
  removeDayNote: (id: string) => void

  // Evaluations go to the director before families see them
  approveEvaluations: (ids: string[], by: string) => void

  // Bring a roster in from a spreadsheet or a Clubspot export
  importRoster: (rows: ImportRow[]) => { families: number; sailors: number; registrations: number }

  // Waitlist engine
  processWaitlists: () => void

  // Family-side
  addToCart: (item: CartItem) => void
  removeFromCart: (item: CartItem) => void
  clearCart: () => void
  checkout: (familyId: string) => { confirmed: number; waitlisted: number; charged: number }
  acceptOffer: (registrationId: string) => void
  declineOffer: (registrationId: string) => void
  payBalance: (registrationIds: string[]) => void
  submitForm: (s: Omit<FormSubmission, 'id' | 'signedAt'>) => void
  updateSailor: (id: string, patch: Partial<Sailor>) => void

  // Director-side
  confirmRegistration: (id: string) => void
  cancelRegistration: (id: string) => void
  offerSpot: (id: string) => void
  updateSettings: (patch: Partial<ClubSettings>) => void
  updatePricing: (patch: Partial<ClubSettings['pricing']>) => void
  updateTier: (tierId: string, patch: { member?: number; nonMember?: number }) => void
  updateSession: (id: string, patch: Partial<Session>) => void
  autoGroupSession: (sessionId: string) => void
  moveSailor: (sailorId: string, toGroupId: string) => void
  setGroupCoaches: (groupId: string, coachIds: string[]) => void
  addGroup: (sessionId: string) => void
  sendAnnouncement: (a: Omit<Announcement, 'id' | 'sentAt' | 'opened' | 'recipients'>) => number
  sendFormReminders: (familyIds: string[]) => void

  sendFormRequest: (r: Omit<FormRequest, 'id' | 'sentAt'>) => void
  createTemplate: (t: Omit<FormTemplate, 'id'>) => FormTemplate

  // Staff directory
  addCoach: (c: Omit<Coach, 'id' | 'certs' | 'avatarHue'>) => Coach
  updateCoach: (id: string, patch: Partial<Coach>) => void
  removeCoach: (id: string) => { groups: string[] }
  restoreCoach: (id: string) => void

  // Documents
  addDocument: (d: Omit<ClubDocument, 'id' | 'uploadedAt'>) => void
  removeDocument: (id: string) => void

  // Calendar, safety, equipment, money
  addCalendarEvent: (e: Omit<ClubEvent, 'id'>) => void
  removeCalendarEvent: (id: string) => void
  logIncident: (i: Omit<Incident, 'id'>) => void
  updateIncident: (id: string, patch: Partial<Incident>) => void
  addBoat: (b: Omit<Boat, 'id'>) => void
  updateBoat: (id: string, patch: Partial<Boat>) => void
  removeBoat: (id: string) => void
  recordPayment: (p: { familyId: string; registrationIds: string[]; method: 'check' | 'cash'; memo: string }) => void

  // Coach-side
  renewCert: (
    coachId: string,
    certTypeId: string,
    issued: string,
    file?: { fileName: string; mime: string; sizeBytes: number; dataUrl?: string; uploadedBy: string }
  ) => void
  markAttendance: (
    date: string,
    sessionId: string,
    sailorIds: string[],
    status: AttendanceStatus,
    extra?: { by: string; pickedUpBy?: string }
  ) => void
  clearAttendance: (date: string, sessionId: string, sailorId: string) => void
  recordSwimCheck: (c: SwimCheck) => void

  // Practice day
  callPractice: (sessionIds: string[], date: string, status: PracticeCall['status'], note: string, by: string) => number
  saveLessonPlan: (p: Omit<LessonPlan, 'id' | 'updatedAt'> & { id?: string }) => void
  assignBoat: (sessionId: string, who: 'sailor' | 'coach', personId: string, boatId: string | 'own' | null) => void

  // Progress
  markSkill: (sailorId: string, skillId: string, status: SkillMark['status'] | null, by: string) => void
  saveEvaluation: (e: Omit<Evaluation, 'id'> & { id?: string }) => void

  // Regattas
  addRegatta: (e: Omit<ClubEvent, 'id' | 'kind'>, d: Omit<RegattaDetails, 'eventId'>) => void
  updateRegatta: (eventId: string, patch: Partial<RegattaDetails>) => void
  respondToRegatta: (r: Omit<RegattaResponse, 'updatedAt'>) => void
}

const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`

const memory = new Map<string, string>()
const safeStorage: StateStorage = {
  getItem: (k) => {
    try {
      return window.localStorage.getItem(k)
    } catch {
      return memory.get(k) ?? null
    }
  },
  setItem: (k, v) => {
    try {
      window.localStorage.setItem(k, v)
    } catch {
      memory.set(k, v)
    }
  },
  removeItem: (k) => {
    try {
      window.localStorage.removeItem(k)
    } catch {
      memory.delete(k)
    }
  },
}

const fresh = (): State => ({
  ...createSeed(clockNow()),
  settings: structuredClone(DEFAULT_SETTINGS),
  cart: [],
  role: 'director',
})

function event(kind: ActivityEvent['kind'], text: string): ActivityEvent {
  return { id: uid('e'), at: clockNow().toISOString(), kind, text }
}

/** Expire stale offers and fill open seats from the waitlist. */
function runWaitlist(state: State, sessionIds?: string[]): Partial<State> {
  const now = clockNow()
  let registrations = state.registrations
  const events: ActivityEvent[] = []

  const expired = expiredOffers(registrations, now)
  if (expired.length) {
    const ids = new Set(expired.map((r) => r.id))
    registrations = registrations.map((r) =>
      ids.has(r.id) ? { ...r, status: 'cancelled', offerExpiresAt: undefined } : r
    )
  }

  const targets = sessionIds
    ? state.sessions.filter((s) => sessionIds.includes(s.id))
    : state.sessions
  for (const session of [...targets, ...state.sessions.filter((s) => expired.some((e) => e.sessionId === s.id))]) {
    const offers = offersToIssue(
      session,
      registrations,
      state.sailors,
      state.families,
      state.settings.waitlist,
      now
    )
    if (!offers.length) continue
    const byId = new Map(offers.map((o) => [o.registrationId, o]))
    registrations = registrations.map((r) => {
      const o = byId.get(r.id)
      if (!o) return r
      const s = state.sailors.find((x) => x.id === r.sailorId)
      const p = PROGRAMS.find((x) => x.id === session.programId)
      events.push(
        event('offered', `Spot offered to ${s?.firstName} ${s?.lastName} for ${p?.name} · ${session.name} (held ${state.settings.waitlist.holdHours}h)`)
      )
      return { ...r, status: 'offered', offerExpiresAt: o.offerExpiresAt }
    })
  }
  if (registrations === state.registrations && !events.length) return {}
  return { registrations, events: [...events, ...state.events] }
}

export function audienceFamilyIds(audience: Audience, s: DemoState, season: string): string[] {
  const sessionById = new Map(s.sessions.map((x) => [x.id, x]))
  const sailorById = new Map(s.sailors.map((x) => [x.id, x]))
  const active = s.registrations.filter((r) => ACTIVE_STATUSES.has(r.status))
  const famOf = (sailorId: string) => sailorById.get(sailorId)?.familyId
  const uniq = (ids: (string | undefined)[]) => [...new Set(ids.filter(Boolean) as string[])]
  switch (audience.kind) {
    case 'everyone':
      return uniq(s.registrations.filter((r) => r.status !== 'cancelled').map((r) => famOf(r.sailorId)))
    case 'program':
      return uniq(active.filter((r) => sessionById.get(r.sessionId)?.programId === audience.programId).map((r) => famOf(r.sailorId)))
    case 'session':
      return uniq(active.filter((r) => r.sessionId === audience.sessionId).map((r) => famOf(r.sailorId)))
    case 'group': {
      const g = s.groups.find((x) => x.id === audience.groupId)
      return uniq((g?.sailorIds ?? []).map(famOf))
    }
    case 'waitlisted':
      return uniq(s.registrations.filter((r) => r.status === 'waitlisted').map((r) => famOf(r.sailorId)))
    case 'outstanding-forms': {
      const activeSailors = new Set(active.map((r) => r.sailorId))
      return uniq(
        [...activeSailors]
          .filter((sid) => {
            const sailor = sailorById.get(sid)!
            const signed = s.submissions.filter(
              (x) => x.season === season && (x.sailorId === sid || (!x.sailorId && x.familyId === sailor.familyId))
            )
            return signed.length < 4
          })
          .map(famOf)
      )
    }
    case 'families':
      return audience.familyIds
    case 'staff':
      return []
  }
}

export const useStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      ...fresh(),

      setRole: (role) => set({ role }),
      resetDemo: () => set({ ...fresh(), role: get().role }),
      setDemoTime: (time) => {
        setClock(time)
        set({ ...fresh(), role: get().role })
      },

      startThread: (t) => {
        const id = uid('th')
        const when = clockNow().toISOString()
        const thread: Thread = {
          id,
          subject: t.subject,
          participants: [...new Set(t.participants)],
          familyId: t.familyId,
          sailorId: t.sailorId,
          announcementId: t.announcementId,
          messages: [{ id: uid('m'), from: t.from, name: t.name, text: t.text, at: when }],
          reads: { [t.from]: when },
        }
        set((s) => ({ threads: [thread, ...s.threads] }))
        return id
      },
      sendMessage: (threadId, from, name, text) =>
        set((s) => {
          const when = clockNow().toISOString()
          return {
            threads: s.threads.map((t) =>
              t.id === threadId ? { ...t, messages: [...t.messages, { id: uid('m'), from, name, text, at: when }], reads: { ...t.reads, [from]: when } } : t
            ),
          }
        }),
      markThreadRead: (threadId, who) =>
        set((s) => ({
          threads: s.threads.map((t) => (t.id === threadId ? { ...t, reads: { ...t.reads, [who]: clockNow().toISOString() } } : t)),
        })),

      addDayNote: (n) =>
        set((s) => {
          const note: DayNote = { ...n, id: uid('dn'), at: clockNow().toISOString() }
          const kid = s.sailors.find((x) => x.id === n.sailorId)
          const attendance = { ...s.attendance }
          // An absence the parent reports marks the sailor absent on every roster that day.
          if (n.kind === 'absent') {
            const day = new Date(`${n.date}T12:00:00`)
            const sessionIds = s.registrations
              .filter((r) => r.sailorId === n.sailorId && r.status === 'confirmed')
              .map((r) => s.sessions.find((x) => x.id === r.sessionId)!)
              .filter((se) => se && meetsOn(se, day))
              .map((se) => se.id)
            for (const sid of sessionIds) {
              const key = attendanceKey(n.date, sid, n.sailorId)
              if (!attendance[key]) attendance[key] = { sailorId: n.sailorId, sessionId: sid, date: n.date, status: 'absent', updatedAt: note.at, by: `${n.by} (parent)` }
            }
          }
          const what = n.kind === 'absent' ? 'will be out' : n.kind === 'late' ? 'will be late' : n.kind === 'early' ? `leaves early (${n.detail})` : `is being picked up by ${n.detail}`
          return {
            dayNotes: [...s.dayNotes.filter((d) => !(d.sailorId === n.sailorId && d.date === n.date && d.kind === n.kind)), note],
            attendance,
            events: [event('announcement', `${n.by}: ${kid?.firstName} ${what} on ${format(new Date(`${n.date}T12:00:00`), 'EEE, MMM d')}`), ...s.events],
          }
        }),
      removeDayNote: (id) =>
        set((s) => {
          const note = s.dayNotes.find((d) => d.id === id)
          if (!note) return {}
          const attendance = { ...s.attendance }
          if (note.kind === 'absent')
            for (const [k, v] of Object.entries(attendance)) if (v.sailorId === note.sailorId && v.date === note.date && v.status === 'absent' && v.by.endsWith('(parent)')) delete attendance[k]
          return { dayNotes: s.dayNotes.filter((d) => d.id !== id), attendance }
        }),

      approveEvaluations: (ids, by) =>
        set((s) => {
          const when = clockNow().toISOString()
          return {
            evaluations: s.evaluations.map((e) => (ids.includes(e.id) ? { ...e, status: 'shared', approvedBy: by, approvedAt: when } : e)),
            events: [event('announcement', `${ids.length} evaluation${ids.length > 1 ? 's' : ''} approved and shared with families`), ...s.events],
          }
        }),

      importRoster: (rows) => {
        const s = get()
        const families = [...s.families]
        const sailors = [...s.sailors]
        const registrations = [...s.registrations]
        const when = clockNow().toISOString()
        const counts = { families: 0, sailors: 0, registrations: 0 }
        for (const r of rows) {
          const email = r.email.trim().toLowerCase()
          let fam = families.find((f) => f.guardians.some((g) => g.email.toLowerCase() === email))
          if (!fam) {
            fam = {
              id: uid('f'),
              name: r.guardianName.split(' ').slice(-1)[0] || r.lastName,
              membership: 'member',
              guardians: [{ name: r.guardianName, email: r.email.trim(), phone: r.phone, relationship: 'Parent', smsOptIn: true }],
              address: '',
              createdAt: when,
            }
            families.push(fam)
            counts.families++
          }
          let kid = sailors.find((k) => k.familyId === fam!.id && k.firstName.toLowerCase() === r.firstName.toLowerCase())
          if (!kid) {
            kid = { id: uid('s'), familyId: fam.id, firstName: r.firstName, lastName: r.lastName, dob: r.dob ?? '2016-01-01', level: r.level, shirtSize: 'YM', medicalAlerts: [] }
            sailors.push(kid)
            counts.sailors++
          }
          if (!registrations.some((x) => x.sailorId === kid!.id && x.sessionId === r.sessionId && x.status !== 'cancelled')) {
            registrations.push({ id: uid('r'), sailorId: kid.id, sessionId: r.sessionId, status: r.status, createdAt: when, price: 0, priceLines: [], paid: 0 })
            counts.registrations++
          }
        }
        set({
          families,
          sailors,
          registrations,
          events: [event('registered', `Imported ${counts.registrations} registrations (${counts.sailors} new sailors, ${counts.families} new families)`), ...s.events],
        })
        return counts
      },

      processWaitlists: () => set((s) => runWaitlist(s)),

      addToCart: (item) =>
        set((s) =>
          s.cart.some((c) => c.sailorId === item.sailorId && c.sessionId === item.sessionId)
            ? {}
            : { cart: [...s.cart, item] }
        ),
      removeFromCart: (item) =>
        set((s) => ({
          cart: s.cart.filter((c) => !(c.sailorId === item.sailorId && c.sessionId === item.sessionId)),
        })),
      clearCart: () => set({ cart: [] }),

      checkout: (familyId) => {
        const s = get()
        const family = s.families.find((f) => f.id === familyId)!
        const famSailorIds = new Set(s.sailors.filter((x) => x.familyId === familyId).map((x) => x.id))
        const quote = quoteCart(s.cart, {
          pricing: s.settings.pricing,
          family,
          sailors: s.sailors,
          sessions: s.sessions,
          programs: PROGRAMS,
          terms: TERMS,
          existing: s.registrations.filter((r) => famSailorIds.has(r.sailorId)),
          now: clockNow(),
        })
        let registrations = [...s.registrations]
        const events: ActivityEvent[] = []
        let confirmed = 0
        let waitlisted = 0
        let charged = 0
        for (const item of quote.items) {
          const session = s.sessions.find((x) => x.id === item.sessionId)!
          const program = PROGRAMS.find((p) => p.id === session.programId)!
          const sailor = s.sailors.find((x) => x.id === item.sailorId)!
          const hasSeat = seatsLeft(session, registrations) > 0
          const status: Registration['status'] = hasSeat ? 'confirmed' : 'waitlisted'
          if (hasSeat) {
            confirmed++
            charged += item.total
          } else waitlisted++
          registrations.push({
            id: uid('r'),
            sailorId: item.sailorId,
            sessionId: item.sessionId,
            status,
            createdAt: clockNow().toISOString(),
            price: item.total,
            priceLines: item.lines,
            paid: hasSeat ? item.total : 0,
          })
          events.push(
            event(
              hasSeat ? 'registered' : 'waitlisted',
              `${sailor.firstName} ${sailor.lastName} ${hasSeat ? 'registered for' : 'joined the waitlist for'} ${program.name} · ${session.name}`
            )
          )
        }
        if (charged > 0) {
          const fee = Math.round(charged * s.settings.pricing.processingFeePct) / 100
          charged = Math.round((charged + fee) * 100) / 100
          events.push(event('payment', `Payment received from the ${family.name} family · $${charged.toLocaleString()}`))
        }
        registrations = registrations.slice()
        set({ registrations, cart: [], events: [...events.reverse(), ...s.events] })
        return { confirmed, waitlisted, charged }
      },

      acceptOffer: (id) =>
        set((s) => {
          const r = s.registrations.find((x) => x.id === id)
          if (!r) return {}
          const sailor = s.sailors.find((x) => x.id === r.sailorId)!
          const session = s.sessions.find((x) => x.id === r.sessionId)!
          const program = PROGRAMS.find((p) => p.id === session.programId)!
          return {
            registrations: s.registrations.map((x) =>
              x.id === id ? { ...x, status: 'confirmed', paid: x.price, offerExpiresAt: undefined } : x
            ),
            events: [
              event('accepted', `${sailor.firstName} ${sailor.lastName} accepted a spot in ${program.name} · ${session.name}`),
              ...s.events,
            ],
          }
        }),

      declineOffer: (id) => {
        const r = get().registrations.find((x) => x.id === id)
        if (!r) return
        set((s) => ({
          registrations: s.registrations.map((x) =>
            x.id === id ? { ...x, status: 'cancelled', offerExpiresAt: undefined } : x
          ),
        }))
        set((s) => runWaitlist(s, [r.sessionId]))
      },

      payBalance: (ids) =>
        set((s) => ({
          registrations: s.registrations.map((r) =>
            ids.includes(r.id) ? { ...r, status: r.status === 'pending-payment' ? 'confirmed' : r.status, paid: r.price } : r
          ),
          events: [event('payment', `Balance paid for ${ids.length} registration${ids.length > 1 ? 's' : ''}`), ...s.events],
        })),

      submitForm: (sub) =>
        set((s) => {
          const t = sub.sailorId ? s.sailors.find((x) => x.id === sub.sailorId) : undefined
          const fam = s.families.find((f) => f.id === sub.familyId)
          return {
            submissions: [
              ...s.submissions.filter(
                (x) =>
                  !(x.templateId === sub.templateId && x.season === sub.season && x.familyId === sub.familyId && x.sailorId === sub.sailorId)
              ),
              { ...sub, id: uid('fs'), signedAt: clockNow().toISOString() },
            ],
            events: [
              event('form-signed', `${sub.signedBy} signed a form for ${t ? t.firstName : `the ${fam?.name} family`}`),
              ...s.events,
            ],
          }
        }),

      updateSailor: (id, patch) =>
        set((s) => ({ sailors: s.sailors.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),

      confirmRegistration: (id) =>
        set((s) => ({
          registrations: s.registrations.map((r) =>
            r.id === id ? { ...r, status: 'confirmed', paid: r.price, offerExpiresAt: undefined } : r
          ),
        })),

      cancelRegistration: (id) => {
        const r = get().registrations.find((x) => x.id === id)
        if (!r) return
        const s0 = get()
        const sailor = s0.sailors.find((x) => x.id === r.sailorId)!
        const session = s0.sessions.find((x) => x.id === r.sessionId)!
        set((s) => ({
          registrations: s.registrations.map((x) =>
            x.id === id ? { ...x, status: 'cancelled', offerExpiresAt: undefined } : x
          ),
          groups: s.groups.map((g) =>
            g.sessionId === r.sessionId ? { ...g, sailorIds: g.sailorIds.filter((sid) => sid !== r.sailorId) } : g
          ),
          events: [
            event('cancelled', `${sailor.firstName} ${sailor.lastName} was removed from ${PROGRAMS.find((p) => p.id === session.programId)?.name} · ${session.name}`),
            ...s.events,
          ],
        }))
        // Waitlists run in the club's registration system, so nothing is offered automatically here.
      },

      offerSpot: (id) =>
        set((s) => {
          const r = s.registrations.find((x) => x.id === id)!
          const sailor = s.sailors.find((x) => x.id === r.sailorId)!
          const session = s.sessions.find((x) => x.id === r.sessionId)!
          const expires = new Date(clockNow().getTime() + s.settings.waitlist.holdHours * 3600000).toISOString()
          return {
            registrations: s.registrations.map((x) =>
              x.id === id ? { ...x, status: 'offered', offerExpiresAt: expires } : x
            ),
            events: [
              event('offered', `Spot offered to ${sailor.firstName} ${sailor.lastName} for ${PROGRAMS.find((p) => p.id === session.programId)?.name} · ${session.name}`),
              ...s.events,
            ],
          }
        }),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      updatePricing: (patch) =>
        set((s) => ({ settings: { ...s.settings, pricing: { ...s.settings.pricing, ...patch } } })),
      updateTier: (tierId, patch) =>
        set((s) => ({
          settings: {
            ...s.settings,
            pricing: {
              ...s.settings.pricing,
              tiers: s.settings.pricing.tiers.map((t) => (t.id === tierId ? { ...t, ...patch } : t)),
            },
          },
        })),

      updateSession: (id, patch) => {
        set((s) => ({ sessions: s.sessions.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
        if (patch.capacity !== undefined) set((s) => runWaitlist(s, [id]))
      },

      autoGroupSession: (sessionId) =>
        set((s) => {
          const session = s.sessions.find((x) => x.id === sessionId)!
          const program = PROGRAMS.find((p) => p.id === session.programId)!
          const roster = s.registrations
            .filter((r) => r.sessionId === sessionId && r.status === 'confirmed')
            .map((r) => s.sailors.find((x) => x.id === r.sailorId)!)
          const existingCoaches = [...new Set(s.groups.filter((g) => g.sessionId === sessionId).flatMap((g) => g.coachIds))]
          const pool = existingCoaches.length
            ? existingCoaches.map((cid) => s.coaches.find((c) => c.id === cid)!)
            : s.coaches.filter((c) => c.activities.includes(program.activity) && c.role !== 'program-director')
          const needed = Math.ceil(roster.length / program.ratio)
          const coaches = pool.slice(0, Math.max(needed, 1))
          const boats = ['RIB 1 "Osprey"', 'RIB 2 "Heron"', 'RIB 3 "Pelican"', 'Whaler 4', 'Whaler 5']
          const groups = autoGroups(session, program, roster, coaches, () => uid('g'), boats)
          return { groups: [...s.groups.filter((g) => g.sessionId !== sessionId), ...groups] }
        }),

      moveSailor: (sailorId, toGroupId) =>
        set((s) => {
          const to = s.groups.find((g) => g.id === toGroupId)
          if (!to) return {}
          return {
            groups: s.groups.map((g) => {
              if (g.sessionId !== to.sessionId) return g
              const without = g.sailorIds.filter((id) => id !== sailorId)
              return g.id === toGroupId ? { ...g, sailorIds: [...without, sailorId] } : { ...g, sailorIds: without }
            }),
          }
        }),

      setGroupCoaches: (groupId, coachIds) =>
        set((s) => ({ groups: s.groups.map((g) => (g.id === groupId ? { ...g, coachIds } : g)) })),

      addGroup: (sessionId) =>
        set((s) => {
          const existing = s.groups.filter((g) => g.sessionId === sessionId)
          const session = s.sessions.find((x) => x.id === sessionId)!
          const program = PROGRAMS.find((p) => p.id === session.programId)!
          const base = existing[0]?.name.replace(/ [A-Z]$/, '') ?? program.name.split(' ').slice(0, 2).join(' ')
          const g: Group = {
            id: uid('g'),
            sessionId,
            name: `${base} ${String.fromCharCode(65 + existing.length)}`,
            coachIds: [],
            sailorIds: [],
          }
          return { groups: [...s.groups, g] }
        }),

      sendAnnouncement: (a) => {
        const s = get()
        const recipients =
          a.audience.kind === 'staff'
            ? s.coaches.length
            : audienceFamilyIds(a.audience, s, s.settings.season).length
        const full: Announcement = { ...a, id: uid('a'), sentAt: clockNow().toISOString(), recipients, opened: 0 }
        set({
          announcements: [full, ...s.announcements],
          events: [event('announcement', `“${a.title}” sent to ${recipients} ${a.audience.kind === 'staff' ? 'staff' : 'families'} by ${a.channels.join(' + ')}`), ...s.events],
        })
        return recipients
      },

      sendFormReminders: (familyIds) => {
        get().sendAnnouncement({
          title: `Reminder: ${get().settings.season} forms`,
          body: 'Your sailor is still missing one or more season forms. It takes about a minute from your phone in Burgee, and sailors need them on file before their next session.',
          category: 'reminder',
          audience: { kind: 'families', familyIds, label: 'Families with forms due' },
          channels: ['push', 'email'],
          sentBy: 'Jordan Hale',
        })
      },

      sendFormRequest: (r) =>
        set((s) => {
          const template = [...s.customTemplates, ...FORM_TEMPLATES].find((t) => t.id === r.templateId)
          const req: FormRequest = { ...r, id: uid('req'), sentAt: clockNow().toISOString() }
          const ann: Announcement = {
            id: uid('a'),
            title: `Please sign: ${template?.name ?? 'a form'}`,
            body: `${r.message}${r.dueDate ? ` Due ${format(new Date(`${r.dueDate}T12:00:00`), 'MMMM d')}.` : ''} Sign it from your phone in Burgee.`,
            category: 'reminder',
            audience: { kind: 'families', familyIds: r.familyIds, label: r.audienceLabel },
            channels: r.channels,
            sentAt: req.sentAt,
            sentBy: r.sentBy,
            recipients: r.familyIds.length,
            opened: 0,
          }
          return {
            formRequests: [req, ...s.formRequests],
            announcements: [ann, ...s.announcements],
            events: [event('announcement', `${template?.name ?? 'Form'} sent to ${r.familyIds.length} families for signature`), ...s.events],
          }
        }),

      createTemplate: (t) => {
        const tpl: FormTemplate = { ...t, id: uid('form') }
        set((s) => ({ customTemplates: [tpl, ...s.customTemplates] }))
        return tpl
      },

      markAttendance: (date, sessionId, sailorIds, status, extra) =>
        set((s) => {
          const attendance = { ...s.attendance }
          const nowIso = clockNow().toISOString()
          for (const sid of sailorIds) {
            const key = attendanceKey(date, sessionId, sid)
            const prev = attendance[key]
            attendance[key] = {
              sailorId: sid,
              sessionId,
              date,
              status,
              updatedAt: nowIso,
              by: extra?.by ?? 'Coach',
              pickedUpBy: status === 'picked-up' ? extra?.pickedUpBy : undefined,
              launchedAt: status === 'on-water' ? (prev?.launchedAt ?? nowIso) : prev?.launchedAt,
            }
          }
          return { attendance }
        }),

      clearAttendance: (date, sessionId, sailorId) =>
        set((s) => {
          const attendance = { ...s.attendance }
          delete attendance[attendanceKey(date, sessionId, sailorId)]
          return { attendance }
        }),

      recordSwimCheck: (c) =>
        set((s) => {
          const k = s.sailors.find((x) => x.id === c.sailorId)
          return {
            swimChecks: [c, ...s.swimChecks.filter((x) => !(x.sailorId === c.sailorId && x.date === c.date))],
            events: [event('form-signed', `${k?.firstName} ${k?.lastName} ${c.result === 'passed' ? 'passed' : 'did not pass'} a swim check with ${c.by}`), ...s.events],
          }
        }),

      renewCert: (coachId, certTypeId, issued, file) =>
        set((s) => {
          const ct = CERT_TYPES.find((c) => c.id === certTypeId)!
          const expires = format(addMonths(new Date(`${issued}T12:00:00`), ct.validMonths), 'yyyy-MM-dd')
          const doc: ClubDocument[] = file
            ? [{ id: uid('doc'), title: ct.name, kind: 'certification', coachId, certTypeId, expires, uploadedAt: clockNow().toISOString(), ...file }]
            : []
          return {
            coaches: s.coaches.map((c) =>
              c.id === coachId
                ? { ...c, certs: [...c.certs.filter((x) => x.certTypeId !== certTypeId), { certTypeId, issued, expires }] }
                : c
            ),
            documents: [...doc, ...s.documents],
          }
        }),

      addCoach: (c) => {
        const coach: Coach = { ...c, id: uid('c'), certs: [], avatarHue: Math.floor(Math.random() * 360), active: true }
        set((s) => ({ coaches: [...s.coaches, coach], events: [event('registered', `${coach.name} was added to staff`), ...s.events] }))
        return coach
      },
      updateCoach: (id, patch) => set((s) => ({ coaches: s.coaches.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
      removeCoach: (id) => {
        const s0 = get()
        const coach = s0.coaches.find((c) => c.id === id)
        const affected = s0.groups.filter((g) => g.coachIds.includes(id)).map((g) => g.name)
        if (!coach) return { groups: [] }
        set((s) => ({
          coaches: s.coaches.filter((c) => c.id !== id),
          formerCoaches: [{ ...coach, active: false }, ...s.formerCoaches],
          groups: s.groups.map((g) => (g.coachIds.includes(id) ? { ...g, coachIds: g.coachIds.filter((x) => x !== id) } : g)),
          events: [event('cancelled', `${coach.name} was removed from staff${affected.length ? ` and taken off ${affected.length} group${affected.length > 1 ? 's' : ''}` : ''}`), ...s.events],
        }))
        return { groups: affected }
      },
      restoreCoach: (id) =>
        set((s) => {
          const coach = s.formerCoaches.find((c) => c.id === id)
          if (!coach) return {}
          return { formerCoaches: s.formerCoaches.filter((c) => c.id !== id), coaches: [...s.coaches, { ...coach, active: true }] }
        }),

      addDocument: (d) => set((s) => ({ documents: [{ ...d, id: uid('doc'), uploadedAt: clockNow().toISOString() }, ...s.documents] })),
      removeDocument: (id) => set((s) => ({ documents: s.documents.filter((d) => d.id !== id) })),

      callPractice: (sessionIds, date, status, note, by) => {
        const s = get()
        const now = clockNow().toISOString()
        const keep = s.practiceCalls.filter((c) => !(c.date === date && sessionIds.includes(c.sessionId)))
        const calls: PracticeCall[] = sessionIds.map((sessionId) => ({ sessionId, date, status, note: note || undefined, postedAt: now, by }))
        set({ practiceCalls: [...keep, ...calls] })
        const familyIds = [...new Set(sessionIds.flatMap((sid) => audienceFamilyIds({ kind: 'session', sessionId: sid }, s, s.settings.season)))]
        if (!familyIds.length) return 0
        const names = sessionIds.map((sid) => {
          const se = s.sessions.find((x) => x.id === sid)
          return PROGRAMS.find((p) => p.id === se?.programId)?.name ?? 'Practice'
        })
        const label = names.length > 2 ? 'All teams' : names.join(' and ')
        const word = status === 'on' ? 'is on' : status === 'delayed' ? 'is delayed' : 'is cancelled'
        return get().sendAnnouncement({
          title: `${label}: practice ${word} ${date === format(clockNow(), 'yyyy-MM-dd') ? 'today' : `on ${format(new Date(`${date}T12:00:00`), 'EEE, MMM d')}`}`,
          body: note || (status === 'on' ? 'See you at the dock.' : status === 'delayed' ? 'We’ll post an update within the hour.' : 'Stay safe. We’ll see you next practice.'),
          category: status === 'on' ? 'schedule' : 'weather',
          urgent: status !== 'on',
          audience: { kind: 'families', familyIds, label },
          // Cancellations and delays are urgent, so they also go out by text.
          channels: status === 'on' ? ['push', 'email'] : ['push', 'sms', 'email'],
          sentBy: by,
        })
      },

      saveLessonPlan: (p) =>
        set((s) => {
          const existing = p.id ? s.lessonPlans.find((x) => x.id === p.id) : s.lessonPlans.find((x) => x.sessionId === p.sessionId && x.date === p.date)
          const full: LessonPlan = { ...p, id: existing?.id ?? uid('lp'), updatedAt: clockNow().toISOString() }
          return { lessonPlans: existing ? s.lessonPlans.map((x) => (x.id === existing.id ? full : x)) : [...s.lessonPlans, full] }
        }),

      assignBoat: (sessionId, who, personId, boatId) =>
        set((s) => {
          const cur = s.boatAssignments.find((a) => a.sessionId === sessionId) ?? { sessionId, sailors: {}, coaches: {} }
          const next = { ...cur, sailors: { ...cur.sailors }, coaches: { ...cur.coaches } }
          if (who === 'sailor') {
            if (boatId === null) delete next.sailors[personId]
            else next.sailors[personId] = boatId
          } else if (boatId === null || boatId === 'own') delete next.coaches[personId]
          else next.coaches[personId] = boatId
          return { boatAssignments: [...s.boatAssignments.filter((a) => a.sessionId !== sessionId), next] }
        }),

      markSkill: (sailorId, skillId, status, by) =>
        set((s) => {
          const rest = s.skillMarks.filter((m) => !(m.sailorId === sailorId && m.skillId === skillId))
          return { skillMarks: status ? [...rest, { sailorId, skillId, status, by, date: format(clockNow(), 'yyyy-MM-dd') }] : rest }
        }),

      saveEvaluation: (e) =>
        set((s) => {
          const full: Evaluation = { ...e, id: e.id ?? uid('evl') }
          const exists = s.evaluations.some((x) => x.id === full.id)
          return { evaluations: exists ? s.evaluations.map((x) => (x.id === full.id ? full : x)) : [full, ...s.evaluations] }
        }),

      addRegatta: (e, d) =>
        set((s) => {
          const id = uid('ev')
          return {
            calendar: [...s.calendar, { ...e, id, kind: 'regatta' }],
            regattas: [...s.regattas, { ...d, eventId: id }],
          }
        }),
      updateRegatta: (eventId, patch) => set((s) => ({ regattas: s.regattas.map((r) => (r.eventId === eventId ? { ...r, ...patch } : r)) })),
      respondToRegatta: (r) =>
        set((s) => ({
          regattaResponses: [
            ...s.regattaResponses.filter((x) => !(x.eventId === r.eventId && x.sailorId === r.sailorId)),
            { ...r, updatedAt: clockNow().toISOString() },
          ],
        })),

      addCalendarEvent: (e) => set((s) => ({ calendar: [...s.calendar, { ...e, id: uid('ev') }] })),
      removeCalendarEvent: (id) =>
        set((s) => ({
          calendar: s.calendar.filter((e) => e.id !== id),
          regattas: s.regattas.filter((r) => r.eventId !== id),
          regattaResponses: s.regattaResponses.filter((r) => r.eventId !== id),
        })),

      logIncident: (i) =>
        set((s) => ({
          incidents: [{ ...i, id: uid('inc') }, ...s.incidents],
          events: [event('announcement', `Incident report filed by ${i.reportedBy}`), ...s.events],
        })),
      updateIncident: (id, patch) => set((s) => ({ incidents: s.incidents.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),

      addBoat: (b) => set((s) => ({ boats: [...s.boats, { ...b, id: uid('b') }] })),
      updateBoat: (id, patch) => set((s) => ({ boats: s.boats.map((b) => (b.id === id ? { ...b, ...patch } : b)) })),
      removeBoat: (id) => set((s) => ({ boats: s.boats.filter((b) => b.id !== id) })),

      recordPayment: ({ familyId, registrationIds, method, memo }) =>
        set((s) => {
          const regs = s.registrations.filter((r) => registrationIds.includes(r.id))
          const amount = regs.reduce((n, r) => n + r.price - r.paid, 0)
          const fam = s.families.find((f) => f.id === familyId)
          return {
            registrations: s.registrations.map((r) => (registrationIds.includes(r.id) ? { ...r, status: r.status === 'pending-payment' ? 'confirmed' : r.status, paid: r.price } : r)),
            ledger: [{ id: uid('pay'), at: clockNow().toISOString(), familyId, registrationIds, amount, method, memo, recordedBy: 'Jordan Hale' }, ...s.ledger],
            events: [event('payment', `${method === 'check' ? 'Check' : 'Cash'} payment recorded for the ${fam?.name} family · $${amount.toLocaleString()}`), ...s.events],
          }
        }),
    }),
    {
      name: 'burgee-demo-v1',
      storage: createJSONStorage(() => safeStorage),
      version: 5,
      // Demo data shape changed: start older saved demos fresh.
      migrate: () => fresh() as never,
    }
  )
)
