import type { Level, Program, Session } from './types'
import { LEVELS } from './rules'

/**
 * Matching an imported roster (a spreadsheet, or a registration export from
 * Clubspot or another system) to Burgee's programs and weeks. Column names are
 * forgiving: "First name", "Participant First Name" and "first_name" all work.
 */

export type ImportMatch = {
  line: number
  firstName: string
  lastName: string
  dob?: string
  level: Level
  guardianName: string
  email: string
  phone: string
  sessionId?: string
  status: 'confirmed' | 'waitlisted'
  error?: string
}

const pick = (o: Record<string, string>, ...keys: string[]) => {
  for (const k of keys) if (o[k]?.trim()) return o[k].trim()
  // Fall back to any column whose name contains every word of the first key.
  return ''
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

export function matchProgram(text: string, programs: Program[]): Program | undefined {
  const t = norm(text)
  if (!t) return undefined
  return (
    programs.find((p) => norm(p.name) === t || p.id === text.trim()) ??
    programs.find((p) => norm(p.name).includes(t) || t.includes(norm(p.name))) ??
    programs.find((p) => t.includes(norm(p.name.replace(/camp|team|program/gi, ''))))
  )
}

export function matchLevel(text: string, program?: Program): Level {
  const t = norm(text)
  const hit = (Object.keys(LEVELS) as Level[]).find((l) => t && (norm(LEVELS[l].label) === t || norm(LEVELS[l].short) === t || norm(l) === t))
  return hit ?? program?.levels[0] ?? 'learn-to-sail'
}

export function matchSession(week: string, program: Program, sessions: Session[]): Session | undefined {
  const mine = sessions.filter((s) => s.programId === program.id)
  const n = week.match(/\d+/)?.[0]
  if (program.format === 'camp' && n) return mine.find((s) => s.name === `Week ${Number(n)}`)
  const w = norm(week)
  return mine.find((s) => w && (norm(s.name).includes(w) || w.includes(norm(s.name)))) ?? (program.format === 'team' ? mine[0] : undefined)
}

export function matchImportRows(objs: Record<string, string>[], programs: Program[], sessions: Session[]): ImportMatch[] {
  return objs.map((o, i) => {
    const firstName = pick(o, 'firstname', 'sailorfirstname', 'participantfirstname', 'childfirstname', 'juniorfirstname')
    const lastName = pick(o, 'lastname', 'sailorlastname', 'participantlastname', 'childlastname', 'juniorlastname')
    const guardianName = pick(o, 'parentname', 'guardianname', 'parent', 'guardian', 'primarycontact', 'contactname')
    const email = pick(o, 'email', 'parentemail', 'guardianemail', 'contactemail', 'primaryemail')
    const phone = pick(o, 'phone', 'parentphone', 'guardianphone', 'mobile', 'cell', 'contactphone')
    const programText = pick(o, 'program', 'class', 'activity', 'course', 'camp')
    const weekText = pick(o, 'week', 'session', 'sessionname', 'dates')
    const program = matchProgram(programText, programs)
    const session = program ? matchSession(weekText, program, sessions) : undefined
    const dobRaw = pick(o, 'birthdate', 'dob', 'dateofbirth', 'birthday')
    const dob = /^\d{4}-\d{2}-\d{2}$/.test(dobRaw)
      ? dobRaw
      : (() => {
          const m = dobRaw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
          return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : undefined
        })()
    const error = !firstName
      ? 'No sailor name'
      : !email
        ? 'No parent email'
        : !program
          ? `Can’t find a program called “${programText || '(blank)'}”`
          : !session
            ? `Can’t find ${weekText || 'a week'} of ${program.name}`
            : undefined
    return {
      line: i + 2,
      firstName,
      lastName: lastName || guardianName.split(' ').slice(-1)[0] || '',
      dob,
      level: matchLevel(pick(o, 'level', 'fleet', 'skilllevel', 'group'), program),
      guardianName: guardianName || `${lastName} family`,
      email,
      phone,
      sessionId: session?.id,
      status: /wait/i.test(pick(o, 'status', 'registrationstatus')) ? 'waitlisted' : 'confirmed',
      error,
    }
  })
}

export const IMPORT_TEMPLATE = [
  ['First name', 'Last name', 'Birthdate', 'Level', 'Parent name', 'Email', 'Phone', 'Program', 'Week', 'Status'],
  ['Ada', 'Lovell', '2016-05-02', 'Opti Green', 'Kate Lovell', 'kate@example.com', '(203) 555-0101', 'Opti Green Camp', 'Week 6', 'Confirmed'],
  ['Ada', 'Lovell', '2016-05-02', 'Opti Green', 'Kate Lovell', 'kate@example.com', '(203) 555-0101', 'Opti Green Camp', 'Week 7', 'Waitlist'],
  ['Max', 'Lovell', '2019-03-14', 'Learn to Sail', 'Kate Lovell', 'kate@example.com', '(203) 555-0101', 'Learn to Sail', 'Week 6', 'Confirmed'],
]
