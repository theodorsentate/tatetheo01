import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, PROGRAMS, TERMS } from '@/data/catalog'
import { SKILLS, TRACKS, trackFor } from '@/data/curriculum'
import { createSeed } from '@/data/seed'
import { useStore } from '@/data/store'
import { demoStart } from '@/lib/clock'
import { answerLocally } from '@/assistant/local'
import type { Ctx } from '@/assistant/query'
import { withParentsCopied } from '@/features/inbox/inbox'
import { nextPractice } from './attendance'
import { eligibleSailors, regattaSummary, termForDate } from './regattas'

const now = demoStart()
const seed = createSeed(now)
const ctx: Ctx = { s: { ...seed, settings: structuredClone(DEFAULT_SETTINGS) }, now }
const today = '2027-07-14'

describe('sailing only, summer first', () => {
  it('has no swim or tennis programs', () => {
    expect(PROGRAMS.every((p) => p.activity === 'sailing')).toBe(true)
    expect(seed.sessions.some((s) => /swim|tennis/.test(s.programId))).toBe(false)
  })
  it('runs camps as morning or afternoon groups', () => {
    for (const p of PROGRAMS.filter((x) => x.format === 'camp')) expect(['AM', 'PM']).toContain(p.slot)
  })
})

describe('regattas', () => {
  it('a summer regatta draws from that summer’s campers', () => {
    expect(termForDate(TERMS, '2027-07-20').id).toBe('summer-27')
    const harbor = seed.regattas[0]
    const kids = eligibleSailors(harbor, seed.sailors, seed.registrations, seed.sessions, 'summer-27')
    expect(kids.length).toBeGreaterThan(0)
    expect(kids.every((k) => k.level === 'opti-green')).toBe(true)
    expect(kids.some((k) => k.id === 's-hazel')).toBe(true)
  })
  it('counts every eligible sailor exactly once', () => {
    const r = seed.regattas[1]
    const kids = eligibleSailors(r, seed.sailors, seed.registrations, seed.sessions, 'summer-27')
    const sum = regattaSummary(r.eventId, kids, seed.regattaResponses)
    const answeredEligible = [...sum.going, ...sum.interested, ...sum.notGoing].filter((x) => kids.some((k) => k.id === x.sailorId)).length
    expect(answeredEligible + sum.noAnswer.length).toBe(kids.length)
    expect(sum.going.some((x) => x.sailorId === 's-finn')).toBe(true)
  })
})

describe('camp days', () => {
  it('finds the next camp day', () => {
    const green = seed.sessions.find((s) => s.id === 'green-camp-w5')!
    expect(nextPractice(green, now)).toBe(today)
    expect(nextPractice(green, new Date('2027-07-15T13:00:00'))).toBe('2027-07-15')
    expect(nextPractice(green, new Date('2027-07-17T09:00:00'))).toBeUndefined() // week over
  })
  it('in the morning, only the AM groups have a call for today', () => {
    const calls = seed.practiceCalls.filter((c) => c.date === today).map((c) => c.sessionId).sort()
    expect(calls).toEqual(['green-camp-w5', 'lts-w5'])
  })
  it('has a plan for every group sailing today', () => {
    expect(seed.lessonPlans.some((p) => p.sessionId === 'green-camp-w5' && p.date === today)).toBe(true)
    expect(seed.lessonPlans.filter((p) => p.sessionId === 'rwb-camp-w5' && p.date === today).length).toBeGreaterThan(1)
  })
})

describe('skills', () => {
  it('every track has eight skills and maps from a fleet', () => {
    for (const t of Object.keys(TRACKS)) expect(SKILLS.filter((k) => k.track === t)).toHaveLength(8)
    expect(trackFor('opti-white')).toBe('champ')
    expect(trackFor('learn-to-sail')).toBe('lts')
  })
})

describe('SafeSport', () => {
  it('copies the parents on anything that includes a sailor', () => {
    const look = {
      sailor: new Map(seed.sailors.map((k) => [k.id, k])),
      family: new Map(seed.families.map((f) => [f.id, f])),
      coach: new Map(seed.coaches.map((c) => [c.id, c])),
      session: new Map(seed.sessions.map((s) => [s.id, s])),
    } as unknown as Parameters<typeof withParentsCopied>[1]
    expect(withParentsCopied(['coach:c-eli', 'sailor:s-lucy'], look).sort()).toEqual(['coach:c-eli', 'family:f-reyes', 'sailor:s-lucy'])
    expect(withParentsCopied(['coach:c-eli', 'director'], look)).toEqual(['coach:c-eli', 'director'])
  })
})

