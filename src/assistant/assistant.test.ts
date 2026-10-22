import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@/data/catalog'
import { createSeed } from '@/data/seed'
import { answerLocally, SUGGESTIONS } from './local'
import { findSessions, formsInfo, matchCert, matchPrograms, staffCertifications, waitlistInfo, type Ctx } from './query'

const now = new Date('2026-10-22T10:00:00')
const ctx: Ctx = { s: { ...createSeed(now), settings: structuredClone(DEFAULT_SETTINGS) }, now }

describe('name resolution', () => {
  it('understands program nicknames', () => {
    expect(matchPrograms('green camp')).toEqual(['green-camp'])
    expect(matchPrograms('the race team')).toEqual(['rwb-team'])
    expect(matchPrograms('420s')).toEqual(['420-camp', '420-team'])
    expect(matchPrograms('learn to sail')).toEqual(['lts'])
  })
  it('understands cert nicknames', () => {
    expect(matchCert('who needs their safesport')).toBe('safesport')
    expect(matchCert('cpr')).toBe('fa')
    expect(matchCert('background checks')).toBe('bg')
  })
  it('finds a summer week from "week 3"', () => {
    const s = findSessions(ctx, { program: 'green camp', week: 'week 3' })
    expect(s.map((x) => x.id)).toEqual(['green-camp-w3'])
  })
  it('defaults team questions to the current fall season', () => {
    expect(findSessions(ctx, { program: 'green team' }).map((x) => x.id)).toEqual(['green-team-fall-26'])
  })
})

describe('data tools', () => {
  it('lists who needs SafeSport', () => {
    const r = staffCertifications(ctx, { cert: 'safesport' })
    expect(r.rows.map((x) => x.staff)).toContain('Noah Fitzgerald')
    expect(r.rows.every((x) => x.status !== 'valid')).toBe(true)
  })
  it('orders a waitlist with positions', () => {
    const w = waitlistInfo(ctx, { program: 'green camp', week: '3' })
    expect(w.sessions[0].inLine.map((x) => x.position)).toEqual(w.sessions[0].inLine.map((_, i) => i + 1))
    expect(w.sessions[0].inLine.some((x) => x.sailor === 'Hazel Calloway')).toBe(true)
  })
  it('counts missing forms', () => {
    expect(formsInfo(ctx, {}).sailorsMissing).toBeGreaterThan(0)
  })
})

describe('offline answers', () => {
  it('answers every suggested question with real content', () => {
    for (const q of SUGGESTIONS) {
      const a = answerLocally(q, ctx)
      expect(a.text, q).not.toMatch(/^I can look up/)
    }
  })
  it('names the SafeSport problem', () => {
    expect(answerLocally('Who still needs their SafeSport?', ctx).text).toContain('Noah Fitzgerald')
  })
  it('drafts a reminder when asked, without sending', () => {
    const a = answerLocally('Remind families who are missing forms', ctx)
    const draft = a.actions.find((x) => x.kind === 'draft')
    expect(draft && draft.kind === 'draft' && draft.audience.kind).toBe('outstanding-forms')
    expect(ctx.s.announcements.length).toBe(createSeed(now).announcements.length)
  })
  it('answers about a family by last name', () => {
    expect(answerLocally("what's going on with the Calloways?", ctx).text).toContain('Finn')
  })
  it('shows the Green Camp week 3 waitlist with Hazel', () => {
    expect(answerLocally("Who's on the Green Camp week 3 waitlist?", ctx).text).toContain('Hazel Calloway')
  })
  it('flags medical alerts on the green team', () => {
    expect(answerLocally('Any allergies on the Green Team?', ctx).text).toMatch(/medical alert|No sailors/)
  })
})
