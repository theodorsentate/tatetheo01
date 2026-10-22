import { describe, expect, it } from 'vitest'
import { CERT_TYPES, DEFAULT_SETTINGS, PROGRAMS, TERMS } from '@/data/catalog'
import { createSeed } from '@/data/seed'
import { quoteCart } from './pricing'
import { autoGroups, certStatus, coachCertRows, eligibility, groupLoad } from './rules'
import type { Family, Registration, Sailor, Session } from './types'
import { offersToIssue, registrationWindow, seatsLeft, waitlistFor } from './waitlist'

const fam = (membership: Family['membership'], id = 'f1'): Family => ({
  id,
  name: 'Test',
  membership,
  guardians: [],
  address: '',
  createdAt: '2026-01-01T00:00:00Z',
})
const sailor = (id: string, familyId = 'f1', dob = '2015-05-01', level: Sailor['level'] = 'opti-white'): Sailor => ({
  id,
  familyId,
  firstName: id,
  lastName: 'T',
  dob,
  level,
  shirtSize: 'YM',
  medicalAlerts: [],
})
const session = (id: string, programId = 'rwb-camp', termId = 'summer-27', capacity = 2): Session => ({
  id,
  programId,
  termId,
  name: id,
  startDate: '2027-06-21',
  endDate: '2027-06-25',
  days: 'Mon–Fri',
  time: '',
  capacity,
  status: 'open',
})
const reg = (id: string, sailorId: string, sessionId: string, status: Registration['status'], createdAt = '2026-10-05T00:00:00Z'): Registration => ({
  id,
  sailorId,
  sessionId,
  status,
  createdAt,
  price: 0,
  priceLines: [],
  paid: 0,
})

const ctx = (family: Family, sessions: Session[], sailors: Sailor[], existing: Registration[] = [], now = new Date('2026-10-22T12:00:00')) => ({
  pricing: DEFAULT_SETTINGS.pricing,
  family,
  sailors,
  sessions,
  programs: PROGRAMS,
  terms: TERMS,
  existing,
  now,
})

describe('pricing', () => {
  it('charges member vs non-member rates with early bird', () => {
    const s = [session('w1')]
    const m = quoteCart([{ sailorId: 'a', sessionId: 'w1' }], ctx(fam('member'), s, [sailor('a')]))
    const n = quoteCart([{ sailorId: 'a', sessionId: 'w1' }], ctx(fam('non-member'), s, [sailor('a')]))
    expect(m.subtotal).toBe(450)
    expect(n.subtotal).toBe(575)
    // 10% early bird before Jan 31
    expect(m.total).toBe(405)
  })

  it('applies sibling and multi-week discounts', () => {
    const s = [1, 2, 3, 4].map((w) => session(`w${w}`))
    const kids = [sailor('a'), sailor('b')]
    const items = [
      ...s.map((x) => ({ sailorId: 'a', sessionId: x.id })),
      { sailorId: 'b', sessionId: 'w1' },
    ]
    const q = quoteCart(items, ctx(fam('member'), s, kids, [], new Date('2027-03-01T12:00:00')))
    // a: 4 weeks → 5% multi-week each; b: sibling 10%
    expect(q.items[0].total).toBe(427.5)
    expect(q.items[4].total).toBe(405)
    expect(q.total).toBe(427.5 * 4 + 405)
  })

  it('treats an earlier-registered sibling as the first child', () => {
    const s = [session('w1'), session('w2')]
    const kids = [sailor('a'), sailor('b')]
    const existing = [reg('r1', 'b', 'w1', 'confirmed')]
    const q = quoteCart([{ sailorId: 'a', sessionId: 'w2' }], ctx(fam('member'), s, kids, existing, new Date('2027-03-01T12:00:00')))
    expect(q.items[0].lines.some((l) => l.label.startsWith('Sibling'))).toBe(true)
  })
})

