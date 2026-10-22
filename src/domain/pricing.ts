import type {
  Family,
  PriceLine,
  PricingSettings,
  Program,
  Registration,
  Sailor,
  Session,
  Term,
} from './types'

export const ACTIVE_STATUSES = new Set([
  'confirmed',
  'pending-payment',
  'offered',
])

export type CartItem = { sailorId: string; sessionId: string }

export type PricingContext = {
  pricing: PricingSettings
  family: Family
  sailors: Sailor[]
  sessions: Session[]
  programs: Program[]
  terms: Term[]
  /** All registrations for this family (used for sibling / multi-week rules). */
  existing: Registration[]
  now: Date
}

export type ItemQuote = CartItem & {
  lines: PriceLine[]
  base: number
  total: number
}

export type CartQuote = {
  items: ItemQuote[]
  subtotal: number
  discounts: number
  fee: number
  total: number
}

export const round2 = (n: number) => Math.round(n * 100) / 100

export function basePrice(
  session: Session,
  program: Program,
  pricing: PricingSettings,
  family: Family
): number {
  const tier =
    session.priceOverride ??
    pricing.tiers.find((t) => t.id === program.pricingTierId)
  if (!tier) return 0
  return family.membership === 'member' ? tier.member : tier.nonMember
}

/**
 * Prices a set of new registrations for one family.
 *
 * Rules (all configurable in Settings → Pricing):
 *  - Member / non-member rate from the program's pricing tier
 *  - Early bird: % off if booked before the term's early-bird date
 *  - Multi-week: % off camp weeks once a sailor has N+ weeks in the term
 *  - Sibling: % off for every sailor after the first in the same term
 *  - Processing fee: optional % passed on at the cart level
 *
 * Discounts are each a % of the base rate (not compounded) so the receipt
 * reads clearly for parents.
 */
export function quoteCart(items: CartItem[], ctx: PricingContext): CartQuote {
  const { pricing, family, sessions, programs, terms, existing, now } = ctx
  const sessionById = new Map(sessions.map((s) => [s.id, s]))
  const programById = new Map(programs.map((p) => [p.id, p]))
  const termById = new Map(terms.map((t) => [t.id, t]))

  const activeExisting = existing.filter((r) => ACTIVE_STATUSES.has(r.status))

  // Sibling order per term: earliest existing registration first, then cart order.
  const siblingOrder = new Map<string, string[]>()
  const orderFor = (termId: string) => {
    if (siblingOrder.has(termId)) return siblingOrder.get(termId)!
    const inTerm = activeExisting
      .filter((r) => sessionById.get(r.sessionId)?.termId === termId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((r) => r.sailorId)
    const cartInTerm = items
      .filter((i) => sessionById.get(i.sessionId)?.termId === termId)
      .map((i) => i.sailorId)
    const order = [...new Set([...inTerm, ...cartInTerm])]
    siblingOrder.set(termId, order)
    return order
  }

  const quoted: ItemQuote[] = items.map((item) => {
    const session = sessionById.get(item.sessionId)
    const program = session ? programById.get(session.programId) : undefined
    const term = session ? termById.get(session.termId) : undefined
    if (!session || !program || !term) {
      return { ...item, lines: [], base: 0, total: 0 }
    }

    const base = basePrice(session, program, pricing, family)
    const lines: PriceLine[] = [
      {
        label: `${program.name} · ${session.name} (${family.membership === 'member' ? 'member' : 'non-member'} rate)`,
        amount: base,
      },
    ]

    if (
      pricing.earlyBirdPct > 0 &&
      term.earlyBirdUntil &&
      now <= endOfDay(term.earlyBirdUntil)
    ) {
      lines.push({
        label: `Early bird (${pricing.earlyBirdPct}%)`,
        amount: -round2((base * pricing.earlyBirdPct) / 100),
      })
    }

    if (program.format === 'camp' && pricing.multiWeekDiscountPct > 0) {
      const weeks =
        activeExisting.filter(
          (r) =>
            r.sailorId === item.sailorId &&
            sessionById.get(r.sessionId)?.termId === term.id &&
            programById.get(sessionById.get(r.sessionId)!.programId)?.format ===
              'camp'
        ).length +
        items.filter(
          (i) =>
            i.sailorId === item.sailorId &&
            sessionById.get(i.sessionId)?.termId === term.id &&
            programById.get(sessionById.get(i.sessionId)!.programId)?.format ===
              'camp'
        ).length
      if (weeks >= pricing.multiWeekMin) {
        lines.push({
          label: `Multi-week (${pricing.multiWeekMin}+ weeks, ${pricing.multiWeekDiscountPct}%)`,
          amount: -round2((base * pricing.multiWeekDiscountPct) / 100),
        })
      }
    }

    if (pricing.siblingDiscountPct > 0) {
      const order = orderFor(term.id)
      if (order.indexOf(item.sailorId) > 0) {
        lines.push({
          label: `Sibling (${pricing.siblingDiscountPct}%)`,
          amount: -round2((base * pricing.siblingDiscountPct) / 100),
        })
      }
    }

    const total = round2(lines.reduce((s, l) => s + l.amount, 0))
    return { ...item, lines, base, total: Math.max(0, total) }
  })

  const subtotal = round2(quoted.reduce((s, q) => s + q.base, 0))
  const afterDiscounts = round2(quoted.reduce((s, q) => s + q.total, 0))
  const discounts = round2(subtotal - afterDiscounts)
  const fee = round2((afterDiscounts * pricing.processingFeePct) / 100)
  return {
    items: quoted,
    subtotal,
    discounts,
    fee,
    total: round2(afterDiscounts + fee),
  }
}

export function endOfDay(date: string): Date {
  return new Date(`${date}T23:59:59`)
}

export const money = (n: number) =>
  n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
  })
