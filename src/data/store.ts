import { addMonths, format } from 'date-fns'
import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { ACTIVE_STATUSES, quoteCart, type CartItem } from '@/domain/pricing'
import { autoGroups } from '@/domain/rules'
import type {
  ActivityEvent,
  Announcement,
  Audience,
  ClubSettings,
  FormSubmission,
  Group,
  Registration,
  Sailor,
  Session,
} from '@/domain/types'
import { expiredOffers, offersToIssue, seatsLeft } from '@/domain/waitlist'
import { CERT_TYPES, DEFAULT_SETTINGS, PROGRAMS, TERMS } from './catalog'
import { createSeed, type DemoState } from './seed'

/**
 * Demo data store.
 *
 * Every mutation the UI performs goes through an action here. When the app
 * moves to Supabase, each action becomes an RPC / insert against the tables
 * in /supabase/migrations and the selectors become queries — the components
 * do not need to change shape.
 */

export type Role = 'director' | 'coach' | 'family'

type State = DemoState & {
  settings: ClubSettings
  cart: CartItem[]
  role: Role
}

type Actions = {
  setRole: (role: Role) => void
  resetDemo: () => void

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

  // Coach-side
  renewCert: (coachId: string, certTypeId: string, issued: string) => void
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
  ...createSeed(new Date()),
  settings: structuredClone(DEFAULT_SETTINGS),
  cart: [],
  role: 'director',
})

function event(kind: ActivityEvent['kind'], text: string): ActivityEvent {
  return { id: uid('e'), at: new Date().toISOString(), kind, text }
}

/** Expire stale offers and fill open seats from the waitlist. */
function runWaitlist(state: State, sessionIds?: string[]): Partial<State> {
  const now = new Date()
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
          now: new Date(),
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
            createdAt: new Date().toISOString(),
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
              { ...sub, id: uid('fs'), signedAt: new Date().toISOString() },
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
        set((s) => runWaitlist(s, [r.sessionId]))
      },

      offerSpot: (id) =>
        set((s) => {
          const r = s.registrations.find((x) => x.id === id)!
          const sailor = s.sailors.find((x) => x.id === r.sailorId)!
          const session = s.sessions.find((x) => x.id === r.sessionId)!
          const expires = new Date(Date.now() + s.settings.waitlist.holdHours * 3600000).toISOString()
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
          const boats = program.activity === 'sailing'
            ? ['RIB 1 "Osprey"', 'RIB 2 "Heron"', 'RIB 3 "Pelican"', 'Whaler 4', 'Whaler 5']
            : program.activity === 'tennis' ? ['Courts 1–2', 'Courts 3–4', 'Court 5'] : ['Lanes 1–3', 'Lanes 4–6', 'Shallow end']
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
        const full: Announcement = { ...a, id: uid('a'), sentAt: new Date().toISOString(), recipients, opened: 0 }
        set({
          announcements: [full, ...s.announcements],
          events: [event('announcement', `“${a.title}” sent to ${recipients} ${a.audience.kind === 'staff' ? 'staff' : 'families'} by ${a.channels.join(' + ')}`), ...s.events],
        })
        return recipients
      },

      sendFormReminders: (familyIds) =>
        set((s) => ({
          events: [event('announcement', `Form reminders sent to ${familyIds.length} families`), ...s.events],
        })),

      renewCert: (coachId, certTypeId, issued) =>
        set((s) => {
          const ct = CERT_TYPES.find((c) => c.id === certTypeId)!
          const expires = format(addMonths(new Date(`${issued}T12:00:00`), ct.validMonths), 'yyyy-MM-dd')
          return {
            coaches: s.coaches.map((c) =>
              c.id === coachId
                ? { ...c, certs: [...c.certs.filter((x) => x.certTypeId !== certTypeId), { certTypeId, issued, expires }] }
                : c
            ),
          }
        }),
    }),
    {
      name: 'burgee-demo-v1',
      storage: createJSONStorage(() => safeStorage),
      version: 1,
    }
  )
)
