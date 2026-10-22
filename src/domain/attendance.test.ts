import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, FORM_TEMPLATES } from '@/data/catalog'
import { createSeed, PERMISSION_SLIP } from '@/data/seed'
import { demoStart } from '@/lib/clock'
import { answerLocally } from '@/assistant/local'
import { attendanceRecord, dayCounts, meetsOn, pendingForFamily, practiceDates, requestProgress } from './attendance'
import { ACTIVE_STATUSES } from './pricing'

// Wednesday, July 14 2027: week 5 of camp, mid-morning.
const now = demoStart()
const seed = createSeed(now)
const w5 = seed.sessions.find((s) => s.id === 'green-camp-w5')!
const w4 = seed.sessions.find((s) => s.id === 'green-camp-w4')!

describe('schedule', () => {
  it('knows camp days', () => {
    expect(meetsOn(w5, new Date('2027-07-14T12:00:00'))).toBe(true) // Wednesday
    expect(meetsOn(w5, new Date('2027-07-17T12:00:00'))).toBe(false) // Saturday
    expect(meetsOn(w5, new Date('2027-07-19T12:00:00'))).toBe(false) // next week
  })
  it('handles camp weeks with a holiday Monday', () => {
    expect(meetsOn(w4, new Date('2027-07-05T12:00:00'))).toBe(false)
    expect(meetsOn(w4, new Date('2027-07-06T12:00:00'))).toBe(true)
  })
  it('lists camp days up to today, including today', () => {
    expect(practiceDates(w5, now)).toEqual(['2027-07-12', '2027-07-13', '2027-07-14'])
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
  it('seeds a full week of camp history', () => {
    const dates = practiceDates(w4, now)
    const rec = attendanceRecord(Object.values(seed.attendance), 's-hazel', w4.id, dates)
    expect(dates).toHaveLength(4)
    expect(rec.attended + rec.missed).toBe(4)
  })
  it('has the morning groups on the water and the afternoon groups not in yet', () => {
    const today = Object.values(seed.attendance).filter((e) => e.date === '2027-07-14')
    expect(today.some((e) => e.sessionId === 'green-camp-w5' && e.status === 'on-water')).toBe(true)
    expect(today.some((e) => e.sessionId === 'rwb-camp-w5')).toBe(false)
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
  it('includes the regatta permission slip with its due date, for Hazel only', () => {
    const slip = pending.filter((p) => p.template.id === PERMISSION_SLIP.id)
    expect(slip.map((p) => p.sailor?.firstName)).toEqual(['Hazel'])
    expect(slip[0].dueDate).toBe('2027-07-16')
  })
  it('still includes missing season forms', () => {
    expect(pending.filter((p) => p.sailor?.id === 's-hazel').map((p) => p.template.id).sort()).toEqual(['harbor-island-slip', 'medical'])
  })
  it('tracks request progress', () => {
    const p = requestProgress(seed.formRequests[0], PERMISSION_SLIP, seed.submissions, DEFAULT_SETTINGS.season)
    expect(p.total).toBeGreaterThan(p.done)
  })
})

describe('Ask Burgee offline: day-to-day topics', () => {
  const ctx = { s: { ...seed, settings: structuredClone(DEFAULT_SETTINGS) }, now }
  it('swim checks', () => expect(answerLocally('who still needs a swim check?', ctx).text).toMatch(/still need a swim check/))
  it('permission slip', () => expect(answerLocally('who hasn’t signed the harbor island permission slip?', ctx).text).toContain('Hazel Calloway'))
  it('attendance concerns', () => expect(answerLocally('who has missed a lot of practices?', ctx).text).not.toMatch(/^I can look up/))
  it('parent notes', () => expect(answerLocally('any notes from parents on green camp?', ctx).text).toContain('Hazel'))
})
