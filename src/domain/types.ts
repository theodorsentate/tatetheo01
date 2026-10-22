/**
 * Burgee domain model.
 *
 * These types are the contract between the UI and the data layer. The demo
 * keeps them in a local store; the Supabase schema in /supabase mirrors them
 * one table per entity so the swap is mechanical.
 */

export type ID = string
/** ISO date (yyyy-mm-dd) */
export type ISODate = string
/** ISO timestamp */
export type ISODateTime = string

/** Burgee is sailing-only for now; the field stays so other activities can come back later. */
export type Activity = 'sailing'

/** Fleets / levels a sailor can be placed in. */
export type Level =
  | 'learn-to-sail'
  | 'opti-green'
  | 'opti-red'
  | 'opti-white'
  | 'opti-blue'
  | 'club-420'
  | 'ilca'

/** Camps are week-by-week summer sessions; teams run as year-round terms. */
export type ProgramFormat = 'camp' | 'team'

export type Term = {
  id: ID
  name: string // "Summer 2027"
  season: 'fall' | 'spring' | 'summer'
  startDate: ISODate
  endDate: ISODate
  registrationOpens: ISODate
  /** Members-only registration window ends on this date. */
  memberPriorityUntil?: ISODate
  /** Early-bird pricing applies to registrations made before this date. */
  earlyBirdUntil?: ISODate
}

export type Program = {
  id: ID
  name: string
  activity: Activity
  format: ProgramFormat
  levels: Level[]
  minAge: number
  maxAge: number
  description: string
  /** Which pricing tier this program uses (see PricingSettings.tiers). */
  pricingTierId: ID
  /** Max sailors per coach on the water. */
  ratio: number
  color: string
  /** Form template ids required before a sailor can participate. */
  requiredFormIds: ID[]
}

export type Session = {
  id: ID
  programId: ID
  termId: ID
  name: string // "Week 3" or "Fall Team"
  startDate: ISODate
  endDate: ISODate
  days: string // "Mon–Fri" / "Tue, Thu, Sat"
  time: string // "9:00 AM – 12:00 PM"
  capacity: number
  /** Overrides the program's pricing tier for this one session. */
  priceOverride?: { member: number; nonMember: number }
  status: 'open' | 'closed'
}

export type MembershipStatus = 'member' | 'non-member'

export type Guardian = {
  name: string
  email: string
  phone: string
  relationship: string
  smsOptIn: boolean
}

export type Family = {
  id: ID
  name: string // "Calloway"
  membership: MembershipStatus
  memberNumber?: string
  guardians: Guardian[]
  address: string
  createdAt: ISODateTime
}

export type Sailor = {
  id: ID
  familyId: ID
  firstName: string
  lastName: string
  dob: ISODate
  level: Level
  shirtSize: 'YS' | 'YM' | 'YL' | 'AS' | 'AM' | 'AL'
  /** Short flags surfaced on rosters (from the medical form). */
  medicalAlerts: string[]
  /** Free-text note a parent writes for coaches ("nervous in big breeze"). */
  parentNote?: { text: string; updatedAt: ISODateTime; by: string }
  /** People other than guardians allowed to pick this sailor up. */
  authorizedPickups?: string[]
}

/* ───────────── Attendance & safety ───────────── */

/** Check-in → on the water → ashore → picked up. */
export type AttendanceStatus = 'present' | 'absent' | 'on-water' | 'ashore' | 'picked-up'

export type AttendanceEntry = {
  sailorId: ID
  sessionId: ID
  date: ISODate
  status: AttendanceStatus
  updatedAt: ISODateTime
  by: string
  /** Who the sailor went home with. */
  pickedUpBy?: string
  launchedAt?: ISODateTime
}

export type SwimCheck = {
  sailorId: ID
  result: 'passed' | 'not-passed'
  date: ISODate
  by: string
  note?: string
}

/** A form the director pushed to families, with a due date. */
export type FormRequest = {
  id: ID
  templateId: ID
  /** Who it was sent to, resolved at send time. */
  familyIds: ID[]
  /** For per-sailor forms: which sailors need to sign. */
  sailorIds: ID[]
  audienceLabel: string
  dueDate?: ISODate
  message: string
  channels: Channel[]
  sentAt: ISODateTime
  sentBy: string
}

export type RegistrationStatus =
  | 'confirmed'
  | 'pending-payment'
  | 'waitlisted'
  | 'offered'
  | 'cancelled'

export type PriceLine = { label: string; amount: number }

