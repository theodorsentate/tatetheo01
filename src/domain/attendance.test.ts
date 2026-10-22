import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, FORM_TEMPLATES } from '@/data/catalog'
import { createSeed, PERMISSION_SLIP } from '@/data/seed'
import { answerLocally } from '@/assistant/local'
import { attendanceRecord, dayCounts, meetsOn, pendingForFamily, practiceDates, requestProgress } from './attendance'
import { ACTIVE_STATUSES } from './pricing'

const now = new Date('2026-10-22T10:00:00')
const seed = createSeed(now)
const session = seed.sessions.find((s) => s.id === 'green-team-fall-26')!

describe('schedule', () => {
  it('knows Tue/Thu/Sat team practices', () => {
    expect(meetsOn(session, new Date('2026-10-22T12:00:00'))).toBe(true) // Thursday
    expect(meetsOn(session, new Date('2026-10-21T12:00:00'))).toBe(false) // Wednesday
    expect(meetsOn(session, new Date('2026-12-01T12:00:00'))).toBe(false) // after the season
  })
  it('handles camp weeks with a holiday Monday', () => {
    const w4 = seed.sessions.find((s) => s.id === 'green-camp-w4')!
    expect(meetsOn(w4, new Date('2027-07-05T12:00:00'))).toBe(false)
    expect(meetsOn(w4, new Date('2027-07-06T12:00:00'))).toBe(true)
  })
  it('lists practice dates up to a day', () => {
    const dates = practiceDates(session, new Date('2026-09-13T12:00:00'))
    expect(dates).toEqual(['2026-09-08', '2026-09-10', '2026-09-12'])
  })
})

describe('attendance', () => {
  it('counts a day', () => {
    const c = dayCounts(
      [
        { sailorId: 'a', sessionId: 's', date: 'd', status: 'on-water', updatedAt: '', by: '', launchedAt: 'x' },
        { sailorId: 'b', sessionId: 's', date: 'd', status: 'absent', updatedAt: '', by: '' },
      ],
      ['a', 'b', 'c']
    )
    expect(c).toMatchObject({ onWater: 1, absent: 1, notIn: 1, launchedToday: true })
  })
  it('seeds a believable fall season and flags no-shows', () => {
    const dates = practiceDates(session, new Date('2026-10-21T12:00:00'))
    const rec = attendanceRecord(Object.values(seed.attendance), 's-hazel', session.id, dates)
    expect(rec.attended + rec.missed).toBe(dates.length)
    expect(rec.missed).toBeGreaterThan(0)
  })
})

describe('forms pushed to families', () => {
  const kids = seed.sailors.filter((k) => k.familyId === 'f-calloway')
  const active = new Set(seed.registrations.filter((r) => ACTIVE_STATUSES.has(r.status)).map((r) => r.sailorId))
  const pending = pendingForFamily({
    familyId: 'f-calloway',
    kids,
    activeSailorIds: active,
    templates: [...FORM_TEMPLATES, PERMISSION_SLIP],
    submissions: seed.submissions,
    requests: seed.formRequests,
    season: DEFAULT_SETTINGS.season,
  })
  it('includes the permission slip with its due date for Hazel only', () => {
    const slip = pending.filter((p) => p.template.id === PERMISSION_SLIP.id)
    expect(slip.map((p) => p.sailor?.firstName)).toEqual(['Hazel'])
    expect(slip[0].dueDate).toBe('2026-11-02')
  })
  it('still includes missing season forms', () => {
    expect(pending.filter((p) => p.sailor?.id === 's-hazel').map((p) => p.template.id).sort()).toEqual(['frostbite-slip', 'medical', 'swim'])
  })
  it('tracks request progress', () => {
    const p = requestProgress(seed.formRequests[0], PERMISSION_SLIP, seed.submissions, DEFAULT_SETTINGS.season)
    expect(p.total).toBeGreaterThan(p.done)
  })
})

describe('Ask Burgee offline: new topics', () => {
  const ctx = { s: { ...seed, settings: structuredClone(DEFAULT_SETTINGS) }, now }
  it('swim checks', () => expect(answerLocally('who still needs a swim check?', ctx).text).toContain('Hazel Calloway'))
  it('permission slip', () => expect(answerLocally('who hasn’t signed the frostbite permission slip?', ctx).text).toContain('Hazel Calloway'))
  it('attendance concerns', () => expect(answerLocally('who has missed a lot of practices?', ctx).text).not.toMatch(/^I can look up/))
  it('parent notes', () => expect(answerLocally('any notes from parents on the green team?', ctx).text).toContain('Hazel'))
})
