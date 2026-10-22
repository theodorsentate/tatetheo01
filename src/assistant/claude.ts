/**
 * Ask Burgee — Claude engine.
 *
 * In the hosted demo this uses the artifact runtime's `sample` capability
 * (Claude on the viewer's own account) with the data tools from query.ts as
 * page functions. In the MVP the same prompt + tools move to a server
 * function calling the Anthropic API; nothing else changes.
 */
import { useStore } from '@/data/store'
import type { Audience, Channel } from '@/domain/types'
import {
  type AssistantAction,
  type Ctx,
  audienceText,
  briefing,
  clubOverview,
  familyInfo,
  attendanceInfo,
  calendarInfo,
  practiceTodayInfo,
  progressInfo,
  regattasInfo,
  documentsInfo,
  equipmentInfo,
  incidentsInfo,
  staffDirectoryInfo,
  formRequestsInfo,
  formsInfo,
  moneyInfo,
  swimChecksInfo,
  resolveAudience,
  rostersInfo,
  sailorsInfo,
  sessionsInfo,
  staffCertifications,
  waitlistInfo,
} from './query'

/* Minimal typing of the runtime we call (see the artifact capability contract). */
type SampleTool = {
  name: string
  description: string
  inputSchema?: { type: 'object'; properties?: Record<string, unknown>; required?: string[] }
  execute: (input: Record<string, unknown>, context: { signal: AbortSignal }) => unknown
}
type SampleOptions = {
  onText?: (u: { text: string; delta: string }) => void
  signal?: AbortSignal
  tools?: SampleTool[]
  modelTier?: 'quick' | 'default' | 'complex'
  cache?: boolean
}
type SampleFn = ((
  input: string | { role: 'user' | 'assistant'; content: string }[],
  options?: SampleOptions
) => Promise<{ text: string; truncated: boolean }>) & {
  limits: () => Promise<{ maxPromptBytes: number; tools?: { maxCount: number } }>
}
export type SampleError = { code: string; message: string; text?: string }

let samplePromise: Promise<SampleFn | null> | null = null

/** Resolves Claude when this page runs inside a Claude viewer, else null. */
export function getClaude(): Promise<SampleFn | null> {
  if (samplePromise) return samplePromise
  const runtime = (window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } }).claude
  samplePromise = runtime?.use
    ? runtime.use('sample').then((s) => (typeof s === 'function' ? (s as SampleFn) : null)).catch(() => null)
    : Promise.resolve(null)
  return samplePromise
}

export const ctxNow = (): Ctx => ({ s: useStore.getState(), now: new Date() })

const str = (v: unknown) => (v === undefined || v === null || v === '' ? undefined : String(v))
const scope = {
  program: { type: 'string', description: 'Program name or nickname, e.g. "Opti Green Camp", "race team", "420", "learn to sail", "swim"' },
  term: { type: 'string', description: '"fall" (now, in progress), "spring", or "summer"' },
  week: { type: 'string', description: 'Summer camp week number 1-8, e.g. "3"' },
}

export type ToolEvent = { tool: string; label: string }

const LABELS: Record<string, string> = {
  club_overview: 'Reading club setup',
  staff_certifications: 'Checking staff certifications',
  sessions: 'Checking session capacity',
  waitlists: 'Reading waitlists',
  sailors: 'Looking up sailors',
  family: 'Looking up the family',
  money: 'Checking balances',
  rosters: 'Checking rosters and coaches',
  forms: 'Checking forms',
  attendance: 'Checking attendance',
  swim_checks: 'Checking swim checks',
  sent_forms: 'Checking sent forms',
  staff_directory: 'Looking up staff',
  documents: 'Searching documents',
  calendar: 'Checking the calendar',
  regattas: 'Checking regatta sign-ups',
  practice_today: 'Checking today’s practice calls',
  progress: 'Checking skills and evaluations',
  equipment: 'Checking boats',
  incidents: 'Reading incident reports',
  draft_message: 'Drafting a message',
}