export type Registration = {
  id: ID
  sailorId: ID
  sessionId: ID
  status: RegistrationStatus
  createdAt: ISODateTime
  /** Set when a waitlisted spot is offered; spot is held until this time. */
  offerExpiresAt?: ISODateTime
  price: number
  priceLines: PriceLine[]
  paid: number
}

export type CertType = {
  id: ID
  name: string
  /** How long a fresh cert stays valid, in months. */
  validMonths: number
  /** Required for these staff roles. */
  requiredFor: StaffRole[]
}

export type StaffRole =
  | 'program-director'
  | 'head-coach'
  | 'instructor'
  | 'assistant'

export type Certification = {
  certTypeId: ID
  issued: ISODate
  expires: ISODate
}

export type Coach = {
  id: ID
  name: string
  role: StaffRole
  email: string
  phone: string
  activities: Activity[]
  certs: Certification[]
  avatarHue: number
  /** Directory details. */
  emergencyContact?: { name: string; phone: string; relationship: string }
  startedSeason?: string // "Summer 2023"
  school?: string
  notes?: string
  /** Removed staff stay in history (attendance, documents) but leave rosters. */
  active?: boolean
}

/* ───────────── Documents ───────────── */

export type ClubDocument = {
  id: ID
  title: string
  kind: 'certification' | 'club' | 'other'
  /** Certification documents belong to a staff member and a cert type. */
  coachId?: ID
  certTypeId?: ID
  fileName: string
  mime: string
  sizeBytes: number
  uploadedAt: ISODateTime
  uploadedBy: string
  /** Expiry shown on the card (certifications). */
  expires?: ISODate
  /** Uploaded image/PDF kept in the demo (small files only). */
  dataUrl?: string
  /** Seeded examples render a placeholder preview. */
  sample?: boolean
  description?: string
}

/* ───────────── Calendar ───────────── */

export type ClubEvent = {
  id: ID
  title: string
  kind: 'regatta' | 'deadline' | 'meeting' | 'social' | 'training'
  date: ISODate
  endDate?: ISODate
  time?: string
  location?: string
  programIds?: ID[]
  notes?: string
}

/** A regatta the club is sending sailors to. Lives on the calendar as a ClubEvent of kind 'regatta'. */
export type RegattaDetails = {
  eventId: ID
  levels: Level[]
  /** Official entry happens elsewhere (Clubspot, Regatta Network…). */
  entryUrl?: string
  entryDeadline?: ISODate
  entryFee?: number
  coachIds: ID[]
  chaperonesNeeded: number
  travel?: string
}

export type RegattaResponse = {
  eventId: ID
  sailorId: ID
  status: 'interested' | 'going' | 'not-going'
  /** A guardian offered to chaperone. */
  chaperone?: boolean
  note?: string
  updatedAt: ISODateTime
  by: string
}

/* ───────────── Practice day ───────────── */

/** The call for one session on one day: on, delayed or cancelled. */
export type PracticeCall = {
  sessionId: ID
  date: ISODate
  status: 'on' | 'delayed' | 'cancelled'
  note?: string
  postedAt: ISODateTime
  by: string
}

export type LessonBlock = { minutes: number; title: string; detail?: string }

export type LessonPlan = {
  id: ID
  sessionId: ID
  date: ISODate
  title: string
  focus: string
  blocks: LessonBlock[]
  /** Skills this practice works on. */
  skillIds: ID[]
  notes?: string
  by: string
  updatedAt: ISODateTime
}

/** Season boat assignments for one session: sailor → boat, coach → coach boat. */
export type BoatAssignments = {
  sessionId: ID
  sailors: Record<ID, ID | 'own'>
  coaches: Record<ID, ID>
}

/* ───────────── Progress ───────────── */

export type SkillTrack = 'lts' | 'green' | 'champ' | 'c420' | 'ilca'

export type Skill = {
  id: ID
  track: SkillTrack
  area: 'Safety' | 'Boat handling' | 'Racing' | 'Rules' | 'Rigging'
  name: string
  detail: string
}

export type SkillMark = {
  sailorId: ID
  skillId: ID
  status: 'working' | 'got-it'
  date: ISODate
  by: string
}

/** A coach's written evaluation, shared with the family when ready. */
export type Evaluation = {
  id: ID
  sailorId: ID
  sessionId: ID
  coachId: ID
  date: ISODate
  strengths: string
  workOn: string
  nextStep: string
  shared: boolean
}

