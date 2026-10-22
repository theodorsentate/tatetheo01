import { addDays, addMonths, format, subDays } from 'date-fns'
import { quoteCart } from '@/domain/pricing'
import { autoGroups, eligibility } from '@/domain/rules'
import { attendanceKey, practiceDates } from '@/domain/attendance'
import type {
  ActivityEvent,
  Announcement,
  AttendanceEntry,
  Coach,
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
  Level,
  Registration,
  Sailor,
  Session,
  SwimCheck,
} from '@/domain/types'
import { seatsLeft } from '@/domain/waitlist'
import {
  CERT_TYPES,
  DEFAULT_SETTINGS,
  FORM_TEMPLATES,
  PROGRAMS,
  TERMS,
} from './catalog'

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
}

/** One-off form the director already sent this fall. */
export const PERMISSION_SLIP: FormTemplate = {
  id: 'frostbite-slip',
  name: 'Frostbite Regatta Permission Slip',
  short: 'Frostbite slip',
  description: 'Permission to race at the Frostbite Green Fleet regatta on Nov 7, travel by club launch.',
  scope: 'sailor',
  requiresSignature: true,
  required: false,
  custom: true,
  body: 'I give permission for my child to sail in the Frostbite Green Fleet regatta on Saturday, November 7, and to ride the club launch to and from the race area with coaches. I understand races may be postponed or cancelled for weather.',
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
  'Leaves early on Thursdays for piano at 5:15.',
  'First summer away from Opti Green. Nervous about capsize drills.',
  'Sunburns easily. We send SPF 50 in the bag; please remind at lunch.',
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

export function createSeed(now: Date = new Date()): DemoState {
  const rand = mulberry32(20261022)
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)]
  const chance = (p: number) => rand() < p
  let n = 0
  const id = (prefix: string) => `${prefix}-${(++n).toString(36)}`

  /* ───────────── Sessions ───────────── */
  const sessions: Session[] = []
  const summer = TERMS.find((t) => t.id === 'summer-27')!
  const summerStart = new Date(`${summer.startDate}T12:00:00`)
  const camp = (programId: string, weeks: number[], capacity: number, time: string) => {
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
        time,
        capacity,
        status: 'open',
      })
    }
  }
  const allWeeks = [1, 2, 3, 4, 5, 6, 7, 8]
  camp('lts', allWeeks, 18, '9:00 AM – 12:00 PM')
  camp('green-camp', allWeeks, 24, '9:00 AM – 3:00 PM')
  camp('rwb-camp', allWeeks, 24, '9:00 AM – 3:30 PM')
  camp('420-camp', allWeeks, 16, '9:30 AM – 4:00 PM')
  camp('ilca-camp', [2, 4, 6, 8], 12, '9:30 AM – 4:00 PM')
  camp('swim', allWeeks, 30, '1:00 PM – 2:30 PM')
  camp('tennis', allWeeks, 16, '12:30 PM – 2:30 PM')

  for (const term of TERMS.filter((t) => t.season !== 'summer')) {
    const teams: [string, number, string, string][] = [
      ['green-team', 20, 'Tue, Thu, Sat', 'Weekdays 3:45–5:45 PM · Sat 9–12'],
      ['rwb-team', 20, 'Tue, Thu, Sat', 'Weekdays 3:45–6:00 PM · Sat 9–1'],
      ['420-team', 16, 'Mon, Wed, Sat', 'Weekdays 4:00–6:15 PM · Sat 9–1'],
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

  /* ───────────── Coaches ───────────── */
  const certsFor = (
    role: Coach['role'],
    tweaks: Record<string, number | null> = {}
  ) =>
    CERT_TYPES.filter((ct) => ct.requiredFor.includes(role)).flatMap((ct) => {
      // tweak = days until expiry (null = missing)
      if (tweaks[ct.id] === null) return []
      const days =
        tweaks[ct.id] ?? Math.floor(120 + rand() * (ct.validMonths * 30 - 150))
      const expires = addDays(now, days)
      return [
        {
          certTypeId: ct.id,
          expires: iso(expires),
          issued: iso(addMonths(expires, -ct.validMonths)),
        },
      ]
    })

  const coachSpecs: [string, string, Coach['role'], Coach['activities'], Record<string, number | null>?][] = [
    ['c-maya', 'Maya Ortiz', 'head-coach', ['sailing'], { fa: 19 }],
    ['c-liam', 'Liam Becker', 'head-coach', ['sailing']],
    ['c-ava', 'Ava Thornton', 'instructor', ['sailing']],
    ['c-noah', 'Noah Fitzgerald', 'instructor', ['sailing'], { safesport: -12 }],
    ['c-chloe', 'Chloe Mercer', 'instructor', ['sailing']],
    ['c-owen', 'Owen Pryce', 'instructor', ['sailing'], { pwr: 33 }],
    ['c-eli', 'Eli Navarro', 'instructor', ['sailing']],
    ['c-sam', 'Sam Whitaker', 'instructor', ['sailing']],
    ['c-grace', 'Grace Holloway', 'assistant', ['sailing']],
    ['c-ruby', 'Ruby Kessler', 'assistant', ['sailing'], { bg: null }],
    ['c-nora', 'Nora Ames', 'assistant', ['sailing']],
    ['c-tessa', 'Tessa Lund', 'swim-coach', ['swim'], { lifeguard: 27 }],
    ['c-marcus', 'Marcus Reed', 'tennis-pro', ['tennis']],
    ['c-jordan', 'Jordan Hale', 'program-director', ['sailing', 'swim', 'tennis']],
  ]
  const coaches: Coach[] = coachSpecs.map(([cid, name, role, activities, tweaks], i) => ({
    id: cid,
    name,
    role,
    activities,
    email: `${name.split(' ')[0].toLowerCase()}@saltmarshbay.example`,
    phone: `(843) 555-${(1200 + i * 37).toString().slice(-4)}`,
    certs: certsFor(role, tweaks),
    avatarHue: (i * 47) % 360,
    active: true,
    startedSeason: pick(['Summer 2021', 'Summer 2022', 'Summer 2023', 'Summer 2024', 'Summer 2025', 'Fall 2025']),
    school: role === 'program-director' ? undefined : pick(['College sophomore', 'College junior', 'College senior', 'High school senior', 'Graduate student', 'Teacher, year-round']),
    emergencyContact: {
      name: `${pick(PARENT_NAMES)} ${name.split(' ')[1]}`,
      phone: `(843) 555-${(4100 + i * 29).toString().slice(-4)}`,
      relationship: pick(['Mother', 'Father', 'Partner', 'Sister', 'Brother']),
    },
  }))
  coaches.find((c) => c.id === 'c-maya')!.notes = 'Runs the Green Team and leads new-coach onboarding. Prefers texts over calls on the water.'
  coaches.find((c) => c.id === 'c-noah')!.notes = 'Available Tue/Thu only this fall (classes).'
  coaches.find((c) => c.id === 'c-tessa')!.notes = 'Also covers the club pool lifeguard schedule on weekends.'

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

  // The parent persona — the Calloways.
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
    createdAt: subDays(now, 900).toISOString(),
  })
  sailors.push(
    { id: 's-finn', familyId: 'f-calloway', firstName: 'Finn', lastName: 'Calloway', dob: '2015-04-12', level: 'opti-white', shirtSize: 'YL', medicalAlerts: [] },
    { id: 's-hazel', familyId: 'f-calloway', firstName: 'Hazel', lastName: 'Calloway', dob: '2018-08-03', level: 'opti-green', shirtSize: 'YS', medicalAlerts: ['Bee sting allergy'] }
  )

  SURNAMES.forEach((surname, i) => {
    const member = chance(0.78)
    const fid = `f-${surname.toLowerCase()}`
    const p1 = pick(PARENT_NAMES)
    const p2 = pick(PARENT_NAMES.filter((p) => p !== p1))
    families.push({
      id: fid,
      name: surname,
      membership: member ? 'member' : 'non-member',
      memberNumber: member ? `M-${1000 + i * 7}` : undefined,
      guardians: [
        { name: `${p1} ${surname}`, email: `${p1.toLowerCase()}.${surname.toLowerCase()}@example.com`, phone: `(843) 555-${(2000 + i * 13).toString().slice(-4)}`, relationship: 'Parent', smsOptIn: chance(0.7) },
        ...(chance(0.6)
          ? [{ name: `${p2} ${surname}`, email: `${p2.toLowerCase()}@example.com`, phone: `(843) 555-${(5000 + i * 11).toString().slice(-4)}`, relationship: 'Parent', smsOptIn: chance(0.4) }]
          : []),
      ],
      address: `${10 + Math.floor(rand() * 180)} ${pick(STREETS)}, Charleston, SC`,
      createdAt: subDays(now, 30 + Math.floor(rand() * 1500)).toISOString(),
    })
    const kids = chance(0.35) ? 1 : chance(0.75) ? 2 : 3
    const used = new Set<string>()
    for (let k = 0; k < kids; k++) {
      let first = pick(KID_NAMES)
      while (used.has(first)) first = pick(KID_NAMES)
      used.add(first)
      const age = 6 + Math.floor(rand() * 12) // 6–17 next summer
      const dob = new Date(2027 - age, Math.floor(rand() * 12), 1 + Math.floor(rand() * 27))
      sailors.push({
        id: `s-${surname.toLowerCase()}-${first.toLowerCase()}`,
        familyId: fid,
        firstName: first,
        lastName: surname,
        dob: iso(dob),
        level: levelForAge(age - 1),
        shirtSize: age < 9 ? 'YS' : age < 11 ? 'YM' : age < 13 ? 'YL' : age < 15 ? 'AS' : 'AM',
        medicalAlerts: chance(0.12) ? [pick(ALERTS)] : [],
      })
    }
  })

  /* ───────────── Registrations ───────────── */
  const registrations: Registration[] = []
  const programById = new Map(PROGRAMS.map((p) => [p.id, p]))
  const familyById = new Map(families.map((f) => [f.id, f]))

  const register = (
    sailor: Sailor,
    session: Session,
    createdAt: Date,
    opts: { forceStatus?: Registration['status']; paidRatio?: number } = {}
  ) => {
    const family = familyById.get(sailor.familyId)!
    const existing = registrations.filter((r) =>
      sailors.some((s) => s.id === r.sailorId && s.familyId === family.id)
    )
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
    const status: Registration['status'] =
      opts.forceStatus ?? (full ? 'waitlisted' : chance(0.06) ? 'pending-payment' : 'confirmed')
    registrations.push({
      id: id('r'),
      sailorId: sailor.id,
      sessionId: session.id,
      status,
      createdAt: createdAt.toISOString(),
      price: quote.total,
      priceLines: quote.lines,
      paid:
        status === 'confirmed'
          ? quote.total
          : status === 'pending-payment'
            ? Math.round(quote.total * (opts.paidRatio ?? 0))
            : 0,
    })
  }

  const eligibleSessions = (sailor: Sailor, termId: string) =>
    sessions.filter((s) => {
      if (s.termId !== termId) return false
      const p = programById.get(s.programId)!
      return eligibility(sailor, p, s).ok
    })

  const others = sailors.filter((s) => s.familyId !== 'f-calloway')

  // Calloway fall + early spring.
  const sess = (sid: string) => sessions.find((s) => s.id === sid)!
  const finn = sailors.find((s) => s.id === 's-finn')!
  const hazel = sailors.find((s) => s.id === 's-hazel')!
  register(finn, sess('rwb-team-fall-26'), new Date('2026-07-16T08:12:00'), { forceStatus: 'confirmed' })
  register(hazel, sess('green-team-fall-26'), new Date('2026-07-16T08:14:00'), { forceStatus: 'confirmed' })

  // Fall 2026 teams — registered over the summer, all settled.
  const fall = TERMS[0]
  for (const s of others) {
    const options = eligibleSessions(s, fall.id)
    const choice = options.length ? pick(options) : undefined
    if (choice && chance(0.5) && seatsLeft(choice, registrations) > 0) {
      register(s, choice, addDays(new Date(`${fall.registrationOpens}T09:00:00`), Math.floor(rand() * 45)), { forceStatus: 'confirmed' })
    }
  }


  // Spring 2027 — opened Oct 1; early birds trickling in.
  const springOpen = new Date('2026-10-01T08:00:00')
  const sinceOpen = (from: Date) => Math.max(0, (now.getTime() - from.getTime()) / 86400000)
  const springSpan = sinceOpen(springOpen)
  if (springSpan > 0) {
    for (const s of others) {
      const options = eligibleSessions(s, 'spring-27')
      if (options.length && chance(0.22)) {
        register(s, pick(options), new Date(springOpen.getTime() + rand() ** 1.6 * springSpan * 86400000))
      }
    }
    register(finn, sess('rwb-team-spring-27'), subDays(now, 6), { forceStatus: 'pending-payment', paidRatio: 0 })
  }

  // Summer 2027 — members-first window. Demand is front-loaded and peaks mid-summer.
  const summerOpen = new Date('2026-10-01T07:00:00')
  const summerSpan = sinceOpen(summerOpen)
  const weekWeight = [0.55, 0.75, 1, 1, 0.95, 0.9, 0.7, 0.5]
  type Pending = { sailor: Sailor; session: Session; at: Date }
  const pending: Pending[] = []
  if (summerSpan > 0) {
    for (const s of others) {
      const fam = familyById.get(s.familyId)!
      const priorityEnds = new Date(`${summer.memberPriorityUntil}T00:00:00`)
      if (fam.membership !== 'member' && now < priorityEnds) continue
      if (!chance(0.86)) continue
      const options = eligibleSessions(s, 'summer-27').filter(
        (x) => programById.get(x.programId)!.activity === 'sailing'
      )
      if (!options.length) continue
      const programIds = [...new Set(options.map((o) => o.programId))]
      const programId = pick(programIds)
      const weeks = 1 + Math.floor(rand() * 4.6)
      const at = new Date(summerOpen.getTime() + rand() ** 2.2 * summerSpan * 86400000)
      const chosen = options
        .filter((o) => o.programId === programId)
        .map((o) => ({ o, k: rand() / weekWeight[Number(o.name.split(' ')[1]) - 1] }))
        .sort((a, b) => a.k - b.k)
        .slice(0, weeks)
        .map((x) => x.o)
        .sort((a, b) => a.startDate.localeCompare(b.startDate))
      chosen.forEach((session, k) => pending.push({ sailor: s, session, at: new Date(at.getTime() + k * 60000) }))
      if (chance(0.45)) {
        const extra = eligibleSessions(s, 'summer-27').filter(
          (x) => programById.get(x.programId)!.activity !== 'sailing'
        )
        const n = 1 + Math.floor(rand() * 3)
        for (let k = 0; k < n && extra.length; k++) {
          const e = extra.splice(Math.floor(rand() * extra.length), 1)[0]
          pending.push({ sailor: s, session: e, at: new Date(at.getTime() + 300000 + k * 1000) })
        }
      }
    }
    pending.sort((a, b) => a.at.getTime() - b.at.getTime())
    // Force the peak weeks of the popular camps to oversubscribe.
    // The Calloways registered the morning it opened.
    register(finn, sess('rwb-camp-w2'), new Date('2026-10-01T07:04:00'), { forceStatus: 'confirmed' })
    register(finn, sess('rwb-camp-w3'), new Date('2026-10-01T07:05:00'), { forceStatus: 'confirmed' })
    for (const p of pending) register(p.sailor, p.session, p.at)
    const peak = ['green-camp-w3', 'green-camp-w4', 'rwb-camp-w3', 'rwb-camp-w4', 'lts-w3']
    for (const sid of peak) {
      const session = sess(sid)
      const program = programById.get(session.programId)!
      const extra = others.filter(
        (s) =>
          eligibility(s, program, session).ok &&
          !registrations.some((r) => r.sailorId === s.id && r.sessionId === sid) &&
          familyById.get(s.familyId)!.membership === 'member'
      )
      while (seatsLeft(session, registrations) > 0 && extra.length) {
        register(extra.shift()!, session, subDays(now, 14 + Math.floor(rand() * 6)))
      }
      for (let k = 0; k < 3 && extra.length; k++) {
        register(extra.shift()!, session, subDays(now, 1 + Math.floor(rand() * 9)), { forceStatus: 'waitlisted' })
      }
    }

    // Calloways: Finn has two weeks of race camp, a waitlist offer for week 5,
    // and Hazel is #2 on the Green Camp week 3 waitlist.
    const w5 = sess('rwb-camp-w5')
    // Make week 5 full, then put Finn at the front with a live offer.
    const w5others = others.filter(
      (s) =>
        eligibility(s, programById.get('rwb-camp')!, w5).ok &&
        !registrations.some((r) => r.sailorId === s.id && r.sessionId === w5.id)
    )
    while (seatsLeft(w5, registrations) > 1 && w5others.length) {
      register(w5others.shift()!, w5, subDays(now, 15), { forceStatus: 'confirmed' })
    }
    register(finn, w5, subDays(now, 12), { forceStatus: 'offered' })
    registrations[registrations.length - 1].offerExpiresAt = new Date(now.getTime() + 31 * 3600000).toISOString()
    for (let k = 0; k < 2 && w5others.length; k++) {
      register(w5others.shift()!, w5, subDays(now, 10 - k), { forceStatus: 'waitlisted' })
    }

    const g3 = sess('green-camp-w3')
    // Hazel should be second in line: make sure exactly one member family is ahead of her.
    if (!registrations.some((r) => r.sessionId === g3.id && r.status === 'waitlisted')) {
      const candidate = others.find(
        (k) =>
          eligibility(k, programById.get('green-camp')!, g3).ok &&
          familyById.get(k.familyId)!.membership === 'member' &&
          !registrations.some((r) => r.sailorId === k.id && r.sessionId === g3.id)
      )
      if (candidate) register(candidate, g3, subDays(now, 6), { forceStatus: 'waitlisted' })
    }
    const ahead = registrations
      .filter((r) => r.sessionId === g3.id && r.status === 'waitlisted')
      .sort((x, y) => x.createdAt.localeCompare(y.createdAt))
    // Ensure exactly one family is ahead of Hazel.
    ahead.slice(1).forEach((r) => (r.createdAt = subDays(now, 1).toISOString()))
    register(hazel, g3, subDays(now, 3), { forceStatus: 'waitlisted' })
    register(hazel, sess('lts-w6'), subDays(now, 3), { forceStatus: 'confirmed' })
  }

  // A handful of cancellations for realism.
  registrations
    .filter((r) => r.status === 'confirmed' && r.sessionId.includes('-w'))
    .slice(5, 200)
    .forEach((r) => {
      if (chance(0.03)) {
        r.status = 'cancelled'
        r.paid = 0
      }
    })

  /* ───────────── Groups (rosters) ───────────── */
  const groups: Group[] = []
  const coachesFor = (activity: string) =>
    coaches.filter((c) => c.activities.includes(activity as never) && c.role !== 'program-director')
  const boats = ['RIB 1 "Osprey"', 'RIB 2 "Heron"', 'RIB 3 "Pelican"', 'Whaler 4', 'Whaler 5']
  const groupSessions = [
    'green-team-fall-26', 'rwb-team-fall-26', '420-team-fall-26', 'ilca-team-fall-26',
    'lts-w1', 'lts-w3', 'green-camp-w1', 'rwb-camp-w1',
  ]
  const coachPools: Record<string, string[]> = {
    'green-team-fall-26': ['c-maya', 'c-grace', 'c-ava'],
    'rwb-team-fall-26': ['c-liam', 'c-chloe', 'c-nora'],
    '420-team-fall-26': ['c-eli', 'c-sam'],
    'ilca-team-fall-26': ['c-owen'],
    'lts-w1': ['c-ava', 'c-ruby', 'c-grace'],
    'lts-w3': ['c-ava', 'c-ruby'],
    'green-camp-w1': ['c-maya', 'c-noah', 'c-grace'],
    'rwb-camp-w1': ['c-liam', 'c-chloe', 'c-sam'],
  }
  for (const sid of groupSessions) {
    const session = sess(sid)
    const program = programById.get(session.programId)!
    const roster = registrations
      .filter((r) => r.sessionId === sid && r.status === 'confirmed')
      .map((r) => sailors.find((s) => s.id === r.sailorId)!)
    const pool = (coachPools[sid] ?? []).map((cid) => coaches.find((c) => c.id === cid)!)
    groups.push(
      ...autoGroups(session, program, roster, pool.length ? pool : coachesFor(program.activity), () => id('g'), boats)
    )
  }
  // Leave one group short a coach so the ratio warning shows up.
  const lts = groups.filter((g) => g.sessionId === 'lts-w3')
  if (lts.length > 1) lts[lts.length - 1].coachIds = []

  /* ───────────── Form submissions ───────────── */
  const submissions: FormSubmission[] = []
  const activeIds = new Set(
    registrations.filter((r) => r.status !== 'cancelled').map((r) => r.sailorId)
  )
  const signedPhoto = new Set<string>()
  for (const s of sailors) {
    if (!activeIds.has(s.id)) continue
    const fam = familyById.get(s.familyId)!
    const guardian = fam.guardians[0].name
    const diligent = chance(0.72)
    for (const t of FORM_TEMPLATES) {
      if (s.id === 's-hazel' && (t.id === 'medical' || t.id === 'swim')) continue
      if (t.scope === 'family') {
        if (signedPhoto.has(fam.id)) continue
        if (!diligent && chance(0.5)) continue
        signedPhoto.add(fam.id)
      } else if (!diligent && chance(0.45)) continue
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
        values.testedOn = iso(subDays(now, 60 + Math.floor(rand() * 300)))
      }
      if (t.id === 'photo') values.consent = chance(0.88) ? 'Yes, photos are fine' : 'No photos of my children, please'
      submissions.push({
        id: id('fs'),
        templateId: t.id,
        familyId: fam.id,
        sailorId: t.scope === 'sailor' ? s.id : undefined,
        season: DEFAULT_SETTINGS.season,
        signedBy: guardian,
        signedAt: subDays(now, Math.floor(rand() * 70)).toISOString(),
        values,
      })
    }
  }

  /* ───────────── Announcements ───────────── */
  const ann = (
    daysAgo: number,
    hour: number,
    a: Omit<Announcement, 'id' | 'sentAt' | 'opened'>
  ): Announcement => {
    const sentAt = subDays(now, daysAgo)
    sentAt.setHours(hour, 5, 0, 0)
    return { ...a, id: id('a'), sentAt: sentAt.toISOString(), opened: Math.round(a.recipients * (0.62 + rand() * 0.3)) }
  }
  const announcements: Announcement[] = [
    ann(1, 13, {
      title: 'Thursday practice cancelled — small craft advisory',
      body: 'NWS has a small craft advisory through 8 PM with gusts to 28 knots. All Thursday team practices are cancelled. Saturday is on as scheduled. Make-up session details to follow.',
      category: 'weather',
      audience: { kind: 'everyone' },
      channels: ['email', 'sms'],
      sentBy: 'Jordan Hale',
      recipients: 118,
    }),
    ann(4, 9, {
      title: 'Green Team: Frostbite Green Fleet regatta Nov 7',
      body: 'Our Green Team will race at the Frostbite Green Fleet regatta on Saturday, Nov 7. Launch at 9:30, first warning 11:00. Bring a warm layer, water bottle and lunch. Parents are welcome on the spectator boat — reply to reserve a seat.',
      category: 'schedule',
      audience: { kind: 'program', programId: 'green-team' },
      channels: ['email'],
      sentBy: 'Maya Ortiz',
      recipients: 23,
    }),
    ann(8, 10, {
      title: 'Reminder: 2026–27 forms are due',
      body: 'Every sailor needs a signed waiver, medical form and swim test confirmation for the 2026–27 season before their next session. It takes about three minutes in your Burgee family account.',
      category: 'reminder',
      audience: { kind: 'outstanding-forms' },
      channels: ['email', 'sms'],
      sentBy: 'Jordan Hale',
      recipients: 41,
    }),
    ann(21, 7, {
      title: 'Summer 2027 registration is open for members',
      body: 'Member registration for Summer 2027 camps is open now. Non-member registration opens November 1. Early-bird pricing (10% off) runs through January 31. Peak weeks fill quickly — join the waitlist if a week is full and we will offer spots automatically as they open.',
      category: 'general',
      audience: { kind: 'everyone' },
      channels: ['email'],
      sentBy: 'Jordan Hale',
      recipients: 131,
    }),
    ann(24, 16, {
      title: 'Coach meeting Saturday 8:00 AM',
      body: 'Quick coach meeting in the junior shed before practice. We will walk through the fall regatta schedule and the new launch sign-out sheet.',
      category: 'schedule',
      audience: { kind: 'staff' },
      channels: ['email', 'sms'],
      sentBy: 'Jordan Hale',
      recipients: 13,
    }),
    ann(36, 12, {
      title: 'Race Team: practice moves to 3:45 PM',
      body: 'With earlier sunsets, weekday Race Team practices start at 3:45 PM beginning next week. Please plan pickups for 6:00 PM.',
      category: 'schedule',
      audience: { kind: 'program', programId: 'rwb-team' },
      channels: ['email', 'sms'],
      sentBy: 'Liam Becker',
      recipients: 21,
    }),
  ]

  /* ───────────── Activity feed ───────────── */
  const sailorById = new Map(sailors.map((s) => [s.id, s]))
  const sessionById = new Map(sessions.map((s) => [s.id, s]))
  const events: ActivityEvent[] = registrations
    .filter((r) => new Date(r.createdAt) <= now)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 25)
    .map((r) => {
      const s = sailorById.get(r.sailorId)!
      const se = sessionById.get(r.sessionId)!
      const p = programById.get(se.programId)!
      const kind: ActivityEvent['kind'] =
        r.status === 'waitlisted' ? 'waitlisted' : r.status === 'offered' ? 'offered' : 'registered'
      const verb =
        kind === 'waitlisted' ? 'joined the waitlist for' : kind === 'offered' ? 'was offered a spot in' : 'registered for'
      return {
        id: id('e'),
        at: r.createdAt,
        kind,
        text: `${s.firstName} ${s.lastName} ${verb} ${p.name} · ${se.name}`,
      }
    })

  /* ───────────── Parent notes & pickups ───────────── */
  for (const k of sailors) {
    const fam = familyById.get(k.familyId)!
    if (k.id === 's-finn') {
      k.parentNote = { text: 'Finn is working on his starts and loves the competitive drills. He can get frustrated after a bad race; a quick word from a coach helps him reset.', updatedAt: subDays(now, 40).toISOString(), by: 'Sarah Calloway' }
      continue
    }
    if (k.id === 's-hazel') {
      k.parentNote = { text: 'Hazel is still a little nervous about capsizing and does best with a buddy boat nearby. Her grandmother Lou picks her up on Thursdays.', updatedAt: subDays(now, 12).toISOString(), by: 'Sarah Calloway' }
      k.authorizedPickups = ['Lou Calloway (grandmother)']
      continue
    }
    if (chance(0.3)) k.parentNote = { text: pick(NOTES), updatedAt: subDays(now, Math.floor(rand() * 60)).toISOString(), by: fam.guardians[0].name }
    if (chance(0.35)) k.authorizedPickups = [`${pick(PARENT_NAMES)} ${pick([fam.name, pick(SURNAMES)])} (${pick(PICKUPS).toLowerCase()})`]
  }

  /* ───────────── Swim checks ───────────── */
  const swimChecks: SwimCheck[] = []
  for (const sub of submissions.filter((x) => x.templateId === 'swim')) {
    if (sub.values.result?.startsWith('Passed')) {
      const atClub = sub.values.result.includes('at the Club')
      swimChecks.push({
        sailorId: sub.sailorId!,
        result: 'passed',
        date: sub.values.testedOn || iso(subDays(now, 120)),
        by: atClub ? pick(['Maya Ortiz', 'Liam Becker', 'Ava Thornton']) : 'Certificate on file',
      })
    }
  }
  // A couple of kids on current teams still need theirs.
  for (const sid of ['s-hazel']) {
    const i = swimChecks.findIndex((c) => c.sailorId === sid)
    if (i >= 0) swimChecks.splice(i, 1)
  }

  /* ───────────── Attendance history (fall teams, up to yesterday) ───────────── */
  const attendance: Record<string, AttendanceEntry> = {}
  const yesterday = subDays(now, 1)
  for (const session of sessions.filter((s) => s.termId === 'fall-26')) {
    const roster = registrations.filter((r) => r.sessionId === session.id && r.status === 'confirmed').map((r) => r.sailorId)
    const coach = groups.find((g) => g.sessionId === session.id && g.coachIds.length)?.coachIds[0]
    const coachName = coaches.find((c) => c.id === coach)?.name ?? 'Coach'
    const dates = practiceDates(session, yesterday)
    for (const sid of roster) {
      const reliability = 0.78 + rand() * 0.2
      dates.forEach((date, i) => {
        const absent = !chance(reliability) || (sid === 's-hazel' && i === dates.length - 2)
        const fam = familyById.get(sailors.find((x) => x.id === sid)!.familyId)!
        attendance[attendanceKey(date, session.id, sid)] = {
          sailorId: sid,
          sessionId: session.id,
          date,
          status: absent ? 'absent' : 'picked-up',
          updatedAt: new Date(`${date}T18:05:00`).toISOString(),
          by: coachName,
          pickedUpBy: absent ? undefined : fam.guardians[Math.floor(rand() * fam.guardians.length)].name,
          launchedAt: absent ? undefined : new Date(`${date}T16:05:00`).toISOString(),
        }
      })
    }
  }

  /* ───────────── Forms already pushed to families ───────────── */
  const green = registrations.filter((r) => r.sessionId === 'green-team-fall-26' && r.status === 'confirmed').map((r) => r.sailorId)
  const greenFamilies = [...new Set(green.map((sid) => sailors.find((x) => x.id === sid)!.familyId))]
  const formRequests: FormRequest[] = [
    {
      id: 'req-frostbite',
      templateId: PERMISSION_SLIP.id,
      familyIds: greenFamilies,
      sailorIds: green,
      audienceLabel: 'Opti Green Team families',
      dueDate: '2026-11-02',
      message: 'Please sign the permission slip for the Frostbite Green Fleet regatta on Nov 7 so your sailor can race.',
      channels: ['email', 'sms'],
      sentAt: subDays(now, 4).toISOString(),
      sentBy: 'Maya Ortiz',
    },
  ]
  for (const sid of green.filter((x) => x !== 's-hazel')) {
    if (!chance(0.6)) continue
    const k = sailors.find((x) => x.id === sid)!
    const fam = familyById.get(k.familyId)!
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
        uploadedBy: chance(0.6) ? c.name : 'Jordan Hale',
        expires: cert.expires,
        sample: true,
      })
    }
  }
  const clubDocs: [string, string, string][] = [
    ['Emergency Action Plan 2026–27', 'Who calls 911, where the AED is, launch-area evacuation and the coach-boat radio channel.', 'emergency-action-plan-2026-27.pdf'],
    ['Junior Program Handbook', 'Program levels, daily schedule, what to bring, pickup rules and the parent code of conduct.', 'junior-program-handbook.pdf'],
    ['Coach Code of Conduct', 'Signed by every coach each season. SafeSport-aligned rules on one-on-one contact and messaging.', 'coach-code-of-conduct.pdf'],
    ['Weather & Small Craft Advisory Policy', 'Wind and lightning limits by fleet, and who makes the call.', 'weather-policy.pdf'],
    ['Coach Boat & Launch Checklist', 'Daily pre-launch checks for RIBs and Whalers: kill cord, fuel, radio, first aid kit.', 'coach-boat-checklist.pdf'],
    ['Concussion Protocol', 'Signs to watch for, removal from activity, and return-to-sail steps.', 'concussion-protocol.pdf'],
    ['Certificate of Insurance 2026', 'Club liability coverage for junior programs and regattas.', 'certificate-of-insurance-2026.pdf'],
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
      uploadedBy: 'Jordan Hale',
      description,
      sample: true,
    })
  )

  /* ───────────── Calendar ───────────── */
  const calendar: ClubEvent[] = [
    { id: id('ev'), title: 'Junior committee meeting', kind: 'meeting', date: '2026-10-27', time: '7:00 PM', location: 'Club library' },
    { id: id('ev'), title: 'Summer registration opens to non-members', kind: 'deadline', date: '2026-11-01' },
    { id: id('ev'), title: 'Frostbite permission slips due', kind: 'deadline', date: '2026-11-02', programIds: ['green-team'] },
    { id: id('ev'), title: 'Frostbite Green Fleet Regatta', kind: 'regatta', date: '2026-11-07', time: 'Launch 9:30 AM, first warning 11:00', location: 'Saltmarsh Bay YC', programIds: ['green-team'], notes: 'Spectator boat available, reserve with Maya.' },
    { id: id('ev'), title: 'Fall Championship Regatta', kind: 'regatta', date: '2026-11-14', endDate: '2026-11-15', time: 'Both days 10:00 AM', location: 'Bayside Sailing Association', programIds: ['rwb-team', '420-team', 'ilca-team'] },
    { id: id('ev'), title: 'Fall season wrap and team pizza party', kind: 'social', date: '2026-11-21', time: '12:30 PM', location: 'Junior shed' },
    { id: id('ev'), title: 'Coach First Aid & CPR recertification', kind: 'training', date: '2026-12-05', time: '9:00 AM – 1:00 PM', location: 'Club ballroom', notes: 'Maya, Ruby and Tessa need this one.' },
    { id: id('ev'), title: 'Spring early-bird pricing ends', kind: 'deadline', date: '2026-12-15' },
    { id: id('ev'), title: 'Summer early-bird pricing ends', kind: 'deadline', date: '2027-01-31' },
    { id: id('ev'), title: 'Spring season starts', kind: 'training', date: '2027-03-02', programIds: ['green-team', 'rwb-team', '420-team', 'ilca-team'] },
    { id: id('ev'), title: 'Spring Invitational', kind: 'regatta', date: '2027-04-17', endDate: '2027-04-18', location: 'Saltmarsh Bay YC', programIds: ['rwb-team', '420-team'] },
    { id: id('ev'), title: 'Summer coach onboarding weekend', kind: 'training', date: '2027-06-05', endDate: '2027-06-06', location: 'Junior shed' },
    { id: id('ev'), title: 'Junior awards banquet', kind: 'social', date: '2027-08-07', time: '6:00 PM', location: 'Club lawn' },
  ]

  /* ───────────── Incidents ───────────── */
  const rosterOf = (sid: string) => registrations.filter((r) => r.sessionId === sid && r.status === 'confirmed').map((r) => r.sailorId)
  const rwb = rosterOf('rwb-team-fall-26')
  const grn = rosterOf('green-team-fall-26')
  const hs = rosterOf('420-team-fall-26')
  const incidents: Incident[] = [
    {
      id: id('inc'),
      at: new Date('2026-10-20T16:20:00').toISOString(),
      sessionId: '420-team-fall-26',
      sailorIds: hs.slice(0, 2),
      type: 'near-miss',
      severity: 'minor',
      description: 'Two 420s came within a boat length on opposite tacks rounding the leeward mark. No contact.',
      actionTaken: 'Stopped the drill and ran a quick port/starboard refresher on the water.',
      parentsNotified: false,
      reportedBy: 'Eli Navarro',
      status: 'open',
    },
    {
      id: id('inc'),
      at: new Date('2026-10-17T10:45:00').toISOString(),
      sessionId: 'rwb-team-fall-26',
      sailorIds: [],
      type: 'equipment',
      severity: 'moderate',
      description: 'RIB 2 "Heron" outboard stalled twice at idle during Saturday practice.',
      actionTaken: 'Whaler 4 covered the group. RIB 2 tagged out until the mechanic visit.',
      parentsNotified: false,
      reportedBy: 'Owen Pryce',
      status: 'open',
    },
    {
      id: id('inc'),
      at: new Date('2026-10-15T16:40:00').toISOString(),
      sessionId: 'rwb-team-fall-26',
      sailorIds: rwb.slice(2, 3),
      type: 'capsize-rescue',
      severity: 'minor',
      description: 'Capsized in a 15-knot gust near the windward mark and couldn’t right the boat after two tries.',
      actionTaken: 'Coach boat pulled the sailor aboard in under a minute; boat towed in. Warmed up and finished practice ashore.',
      parentsNotified: true,
      notifiedHow: 'Text at 4:55 PM',
      reportedBy: 'Liam Becker',
      status: 'closed',
    },
    {
      id: id('inc'),
      at: new Date('2026-10-08T17:10:00').toISOString(),
      sessionId: 'green-team-fall-26',
      sailorIds: grn.slice(3, 4),
      type: 'injury',
      severity: 'minor',
      description: 'Bumped head on the boom during a tack.',
      actionTaken: 'Ice pack, sat out the rest of practice, watched for concussion signs per protocol. No symptoms.',
      parentsNotified: true,
      notifiedHow: 'Spoke with parent at pickup',
      reportedBy: 'Maya Ortiz',
      status: 'closed',
    },
  ]

  /* ───────────── Boats & equipment ───────────── */
  const fleet: Boat[] = []
  for (let n = 1; n <= 24; n++)
    fleet.push({ id: id('b'), kind: 'Opti', name: `Opti #${2100 + n}`, status: 'ready', assignedTo: n <= 10 ? 'Opti Green Team' : 'Opti Race Team', lastInspected: iso(subDays(now, 5 + Math.floor(rand() * 40))) })
  for (let n = 11; n <= 18; n++)
    fleet.push({ id: id('b'), kind: 'Club 420', name: `C420 #${n}`, status: 'ready', assignedTo: 'High School 420 Team', lastInspected: iso(subDays(now, 5 + Math.floor(rand() * 40))) })
  for (let n = 1; n <= 6; n++)
    fleet.push({ id: id('b'), kind: 'ILCA', name: `ILCA #${n}`, status: 'ready', assignedTo: 'ILCA Team', lastInspected: iso(subDays(now, 5 + Math.floor(rand() * 40))) })
  ;[
    ['RIB', 'RIB 1 "Osprey"'],
    ['RIB', 'RIB 2 "Heron"'],
    ['RIB', 'RIB 3 "Pelican"'],
    ['Whaler', 'Whaler 4'],
    ['Whaler', 'Whaler 5'],
  ].forEach(([kind, name]) => fleet.push({ id: id('b'), kind: kind as Boat['kind'], name, status: 'ready', assignedTo: 'Coach boat', lastInspected: iso(subDays(now, 2 + Math.floor(rand() * 10))) }))
  const fix = (name: string, status: Boat['status'], issue: string) => Object.assign(fleet.find((b) => b.name === name)!, { status, issue })
  fix('Opti #2104', 'needs-repair', 'Daggerboard trunk cracked at the top edge')
  fix('Opti #2117', 'needs-repair', 'Sail torn along the luff, sent to the loft')
  fix('Opti #2122', 'out-of-service', 'Hull crack below the waterline, awaiting fiberglass repair')
  fix('C420 #15', 'needs-repair', 'Spinnaker halyard frayed')
  fix('ILCA #4', 'needs-repair', 'Mainsheet block cracked')
  fix('RIB 2 "Heron"', 'out-of-service', 'Outboard stalls at idle. Mechanic booked for Tuesday.')

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
  }
}
