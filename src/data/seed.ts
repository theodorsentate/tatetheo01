import { addDays, addMonths, format, subDays } from 'date-fns'
import { demoStart } from '@/lib/clock'
import { quoteCart } from '@/domain/pricing'
import { autoGroups, eligibility } from '@/domain/rules'
import { attendanceKey, meetsOn, practiceDates } from '@/domain/attendance'
import type {
  ActivityEvent,
  Announcement,
  AttendanceEntry,
  BoatAssignments,
  Coach,
  DayNote,
  Evaluation,
  Family,
  Boat,
  ClubDocument,
  ClubEvent,
  FormRequest,
  FormSubmission,
  FormTemplate,
  Group,
  Incident,
  LedgerEntry,
  LessonPlan,
  Level,
  PracticeCall,
  RegattaDetails,
  RegattaResponse,
  Registration,
  Sailor,
  Session,
  SkillMark,
  SwimCheck,
  Thread,
} from '@/domain/types'
import { seatsLeft } from '@/domain/waitlist'
import { CERT_TYPES, DEFAULT_SETTINGS, FORM_TEMPLATES, PROGRAMS, TERMS } from './catalog'
import { LESSON_LIBRARY, SKILLS, trackFor } from './curriculum'

export type DemoState = {
  sessions: Session[]
  families: Family[]
  sailors: Sailor[]
  coaches: Coach[]
  registrations: Registration[]
  groups: Group[]
  submissions: FormSubmission[]
  announcements: Announcement[]
  events: ActivityEvent[]
  attendance: Record<string, AttendanceEntry>
  swimChecks: SwimCheck[]
  customTemplates: FormTemplate[]
  formRequests: FormRequest[]
  formerCoaches: Coach[]
  documents: ClubDocument[]
  calendar: ClubEvent[]
  incidents: Incident[]
  boats: Boat[]
  ledger: LedgerEntry[]
  regattas: RegattaDetails[]
  regattaResponses: RegattaResponse[]
  practiceCalls: PracticeCall[]
  lessonPlans: LessonPlan[]
  boatAssignments: BoatAssignments[]
  skillMarks: SkillMark[]
  evaluations: Evaluation[]
  dayNotes: DayNote[]
  threads: Thread[]
}

/** One-off form the director already sent this week. */
export const PERMISSION_SLIP: FormTemplate = {
  id: 'harbor-island-slip',
  name: 'Harbor Island Regatta Permission Slip',
  short: 'Harbor Island slip',
  description: 'Permission to race at the Harbor Island Green Fleet Regatta on Tue, Jul 20 and ride the club launch.',
  scope: 'sailor',
  requiresSignature: true,
  required: false,
  custom: true,
  body: 'I give permission for my child to sail in the Harbor Island Green Fleet Regatta on Tuesday, July 20, and to ride the club launch to and from the race area with coaches. I understand races may be postponed or cancelled for weather.',
  fields: [
    { kind: 'choice', id: 'lunch', label: 'Lunch', options: ['Packing a lunch', 'Ordering the club box lunch ($12)'], required: true },
    { kind: 'text', id: 'pickup', label: 'Who is picking up after racing?', required: true },
  ],
}

const NOTES = [
  'Gets cold quickly. Please make sure the spray top goes on before launching.',
  'Working on confidence in big breeze. A quick check-in before launching helps a lot.',
  'Very competitive, can get frustrated after a bad race. A short reset talk works best.',
  'Wears contacts, keeps a spare pair in the green dry bag.',
  'Shy with new groups for the first day or two. Pairing with a friend helps.',
  'Loves helping rig. Happy to be given a job on the dock.',
  'Does best with short instructions, one at a time.',
  'Prefers to be called by middle name, Jamie.',
  'First summer away from Opti Green. Nervous about capsize drills.',
  'Sunburns easily. We send SPF 50 in the bag; please remind at snack.',
  'Carpools with the Hadley kids on Tuesdays.',
]
const PICKUPS = ['Grandmother', 'Grandfather', 'Nanny', 'Aunt', 'Family friend', 'Older sibling (17)']

