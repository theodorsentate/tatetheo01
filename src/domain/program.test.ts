import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, PROGRAMS, TERMS } from '@/data/catalog'
import { SKILLS, TRACKS, trackFor } from '@/data/curriculum'
import { createSeed } from '@/data/seed'
import { useStore } from '@/data/store'
import { answerLocally } from '@/assistant/local'
import type { Ctx } from '@/assistant/query'
import { nextPractice } from './attendance'
import { eligibleSailors, regattaSummary, termForDate } from './regattas'

const now = new Date('2026-10-22T14:00:00')
const seed = createSeed(now)
const ctx: Ctx = { s: { ...seed, settings: structuredClone(DEFAULT_SETTINGS) }, now }

describe('sailing only', () => {
  it('has no swim or tennis programs', () => {
    expect(PROGRAMS.every((p) => p.activity === 'sailing')).toBe(true)
    expect(seed.sessions.some((s) => /swim|tennis/.test(s.programId))).toBe(false)
  })
})

describe('regattas', () => {
  it('a late-November regatta draws from the fall teams', () => {
    expect(termForDate(TERMS, '2026-11-28').id).toBe('fall-26')
    expect(termForDate(TERMS, '2027-04-17').id).toBe('spring-27')
  })
  it('only fleets racing are eligible', () => {
    const frostbite = seed.regattas[0]
    const kids = eligibleSailors(frostbite, seed.sailors, seed.registrations, seed.sessions, 'fall-26')
    expect(kids.length).toBeGreaterThan(0)
    expect(kids.every((k) => k.level === 'opti-green')).toBe(true)
    expect(kids.some((k) => k.id === 's-hazel')).toBe(true)
  })
  it('counts every eligible sailor exactly once', () => {
    const r = seed.regattas[1]
    const kids = eligibleSailors(r, seed.sailors, seed.registrations, seed.sessions, 'fall-26')
    const sum = regattaSummary(r.eventId, kids, seed.regattaResponses)
    const answeredEligible = [...sum.going, ...sum.interested, ...sum.notGoing].filter((x) => kids.some((k) => k.id === x.sailorId)).length
    expect(answeredEligible + sum.noAnswer.length).toBe(kids.length)
    expect(sum.going.some((x) => x.sailorId === 's-finn')).toBe(true)
  })
})

describe('practice days', () => {
  it('finds the next practice', () => {
    const green = seed.sessions.find((s) => s.id === 'green-team-fall-26')!
    expect(nextPractice(green, now)).toBe('2026-10-22') // Thursday: today
    expect(nextPractice(green, new Date('2026-10-23T09:00:00'))).toBe('2026-10-24') // Saturday
    expect(nextPractice(green, new Date('2026-11-22T09:00:00'))).toBeUndefined() // season over
  })
  it('seeds a call and a plan for each team practicing today', () => {
    expect(seed.practiceCalls.map((c) => c.sessionId).sort()).toEqual(['green-team-fall-26', 'rwb-team-fall-26'])
    expect(seed.lessonPlans.some((p) => p.sessionId === 'green-team-fall-26' && p.date === '2026-10-22')).toBe(true)
  })
})

describe('skills', () => {
  it('every track has eight skills and maps from a fleet', () => {
    for (const t of Object.keys(TRACKS)) expect(SKILLS.filter((k) => k.track === t)).toHaveLength(8)
    expect(trackFor('opti-white')).toBe('champ')
    expect(trackFor('learn-to-sail')).toBe('lts')
  })
})

describe('store actions', () => {
  beforeEach(() => useStore.getState().resetDemo())

  it('calling off practice updates the call and texts the team', () => {
    const before = useStore.getState().announcements.length
    const today = new Date().toISOString().slice(0, 10)
    const n = useStore.getState().callPractice(['green-team-fall-26'], today, 'cancelled', 'Lightning nearby.', 'Jordan Hale')
    const s = useStore.getState()
    expect(n).toBeGreaterThan(0)
    expect(s.practiceCalls.filter((c) => c.sessionId === 'green-team-fall-26' && c.date === today)).toHaveLength(1)
    expect(s.practiceCalls.find((c) => c.sessionId === 'green-team-fall-26' && c.date === today)!.status).toBe('cancelled')
    expect(s.announcements.length).toBe(before + 1)
    expect(s.announcements[0].body).toBe('Lightning nearby.')
  })
  it('a regatta answer replaces the earlier one', () => {
    const ev = useStore.getState().regattas[0].eventId
    useStore.getState().respondToRegatta({ eventId: ev, sailorId: 's-hazel', status: 'interested', by: 'Sarah Calloway' })
    useStore.getState().respondToRegatta({ eventId: ev, sailorId: 's-hazel', status: 'going', chaperone: true, by: 'Sarah Calloway' })
    const mine = useStore.getState().regattaResponses.filter((r) => r.eventId === ev && r.sailorId === 's-hazel')
    expect(mine).toHaveLength(1)
    expect(mine[0]).toMatchObject({ status: 'going', chaperone: true })
  })
  it('ticking a skill cycles and clears', () => {
    const { markSkill } = useStore.getState()
    markSkill('s-hazel', 'green-8', 'working', 'Maya Ortiz')
    markSkill('s-hazel', 'green-8', 'got-it', 'Maya Ortiz')
    expect(useStore.getState().skillMarks.filter((m) => m.sailorId === 's-hazel' && m.skillId === 'green-8')).toEqual([
      expect.objectContaining({ status: 'got-it' }),
    ])
    markSkill('s-hazel', 'green-8', null, 'Maya Ortiz')
    expect(useStore.getState().skillMarks.some((m) => m.sailorId === 's-hazel' && m.skillId === 'green-8')).toBe(false)
  })
  it('boat assignments can be set and cleared', () => {
    const { assignBoat } = useStore.getState()
    assignBoat('green-team-fall-26', 'sailor', 's-hazel', 'own')
    expect(useStore.getState().boatAssignments.find((a) => a.sessionId === 'green-team-fall-26')!.sailors['s-hazel']).toBe('own')
    assignBoat('green-team-fall-26', 'sailor', 's-hazel', null)
    expect(useStore.getState().boatAssignments.find((a) => a.sessionId === 'green-team-fall-26')!.sailors['s-hazel']).toBeUndefined()
  })
})

describe('Ask Burgee', () => {
  it('answers who is going to a regatta', () => {
    const a = answerLocally('who is going to the fall championship?', ctx)
    expect(a.text).toMatch(/Fall Championship Regatta/)
    expect(a.text).toMatch(/Finn Calloway/)
  })
  it('drafts a nudge for families who have not answered', () => {
    const a = answerLocally('remind families who haven’t answered for the frostbite', ctx)
    expect(a.actions.some((x) => x.kind === 'draft')).toBe(true)
  })
  it('answers whether practice is on today', () => {
    const a = answerLocally('is practice on today?', ctx)
    expect(a.text).toMatch(/Opti Green Team/)
    expect(a.text).toMatch(/\bon\b/)
  })
  it('answers how a sailor is doing', () => {
    const a = answerLocally('how is Finn doing?', ctx)
    expect(a.text).toMatch(/Finn Calloway/)
    expect(a.text).toMatch(/Going well/)
  })
  it('lists sailors without evaluations', () => {
    expect(answerLocally('who still needs an evaluation?', ctx).text).toMatch(/don’t have an evaluation/)
  })
})