/* ───────────── Safety ───────────── */

export type Incident = {
  id: ID
  at: ISODateTime
  sessionId?: ID
  sailorIds: ID[]
  type: 'capsize-rescue' | 'injury' | 'near-miss' | 'equipment' | 'behavior' | 'weather' | 'other'
  severity: 'minor' | 'moderate' | 'serious'
  description: string
  actionTaken: string
  parentsNotified: boolean
  notifiedHow?: string
  reportedBy: string
  status: 'open' | 'closed'
}

/* ───────────── Equipment ───────────── */

export type Boat = {
  id: ID
  kind: 'Opti' | 'Club 420' | 'ILCA' | 'RIB' | 'Whaler' | 'Other'
  name: string // sail number or boat name
  status: 'ready' | 'needs-repair' | 'out-of-service'
  assignedTo?: string // program or group
  lastInspected?: ISODate
  issue?: string
}

/** Money received outside the card flow (a check, cash) or given back. */
export type LedgerEntry = {
  id: ID
  at: ISODateTime
  familyId: ID
  registrationIds: ID[]
  amount: number // negative = refund
  method: 'card' | 'check' | 'cash' | 'refund'
  memo: string
  recordedBy: string
}

/** A roster group within one session, e.g. "Green A" with two coaches. */
export type Group = {
  id: ID
  sessionId: ID
  name: string
  coachIds: ID[]
  sailorIds: ID[]
  /** Coach boat / court / lane assignment. */
  resource?: string
}

export type FormField =
  | { kind: 'text'; id: string; label: string; required?: boolean }
  | { kind: 'textarea'; id: string; label: string; required?: boolean }
  | { kind: 'date'; id: string; label: string; required?: boolean }
  | {
      kind: 'choice'
      id: string
      label: string
      options: string[]
      required?: boolean
    }

export type FormTemplate = {
  id: ID
  name: string
  short: string
  description: string
  /** Legal text the guardian agrees to. */
  body: string
  fields: FormField[]
  /** Per-sailor forms are signed once per sailor; family forms once per family. */
  scope: 'sailor' | 'family'
  requiresSignature: boolean
  /** Season forms every registered sailor needs. One-off forms (permission slips) are only due when sent. */
  required?: boolean
  custom?: boolean
}

export type FormSubmission = {
  id: ID
  templateId: ID
  familyId: ID
  sailorId?: ID
  season: string // "2026–27"
  signedBy: string
  signedAt: ISODateTime
  values: Record<string, string>
}

export type Channel = 'email' | 'sms'

export type Audience =
  | { kind: 'everyone' }
  | { kind: 'program'; programId: ID }
  | { kind: 'session'; sessionId: ID }
  | { kind: 'group'; groupId: ID }
  | { kind: 'staff' }
  | { kind: 'outstanding-forms' }
  | { kind: 'waitlisted' }
  /** An explicit list, e.g. the families a form was sent to. */
  | { kind: 'families'; familyIds: ID[]; label: string }

export type Announcement = {
  id: ID
  title: string
  body: string
  category: 'general' | 'weather' | 'schedule' | 'reminder'
  audience: Audience
  channels: Channel[]
  sentAt: ISODateTime
  sentBy: string
  recipients: number
  opened: number
}

export type PricingTier = {
  id: ID
  name: string
  unit: 'week' | 'term'
  member: number
  nonMember: number
}

export type PricingSettings = {
  tiers: PricingTier[]
  /** % off for each additional sibling registered in the same term. */
  siblingDiscountPct: number
  /** % off when a sailor books at least `multiWeekMin` camp weeks in a term. */
  multiWeekDiscountPct: number
  multiWeekMin: number
  /** % off registrations made before the term's earlyBirdUntil date. */
  earlyBirdPct: number
  /** Card processing fee passed to families (%). 0 to absorb it. */
  processingFeePct: number
}

export type WaitlistSettings = {
  memberPriority: boolean
  autoOffer: boolean
  holdHours: number
}

export type ClubSettings = {
  clubName: string
  shortName: string
  season: string
  supportEmail: string
  pricing: PricingSettings
  waitlist: WaitlistSettings
  certWarningDays: number
}

export type ActivityEvent = {
  id: ID
  at: ISODateTime
  kind:
    | 'registered'
    | 'waitlisted'
    | 'offered'
    | 'accepted'
    | 'cancelled'
    | 'form-signed'
    | 'announcement'
    | 'payment'
  text: string
}
