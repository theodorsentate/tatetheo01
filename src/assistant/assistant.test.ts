import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@/data/catalog'
import { createSeed } from '@/data/seed'
import { demoStart } from '@/lib/clock'
import { answerLocally, SUGGESTIONS } from './local'
import { findSessions, formsInfo, inboxInfo, matchCert, matchPrograms, parentNotesInfo, progressInfo, staffCertifications, waitlistInfo, type Ctx } from './query'

// The demo day: Wednesday of camp week 5, mid-morning.
const now = demoStart()
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
    expect(findSessions(ctx, { program: 'green camp', week: 'week 3' }).map((x) => x.id)).toEqual(['green-camp-w3'])
  })
  it('reads a camp with no week as this week', () => {
    expect(findSessions(ctx, { program: 'green camp' }).map((x) => x.id)).toEqual(['green-camp-w5'])
  })
  it('defaults team questions to the next team season in July', () => {
    expect(findSessions(ctx, { program: 'green team' }).map((x) => x.id)).toEqual(['green-team-fall-27'])
  })
})

describe('data tools', () => {
  it('lists who needs SafeSport', () => {
    const r = staffCertifications(ctx, { cert: 'safesport' })
    expect(r.rows.map((x) => x.staff)).toContain('Noah Fitzgerald')
    expect(r.rows.every((x) => x.status !== 'valid')).toBe(true)
  })
  it('orders an imported waitlist with positions', () => {
    const w = waitlistInfo(ctx, { program: 'green camp', week: '7' })
    expect(w.sessions[0].inLine.map((x) => x.position)).toEqual(w.sessions[0].inLine.map((_, i) => i + 1))
    expect(w.sessions[0].inLine.some((x) => x.sailor === 'Hazel Calloway')).toBe(true)
  })
  it('counts missing forms', () => {
    expect(formsInfo(ctx, {}).sailorsMissing).toBeGreaterThan(0)
  })
  it('knows what is waiting in the inbox', () => {
    const inbox = inboxInfo(ctx, {})
    expect(inbox.waitingForYou).toBe(1)
    expect(inbox.rows.find((r) => r.waitingForDirector)?.subject).toMatch(/switch weeks/)
  })
  it('lists today’s parent notes with the coach', () => {
    const notes = parentNotesInfo(ctx, {})
    expect(notes.rows.find((r) => r.sailor === 'Hazel Calloway')?.what).toMatch(/picked up by Lou Calloway/)
    expect(notes.rows.every((r) => r.coach)).toBe(true)
  })
  it('lists evaluations waiting for approval', () => {
    expect(progressInfo(ctx, {}).waitingForApproval.length).toBe(6)
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
  it('drafts a reminder when asked, as an app notification and email, without sending', () => {
    const a = answerLocally('Remind families who are missing forms', ctx)
    const draft = a.actions.find((x) => x.kind === 'draft')
    expect(draft && draft.kind === 'draft' && draft.audience.kind).toBe('outstanding-forms')
    expect(draft && draft.kind === 'draft' && draft.channels).toEqual(['push', 'email'])
    expect(ctx.s.announcements.length).toBe(createSeed(now).announcements.length)
  })
  it('answers about a family by last name', () => {
    expect(answerLocally("what's going on with the Calloways?", ctx).text).toContain('Finn')
  })
  it('shows the Green Camp week 7 waitlist with Hazel', () => {
    expect(answerLocally("Who's on the Green Camp week 7 waitlist?", ctx).text).toContain('Hazel Calloway')
  })
  it('finds medical alerts in this week’s Green Camp', () => {
    expect(answerLocally('Any allergies in Green Camp this week?', ctx).text).toContain('Hazel Calloway')
  })
  it('says who is out and who is picking up', () => {
    const t = answerLocally("Who's out today?", ctx).text
    expect(t).toContain('Hazel Calloway')
    expect(t).toMatch(/out/)
  })
  it('points money questions to the registration system', () => {
    expect(answerLocally('Which families owe money?', ctx).text).toMatch(/doesn’t handle payments/)
  })
  it('finds a named regatta on the calendar', () => {
    expect(answerLocally('when is the harbor island regatta?', ctx).text).toContain('Harbor Island Green Fleet Regatta')
  })
})