describe('store actions', () => {
  beforeEach(() => useStore.getState().resetDemo())

  it('calling off camp updates the call and tells the families', () => {
    const before = useStore.getState().announcements.length
    const n = useStore.getState().callPractice(['rwb-camp-w5'], today, 'cancelled', 'Lightning nearby.', 'Jordan Hale')
    const s = useStore.getState()
    expect(n).toBeGreaterThan(0)
    expect(s.practiceCalls.filter((c) => c.sessionId === 'rwb-camp-w5' && c.date === today)).toHaveLength(1)
    expect(s.practiceCalls.find((c) => c.sessionId === 'rwb-camp-w5' && c.date === today)!.status).toBe('cancelled')
    expect(s.announcements.length).toBe(before + 1)
    expect(s.announcements[0].body).toBe('Lightning nearby.')
  })
  it('a parent’s absence note marks the sailor absent on the roster', () => {
    useStore.getState().addDayNote({ sailorId: 's-finn', date: today, kind: 'absent', note: 'Sick', by: 'Sarah Calloway' })
    const s = useStore.getState()
    expect(s.dayNotes.some((d) => d.sailorId === 's-finn' && d.kind === 'absent')).toBe(true)
    expect(Object.values(s.attendance).some((e) => e.sailorId === 's-finn' && e.date === today && e.status === 'absent')).toBe(true)
  })
  it('a reply lands in the thread and counts as read for the sender', () => {
    const id = useStore.getState().startThread({ subject: 'Hi', participants: ['family:f-calloway', 'coach:c-maya'], from: 'family:f-calloway', name: 'Sarah Calloway', text: 'Hello' })
    useStore.getState().sendMessage(id, 'coach:c-maya', 'Maya Ortiz', 'Hi Sarah!')
    const t = useStore.getState().threads.find((x) => x.id === id)!
    expect(t.messages.map((m) => m.text)).toEqual(['Hello', 'Hi Sarah!'])
    expect(t.reads['coach:c-maya']).toBe(t.messages[1].at)
  })
  it('evaluations reach families only after approval', () => {
    const pending = useStore.getState().evaluations.filter((e) => e.status === 'pending')
    useStore.getState().approveEvaluations([pending[0].id], 'Jordan Hale')
    expect(useStore.getState().evaluations.find((e) => e.id === pending[0].id)).toMatchObject({ status: 'shared', approvedBy: 'Jordan Hale' })
  })
  it('importing a roster twice does not duplicate families or weeks', () => {
    const row = { firstName: 'Ada', lastName: 'Lovell', level: 'opti-green' as const, guardianName: 'Kate Lovell', email: 'kate@example.com', phone: '1', sessionId: 'green-camp-w6', status: 'confirmed' as const }
    const first = useStore.getState().importRoster([row])
    const second = useStore.getState().importRoster([row])
    expect(first).toEqual({ families: 1, sailors: 1, registrations: 1 })
    expect(second).toEqual({ families: 0, sailors: 0, registrations: 0 })
  })
  it('a regatta answer replaces the earlier one', () => {
    const ev = useStore.getState().regattas[0].eventId
    useStore.getState().respondToRegatta({ eventId: ev, sailorId: 's-hazel', status: 'interested', by: 'Sarah Calloway' })
    useStore.getState().respondToRegatta({ eventId: ev, sailorId: 's-hazel', status: 'going', chaperone: true, by: 'Sarah Calloway' })
    const mine = useStore.getState().regattaResponses.filter((r) => r.eventId === ev && r.sailorId === 's-hazel')
    expect(mine).toHaveLength(1)
    expect(mine[0]).toMatchObject({ status: 'going', chaperone: true })
  })
  it('a skill moves through Introduced, In progress, Completed and clears', () => {
    const { markSkill } = useStore.getState()
    markSkill('s-hazel', 'green-8', 'introduced', 'Maya Ortiz')
    markSkill('s-hazel', 'green-8', 'got-it', 'Maya Ortiz')
    expect(useStore.getState().skillMarks.filter((m) => m.sailorId === 's-hazel' && m.skillId === 'green-8')).toEqual([expect.objectContaining({ status: 'got-it' })])
    markSkill('s-hazel', 'green-8', null, 'Maya Ortiz')
    expect(useStore.getState().skillMarks.some((m) => m.sailorId === 's-hazel' && m.skillId === 'green-8')).toBe(false)
  })
  it('boat assignments can be set and cleared', () => {
    const { assignBoat } = useStore.getState()
    assignBoat('green-camp-w5', 'sailor', 's-hazel', 'own')
    expect(useStore.getState().boatAssignments.find((a) => a.sessionId === 'green-camp-w5')!.sailors['s-hazel']).toBe('own')
    assignBoat('green-camp-w5', 'sailor', 's-hazel', null)
    expect(useStore.getState().boatAssignments.find((a) => a.sessionId === 'green-camp-w5')!.sailors['s-hazel']).toBeUndefined()
  })
})

describe('Ask Burgee', () => {
  it('answers who is going to a regatta', () => {
    const a = answerLocally('who is going to the lowcountry championship?', ctx)
    expect(a.text).toMatch(/Lowcountry Opti Championship/)
    expect(a.text).toMatch(/Finn Calloway/)
  })
  it('drafts a nudge for families who have not answered', () => {
    const a = answerLocally('remind families who haven’t answered for the harbor island regatta', ctx)
    expect(a.actions.some((x) => x.kind === 'draft')).toBe(true)
  })
  it('answers whether practice is on today', () => {
    const a = answerLocally('is practice on today?', ctx)
    expect(a.text).toMatch(/Opti Green Camp/)
    expect(a.text).toMatch(/\bon\b/)
  })
  it('answers how a sailor is doing', () => {
    const a = answerLocally('how is Hazel doing?', ctx)
    expect(a.text).toMatch(/Hazel Calloway/)
  })
  it('lists evaluations waiting for approval', () => {
    expect(answerLocally('which evaluations are waiting for my approval?', ctx).text).toMatch(/waiting for your approval/)
  })
})
