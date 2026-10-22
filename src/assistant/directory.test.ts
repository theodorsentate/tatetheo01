import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@/data/catalog'
import { createSeed } from '@/data/seed'
import { answerLocally } from './local'
import { documentsInfo, equipmentInfo, staffDirectoryInfo } from './query'

const now = new Date('2026-10-22T10:00:00')
const seed = createSeed(now)
const ctx = { s: { ...seed, settings: structuredClone(DEFAULT_SETTINGS) }, now }

describe('directory, documents, calendar, boats, incidents', () => {
  it('looks up a coach by first name', () => {
    expect(staffDirectoryInfo(ctx, { name: 'maya' }).rows[0].phone).toMatch(/\(843\)/)
    expect(answerLocally("what's Maya's number?", ctx).text).toContain('Maya Ortiz')
  })
  it('finds certificate files and flags missing ones', () => {
    const noah = documentsInfo(ctx, { person: 'Noah', cert: 'safesport' })
    expect(noah.rows[0].staff).toBe('Noah Fitzgerald')
    expect(documentsInfo(ctx, { missingOnly: true }).rows.some((r) => r.staff === 'Owen Pryce')).toBe(true)
    expect(answerLocally("where is Noah's safesport certificate?", ctx).text).toContain('Noah Fitzgerald')
  })
  it('answers calendar, boats and incidents', () => {
    expect(answerLocally('when is the frostbite regatta?', ctx).text).toContain('Frostbite')
    expect(equipmentInfo(ctx, {}).boats.some((b) => b.name.includes('Heron'))).toBe(true)
    expect(answerLocally('which boats need repair?', ctx).text).toContain('Heron')
    expect(answerLocally('any open incidents?', ctx).text).toMatch(/near miss|equipment/)
  })
  it('seeds documents for every recorded cert but two', () => {
    const certs = seed.coaches.reduce((n, c) => n + c.certs.length, 0)
    expect(seed.documents.filter((d) => d.kind === 'certification')).toHaveLength(certs - 2)
  })
})
