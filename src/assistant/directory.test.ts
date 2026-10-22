import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@/data/catalog'
import { createSeed } from '@/data/seed'
import { demoStart } from '@/lib/clock'
import { answerLocally } from './local'
import { documentsInfo, equipmentInfo, staffDirectoryInfo } from './query'

const now = demoStart()
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
    expect(documentsInfo(ctx, { missingOnly: true }).rows.length).toBeGreaterThan(0)
    expect(answerLocally("where is Noah's safesport certificate?", ctx).text).toContain('Noah Fitzgerald')
  })
  it('answers calendar, boats and incidents', () => {
    expect(answerLocally('what’s coming up this week?', ctx).text).toContain('Parent night')
    expect(equipmentInfo(ctx, {}).boats.some((b) => b.name.includes('Heron'))).toBe(true)
    expect(answerLocally('which boats need repair?', ctx).text).toContain('Opti #2104')
    expect(answerLocally('any open incidents?', ctx).text).toMatch(/near miss|equipment/)
  })
})