export function buildTools(onTool: (e: ToolEvent) => void, actions: AssistantAction[]): SampleTool[] {
  const wrap = (name: string, run: (i: Record<string, unknown>) => unknown) => (input: Record<string, unknown>) => {
    onTool({ tool: name, label: LABELS[name] ?? name })
    return run(input)
  }
  return [
    {
      name: 'staff_certifications',
      description:
        'Coach and staff certifications (SafeSport, First Aid & CPR, Background Check, US Sailing Level 1/2, Safe Powerboat). Returns rows of staff, cert, status (valid/expiring/expired/missing), expiry, daysLeft. Default returns only those needing action.',
      inputSchema: {
        type: 'object',
        properties: {
          cert: { type: 'string', description: 'Cert name or nickname, e.g. "safesport", "cpr", "background"' },
          person: { type: 'string', description: 'Staff name or part of it' },
          status: { type: 'string', enum: ['needs-action', 'expired', 'missing', 'expiring', 'valid', 'all'] },
        },
      },
      execute: wrap('staff_certifications', (i) => staffCertifications(ctxNow(), { cert: str(i.cert), person: str(i.person), status: str(i.status) })),
    },
    {
      name: 'sessions',
      description: 'Capacity for camp weeks and team seasons: capacity, taken, spotsLeft, waitlist and offers out, with an href per session. Filter by program/term/week, and optionally only full, open or waitlisted sessions.',
      inputSchema: { type: 'object', properties: { ...scope, filter: { type: 'string', enum: ['all', 'full', 'open', 'waitlist'] } } },
      execute: wrap('sessions', (i) => sessionsInfo(ctxNow(), { program: str(i.program), term: str(i.term), week: str(i.week), filter: str(i.filter) })),
    },
    {
      name: 'waitlists',
      description: 'Ordered waitlists (position, sailor, family, member?, joined) and spot offers currently out with hours left on the hold, per session. Omit filters to get every session that has a waitlist.',
      inputSchema: { type: 'object', properties: scope },
      execute: wrap('waitlists', (i) => waitlistInfo(ctxNow(), { program: str(i.program), term: str(i.term), week: str(i.week) })),
    },
    {
      name: 'sailors',
      description: 'Find junior sailors by name, by the session they are in (program/term/week), by fleet level, or only those with medical alerts or missing forms. Returns age, fleet, family, medical alerts, the parent\'s note for coaches, authorized pickups, swim check, emergency contact, missing forms and registrations.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          ...scope,
          level: { type: 'string', description: 'Fleet, e.g. "Opti Green", "Club 420"' },
          withMedical: { type: 'boolean' },
          missingForms: { type: 'boolean' },
        },
      },
      execute: wrap('sailors', (i) =>
        sailorsInfo(ctxNow(), {
          name: str(i.name),
          program: str(i.program),
          term: str(i.term),
          week: str(i.week),
          level: str(i.level),
          withMedical: i.withMedical === true || i.withMedical === 'true',
          missingForms: i.missingForms === true || i.missingForms === 'true',
        })
      ),
    },
    {
      name: 'family',
      description: 'One family by last name or a guardian name: guardians with phone/email, kids, registrations, balance due, missing forms, and an href.',
      inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
      execute: wrap('family', (i) => familyInfo(ctxNow(), { name: String(i.name ?? '') })),
    },
    {
      name: 'money',
      description: 'Unpaid balances by family (largest first) and tuition booked vs collected per term.',
      execute: wrap('money', () => moneyInfo(ctxNow())),
    },
    {
      name: 'rosters',
      description: 'Roster groups: coaches, sailor count and names (with medical alerts), coach ratio, boat, and problems (no coach / over ratio). Filter by program/term/week or coach name. Also lists sessions with sailors but no groups yet.',
      inputSchema: { type: 'object', properties: { ...scope, coach: { type: 'string' }, problemsOnly: { type: 'boolean' } } },
      execute: wrap('rosters', (i) =>
        rostersInfo(ctxNow(), { program: str(i.program), term: str(i.term), week: str(i.week), coach: str(i.coach), problemsOnly: i.problemsOnly === true })
      ),
    },
    {
      name: 'forms',
      description: 'Registered sailors missing season forms (waiver, medical, swim test, photo release), with the guardian and phone. Filter by form and/or session.',
      inputSchema: { type: 'object', properties: { form: { type: 'string', description: '"waiver", "medical", "swim test" or "photo"' }, ...scope } },
      execute: wrap('forms', (i) => formsInfo(ctxNow(), { form: str(i.form), program: str(i.program), term: str(i.term), week: str(i.week) })),
    },
    {
      name: 'attendance',
      description: 'Live attendance today for sessions in progress (who is on the water, here, absent, went home and with whom, not checked in) plus sailors with poor season attendance. Filter by program/term/week.',
      inputSchema: { type: 'object', properties: scope },
      execute: wrap('attendance', (i) => attendanceInfo(ctxNow(), { program: str(i.program), term: str(i.term), week: str(i.week) })),
    },
    {
      name: 'swim_checks',
      description: 'Registered sailors in water programs who have not passed a swim check yet. Filter by program/term/week.',
      inputSchema: { type: 'object', properties: scope },
      execute: wrap('swim_checks', (i) => swimChecksInfo(ctxNow(), { program: str(i.program), term: str(i.term), week: str(i.week) })),
    },
    {
      name: 'sent_forms',
      description: 'One-off and season forms the director sent to families for signature (e.g. regatta permission slips): due date, how many signed, and who has not signed yet.',
      execute: wrap('sent_forms', () => formRequestsInfo(ctxNow())),
    },
    {
      name: 'staff_directory',
      description: 'Staff contacts: phone, email, role, emergency contact, groups they coach, notes. Filter by name (first name is fine) or role.',
      inputSchema: { type: 'object', properties: { name: { type: 'string' }, role: { type: 'string' } } },
      execute: wrap('staff_directory', (i) => staffDirectoryInfo(ctxNow(), { name: str(i.name), role: str(i.role) })),
    },
    {
      name: 'documents',
      description: 'Find certificate files (SafeSport, Level 1, CPR cards, etc.) by staff member and/or certification, or list which certifications have no file uploaded. Also lists club documents (emergency plan, handbook…). Each row has an href to open it.',
      inputSchema: { type: 'object', properties: { person: { type: 'string' }, cert: { type: 'string' }, missingOnly: { type: 'boolean' } } },
      execute: wrap('documents', (i) => documentsInfo(ctxNow(), { person: str(i.person), cert: str(i.cert), missingOnly: i.missingOnly === true })),
    },
    {
      name: 'calendar',
      description: 'Upcoming club events: regattas, deadlines, meetings, socials, trainings. Optionally the next N days, one kind, or a search term (e.g. "frostbite").',
      inputSchema: { type: 'object', properties: { days: { type: 'number' }, kind: { type: 'string', enum: ['regatta', 'deadline', 'meeting', 'social', 'training'] }, search: { type: 'string' } } },
      execute: wrap('calendar', (i) => calendarInfo(ctxNow(), { days: i.days ? Number(i.days) : undefined, kind: str(i.kind), search: str(i.search) })),
    },
    {
      name: 'regattas',
      description: 'Upcoming regattas with the sailors whose families said going, interested or not going, who has not answered, chaperones and coaches. Optional search (e.g. "frostbite").',
      inputSchema: { type: 'object', properties: { search: { type: 'string' } } },
      execute: wrap('regattas', (i) => regattasInfo(ctxNow(), { search: str(i.search) })),
    },
    {
      name: 'practice_today',
      description: 'Each team practicing today: the call (on, delayed, cancelled or no call yet), the note sent to families, and the lesson plan.',
      execute: wrap('practice_today', () => practiceTodayInfo(ctxNow())),
    },
    {
      name: 'progress',
      description: 'Skill progress and coach evaluations for fall team sailors: skills got / total, ready to move up, working on, evaluation status. Filter by program or sailor name (sailor returns the evaluation text).',
      inputSchema: { type: 'object', properties: { program: { type: 'string' }, sailor: { type: 'string' } } },
      execute: wrap('progress', (i) => progressInfo(ctxNow(), { program: str(i.program), sailor: str(i.sailor) })),
    },
    {
      name: 'equipment',
      description: 'Boats and coach boats: status (ready, needs-repair, out-of-service), issue, who uses it, last checked. Default returns only boats that need work.',
      inputSchema: { type: 'object', properties: { status: { type: 'string', enum: ['all', 'ready', 'needs-repair', 'out-of-service'] }, kind: { type: 'string' } } },
      execute: wrap('equipment', (i) => equipmentInfo(ctxNow(), { status: str(i.status), kind: str(i.kind) })),
    },
    {
      name: 'incidents',
      description: 'Incident reports (capsizes needing help, injuries, near misses, equipment failures): what happened, action taken, whether parents were told, open/closed.',
      inputSchema: { type: 'object', properties: { status: { type: 'string', enum: ['all', 'open', 'closed'] } } },
      execute: wrap('incidents', (i) => incidentsInfo(ctxNow(), { status: str(i.status) })),
    },
    {
      name: 'club_overview',
      description: 'Terms and dates, programs with ages/fleets/ratios, pricing tiers and discounts, waitlist rules.',
      execute: wrap('club_overview', () => clubOverview(ctxNow())),
    },
    {
      name: 'draft_message',
      description:
        'Prepare an email/text for the director to review and send from the Messages page. It does NOT send anything. audience: "everyone", "staff", "forms" (families with forms due), "waitlisted", or a program/session phrase like "Opti Green Camp week 3".',
      inputSchema: {
        type: 'object',
        properties: {
          audience: { type: 'string' },
          title: { type: 'string' },
          body: { type: 'string' },
          sms: { type: 'boolean', description: 'Also send as a text' },
        },
        required: ['audience', 'title', 'body'],
      },
      execute: wrap('draft_message', (i) => {
        const ctx = ctxNow()
        const audience: Audience = resolveAudience(ctx, String(i.audience ?? 'everyone'))
        const channels: Channel[] = i.sms === false ? ['email'] : ['email', 'sms']
        actions.push({ kind: 'draft', label: `Review draft to ${audienceText(audience, ctx)}`, title: String(i.title ?? ''), body: String(i.body ?? ''), audience, channels })
        return { status: 'Draft ready for the director to review. Nothing has been sent.', audience: audienceText(audience, ctx) }
      }),
    },
  ]
}

