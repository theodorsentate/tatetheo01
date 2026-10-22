/**
 * Ask Burgee — offline engine.
 *
 * Answers the common questions instantly from the same data tools Claude
 * uses, by recognizing what the question is about. It runs when Claude isn't
 * available (the offline demo file, local dev, or a viewer who declined),
 * so the feature always works in a pitch.
 */
import { CERT_TYPES } from '@/data/catalog'
import { money } from '@/domain/pricing'
import {
  type AssistantAction,
  type Ctx,
  familyInfo,
  findSessions,
  formsInfo,
  matchCert,
  matchPrograms,
  matchTerm,
  matchWeek,
  moneyInfo,
  rostersInfo,
  sailorsInfo,
  sessionsInfo,
  staffCertifications,
  waitlistInfo,
} from './query'

export type LocalAnswer = { text: string; actions: AssistantAction[] }

const list = (items: string[], max = 12) =>
  items.slice(0, max).map((i) => `- ${i}`).join('\n') + (items.length > max ? `\n- …and ${items.length - max} more` : '')

const wantsMessage = (q: string) => /\b(remind|send|message|email|text|nudge|notify|tell them|reach out)\b/.test(q)

function scopeOf(q: string) {
  return {
    program: matchPrograms(q).length ? q : undefined,
    term: matchTerm(q) ? q : undefined,
    week: matchWeek(q) ? q : undefined,
  }
}

function scopeLabel(ctx: Ctx, q: string) {
  const s = findSessions(ctx, scopeOf(q))
  return s.length === ctx.s.sessions.length ? '' : s.length
}