/* Deterministic PRNG so every demo load looks the same. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const iso = (d: Date) => format(d, 'yyyy-MM-dd')
/** A timestamp on a given day at a given clock time. */
const at = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00`).toISOString()

const SURNAMES = [
  'Ashby', 'Barrow', 'Beckett', 'Bishop', 'Brennan', 'Carver', 'Chandler', 'Coleridge',
  'Dalton', 'Delaney', 'Ellery', 'Fairbanks', 'Fenwick', 'Galloway', 'Garrison', 'Grayson',
  'Hadley', 'Hargrove', 'Hollis', 'Huxley', 'Kendrick', 'Kingsley', 'Langford', 'Lattimore',
  'Lowell', 'Marlowe', 'Merritt', 'Monroe', 'Norwood', 'Oakes', 'Pemberton', 'Prescott',
  'Quincy', 'Radcliffe', 'Ramsey', 'Remington', 'Sawyer', 'Sheffield', 'Sinclair', 'Stanton',
  'Sterling', 'Talbot', 'Thayer', 'Vance', 'Wakefield', 'Warwick', 'Whitmore', 'Winslow',
  'Yardley', 'Abernathy', 'Bramwell', 'Calhoun', 'Desmond', 'Everhart', 'Fletcher', 'Gilchrist',
  'Hawthorne', 'Iverson', 'Jessup', 'Kincaid', 'Lockhart', 'Maddox', 'Nash', 'Osgood',
]
const KID_NAMES = [
  'Ava', 'Beau', 'Caroline', 'Charlie', 'Eliza', 'Emmett', 'Georgia', 'Graham', 'Harper',
  'Henry', 'Isla', 'Jack', 'June', 'Knox', 'Lila', 'Luke', 'Mae', 'Miles', 'Nora', 'Oliver',
  'Poppy', 'Reid', 'Sadie', 'Sawyer', 'Tess', 'Theo', 'Violet', 'Wells', 'Wren', 'Will',
  'Annie', 'Brooks', 'Clara', 'Duke', 'Ellie', 'Finnegan', 'Gus', 'Hattie', 'Ivy', 'James',
  'Kate', 'Lucy', 'Margot', 'Ned', 'Olive', 'Pierce', 'Quinn', 'Rosie', 'Sam', 'Tucker',
]
const PARENT_NAMES = [
  'Katherine', 'Michael', 'Elizabeth', 'David', 'Anne', 'Robert', 'Margaret', 'John',
  'Sarah', 'Andrew', 'Laura', 'Christopher', 'Meredith', 'Thomas', 'Julia', 'Peter',
  'Hillary', 'James', 'Courtney', 'William', 'Leigh', 'Charles', 'Allison', 'Patrick',
]
const STREETS = ['Tradd St', 'Legare St', 'Church St', 'Murray Blvd', 'King St', 'Meeting St', 'Bay St', 'Harbor View Rd', 'Wharf Ln', 'Marsh Hen Dr']
const ALERTS = [
  'Peanut allergy — EpiPen in bag',
  'Asthma — inhaler',
  'Bee sting allergy',
  'Type 1 diabetes — CGM',
  'Wears glasses',
  'Sunscreen sensitivity',
  'Gets seasick',
]

/** Times each camp slot runs. */
const CAMP_TIMES: Record<string, string> = {
  lts: '9:00 AM – 12:00 PM',
  'green-camp': '9:00 AM – 12:00 PM',
  'rwb-camp': '1:00 – 4:00 PM',
  '420-camp': '1:00 – 4:30 PM',
  'ilca-camp': '1:00 – 4:30 PM',
}

/**
 * The demo club on a Wednesday in week 5 of summer camps.
 * `now` is the demo moment; mornings show the AM groups on the water,
 * afternoons show them gone home and the PM groups out.
 */
export function createSeed(now: Date = demoStart()): DemoState {
  const rand = mulberry32(20270714)
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)]
  const chance = (p: number) => rand() < p
  let n = 0
  const id = (prefix: string) => `${prefix}-${(++n).toString(36)}`
  const today = iso(now)
  const yesterday = subDays(now, 1)
  const afternoon = now.getHours() >= 13
  const director = 'Jordan Hale'

  /* ───────────── Sessions ───────────── */
  const sessions: Session[] = []
  const summer = TERMS.find((t) => t.id === 'summer-27')!
  const summerStart = new Date(`${summer.startDate}T12:00:00`)
  const camp = (programId: string, weeks: number[], capacity: number) => {
    for (const w of weeks) {
      const start = addDays(summerStart, (w - 1) * 7)
      sessions.push({
        id: `${programId}-w${w}`,
        programId,
        termId: 'summer-27',
        name: `Week ${w}`,
        startDate: iso(start),
        endDate: iso(addDays(start, 4)),
        days: w === 4 ? 'Tue–Fri (Jul 5 off)' : 'Mon–Fri',
        time: CAMP_TIMES[programId],
        capacity,
        status: 'open',
      })
    }
  }
  const allWeeks = [1, 2, 3, 4, 5, 6, 7, 8]
  camp('lts', allWeeks, 18)
  camp('green-camp', allWeeks, 24)
  camp('rwb-camp', allWeeks, 24)
  camp('420-camp', allWeeks, 16)
  camp('ilca-camp', [2, 4, 6, 8], 12)

  for (const term of TERMS.filter((t) => t.season !== 'summer')) {
    const teams: [string, number, string, string][] = [
      ['green-team', 20, 'Tue, Thu, Sat', 'Weekdays 4:00–6:00 PM · Sat 9–12'],
      ['rwb-team', 20, 'Tue, Thu, Sat', 'Weekdays 4:00–6:15 PM · Sat 9–1'],
      ['420-team', 16, 'Mon, Wed, Sat', 'Weekdays 4:15–6:30 PM · Sat 9–1'],
      ['ilca-team', 10, 'Sat, Sun', 'Weekends 10:00 AM – 2:00 PM'],
    ]
    for (const [programId, capacity, days, time] of teams) {
      sessions.push({
        id: `${programId}-${term.id}`,
        programId,
        termId: term.id,
        name: `${term.season === 'fall' ? 'Fall' : 'Spring'} Season`,
        startDate: term.startDate,
        endDate: term.endDate,
        days,
        time,
        capacity,
        status: 'open',
      })
    }
  }
  const sess = (sid: string) => sessions.find((s) => s.id === sid)!
  const currentWeek = Math.max(1, Math.min(8, Math.floor((new Date(`${today}T12:00:00`).getTime() - summerStart.getTime()) / (7 * 86400000)) + 1))
  const weekId = (programId: string, w = currentWeek) => `${programId}-w${w}`

  /* ───────────── Coaches ───────────── */
  const certsFor = (role: Coach['role'], tweaks: Record<string, number | null> = {}) =>
    CERT_TYPES.filter((ct) => ct.requiredFor.includes(role)).flatMap((ct) => {
      // tweak = days until expiry (null = missing)
      if (tweaks[ct.id] === null) return []
      const days = tweaks[ct.id] ?? Math.floor(120 + rand() * (ct.validMonths * 30 - 150))
      const expires = addDays(now, days)
      return [{ certTypeId: ct.id, expires: iso(expires), issued: iso(addMonths(expires, -ct.validMonths)) }]
    })

  const coachSpecs: [string, string, Coach['role'], Record<string, number | null>?][] = [
    ['c-maya', 'Maya Ortiz', 'head-coach', { fa: 19 }],
    ['c-liam', 'Liam Becker', 'head-coach'],
    ['c-ava', 'Ava Thornton', 'instructor'],
    ['c-noah', 'Noah Fitzgerald', 'instructor', { safesport: -12 }],
    ['c-chloe', 'Chloe Mercer', 'instructor'],
    ['c-owen', 'Owen Pryce', 'instructor', { pwr: 33 }],
    ['c-eli', 'Eli Navarro', 'instructor'],
    ['c-sam', 'Sam Whitaker', 'instructor'],
    ['c-grace', 'Grace Holloway', 'assistant'],
    ['c-ruby', 'Ruby Kessler', 'assistant', { bg: null }],
    ['c-nora', 'Nora Ames', 'assistant'],
    ['c-tessa', 'Tessa Lund', 'instructor', { pwr: 27 }],
    ['c-marcus', 'Marcus Reed', 'assistant'],
    ['c-jordan', 'Jordan Hale', 'program-director'],
  ]
  const coaches: Coach[] = coachSpecs.map(([cid, name, role, tweaks], i) => ({
    id: cid,
    name,
    role,
    activities: ['sailing'],
    email: `${name.split(' ')[0].toLowerCase()}@saltmarshbay.example`,
    phone: `(843) 555-${(1200 + i * 37).toString().slice(-4)}`,
    certs: certsFor(role, tweaks),
    avatarHue: (i * 47) % 360,
    active: true,
    startedSeason: pick(['Summer 2022', 'Summer 2023', 'Summer 2024', 'Summer 2025', 'Fall 2025', 'Summer 2026']),
    school: role === 'program-director' ? undefined : pick(['College sophomore', 'College junior', 'College senior', 'High school senior', 'Graduate student', 'Teacher, year-round']),
    emergencyContact: {
      name: `${pick(PARENT_NAMES)} ${name.split(' ')[1]}`,
      phone: `(843) 555-${(4100 + i * 29).toString().slice(-4)}`,
      relationship: pick(['Mother', 'Father', 'Partner', 'Sister', 'Brother']),
    },
  }))
  const coach = (cid: string) => coaches.find((c) => c.id === cid)!
  coach('c-maya').notes = 'Head coach for Green camp mornings and a Race camp group in the afternoon. Prefers texts over calls on the water.'
  coach('c-noah').notes = 'Mornings only this summer.'
  coach('c-tessa').notes = 'Drives the mark-set boat on Friday race days.'

  /* ───────────── Families & sailors ───────────── */
  const families: Family[] = []
  const sailors: Sailor[] = []

  const levelForAge = (age: number): Level => {
    if (age <= 7) return 'learn-to-sail'
    if (age <= 9) return chance(0.6) ? 'opti-green' : 'learn-to-sail'
    if (age === 10) return chance(0.5) ? 'opti-red' : 'opti-green'
    if (age <= 12) return chance(0.25) ? 'opti-green' : 'opti-white'
    if (age <= 14) return chance(0.45) ? 'opti-blue' : 'club-420'
    return chance(0.55) ? 'club-420' : 'ilca'
  }

  // The parent persona: the Calloways.
  families.push({
    id: 'f-calloway',
    name: 'Calloway',
    membership: 'member',
    memberNumber: 'M-1142',
    guardians: [
      { name: 'Sarah Calloway', email: 'sarah.calloway@example.com', phone: '(843) 555-0142', relationship: 'Mother', smsOptIn: true },
      { name: 'Ben Calloway', email: 'ben.calloway@example.com', phone: '(843) 555-0187', relationship: 'Father', smsOptIn: false },
    ],
    address: '14 Water St, Charleston, SC',
    createdAt: subDays(now, 1100).toISOString(),
  })
  sailors.push(
    { id: 's-finn', familyId: 'f-calloway', firstName: 'Finn', lastName: 'Calloway', dob: '2015-04-12', level: 'opti-white', shirtSize: 'YL', medicalAlerts: [] },
    { id: 's-hazel', familyId: 'f-calloway', firstName: 'Hazel', lastName: 'Calloway', dob: '2018-08-03', level: 'opti-green', shirtSize: 'YS', medicalAlerts: ['Bee sting allergy'] }
  )
  // The teen persona: Lucy Reyes sails 420s and has her own login.
  families.push({
    id: 'f-reyes',
    name: 'Reyes',
    membership: 'member',
    memberNumber: 'M-1287',
    guardians: [
      { name: 'Carmen Reyes', email: 'carmen.reyes@example.com', phone: '(843) 555-0164', relationship: 'Mother', smsOptIn: true },
      { name: 'Dan Reyes', email: 'dan.reyes@example.com', phone: '(843) 555-0171', relationship: 'Father', smsOptIn: true },
    ],
    address: '3 Lamboll St, Charleston, SC',
    createdAt: subDays(now, 800).toISOString(),
  })
  sailors.push({
    id: 's-lucy',
    familyId: 'f-reyes',
    firstName: 'Lucy',
    lastName: 'Reyes',
    dob: '2012-03-09',
    level: 'club-420',
    shirtSize: 'AS',
    medicalAlerts: [],
    login: { email: 'lucy.reyes@example.com', phone: '(843) 555-0176' },
  })

  SURNAMES.forEach((surname, i) => {
    const member = chance(0.8)
    const fid = `f-${surname.toLowerCase()}`
    const p1 = pick(PARENT_NAMES)
    const p2 = pick(PARENT_NAMES.filter((p) => p !== p1))
    families.push({
      id: fid,
      name: surname,
      membership: member ? 'member' : 'non-member',
      memberNumber: member ? `M-${1000 + i * 7}` : undefined,
      guardians: [
        { name: `${p1} ${surname}`, email: `${p1.toLowerCase()}.${surname.toLowerCase()}@example.com`, phone: `(843) 555-${(2000 + i * 13).toString().slice(-4)}`, relationship: 'Parent', smsOptIn: chance(0.75) },
        ...(chance(0.6)
          ? [{ name: `${p2} ${surname}`, email: `${p2.toLowerCase()}@example.com`, phone: `(843) 555-${(5000 + i * 11).toString().slice(-4)}`, relationship: 'Parent', smsOptIn: chance(0.45) }]
          : []),
      ],
      address: `${10 + Math.floor(rand() * 180)} ${pick(STREETS)}, Charleston, SC`,
      createdAt: subDays(now, 60 + Math.floor(rand() * 1500)).toISOString(),
    })
    const kids = chance(0.35) ? 1 : chance(0.75) ? 2 : 3
    const used = new Set<string>()
    for (let k = 0; k < kids; k++) {
      let first = pick(KID_NAMES)
      while (used.has(first)) first = pick(KID_NAMES)
      used.add(first)
      const age = 6 + Math.floor(rand() * 12) // 6–17 this summer
      const dob = new Date(2027 - age, Math.floor(rand() * 6), 1 + Math.floor(rand() * 27))
      const level = levelForAge(age)
      sailors.push({
        id: `s-${surname.toLowerCase()}-${first.toLowerCase()}`,
        familyId: fid,
        firstName: first,
        lastName: surname,
        dob: iso(dob),
        level,
        shirtSize: age < 9 ? 'YS' : age < 11 ? 'YM' : age < 13 ? 'YL' : age < 15 ? 'AS' : 'AM',
        medicalAlerts: chance(0.12) ? [pick(ALERTS)] : [],
        login: age >= 14 && chance(0.4) ? { email: `${first.toLowerCase()}.${surname.toLowerCase()}@example.com` } : undefined,
      })
    }
  })

  /* ───────────── Registrations ───────────── */
  const registrations: Registration[] = []
  const programById = new Map(PROGRAMS.map((p) => [p.id, p]))
  const familyById = new Map(families.map((f) => [f.id, f]))

  const register = (sailor: Sailor, session: Session, createdAt: Date, forceStatus?: Registration['status']) => {
    const family = familyById.get(sailor.familyId)!
    const existing = registrations.filter((r) => sailors.some((s) => s.id === r.sailorId && s.familyId === family.id))
    const quote = quoteCart([{ sailorId: sailor.id, sessionId: session.id }], {
      pricing: DEFAULT_SETTINGS.pricing,
      family,
      sailors,
      sessions,
      programs: PROGRAMS,
      terms: TERMS,
      existing,
      now: createdAt,
    }).items[0]
    const full = seatsLeft(session, registrations) <= 0
    const status: Registration['status'] = forceStatus ?? (full ? 'waitlisted' : 'confirmed')
    // Burgee doesn't take payments; anyone holding a seat is simply signed up.
    registrations.push({
      id: id('r'),
      sailorId: sailor.id,
      sessionId: session.id,
      status,
      createdAt: createdAt.toISOString(),
      price: quote.total,
      priceLines: quote.lines,
      // The club bills families through its own system; Burgee records the price only.
      paid: status === 'confirmed' ? quote.total : 0,
    })
    return registrations[registrations.length - 1]
  }

  const eligibleSessions = (sailor: Sailor, termId: string) =>
    sessions.filter((s) => s.termId === termId && eligibility(sailor, programById.get(s.programId)!, s).ok)

  const personas = new Set(['s-finn', 's-hazel', 's-lucy'])
  const others = sailors.filter((s) => !personas.has(s.id))
  const finn = sailors.find((s) => s.id === 's-finn')!
  const hazel = sailors.find((s) => s.id === 's-hazel')!
  const lucy = sailors.find((s) => s.id === 's-lucy')!

  // Spring 2027 teams (finished in May).
  for (const s of others) {
    const options = eligibleSessions(s, 'spring-27')
    if (options.length && chance(0.4)) register(s, pick(options), new Date(`2026-12-${String(1 + Math.floor(rand() * 27)).padStart(2, '0')}T09:00:00`))
  }
  register(finn, sess('rwb-team-spring-27'), new Date('2026-12-01T08:12:00'), 'confirmed')

  // Summer 2027: members from Jan 15, everyone from Feb 15. Most of it happened in the first weeks.
  const summerOpen = new Date('2027-01-15T07:00:00')
  const publicOpen = new Date('2027-02-15T07:00:00')
  const span = (now.getTime() - summerOpen.getTime()) / 86400000
  const weekWeight = [0.55, 0.75, 1, 1, 0.95, 0.9, 0.7, 0.5]
  // The personas registered the morning it opened.
  register(finn, sess('rwb-camp-w2'), new Date('2027-01-15T07:04:00'), 'confirmed')
  register(finn, sess('rwb-camp-w3'), new Date('2027-01-15T07:05:00'), 'confirmed')
  register(finn, sess('rwb-camp-w5'), new Date('2027-01-15T07:05:30'), 'confirmed')
  register(hazel, sess('green-camp-w4'), new Date('2027-01-15T07:06:00'), 'confirmed')
  register(hazel, sess('green-camp-w5'), new Date('2027-01-15T07:06:30'), 'confirmed')
  for (const w of [3, 5, 6]) register(lucy, sess(`420-camp-w${w}`), new Date('2027-01-15T07:20:00'), 'confirmed')

  type Pending = { sailor: Sailor; session: Session; at: Date }
  const pending: Pending[] = []
  for (const s of others) {
    const fam = familyById.get(s.familyId)!
    if (!chance(0.88)) continue
    const options = eligibleSessions(s, 'summer-27')
    if (!options.length) continue
    const programId = pick([...new Set(options.map((o) => o.programId))])
    const weeks = 1 + Math.floor(rand() * 4.6)
    let when = new Date(summerOpen.getTime() + rand() ** 2.6 * span * 86400000)
    if (fam.membership !== 'member' && when < publicOpen) when = new Date(publicOpen.getTime() + rand() ** 2 * 20 * 86400000)
    options
      .filter((o) => o.programId === programId)
      .map((o) => ({ o, k: rand() / weekWeight[Number(o.name.split(' ')[1]) - 1] }))
      .sort((a, b) => a.k - b.k)
      .slice(0, weeks)
      .map((x) => x.o)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .forEach((session, k) => pending.push({ sailor: s, session, at: new Date(when.getTime() + k * 60000) }))
  }
  pending.sort((a, b) => a.at.getTime() - b.at.getTime())
  for (const p of pending) register(p.sailor, p.session, p.at)

  // The middle weeks of the popular camps sell out with a waitlist.
  for (const sid of ['green-camp-w3', 'green-camp-w4', 'green-camp-w5', 'rwb-camp-w3', 'rwb-camp-w4', 'rwb-camp-w5', 'rwb-camp-w6', 'green-camp-w7', 'lts-w3']) {
    const session = sess(sid)
    const program = programById.get(session.programId)!
    const extra = others.filter(
      (s) => eligibility(s, program, session).ok && !registrations.some((r) => r.sailorId === s.id && r.sessionId === sid)
    )
    while (seatsLeft(session, registrations) > 0 && extra.length) register(extra.shift()!, session, new Date(summerOpen.getTime() + rand() * 40 * 86400000))
    for (let k = 0; k < 3 && extra.length; k++) register(extra.shift()!, session, subDays(now, 2 + Math.floor(rand() * 20)), 'waitlisted')
  }

  // Finn is on the Race camp week 6 waitlist (waitlists run in the club's registration system).
  const w6 = sess('rwb-camp-w6')
  const w6Confirmed = registrations.filter((r) => r.sessionId === w6.id && r.status === 'confirmed' && r.sailorId !== 's-finn')
  w6Confirmed[w6Confirmed.length - 1].status = 'cancelled'
  w6Confirmed[w6Confirmed.length - 1].paid = 0
  register(finn, w6, subDays(now, 9), 'waitlisted')

  // Hazel is second on the Green camp week 7 waitlist.
  const g7 = sess('green-camp-w7')
  const g7Wait = registrations
    .filter((r) => r.sessionId === g7.id && r.status === 'waitlisted')
    .sort((x, y) => x.createdAt.localeCompare(y.createdAt))
  g7Wait.forEach((r, i) => (r.createdAt = subDays(now, i === 0 ? 8 : 1).toISOString()))
  register(hazel, g7, subDays(now, 3), 'waitlisted')

  // Fall 2027 teams opened to members on July 1.
  const fallOpen = new Date('2027-07-01T08:00:00')
  const fallSpan = Math.max(0, (now.getTime() - fallOpen.getTime()) / 86400000)
  for (const s of others) {
    const options = eligibleSessions(s, 'fall-27')
    if (options.length && familyById.get(s.familyId)!.membership === 'member' && chance(0.3))
      register(s, pick(options), new Date(fallOpen.getTime() + rand() ** 1.5 * fallSpan * 86400000))
  }
  register(finn, sess('rwb-team-fall-27'), new Date('2027-07-01T08:03:00'), 'confirmed')
  register(lucy, sess('420-team-fall-27'), new Date('2027-07-02T19:40:00'), 'confirmed')

  // A few cancellations in the coming weeks.
  registrations
    .filter((r) => r.status === 'confirmed' && /-w[78]$/.test(r.sessionId) && !personas.has(r.sailorId))
    .forEach((r) => {
      if (chance(0.04)) {
        r.status = 'cancelled'
        r.paid = 0
      }
    })

  const rosterOf = (sid: string) => registrations.filter((r) => r.sessionId === sid && r.status === 'confirmed').map((r) => r.sailorId)

  /* ───────────── Groups: AM and PM coaches ───────────── */
  const groups: Group[] = []
  const ribs = ['RIB 1 "Osprey"', 'RIB 3 "Pelican"', 'Whaler 4', 'Whaler 5', 'RIB 2 "Heron"']
  const coachPools: Record<string, string[]> = {
    lts: ['c-ava', 'c-ruby', 'c-grace', 'c-nora'],
    'green-camp': ['c-maya', 'c-noah', 'c-tessa', 'c-marcus'],
    'rwb-camp': ['c-maya', 'c-liam', 'c-chloe'],
    '420-camp': ['c-eli', 'c-sam'],
    'ilca-camp': ['c-owen'],
    'green-team': ['c-maya', 'c-grace'],
    'rwb-team': ['c-liam', 'c-chloe'],
    '420-team': ['c-eli', 'c-sam'],
    'ilca-team': ['c-owen'],
  }
  for (const session of sessions.filter((x) => x.termId === 'summer-27' || x.termId === 'fall-27')) {
    const program = programById.get(session.programId)!
    const roster = rosterOf(session.id).map((sid) => sailors.find((s) => s.id === sid)!)
    if (!roster.length) continue
    const pool = coachPools[program.id].map(coach)
    groups.push(...autoGroups(session, program, roster, pool, () => id('g'), ribs))
  }
  // Put the personas with the coaches the story needs.
  const moveTo = (sailorId: string, sessionId: string, coachId: string) => {
    const list = groups.filter((g) => g.sessionId === sessionId)
    const target = list.find((g) => g.coachIds.includes(coachId))
    if (!target) return
    list.forEach((g) => (g.sailorIds = g.sailorIds.filter((x) => x !== sailorId)))
    target.sailorIds.push(sailorId)
  }
  moveTo('s-hazel', 'green-camp-w4', 'c-maya')
  moveTo('s-hazel', 'green-camp-w5', 'c-maya')
  moveTo('s-finn', 'rwb-camp-w5', 'c-liam')
  moveTo('s-finn', 'rwb-camp-w3', 'c-liam')
  moveTo('s-lucy', '420-camp-w5', 'c-eli')
  // Next week one Learn to Sail group is still short a coach.
  const ltsNext = groups.filter((g) => g.sessionId === weekId('lts', currentWeek + 1))
  if (ltsNext.length > 1) ltsNext[ltsNext.length - 1].coachIds = []

  const groupOf = (sessionId: string, sailorId: string) => groups.find((g) => g.sessionId === sessionId && g.sailorIds.includes(sailorId))
  const mayaGreen = groups.find((g) => g.sessionId === weekId('green-camp') && g.coachIds.includes('c-maya'))!
  const mayaRace = groups.find((g) => g.sessionId === weekId('rwb-camp') && g.coachIds.includes('c-maya'))!
  const liamRace = groups.find((g) => g.sessionId === weekId('rwb-camp') && g.coachIds.includes('c-liam'))!
  const eli420 = groups.find((g) => g.sessionId === weekId('420-camp') && g.coachIds.includes('c-eli'))!
  const kidIn = (g: Group, skip: string[] = []) => g.sailorIds.find((x) => !personas.has(x) && !skip.includes(x))!
  const absentKid = kidIn(mayaGreen)
  const retestKid = kidIn(mayaGreen, [absentKid])
  const earlyKid = kidIn(mayaRace)
  const fridayKid = kidIn(liamRace)
  const sailorById = new Map(sailors.map((s) => [s.id, s]))
  const kidName = (sid: string) => sailorById.get(sid)!.firstName
  const guardianOf = (sid: string) => familyById.get(sailorById.get(sid)!.familyId)!.guardians[0]

  /* ───────────── Form submissions ───────────── */
  const submissions: FormSubmission[] = []
  const activeIds = new Set(registrations.filter((r) => r.status !== 'cancelled').map((r) => r.sailorId))
  const signedPhoto = new Set<string>()
  for (const s of sailors) {
    if (!activeIds.has(s.id)) continue
    const fam = familyById.get(s.familyId)!
    const guardian = fam.guardians[0].name
    const inCampNow = registrations.some((r) => r.sailorId === s.id && r.status === 'confirmed' && r.sessionId.endsWith(`-w${currentWeek}`))
    const diligent = inCampNow ? chance(0.9) : chance(0.7)
    for (const t of FORM_TEMPLATES) {
      if (s.id === 's-hazel' && t.id === 'medical') continue
      if (t.scope === 'family') {
        if (signedPhoto.has(fam.id)) continue
        if (!diligent && chance(0.5)) continue
        signedPhoto.add(fam.id)
      } else if (!diligent && chance(0.4) && !personas.has(s.id)) continue
      const values: Record<string, string> = {}
      if (t.id === 'medical') {
        values.allergies = s.medicalAlerts.join('; ') || 'None'
        values.medications = s.medicalAlerts.some((a) => a.includes('Asthma')) ? 'Albuterol inhaler as needed' : 'None'
        values.conditions = s.medicalAlerts.some((a) => a.includes('diabetes')) ? 'Type 1 diabetes. CGM alerts go to parent phone.' : ''
        values.emergencyName = `${pick(PARENT_NAMES)} ${pick(SURNAMES)} (family friend)`
        values.emergencyPhone = `(843) 555-${(3000 + submissions.length).toString().slice(-4)}`
        values.physician = 'East Cooper Pediatrics (843) 555-0110'
        values.insurance = pick(['BlueCross BlueShield SC', 'Aetna', 'Cigna', 'UnitedHealthcare'])
      }
      if (t.id === 'swim') {
        values.result = pick(t.fields[0].kind === 'choice' ? t.fields[0].options.slice(0, 2) : [''])
        values.testedOn = iso(subDays(now, 30 + Math.floor(rand() * 300)))
      }
      if (t.id === 'photo') values.consent = chance(0.88) ? 'Yes, photos are fine' : 'No photos of my children, please'
      submissions.push({
        id: id('fs'),
        templateId: t.id,
        familyId: fam.id,
        sailorId: t.scope === 'sailor' ? s.id : undefined,
        season: DEFAULT_SETTINGS.season,
        signedBy: guardian,
        signedAt: new Date(new Date('2027-01-20T12:00:00').getTime() + rand() * 150 * 86400000).toISOString(),
        values,
      })
    }
  }

  /* ───────────── Announcements ───────────── */
  const ann = (daysAgo: number, hhmm: string, a: Omit<Announcement, 'id' | 'sentAt' | 'opened'>): Announcement => ({
    ...a,
    id: id('a'),
    sentAt: at(iso(subDays(now, daysAgo)), hhmm),
    opened: Math.round(a.recipients * (0.7 + rand() * 0.25)),
  })
  const announcements: Announcement[] = [
    ann(0, '07:30', {
      title: 'Morning camps are on',
      body: 'SW 8–10 knots, 84°F. Learn to Sail and Opti Green are on as scheduled. Sunscreen on before drop-off and a full water bottle, please.',
      category: 'weather',
      audience: { kind: 'program', programId: 'green-camp' },
      channels: ['push', 'email'],
      sentBy: director,
      recipients: 38,
    }),
    ann(1, '15:05', {
      title: 'Lightning: afternoon groups are coming in',
      body: 'Lightning was reported 9 miles west. Every afternoon group is heading in now and will wait it out in the junior shed. Pickup is unchanged. Everyone is safe and ashore.',
      category: 'weather',
      urgent: true,
      audience: { kind: 'everyone' },
      channels: ['push', 'sms', 'email'],
      sentBy: director,
      recipients: 61,
    }),
    ann(2, '18:10', {
      title: 'Week 5: what to bring',
      body: 'Life jacket with your name on it, water bottle, sunscreen, hat, a snack and a dry change of clothes. Afternoon groups: eat lunch before you arrive. Friday is race day for every group, so families are welcome on the seawall from 11:00 (mornings) and 3:00 (afternoons).',
      category: 'general',
      audience: { kind: 'everyone' },
      channels: ['push', 'email'],
      sentBy: director,
      recipients: 64,
    }),
    ann(3, '16:30', {
      title: 'Coach meeting Friday 8:15 AM',
      body: 'Quick meeting in the junior shed before morning camps: Harbor Island regatta plan, the afternoon lightning procedure, and evaluations for week 5.',
      category: 'schedule',
      audience: { kind: 'staff' },
      channels: ['push', 'sms'],
      sentBy: director,
      recipients: 13,
    }),
    ann(4, '09:15', {
      title: 'Harbor Island Green Fleet Regatta, Tue Jul 20',
      body: 'Green fleet sailors are invited to race at Harbor Island YC next Tuesday. Tap Going or Interested in the app so the coaches can plan boats and chaperones, and sign the permission slip by Friday.',
      category: 'schedule',
      audience: { kind: 'program', programId: 'green-camp' },
      channels: ['push', 'email'],
      sentBy: 'Maya Ortiz',
      recipients: 31,
    }),
    ann(6, '10:00', {
      title: 'Reminder: medical forms before camp',
      body: 'A few sailors still need a 2027 medical form. Coaches can’t see allergies or emergency contacts until it’s in. It takes about three minutes in the app.',
      category: 'reminder',
      audience: { kind: 'outstanding-forms' },
      channels: ['push', 'email'],
      sentBy: director,
      recipients: 14,
    }),
    ann(13, '08:00', {
      title: 'Fall 2027 team registration is open for members',
      body: 'Fall race teams start September 7. Member registration is open now through July 31; everyone else can sign up August 1. Early-bird pricing runs through August 15.',
      category: 'general',
      audience: { kind: 'everyone' },
      channels: ['email'],
      sentBy: director,
      recipients: 71,
    }),
  ]

  /* ───────────── Activity feed ───────────── */
  const sessionById = new Map(sessions.map((s) => [s.id, s]))
  const events: ActivityEvent[] = registrations
    .filter((r) => new Date(r.createdAt) <= now)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 25)
    .map((r) => {
      const s = sailorById.get(r.sailorId)!
      const se = sessionById.get(r.sessionId)!
      const p = programById.get(se.programId)!
      const kind: ActivityEvent['kind'] = r.status === 'waitlisted' ? 'waitlisted' : r.status === 'offered' ? 'offered' : 'registered'
      const verb = kind === 'waitlisted' ? 'joined the waitlist for' : kind === 'offered' ? 'was offered a spot in' : 'signed up for'
      return { id: id('e'), at: r.createdAt, kind, text: `${s.firstName} ${s.lastName} ${verb} ${p.name} · ${se.name}` }
    })

  /* ───────────── Parent notes & pickups ───────────── */
  for (const k of sailors) {
    const fam = familyById.get(k.familyId)!
    if (k.id === 's-finn') {
      k.parentNote = { text: 'Finn is working on his starts and loves the competitive drills. He can get frustrated after a bad race; a quick word from a coach helps him reset.', updatedAt: subDays(now, 40).toISOString(), by: 'Sarah Calloway' }
      continue
    }
    if (k.id === 's-hazel') {
      k.parentNote = { text: 'Hazel is still a little nervous about capsizing and does best with a buddy boat nearby.', updatedAt: subDays(now, 12).toISOString(), by: 'Sarah Calloway' }
      k.authorizedPickups = ['Lou Calloway (grandmother)']
      continue
    }
    if (k.id === 's-lucy') {
      k.parentNote = { text: 'Lucy crews for Tess in the fall. Happy to skipper in camp if the coaches want.', updatedAt: subDays(now, 20).toISOString(), by: 'Carmen Reyes' }
      continue
    }
    if (chance(0.3)) k.parentNote = { text: pick(NOTES), updatedAt: subDays(now, Math.floor(rand() * 60)).toISOString(), by: fam.guardians[0].name }
    if (chance(0.35)) k.authorizedPickups = [`${pick(PARENT_NAMES)} ${pick([fam.name, pick(SURNAMES)])} (${pick(PICKUPS).toLowerCase()})`]
  }

  /* ───────────── Swim checks ───────────── */
  const swimChecks: SwimCheck[] = []
  for (const sub of submissions.filter((x) => x.templateId === 'swim')) {
    if (sub.sailorId === retestKid || sub.sailorId === 's-hazel') continue
    swimChecks.push({
      sailorId: sub.sailorId!,
      result: 'passed',
      date: iso(subDays(now, 20 + Math.floor(rand() * 40))),
      by: sub.values.result?.includes('at the Club') ? pick(['Maya Ortiz', 'Liam Becker', 'Ava Thornton']) : 'Certificate on file',
    })
  }
  swimChecks.push({ sailorId: 's-hazel', result: 'passed', date: '2027-07-06', by: 'Maya Ortiz' })
  swimChecks.push({
    sailorId: retestKid,
    result: 'not-passed',
    date: iso(subDays(now, 2)),
    by: 'Maya Ortiz',
    note: 'Treaded water for 1 minute of 2. Retest Wednesday morning at the dock.',
  })

  /* ───────────── Day notes from parents ───────────── */
  const dayNotes: DayNote[] = [
    { id: id('dn'), sailorId: absentKid, date: today, kind: 'absent', note: 'Dentist appointment this morning. Back tomorrow!', by: guardianOf(absentKid).name, at: at(today, '07:12') },
    { id: id('dn'), sailorId: 's-hazel', date: today, kind: 'pickup', detail: 'Lou Calloway (grandmother)', note: 'Lou will be at the dock at noon.', by: 'Sarah Calloway', at: at(iso(yesterday), '20:41') },
    { id: id('dn'), sailorId: earlyKid, date: today, kind: 'early', detail: '3:15 PM', note: 'Orthodontist. I’ll come down to the dock.', by: guardianOf(earlyKid).name, at: at(today, '08:02') },
    { id: id('dn'), sailorId: fridayKid, date: iso(addDays(now, 2)), kind: 'absent', note: 'Family wedding on Friday.', by: guardianOf(fridayKid).name, at: at(iso(yesterday), '19:15') },
  ]

  /* ───────────── Attendance: earlier weeks plus Monday and Tuesday ───────────── */
  const attendance: Record<string, AttendanceEntry> = {}
  const coachOf = (sessionId: string, sailorId: string) => coaches.find((c) => c.id === groupOf(sessionId, sailorId)?.coachIds[0])?.name ?? 'Coach'
  const record = (session: Session, sid: string, date: string, entry: Partial<AttendanceEntry> & { status: AttendanceEntry['status'] }) => {
    attendance[attendanceKey(date, session.id, sid)] = { sailorId: sid, sessionId: session.id, date, updatedAt: at(date, '12:00'), by: coachOf(session.id, sid), ...entry }
  }
  for (const session of sessions.filter((s) => s.termId === 'summer-27' && s.startDate <= today)) {
    const pm = programById.get(session.programId)!.slot === 'PM'
    const dates = practiceDates(session, yesterday)
    for (const sid of rosterOf(session.id)) {
      const fam = familyById.get(sailorById.get(sid)!.familyId)!
      dates.forEach((date) => {
        const absent = !chance(0.95)
        record(session, sid, date, absent
          ? { status: 'absent', updatedAt: at(date, pm ? '13:10' : '09:10') }
          : { status: 'picked-up', updatedAt: at(date, pm ? '16:08' : '12:06'), launchedAt: at(date, pm ? '13:25' : '09:35'), pickedUpBy: fam.guardians[Math.floor(rand() * fam.guardians.length)].name })
      })
    }
  }
  // Today so far.
  for (const session of sessions.filter((s) => s.termId === 'summer-27' && meetsOn(s, now))) {
    const pm = programById.get(session.programId)!.slot === 'PM'
    if (pm && !afternoon) continue
    for (const sid of rosterOf(session.id)) {
      const note = dayNotes.find((d) => d.sailorId === sid && d.date === today)
      if (note?.kind === 'absent') {
        record(session, sid, today, { status: 'absent', updatedAt: note.at, by: `${note.by} (parent)` })
        continue
      }
      if (!pm && afternoon) {
        const fam = familyById.get(sailorById.get(sid)!.familyId)!
        record(session, sid, today, {
          status: 'picked-up',
          updatedAt: at(today, '12:07'),
          launchedAt: at(today, '09:38'),
          pickedUpBy: note?.kind === 'pickup' ? note.detail : fam.guardians[0].name,
        })
        continue
      }
      if (sid === retestKid) {
        record(session, sid, today, { status: 'present', updatedAt: at(today, '08:56') })
        continue
      }
      record(session, sid, today, { status: 'on-water', updatedAt: at(today, pm ? '13:24' : '09:38'), launchedAt: at(today, pm ? '13:24' : '09:38') })
    }
  }

  /* ───────────── Forms already pushed to families ───────────── */
  const greenNow = rosterOf(weekId('green-camp'))
  const greenFamilies = [...new Set(greenNow.map((sid) => sailorById.get(sid)!.familyId))]
  const formRequests: FormRequest[] = [
    {
      id: 'req-harbor-island',
      templateId: PERMISSION_SLIP.id,
      familyIds: greenFamilies,
      sailorIds: greenNow,
      audienceLabel: `Opti Green Camp week ${currentWeek} families`,
      dueDate: iso(addDays(now, 2)),
      message: 'Please sign the permission slip for the Harbor Island Green Fleet Regatta on Tuesday, July 20 so your sailor can race.',
      channels: ['push', 'email'],
      sentAt: at(iso(subDays(now, 4)), '09:20'),
      sentBy: 'Maya Ortiz',
    },
  ]
  for (const sid of greenNow.filter((x) => x !== 's-hazel')) {
    if (!chance(0.6)) continue
    const fam = familyById.get(sailorById.get(sid)!.familyId)!
    submissions.push({
      id: id('fs'),
      templateId: PERMISSION_SLIP.id,
      familyId: fam.id,
      sailorId: sid,
      season: DEFAULT_SETTINGS.season,
      signedBy: fam.guardians[0].name,
      signedAt: subDays(now, Math.floor(rand() * 4)).toISOString(),
      values: { lunch: pick(['Packing a lunch', 'Ordering the club box lunch ($12)']), pickup: fam.guardians[0].name },
    })
  }

  /* ───────────── Documents ───────────── */
  const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const documents: ClubDocument[] = []
  for (const c of coaches) {
    for (const cert of c.certs) {
      // A couple of renewals were recorded without the card being uploaded.
      if ((c.id === 'c-owen' && cert.certTypeId === 'pwr') || (c.id === 'c-grace' && cert.certTypeId === 'fa')) continue
      const ct = CERT_TYPES.find((x) => x.id === cert.certTypeId)!
      const img = chance(0.4)
      documents.push({
        id: id('doc'),
        title: ct.name,
        kind: 'certification',
        coachId: c.id,
        certTypeId: ct.id,
        fileName: `${slug(c.name)}-${slug(ct.name)}.${img ? 'jpg' : 'pdf'}`,
        mime: img ? 'image/jpeg' : 'application/pdf',
        sizeBytes: Math.floor(180_000 + rand() * 900_000),
        uploadedAt: new Date(`${cert.issued}T15:00:00`).toISOString(),
        uploadedBy: chance(0.6) ? c.name : director,
        expires: cert.expires,
        sample: true,
      })
    }
  }
  const clubDocs: [string, string, string][] = [
    ['Emergency Action Plan 2027', 'Who calls 911, where the AED is, launch-area evacuation, lightning procedure and the coach-boat radio channel.', 'emergency-action-plan-2027.pdf'],
    ['Junior Program Handbook', 'Program levels, daily schedule, what to bring, pickup rules and the parent code of conduct.', 'junior-program-handbook.pdf'],
    ['Coach Code of Conduct', 'Signed by every coach each season. SafeSport-aligned rules on one-on-one contact and messaging.', 'coach-code-of-conduct.pdf'],
    ['Weather & Lightning Policy', 'Wind and lightning limits by fleet, the 30-minute rule, and who makes the call.', 'weather-lightning-policy.pdf'],
    ['Coach Boat & Launch Checklist', 'Daily pre-launch checks for RIBs and Whalers: kill cord, fuel, radio, first aid kit.', 'coach-boat-checklist.pdf'],
    ['Concussion Protocol', 'Signs to watch for, removal from activity, and return-to-sail steps.', 'concussion-protocol.pdf'],
    ['Certificate of Insurance 2027', 'Club liability coverage for junior programs and regattas.', 'certificate-of-insurance-2027.pdf'],
  ]
  clubDocs.forEach(([title, description, fileName], i) =>
    documents.push({
      id: id('doc'),
      title,
      kind: 'club',
      fileName,
      mime: 'application/pdf',
      sizeBytes: Math.floor(220_000 + rand() * 1_600_000),
      uploadedAt: subDays(now, 40 + i * 9).toISOString(),
      uploadedBy: director,
      description,
      sample: true,
    })
  )

  /* ───────────── Calendar ───────────── */
  const calendar: ClubEvent[] = [
    { id: id('ev'), title: 'Parent night: sunset sail and dock party', kind: 'social', date: iso(addDays(now, 1)), time: '6:00 PM', location: 'Junior dock' },
    { id: id('ev'), title: 'Friday race day, every group', kind: 'training', date: iso(addDays(now, 2)), time: 'Mornings 10:30, afternoons 2:30', location: 'Inner harbor', notes: 'Families welcome on the seawall.' },
    { id: id('ev'), title: 'Harbor Island permission slips due', kind: 'deadline', date: iso(addDays(now, 2)), programIds: ['green-camp'] },
    { id: id('ev'), title: 'Coach meeting', kind: 'meeting', date: iso(addDays(now, 2)), time: '8:15 AM', location: 'Junior shed' },
    { id: id('ev'), title: 'Harbor Island Green Fleet Regatta', kind: 'regatta', date: '2027-07-20', time: 'Launch 9:30 AM, first warning 11:00', location: 'Harbor Island YC', programIds: ['green-camp'] },
    { id: id('ev'), title: 'Lowcountry Opti Championship', kind: 'regatta', date: '2027-07-24', endDate: '2027-07-25', time: 'Both days 10:00 AM', location: 'Bayside Sailing Association', programIds: ['rwb-camp', 'rwb-team'] },
    { id: id('ev'), title: 'Junior committee meeting', kind: 'meeting', date: '2027-07-27', time: '7:00 PM', location: 'Club library' },
    { id: id('ev'), title: 'Junior 420 Championship', kind: 'regatta', date: '2027-07-31', endDate: '2027-08-01', time: 'First warning 11:00 AM', location: 'Saltmarsh Bay YC', programIds: ['420-camp', '420-team'] },
    { id: id('ev'), title: 'Fall registration opens to everyone', kind: 'deadline', date: '2027-08-01' },
    { id: id('ev'), title: 'Last day of summer camps', kind: 'deadline', date: '2027-08-06' },
    { id: id('ev'), title: 'Junior awards banquet', kind: 'social', date: '2027-08-07', time: '6:00 PM', location: 'Club lawn' },
    { id: id('ev'), title: 'Coach First Aid & CPR recertification', kind: 'training', date: '2027-08-09', time: '9:00 AM – 1:00 PM', location: 'Club ballroom', notes: 'Maya and Ruby need this one.' },
    { id: id('ev'), title: 'Fall early-bird pricing ends', kind: 'deadline', date: '2027-08-15' },
    { id: id('ev'), title: 'Fall teams start', kind: 'training', date: '2027-09-07', programIds: ['green-team', 'rwb-team', '420-team', 'ilca-team'] },
    { id: id('ev'), title: 'Fall Frostbite #1', kind: 'regatta', date: '2027-10-02', time: 'First warning 11:00 AM', location: 'Saltmarsh Bay YC', programIds: ['green-team', 'rwb-team'] },
  ]

  /* ───────────── Incidents ───────────── */
  const ltsNow = rosterOf(weekId('lts'))
  const raceNow = rosterOf(weekId('rwb-camp'))
  const c420Now = rosterOf(weekId('420-camp'))
  const incidents: Incident[] = [
    {
      id: id('inc'),
      at: at(iso(yesterday), '15:05'),
      sailorIds: [],
      type: 'weather',
      severity: 'moderate',
      description: 'Lightning reported 9 miles west. All afternoon groups (Race and 420 camps) brought in and held in the junior shed for 35 minutes.',
      actionTaken: 'Every sailor accounted for ashore by 3:14 PM. Families texted at 3:05. Racing resumed at 3:45 for a short session.',
      parentsNotified: true,
      notifiedHow: 'Urgent text to all families',
      reportedBy: director,
      status: 'closed',
    },
    {
      id: id('inc'),
      at: at(iso(yesterday), '10:20'),
      sessionId: weekId('lts'),
      sailorIds: ltsNow.slice(0, 2),
      type: 'near-miss',
      severity: 'minor',
      description: 'Two Learn to Sail boats drifted onto the moored launch while practicing stops. Light contact, no damage.',
      actionTaken: 'Moved the stopping drill 50 yards off the mooring field. Will brief all LTS coaches Friday.',
      parentsNotified: false,
      reportedBy: 'Ava Thornton',
      status: 'open',
    },
    {
      id: id('inc'),
      at: at(iso(subDays(now, 2)), '14:40'),
      sessionId: weekId('420-camp'),
      sailorIds: c420Now.filter((x) => x !== 's-lucy').slice(1, 3),
      type: 'capsize-rescue',
      severity: 'minor',
      description: 'Turtled in a puff during a spinnaker gybe; crew couldn’t right the boat after two tries.',
      actionTaken: 'Coach boat helped right the boat within two minutes. Both sailors fine and finished practice.',
      parentsNotified: true,
      notifiedHow: 'Spoke with parents at pickup',
      reportedBy: 'Eli Navarro',
      status: 'closed',
    },
    {
      id: id('inc'),
      at: at(iso(subDays(now, 5)), '13:50'),
      sessionId: weekId('rwb-camp', currentWeek - 1),
      sailorIds: raceNow.filter((x) => x !== 's-finn').slice(3, 4),
      type: 'injury',
      severity: 'minor',
      description: 'Bumped head on the boom during a roll tack.',
      actionTaken: 'Ice pack, sat out 20 minutes, watched for concussion signs per protocol. No symptoms.',
      parentsNotified: true,
      notifiedHow: 'Call at 2:05 PM',
      reportedBy: 'Chloe Mercer',
      status: 'closed',
    },
    {
      id: id('inc'),
      at: at(iso(subDays(now, 3)), '09:50'),
      sailorIds: [],
      type: 'equipment',
      severity: 'moderate',
      description: 'RIB 2 "Heron" outboard stalled twice at idle while towing Optis out.',
      actionTaken: 'Whaler 5 covered the group. RIB 2 tagged out until the mechanic visit.',
      parentsNotified: false,
      reportedBy: 'Owen Pryce',
      status: 'open',
    },
  ]

  /* ───────────── Boats & equipment ───────────── */
  const fleet: Boat[] = []
  const inspected = () => iso(subDays(now, 2 + Math.floor(rand() * 20)))
  for (let k = 1; k <= 24; k++)
    fleet.push({ id: id('b'), kind: 'Opti', name: `Opti #${2100 + k}`, status: 'ready', assignedTo: k <= 14 ? 'Learn to Sail and Green camps (AM)' : 'Opti Race Camp (PM)', lastInspected: inspected() })
  for (let k = 11; k <= 18; k++)
    fleet.push({ id: id('b'), kind: 'Club 420', name: `C420 #${k}`, status: 'ready', assignedTo: 'Club 420 Camp (PM)', lastInspected: inspected() })
  for (let k = 1; k <= 6; k++)
    fleet.push({ id: id('b'), kind: 'ILCA', name: `ILCA #${k}`, status: 'ready', assignedTo: 'ILCA Camp (PM)', lastInspected: inspected() })
  ;[
    ['RIB', 'RIB 1 "Osprey"'],
    ['RIB', 'RIB 2 "Heron"'],
    ['RIB', 'RIB 3 "Pelican"'],
    ['Whaler', 'Whaler 4'],
    ['Whaler', 'Whaler 5'],
  ].forEach(([kind, name]) => fleet.push({ id: id('b'), kind: kind as Boat['kind'], name, status: 'ready', assignedTo: 'Coach boat', lastInspected: iso(subDays(now, 1 + Math.floor(rand() * 5))) }))
  const fix = (name: string, status: Boat['status'], issue: string) => Object.assign(fleet.find((b) => b.name === name)!, { status, issue })
  fix('Opti #2104', 'needs-repair', 'Daggerboard trunk cracked at the top edge')
  fix('Opti #2117', 'needs-repair', 'Sail torn along the luff, sent to the loft')
  fix('Opti #2122', 'out-of-service', 'Hull crack below the waterline, awaiting fiberglass repair')
  fix('C420 #15', 'needs-repair', 'Spinnaker halyard frayed')
  fix('RIB 2 "Heron"', 'out-of-service', 'Outboard stalls at idle. Mechanic booked for Friday.')

  /* ───────────── Regattas: details and family responses ───────────── */
  const evByTitle = (t: string) => calendar.find((e) => e.title === t)!
  const regattas: RegattaDetails[] = [
    { eventId: evByTitle('Harbor Island Green Fleet Regatta').id, levels: ['opti-green'], entryDeadline: iso(addDays(now, 2)), entryFee: 40, entryUrl: 'https://www.regattanetwork.com', coachIds: ['c-maya', 'c-tessa'], chaperonesNeeded: 2, travel: 'Optis go over on the club trailer Monday night. Families drive (25 minutes) and meet at the Harbor Island dock at 8:45.' },
    { eventId: evByTitle('Lowcountry Opti Championship').id, levels: ['opti-red', 'opti-white', 'opti-blue'], entryDeadline: '2027-07-19', entryFee: 85, entryUrl: 'https://www.regattanetwork.com', coachIds: ['c-liam', 'c-maya'], chaperonesNeeded: 3, travel: 'Trailer leaves Friday at 5 PM. Families arrange their own rides.' },
    { eventId: evByTitle('Junior 420 Championship').id, levels: ['club-420'], entryDeadline: '2027-07-26', entryFee: 110, entryUrl: 'https://www.regattanetwork.com', coachIds: ['c-eli'], chaperonesNeeded: 2, travel: 'Home regatta. Boats launch from our dock.' },
    { eventId: evByTitle('Fall Frostbite #1').id, levels: ['opti-green', 'opti-red', 'opti-white', 'opti-blue'], coachIds: ['c-maya', 'c-liam'], chaperonesNeeded: 2 },
  ]
  const regattaResponses: RegattaResponse[] = []
  const respond = (eventId: string, sailorId: string, when: Date, odds: { going: number; interested: number }) => {
    const r = rand()
    const status: RegattaResponse['status'] | undefined = r < odds.going ? 'going' : r < odds.going + odds.interested ? 'interested' : r < odds.going + odds.interested + 0.08 ? 'not-going' : undefined
    if (!status) return
    const fam = familyById.get(sailorById.get(sailorId)!.familyId)!
    regattaResponses.push({ eventId, sailorId, status, chaperone: status === 'going' && chance(0.12), updatedAt: when.toISOString(), by: fam.guardians[0].name })
  }
  const uniq = (ids: string[]) => [...new Set(ids)]
  for (const sid of uniq([...greenNow, ...rosterOf(weekId('green-camp', currentWeek + 1))]).filter((x) => x !== 's-hazel'))
    respond(regattas[0].eventId, sid, subDays(now, Math.floor(rand() * 4)), { going: 0.5, interested: 0.2 })
  for (const sid of uniq([...raceNow, ...rosterOf(weekId('rwb-camp', currentWeek + 1)), ...rosterOf('rwb-team-fall-27')]).filter((x) => x !== 's-finn'))
    respond(regattas[1].eventId, sid, subDays(now, 1 + Math.floor(rand() * 8)), { going: 0.45, interested: 0.25 })
  for (const sid of uniq([...c420Now, ...rosterOf('420-team-fall-27')]).filter((x) => x !== 's-lucy'))
    respond(regattas[2].eventId, sid, subDays(now, Math.floor(rand() * 6)), { going: 0.4, interested: 0.3 })
  regattaResponses.push({ eventId: regattas[1].eventId, sailorId: 's-finn', status: 'going', updatedAt: subDays(now, 3).toISOString(), by: 'Sarah Calloway' })
  regattaResponses.push({ eventId: regattas[2].eventId, sailorId: 's-lucy', status: 'interested', note: 'Want to sail with Tess if she goes.', updatedAt: subDays(now, 1).toISOString(), by: 'Lucy Reyes' })

  /* ───────────── Practice day: calls, plans, boats ───────────── */
  const campToday = sessions.filter((x) => x.termId === 'summer-27' && meetsOn(x, now))
  const slotOf = (x: Session) => programById.get(x.programId)!.slot
  const practiceCalls: PracticeCall[] = [
    ...campToday
      .filter((x) => slotOf(x) === 'AM')
      .map((x) => ({ sessionId: x.id, date: today, status: 'on' as const, note: 'SW 8–10 knots, 84°F. Sunscreen and a full water bottle.', postedAt: at(today, '07:30'), by: director })),
    ...(afternoon
      ? campToday
          .filter((x) => slotOf(x) === 'PM')
          .map((x) => ({ sessionId: x.id, date: today, status: 'on' as const, note: 'Storms possible after 3:30. If there’s lightning within 10 miles we bring everyone in and you’ll get a text.', postedAt: at(today, '12:05'), by: director }))
      : []),
    // Yesterday, for the record.
    ...campToday.map((x) => ({
      sessionId: x.id,
      date: iso(yesterday),
      status: 'on' as const,
      note: slotOf(x) === 'PM' ? 'Building sea breeze, 12–15 knots.' : 'Light and shifty, 5–8 knots.',
      postedAt: at(iso(yesterday), slotOf(x) === 'PM' ? '12:00' : '07:30'),
      by: director,
    })),
  ]
  const plan = (sessionId: string, groupId: string | undefined, libId: string, by: string, notes?: string): LessonPlan => {
    const lib = LESSON_LIBRARY.find((l) => l.id === libId)!
    return { id: id('lp'), sessionId, groupId, date: today, title: lib.title, focus: lib.focus, blocks: lib.blocks, skillIds: lib.skillIds, notes, by, updatedAt: at(iso(yesterday), '19:30') }
  }
  const lessonPlans: LessonPlan[] = [
    plan(weekId('lts'), undefined, 'lts-morning', 'Ava Thornton', 'Stopping drill stays 50 yards off the moorings after yesterday’s near-miss.'),
    plan(weekId('green-camp'), undefined, 'green-morning', 'Maya Ortiz', `Harbor Island is next Tuesday, so everyone should leave today able to time a start. ${kidName(retestKid)} retests the swim check at the dock first thing. Hazel sails with a buddy boat.`),
    plan(weekId('rwb-camp'), mayaRace.id, 'race-afternoon', 'Maya Ortiz', 'Storms possible after 3:30. Stay inside the harbor and keep the fleet tight.'),
    plan(weekId('rwb-camp'), liamRace.id, 'starts', 'Liam Becker', 'Lowcountry Champs is next weekend. Starts, starts, starts.'),
    plan(weekId('420-camp'), eli420.id, 'race-afternoon', 'Eli Navarro', 'Spinnaker sets at the windward mark until they’re clean.'),
  ]
  const optis = fleet.filter((b) => b.kind === 'Opti' && b.status !== 'out-of-service')
  const c420s = fleet.filter((b) => b.kind === 'Club 420' && b.status === 'ready')
  const coachBoats = fleet.filter((b) => (b.kind === 'RIB' || b.kind === 'Whaler') && b.status === 'ready')
  const boatAssignments: BoatAssignments[] = []
  const assign = (sessionId: string, pool: Boat[], ownShare: number, perBoat = 1) => {
    const a: BoatAssignments = { sessionId, sailors: {}, coaches: {} }
    let i = 0
    for (const sid of rosterOf(sessionId)) {
      if (perBoat === 1 && chance(ownShare)) a.sailors[sid] = 'own'
      else {
        const boat = pool[Math.floor(i / perBoat) % pool.length]
        if (boat) a.sailors[sid] = boat.id
        i++
      }
    }
    const coachIds = [...new Set(groups.filter((g) => g.sessionId === sessionId).flatMap((g) => g.coachIds))]
    coachIds.forEach((cid, k) => {
      const boat = coachBoats[k % coachBoats.length]
      if (boat) a.coaches[cid] = boat.id
    })
    boatAssignments.push(a)
  }
  assign(weekId('lts'), optis.slice(0, 7), 0)
  assign(weekId('green-camp'), optis.slice(7, 13), 0.5)
  assign(weekId('rwb-camp'), optis.slice(13), 0.75)
  assign(weekId('420-camp'), c420s, 0, 2)

  /* ───────────── Progress: skills and evaluations ───────────── */
  const skillMarks: SkillMark[] = []
  const evaluations: Evaluation[] = []
  const thisWeek = [weekId('lts'), weekId('green-camp'), weekId('rwb-camp'), weekId('420-camp')]
  const seen = new Set<string>()
  for (const sessionId of thisWeek) {
    for (const sid of rosterOf(sessionId)) {
      if (seen.has(sid)) continue
      seen.add(sid)
      const coachName = coachOf(sessionId, sid)
      const list = SKILLS.filter((x) => x.track === trackFor(sailorById.get(sid)!.level))
      const got = sid === 's-hazel' ? 4 : sid === 's-finn' ? 5 : sid === 's-lucy' ? 6 : Math.floor(1 + rand() * 6)
      list.forEach((sk, i) => {
        if (i < got) skillMarks.push({ sailorId: sid, skillId: sk.id, status: 'got-it', date: iso(subDays(now, 2 + Math.floor(rand() * 30))), by: coachName })
        else if (i === got) skillMarks.push({ sailorId: sid, skillId: sk.id, status: 'working', date: iso(subDays(now, Math.floor(rand() * 3))), by: coachName })
        else if (i === got + 1 && chance(0.6)) skillMarks.push({ sailorId: sid, skillId: sk.id, status: 'introduced', date: iso(subDays(now, Math.floor(rand() * 3))), by: coachName })
      })
    }
  }
  const lastFriday = iso(subDays(now, 5))
  evaluations.push(
    {
      id: id('evl'),
      sailorId: 's-hazel',
      sessionId: weekId('green-camp', currentWeek - 1),
      coachId: 'c-maya',
      date: lastFriday,
      strengths: 'Hazel is a careful, steady sailor. She steers a straight line upwind and always knows where the next mark is.',
      workOn: 'Confidence when it’s breezy. She capsized and recovered on purpose twice this week with a buddy boat close by.',
      nextStep: 'Ready for her first Green Fleet regatta at Harbor Island.',
      status: 'shared',
      approvedBy: director,
      approvedAt: at(iso(subDays(now, 4)), '08:40'),
    },
    {
      id: id('evl'),
      sailorId: 's-finn',
      sessionId: 'rwb-camp-w3',
      coachId: 'c-liam',
      date: '2027-07-02',
      strengths: 'Finn’s boat handling has jumped this summer. His roll tacks are some of the cleanest in camp and he’s fast on reaches.',
      workOn: 'Starts. He tends to arrive at the line early and stall. We’re working on holding position and accelerating in the last five seconds.',
      nextStep: 'On track to move up to the Blue fleet for the fall team.',
      status: 'shared',
      approvedBy: director,
      approvedAt: at('2027-07-05', '09:10'),
    },
    {
      id: id('evl'),
      sailorId: 's-lucy',
      sessionId: '420-camp-w3',
      coachId: 'c-eli',
      date: '2027-07-02',
      strengths: 'Lucy is the calmest skipper in the 420 group. Her crew calls are clear and she reads puffs early.',
      workOn: 'Spinnaker gybes in breeze. She sometimes rushes the pole.',
      nextStep: 'Ready to skipper at the Junior 420 Championship.',
      status: 'shared',
      approvedBy: director,
      approvedAt: at('2027-07-05', '09:12'),
    }
  )
  // Last week's Race camp evaluations are waiting for the director.
  const raceLast = rosterOf(weekId('rwb-camp', currentWeek - 1)).filter((x) => !personas.has(x)).slice(0, 6)
  for (const sid of raceLast)
    evaluations.push({
      id: id('evl'),
      sailorId: sid,
      sessionId: weekId('rwb-camp', currentWeek - 1),
      coachId: 'c-chloe',
      date: lastFriday,
      strengths: pick(['Good speed upwind and works hard in drills.', 'Great attitude and the first one rigged every day.', 'Much more confident in the breeze than at the start of the week.']),
      workOn: pick(['Downwind angles and mark roundings.', 'Starting closer to the line.', 'Hiking hard all the way up the beat.']),
      nextStep: pick(['Keep building toward championship-fleet racing.', 'Ready for the Lowcountry Opti Championship.', 'Another week of camp would help a lot.']),
      status: 'pending',
    })
  // A couple of drafts from this week.
  for (const sid of mayaGreen.sailorIds.filter((x) => !personas.has(x)).slice(2, 4))
    evaluations.push({ id: id('evl'), sailorId: sid, sessionId: weekId('green-camp'), coachId: 'c-maya', date: today, strengths: 'Steady at the helm and a great buddy on the water.', workOn: 'Tacking without losing speed.', nextStep: '', status: 'draft' })

  /* ───────────── Conversations ───────────── */
  const msg = (from: string, name: string, text: string, when: string) => ({ id: id('m'), from, name, text, at: when })
  const delaney = families.find((f) => f.id === 'f-delaney')!
  const delaneyKid = sailors.find((k) => k.familyId === delaney.id)!
  const retestFam = familyById.get(sailorById.get(retestKid)!.familyId)!
  const whatToBring = announcements.find((a) => a.title.startsWith('Week 5'))!
  const ltsKid = ltsNow.find((x) => !personas.has(x)) ?? others[0].id
  const ltsFam = familyById.get(sailorById.get(ltsKid)!.familyId)!
  const threads: Thread[] = [
    {
      id: 'th-hazel-regatta',
      subject: 'Is Hazel ready for Harbor Island?',
      participants: ['family:f-calloway', 'coach:c-maya', 'director'],
      familyId: 'f-calloway',
      sailorId: 's-hazel',
      messages: [
        msg('family:f-calloway', 'Sarah Calloway', 'Hi Maya! Hazel keeps asking about the Harbor Island regatta but she’s nervous about racing away from home. Do you think she’s ready?', at(iso(yesterday), '19:52')),
        msg('coach:c-maya', 'Maya Ortiz', 'She’s ready! She timed two starts perfectly on Monday. Tessa and I will both be on the water and she can sail next to a buddy the whole time. I’d mark her as Interested and we can decide together Friday.', at(today, '08:14')),
      ],
      reads: { 'family:f-calloway': at(iso(yesterday), '19:52'), 'coach:c-maya': at(today, '08:14'), director: at(today, '08:30') },
    },
    {
      id: 'th-finn-note',
      subject: 'Great starts from Finn',
      participants: ['family:f-calloway', 'coach:c-liam'],
      familyId: 'f-calloway',
      sailorId: 's-finn',
      messages: [
        msg('coach:c-liam', 'Liam Becker', 'Quick note: Finn won two of the four starts this afternoon. The work on holding position is paying off.', at(iso(subDays(now, 2)), '16:20')),
        msg('family:f-calloway', 'Sarah Calloway', 'That made his whole week. Thank you, Liam!', at(iso(subDays(now, 2)), '18:02')),
      ],
      reads: { 'family:f-calloway': at(iso(subDays(now, 2)), '18:02'), 'coach:c-liam': at(iso(subDays(now, 2)), '18:30') },
    },
    {
      id: 'th-delaney-switch',
      subject: `Can ${delaneyKid.firstName} switch weeks?`,
      participants: [`family:${delaney.id}`, 'director'],
      familyId: delaney.id,
      sailorId: delaneyKid.id,
      messages: [
        msg(`family:${delaney.id}`, delaney.guardians[0].name, `We’re away the week of Jul 26. Is there any way ${delaneyKid.firstName} could move from week 7 to week 8?`, at(today, '07:48')),
      ],
      reads: { [`family:${delaney.id}`]: at(today, '07:48') },
    },
    {
      id: 'th-retest',
      subject: `${kidName(retestKid)}’s swim check`,
      participants: [`family:${retestFam.id}`, 'coach:c-maya'],
      familyId: retestFam.id,
      sailorId: retestKid,
      messages: [
        msg(`family:${retestFam.id}`, retestFam.guardians[0].name, `${kidName(retestKid)} is worried about the swim retest today. We practiced treading water at the pool last night and made it the full two minutes!`, at(today, '07:05')),
      ],
      reads: { [`family:${retestFam.id}`]: at(today, '07:05') },
    },
    {
      id: 'th-what-to-bring',
      subject: `Re: ${whatToBring.title}`,
      participants: [`family:${ltsFam.id}`, 'director'],
      familyId: ltsFam.id,
      announcementId: whatToBring.id,
      messages: [
        msg(`family:${ltsFam.id}`, ltsFam.guardians[0].name, 'Do the Learn to Sail kids need wetsuits or is a rash guard enough?', at(iso(subDays(now, 2)), '19:40')),
        msg('director', director, 'A rash guard is perfect in July. Wetsuits only come out in June and September.', at(iso(subDays(now, 2)), '20:15')),
      ],
      reads: { director: at(iso(subDays(now, 2)), '20:15'), [`family:${ltsFam.id}`]: at(iso(yesterday), '07:00') },
    },
    {
      id: 'th-lucy-crew',
      subject: 'Sailing with Tess this week',
      participants: ['sailor:s-lucy', 'family:f-reyes', 'coach:c-eli'],
      familyId: 'f-reyes',
      sailorId: 's-lucy',
      messages: [
        msg('sailor:s-lucy', 'Lucy Reyes', 'Hi Eli, could I skipper with Tess crewing for the rest of the week? We want to practice for the 420 Champs.', at(iso(yesterday), '17:10')),
        msg('coach:c-eli', 'Eli Navarro', 'Yes, that works. I’ll pair you two starting today. Bring your gloves, it’s going to be breezy.', at(today, '07:55')),
      ],
      reads: { 'sailor:s-lucy': at(iso(yesterday), '17:10'), 'coach:c-eli': at(today, '07:55'), 'family:f-reyes': at(today, '08:20') },
    },
  ]

  return {
    sessions,
    families,
    sailors,
    coaches,
    formerCoaches: [],
    documents,
    calendar,
    incidents,
    boats: fleet,
    ledger: [],
    registrations,
    groups,
    submissions,
    announcements,
    events,
    attendance,
    swimChecks,
    customTemplates: [PERMISSION_SLIP],
    formRequests,
    regattas,
    regattaResponses,
    practiceCalls,
    lessonPlans,
    boatAssignments,
    skillMarks,
    evaluations,
    dayNotes,
    threads,
  }
}