export function instructions(ctx: Ctx) {
  return `You are "Ask Burgee", the assistant inside Burgee, the junior program software at ${ctx.s.settings.clubName}. You are talking with the junior program director. Answer their off-the-cuff questions about the club's junior sailing program.

Rules:
- Use the tools to look things up. Never guess names, dates, counts or money; if the data doesn't cover it, say so in one line.
- Lead with the answer in one short sentence, then a short "- " bullet list when naming people or sessions. Keep it tight: this is a quick chat, not a report.
- Write dates like "Nov 10". Money like "$1,035".
- When a tool result gives an href for a person, family, session or page, link it in Markdown: [Noah Fitzgerald](/admin/staff). Use only hrefs from tool results.
- If the director asks you to remind, email, text or message people, call draft_message with a clear, friendly message from the program director, then tell them the draft is ready to review. Never say anything was sent.
- Formatting: plain paragraphs, "- " bullets, **bold** and links only. No headings, no tables.

Current snapshot of what needs attention:
${briefing(ctx)}`
}

export type Turn = { role: 'user' | 'assistant'; content: string }

export async function askClaude(
  sample: SampleFn,
  history: Turn[],
  opts: { signal: AbortSignal; onText: (t: string) => void; onTool: (e: ToolEvent) => void }
): Promise<{ text: string; actions: AssistantAction[]; truncated: boolean }> {
  const ctx = ctxNow()
  const actions: AssistantAction[] = []
  const limits = await sample.limits().catch(() => null)
  const turns = history.slice(-8)
  if (limits?.tools) {
    const res = await sample([{ role: 'user', content: instructions(ctx) }, ...turns], {
      tools: buildTools(opts.onTool, actions),
      modelTier: 'quick',
      signal: opts.signal,
      onText: ({ text }) => opts.onText(text),
    })
    return { text: res.text, actions, truncated: res.truncated }
  }
  // Views without page tools: hand Claude the data directly.
  const data = {
    overview: clubOverview(ctx),
    certifications: staffCertifications(ctx, { status: 'all' }).rows,
    sessions: sessionsInfo(ctx, {}).rows,
    waitlists: waitlistInfo(ctx, {}).sessions,
    money: moneyInfo(ctx),
    forms: formsInfo(ctx, {}),
    rosters: rostersInfo(ctx, {}).groups,
    sailors: sailorsInfo(ctx, { limit: 200 }).rows.map(({ name, age, fleet, family, medicalAlerts, formsMissing, registrations }) => ({ name, age, fleet, family, medicalAlerts, formsMissing, registrations })),
  }
  const res = await sample(
    [{ role: 'user', content: `${instructions(ctx)}\n\nYou cannot call tools in this view; here is the club's data as JSON:\n${JSON.stringify(data)}` }, ...turns],
    { modelTier: 'default', cache: false, signal: opts.signal, onText: ({ text }) => opts.onText(text) }
  )
  return { text: res.text, actions, truncated: res.truncated }
}