describe('waitlist', () => {
  const families = [fam('member', 'fm'), fam('non-member', 'fn')]
  const sailors = [sailor('m', 'fm'), sailor('n', 'fn'), sailor('x', 'fm')]
  const s = session('w1', 'rwb-camp', 'summer-27', 1)

  it('puts members first when member priority is on', () => {
    const regs = [
      reg('r1', 'n', 'w1', 'waitlisted', '2026-10-01T00:00:00Z'),
      reg('r2', 'm', 'w1', 'waitlisted', '2026-10-02T00:00:00Z'),
    ]
    expect(waitlistFor('w1', regs, sailors, families, DEFAULT_SETTINGS.waitlist).map((r) => r.id)).toEqual(['r2', 'r1'])
    expect(
      waitlistFor('w1', regs, sailors, families, { ...DEFAULT_SETTINGS.waitlist, memberPriority: false }).map((r) => r.id)
    ).toEqual(['r1', 'r2'])
  })

  it('auto-offers open seats with a hold', () => {
    const regs = [reg('r1', 'n', 'w1', 'waitlisted'), reg('r2', 'm', 'w1', 'waitlisted')]
    const now = new Date('2026-10-22T12:00:00Z')
    const offers = offersToIssue(s, regs, sailors, families, DEFAULT_SETTINGS.waitlist, now)
    expect(offers).toHaveLength(1)
    expect(offers[0].registrationId).toBe('r2')
    expect(new Date(offers[0].offerExpiresAt).getTime() - now.getTime()).toBe(48 * 3600000)
  })

  it('counts offered seats as taken', () => {
    expect(seatsLeft(s, [reg('r1', 'x', 'w1', 'offered')])).toBe(0)
  })

  it('blocks non-members during the member window', () => {
    const summer = TERMS.find((t) => t.id === 'summer-27')!
    expect(registrationWindow(summer, fam('non-member'), new Date('2026-10-22')).open).toBe(false)
    expect(registrationWindow(summer, fam('member'), new Date('2026-10-22')).open).toBe(true)
    expect(registrationWindow(summer, fam('non-member'), new Date('2026-11-02')).open).toBe(true)
  })
})

describe('eligibility, certs, rosters', () => {
  it('checks age and level', () => {
    const rwb = PROGRAMS.find((p) => p.id === 'rwb-camp')!
    expect(eligibility(sailor('a'), rwb, session('w1')).ok).toBe(true)
    expect(eligibility(sailor('a', 'f1', '2015-05-01', 'opti-green'), rwb, session('w1')).ok).toBe(false)
    expect(eligibility(sailor('a', 'f1', '2021-05-01', 'opti-white'), rwb, session('w1')).ok).toBe(false)
  })

  it('classifies cert expiry', () => {
    const now = new Date('2026-10-22T12:00:00')
    expect(certStatus('2026-10-01', now, 45)).toBe('expired')
    expect(certStatus('2026-11-15', now, 45)).toBe('expiring')
    expect(certStatus('2027-06-01', now, 45)).toBe('valid')
    expect(certStatus(undefined, now, 45)).toBe('missing')
  })

  it('lists required certs for a role, including missing ones', () => {
    const rows = coachCertRows(
      { id: 'c', name: 'C', role: 'assistant', email: '', phone: '', activities: ['sailing'], certs: [], avatarHue: 0 },
      CERT_TYPES,
      new Date(),
      45
    )
    expect(rows.map((r) => r.certType.id).sort()).toEqual(['bg', 'fa', 'pwr', 'safesport'])
    expect(rows.every((r) => r.status === 'missing')).toBe(true)
  })

  it('auto-groups within the coach ratio', () => {
    const program = PROGRAMS.find((p) => p.id === 'green-camp')!
    const kids = Array.from({ length: 19 }, (_, i) => sailor(`k${i}`, 'f1', `201${i % 9}-01-01`, 'opti-green'))
    let n = 0
    const coaches = ['a', 'b', 'c'].map((id) => ({ id, name: id, role: 'instructor' as const, email: '', phone: '', activities: ['sailing' as const], certs: [], avatarHue: 0 }))
    const groups = autoGroups(session('w1', 'green-camp'), program, kids, coaches, () => `g${++n}`)
    expect(groups).toHaveLength(3)
    expect(groups.flatMap((g) => g.sailorIds)).toHaveLength(19)
    expect(groups.every((g) => !groupLoad(g, program.ratio).overRatio)).toBe(true)
  })
})

describe('demo seed', () => {
  const seed = createSeed(new Date('2026-10-22T09:00:00'))

  it('never overbooks a session', () => {
    for (const s of seed.sessions) {
      const taken = seed.registrations.filter(
        (r) => r.sessionId === s.id && ['confirmed', 'pending-payment', 'offered'].includes(r.status)
      ).length
      expect(taken, s.id).toBeLessThanOrEqual(s.capacity)
    }
  })

  it('sets up the Calloway family story', () => {
    const finn = seed.registrations.filter((r) => r.sailorId === 's-finn')
    expect(finn.some((r) => r.status === 'offered' && r.offerExpiresAt)).toBe(true)
    expect(finn.some((r) => r.status === 'pending-payment')).toBe(true)
    const g3 = waitlistFor('green-camp-w3', seed.registrations, seed.sailors, seed.families, DEFAULT_SETTINGS.waitlist)
    expect(g3.findIndex((r) => r.sailorId === 's-hazel')).toBe(1)
  })

  it('has realistic volume', () => {
    expect(seed.families.length).toBeGreaterThan(50)
    expect(seed.registrations.length).toBeGreaterThan(200)
    expect(seed.registrations.filter((r) => r.status === 'waitlisted').length).toBeGreaterThan(8)
  })
})