export function answerLocally(question: string, ctx: Ctx): LocalAnswer {
  const q = question.toLowerCase()
  const actions: AssistantAction[] = []

  /* Certifications */
  const certId = matchCert(q)
  if (certId || /\bcert|certif|expir|renew|credential|background|clearance/.test(q)) {
    const res = staffCertifications(ctx, { cert: certId, status: /current|valid|who has/.test(q) && !/need|missing|expir/.test(q) ? 'valid' : 'needs-action' })
    const certName = certId ? CERT_TYPES.find((c) => c.id === certId)!.name : 'certifications'
    if (wantsMessage(q) && res.rows.length) {
      actions.push({
        kind: 'draft',
        label: 'Review draft to coaches & staff',
        title: `${certId ? certName : 'Certification'} renewals due`,
        body: `Hi all, a quick admin note. ${[...new Set(res.rows.map((r) => r.staff.split(' ')[0]))].join(', ')}: your ${certId ? certName : 'certifications'} ${res.rows.length > 1 ? 'are' : 'is'} expired, missing, or expiring soon. Please renew and upload the card in Burgee (Certifications tab) before your next session so you stay on the roster. Thanks!`,
        audience: { kind: 'staff' },
        channels: ['email', 'sms'],
      })
    }
    actions.push({ kind: 'link', label: 'Open staff & certifications', href: '/admin/staff' })
    if (res.filter === 'valid') {
      return { text: `**${res.rows.length} staff** are current on ${certName}.\n\n${list(res.rows.map((r) => `${r.staff}, through ${r.expires}`))}`, actions }
    }
    if (!res.rows.length) return { text: `Everyone who needs ${certName} is current. Nothing expires in the next ${res.warningWindowDays} days.`, actions }
    const people = [...new Set(res.rows.map((r) => r.staff))]
    return {
      text:
        `**${people.length} ${people.length === 1 ? 'person needs' : 'people need'}** ${certId ? `to sort out ${certName}` : 'attention on certifications'}:\n\n` +
        list(
          res.rows.map((r) => {
            const what = r.status === 'expired' ? `expired ${r.expires}` : r.status === 'missing' ? 'nothing on file' : `expires ${r.expires} (${r.daysLeft} days)`
            return `[${r.staff}](/admin/staff)${certId ? '' : `, ${r.cert}`}: ${what}${r.status !== 'expiring' && r.onRoster ? ', and they are on a roster' : ''}`
          })
        ) +
        (wantsMessage(q) ? '\n\nI drafted a reminder to staff for you to review. Nothing has been sent.' : ''),
      actions,
    }
  }

  const famMentioned = ctx.s.families.find((f) => new RegExp(`\\b${f.name.toLowerCase()}s?\\b`).test(q))

  /* Money */
  if (/\b(owe|owes|owing|balance|unpaid|outstanding payment|paid|payment|collected|revenue|tuition|money)\b/.test(q)) {
    const m = moneyInfo(ctx)
    if (famMentioned) {
      const f = familyInfo(ctx, { name: famMentioned.name }).families[0]
      const due = f.registrations.filter((r) => r.status === 'pending-payment')
      actions.push({ kind: 'link', label: `Open the ${f.family} family`, href: f.href })
      return {
        text: f.balanceDue
          ? `The [${f.family} family](${f.href}) owes **${money(f.balanceDue)}**:\n\n${list(due.map((r) => `${r.sailor}, ${r.session}: ${money(r.price - r.paid)}`))}`
          : `The [${f.family} family](${f.href}) is paid up. Nothing is due.`,
        actions,
      }
    }
    actions.push({ kind: 'link', label: 'Open balance-due registrations', href: '/admin/registrations?status=pending-payment' })
    if (/revenue|collected|booked|tuition|how much/.test(q) && !/owe|unpaid|balance/.test(q)) {
      return {
        text: `Tuition booked vs collected:\n\n${list(m.byTerm.map((t) => `**${t.term}**: ${money(t.booked)} booked, ${money(t.collected)} collected`))}\n\nUnpaid right now: **${money(m.totalOutstanding)}**.`,
        actions,
      }
    }
    if (!m.familiesWithBalance.length) return { text: 'No one owes anything right now.', actions }
    return {
      text: `**${m.familiesWithBalance.length} families owe ${money(m.totalOutstanding)}** in total:\n\n${list(
        m.familiesWithBalance.map((f) => `[${f.family}](${f.href}): ${money(f.due)} for ${f.for.join('; ')}`),
        10
      )}`,
      actions,
    }
  }

  /* Forms */
  if (/\b(form|forms|waiver|waivers|swim test|photo release|medical form|paperwork|signed|sign)\b/.test(q)) {
    const form = /waiver|release & assumption/.test(q) ? 'waiver' : /swim/.test(q) ? 'swim' : /photo/.test(q) ? 'photo' : /medical/.test(q) ? 'medical' : undefined
    const sc = scopeOf(q)
    const res = formsInfo(ctx, { form, ...sc })
    actions.push({ kind: 'link', label: 'Open forms & waivers', href: '/admin/forms' })
    if (wantsMessage(q) && res.rows.length) {
      actions.push({
        kind: 'draft',
        label: 'Review draft to families with forms due',
        title: `Reminder: ${ctx.s.settings.season} forms`,
        body: `Hi! Our records show your sailor is still missing ${form ? `the ${res.form}` : 'one or more season forms'} for ${ctx.s.settings.season}. It takes about a minute from your phone in Burgee. Sailors need these on file before their next session. Thank you!`,
        audience: { kind: 'outstanding-forms' },
        channels: ['email', 'sms'],
      })
    }
    if (!res.rows.length) return { text: `Everyone registered${scopeLabel(ctx, q) ? ' in that session' : ''} has ${form ? `their ${res.form}` : 'all their forms'} in.`, actions }
    return {
      text:
        `**${res.sailorsMissing} of ${res.activeSailors} sailors**${sc.program || sc.week ? ' in that group' : ''} are missing ${form ? `the ${res.form}` : 'at least one form'}:\n\n` +
        list(res.rows.map((r) => `[${r.sailor}](${r.familyHref}): ${r.missing.join(', ')} (${r.guardian}, ${r.phone})`), 10) +
        (wantsMessage(q) ? '\n\nI drafted a reminder to those families. Review it before it goes out.' : ''),
      actions,
    }
  }

  /* Medical */
  if (/allerg|medical|epipen|epi-pen|asthma|inhaler|diabet|health|meds|medication/.test(q)) {
    const sc = scopeOf(q)
    const res = sailorsInfo(ctx, { ...sc, withMedical: true, limit: 30 })
    if (!res.rows.length) return { text: 'No sailors with medical alerts in that group.', actions }
    return {
      text:
        `**${res.matched} ${res.matched === 1 ? 'sailor' : 'sailors'}**${sc.program || sc.week || sc.term ? ' in that group' : ''} ${res.matched === 1 ? 'has a medical alert' : 'have medical alerts'}:\n\n` +
        list(res.rows.map((r) => `[${r.name}](${r.familyHref}), ${r.age}: ${r.medicalAlerts.join('; ')}${r.emergencyContact ? `. Emergency: ${r.emergencyContact}` : ''}`), 15),
      actions,
    }
  }

  /* Waitlists */
  if (/wait\s*list|waiting|in line|on deck|offer/.test(q)) {
    const sc = scopeOf(q)
    const res = waitlistInfo(ctx, sc)
    const specific = !!(sc.program || sc.week)
    if (!res.sessions.length) return { text: specific ? 'Nobody is waiting for that session.' : 'No waitlists right now.', actions }
    if (specific && res.sessions.length <= 2) {
      const text = res.sessions
        .map((s) => {
          actions.push({ kind: 'link', label: `Open ${s.session}`, href: s.href })
          const offers = s.offersOut.map((o) => `${o.sailor} (offer out, ${o.holdEndsInHours}h left)`)
          return `**[${s.session}](${s.href})**: ${s.inLine.length} waiting${s.spotsLeft ? `, ${s.spotsLeft} spots open` : ', full'}.\n\n${list([...offers, ...s.inLine.map((p) => `#${p.position} ${p.sailor} (${p.member ? 'member' : 'non-member'}, joined ${p.joined})`)])}`
        })
        .join('\n\n')
      return { text: `${text}\n\n${res.rules}. Offers hold ${res.holdHours} hours.`, actions }
    }
    actions.push({ kind: 'link', label: 'Open waitlist', href: '/admin/registrations?status=waitlisted' })
    const total = res.sessions.reduce((n, s) => n + s.inLine.length, 0)
    return {
      text: `**${total} sailors** are waiting across ${res.sessions.length} sessions:\n\n${list(
        res.sessions.map((s) => `[${s.session}](${s.href}): ${s.inLine.length} waiting${s.offersOut.length ? `, ${s.offersOut.length} offer${s.offersOut.length > 1 ? 's' : ''} out` : ''}`)
      )}`,
      actions,
    }
  }

  /* Rosters & coaches */
  if (/\bcoach(es|ing)?\b|ratio|group|roster|who.?s (on|in)|instructor/.test(q) && !/cert/.test(q)) {
    const sc = scopeOf(q)
    const coachName = ctx.s.coaches.find((c) => q.includes(c.name.split(' ')[0].toLowerCase()))?.name
    const res = rostersInfo(ctx, { ...sc, coach: coachName, problemsOnly: /problem|short|over|missing|no coach|uncovered|need/.test(q) })
    if (!res.groups.length)
      return { text: res.sessionsWithoutGroupsYet.length ? `No groups built yet for ${res.sessionsWithoutGroupsYet.join(', ')}. Open the session and use Build groups.` : 'No roster groups match that.', actions }
    return {
      text: list(
        res.groups.map((g) =>
          g.problem
            ? `**${g.group}** ([${g.session}](${g.href})): **${g.problem}**, ${g.sailors} sailors at ${g.ratio}${g.coaches.length ? ` with ${g.coaches.join(' & ')}` : ''}`
            : `**${g.group}** ([${g.session}](${g.href})): ${g.coaches.join(' & ')}, ${g.sailors} sailors at ${g.ratio}`
        ),
        14
      ),
      actions,
    }
  }

  /* Capacity */
  if (/full|spots?|space|room|capacity|open|sold out|how many|availability|fill/.test(q)) {
    const sc = scopeOf(q)
    const filter = /how full|fill/.test(q) ? 'all' : /full|sold out/.test(q) ? 'full' : /open|spots?|space|room|availab/.test(q) && !(sc.program || sc.week) ? 'open' : 'all'
    const res = sessionsInfo(ctx, { ...sc, term: sc.term ?? (sc.program || sc.week ? undefined : 'summer'), filter })
    if (!res.rows.length) return { text: filter === 'full' ? 'Nothing is full yet.' : 'No sessions match that.', actions }
    return {
      text:
        (filter === 'full' ? `**${res.matched} sessions are full:**\n\n` : '') +
        list(res.rows.map((r) => `[${r.session}](${r.href}): ${r.taken}/${r.capacity}${r.spotsLeft ? `, ${r.spotsLeft} open` : ', full'}${r.waitlist ? `, ${r.waitlist} waiting` : ''}`), 16),
      actions,
    }
  }

  /* A family or sailor by name */
  const fam = famMentioned
  if (fam) {
    const f = familyInfo(ctx, { name: fam.name }).families[0]
    actions.push({ kind: 'link', label: `Open the ${f.family} family`, href: f.href })
    return {
      text:
        `**[${f.family} family](${f.href})**, ${f.membership}. ${f.guardians.map((g) => `${g.name} ${g.phone}`).join(', ')}.\n\n` +
        list(f.sailors.map((k) => `**${k.name}** (${k.fleet})${k.medicalAlerts.length ? `, ${k.medicalAlerts.join('; ')}` : ''}${k.formsMissing.length ? `, missing ${k.formsMissing.join(', ').toLowerCase()}` : ''}: ${f.registrations.filter((r) => r.sailor === k.name).map((r) => `${r.session} (${r.status})`).join('; ') || 'no registrations'}`)) +
        (f.balanceDue ? `\n\nBalance due: **${money(f.balanceDue)}**.` : ''),
      actions,
    }
  }
  const kid = ctx.s.sailors.find((k) => q.includes(`${k.firstName} ${k.lastName}`.toLowerCase()))
  if (kid) {
    const r = sailorsInfo(ctx, { name: `${kid.firstName} ${kid.lastName}` }).rows[0]
    return {
      text: `**${r.name}**, ${r.age}, ${r.fleet} ([${r.family} family](${r.familyHref})).${r.medicalAlerts.length ? ` Medical: ${r.medicalAlerts.join('; ')}.` : ''}${r.formsMissing.length ? ` Missing ${r.formsMissing.join(', ').toLowerCase()}.` : ''}\n\n${list(r.registrations)}`,
      actions,
    }
  }

  return {
    text:
      "I can look up staff certifications, waitlists, full or open weeks, rosters and coach ratios, missing forms, medical alerts, balances, and any family by name. Try one of the suggestions, or ask something like \"who's on the Opti Green week 3 waitlist?\"",
    actions,
  }
}

export const SUGGESTIONS = [
  'Who still needs their SafeSport?',
  'Which summer weeks are full?',
  "Who's on the Green Camp week 3 waitlist?",
  'Which families owe money?',
  'Any allergies on the Green Team?',
  'Remind families who are missing forms',
]
