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

export type Activity = 'sailing' | 'swim' | 'tennis'

/** Fleets / levels a sailor can be placed in. */
export type Level =
  | 'learn-to-sail'
  | 'opti-green'
  | 'opti-red'
  | 'opti-white'
  | 'opti-blue'
  | 'club-420'
  | 'ilca'
  | 'swim'
  | 'tennis'

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
  | 'swim-coach'
  | 'tennis-pro'

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
