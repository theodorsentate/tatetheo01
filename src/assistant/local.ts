/**
 * Ask Burgee — offline engine.
 *
 * Answers the common questions instantly from the same data tools Claude
 * uses, by recognizing what the question is about. It runs when Claude isn't
 * available (the offline demo file, local dev, or a viewer who declined),
 * so the feature always works in a pitch.
 */
import { format } from 'date-fns'
import { CERT_TYPES } from '@/data/catalog'
import {
  type AssistantAction,
  type Ctx,
  attendanceInfo,
  calendarInfo,
  practiceTodayInfo,
  progressInfo,
  regattasInfo,
  documentsInfo,
  equipmentInfo,
  familyInfo,
  findStaff,
  incidentsInfo,
  staffDirectoryInfo,
  findSessions,
  formRequestsInfo,
  formsInfo,
  matchCert,
  matchPrograms,
  matchTerm,
  matchWeek,
  inboxInfo,
  parentNotesInfo,
  rostersInfo,
  sailorsInfo,
  sessionsInfo,
  staffCertifications,
  swimChecksInfo,
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
        channels: ['push', 'email'],
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
  // A calendar event named in the question ("the Harbor Island regatta", "parent night").
  const GENERIC = new Set(['regatta', 'championship', 'junior', 'every', 'group', 'meeting', 'party', 'opti', 'fleet', 'green', 'coach', 'harbor', 'inner', 'slips'])
  const eventWord = ctx.s.calendar
    .flatMap((e) => e.title.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 4 && !GENERIC.has(w)))
    .find((w) => q.includes(w))

  const staff = findStaff(ctx, q)

  /* Staff contact details */
  if (staff && /\b(phone|number|cell|email|e-mail|contact|call|reach|text)\b/.test(q) && !/\bcert/.test(q)) {
    const r = staffDirectoryInfo(ctx, { name: staff.name }).rows[0]
    actions.push({ kind: 'link', label: 'Open staff directory', href: '/admin/directory' })
    return {
      text: `**${r.name}**: ${r.phone}, ${r.email}.${r.emergencyContact ? ` Emergency contact: ${r.emergencyContact}.` : ''}${r.groups.length ? ` Coaching ${r.groups.join(', ')}.` : ''}${r.notes ? `\n\n${r.notes}` : ''}`,
      actions,
    }
  }

  /* Documents and certificate files */
  if (/certificate|\bcards?\b|document|\bdocs?\b|\bfiles?\b|\bpdf\b|upload|copy of|emergency (action )?plan|handbook|policy/.test(q)) {
    const certId = matchCert(q)
    const res = documentsInfo(ctx, { person: staff?.name, cert: certId, missingOnly: /missing|haven.?t|no file|without/.test(q) })
    actions.push({ kind: 'link', label: 'Open documents', href: staff || certId ? res.rows[0]?.href ?? '/admin/documents' : '/admin/documents' })
    if (!staff && !certId && /plan|handbook|policy|protocol|insurance|club doc/.test(q))
      return { text: `Club documents on file:\n\n${list(res.clubDocuments)}`, actions }
    if (!res.rows.length) return { text: 'No certification records match that.', actions }
    return {
      text:
        (res.missingFiles && !staff ? `**${res.missingFiles} certifications** have no file uploaded.\n\n` : '') +
        list(res.rows.map((r) => `[${r.staff}](${r.href}), ${r.cert}: ${r.file ? r.file : 'no file on record'}${r.expires ? `, valid to ${r.expires}` : ''}${r.status !== 'valid' ? ` (**${r.status}**)` : ''}`), 15),
      actions,
    }
  }

  /* Today's practice calls */
  if (/practice/.test(q) && /today|tonight|this afternoon|\bon\b|cancel|delay|call/.test(q) && !/plan|attend/.test(q)) {
    const res = practiceTodayInfo(ctx)
    actions.push({ kind: 'link', label: 'Open Home', href: '/admin' })
    if (!res.teams.length) return { text: `No teams practice today (${res.date}).`, actions }
    return {
      text: list(res.teams.map((t) => `**${t.team}** (${t.time}): ${t.call === 'no call yet' ? 'no call yet' : `${t.call}${t.calledBy ? `, called by ${t.calledBy}` : ''}`}${t.note ? `. “${t.note}”` : ''} Plan: ${t.lessonPlan}.`)),
      actions,
    }
  }

  /* Regattas: who's going */
  if ((/regatta|championship|invitational/.test(q) || eventWord) && /going|interested|answer|respond|coming|chaperone|who('s| is) (in|racing)|how many|entries|entered/.test(q) && !/slip|permission|signed/.test(q)) {
    const res = regattasInfo(ctx, { search: eventWord })
    const r = res.regattas[0]
    if (!r) return { text: 'No upcoming regattas match that.', actions }
    actions.push({ kind: 'link', label: `Open ${r.title}`, href: r.page })
    if (wantsMessage(q) && r.noAnswer.length) {
      const fams = [...new Set(r.noAnswer.map((n) => ctx.s.sailors.find((k) => `${k.firstName} ${k.lastName}` === n)?.familyId).filter(Boolean) as string[])]
      actions.push({
        kind: 'draft',
        label: 'Review reminder to families who haven’t answered',
        title: `${r.title}: are you in?`,
        body: `Let us know${r.entryDeadline ? ` by ${r.entryDeadline}` : ' this week'}. Open Burgee and tap Interested or Going so coaches can plan.`,
        audience: { kind: 'families', familyIds: fams, label: `${r.title}: no answer yet` },
        channels: ['push', 'email'],
      })
    }
    return {
      text:
        `**${r.title}** (${r.date}${r.location ? `, ${r.location}` : ''}): **${r.going.length} going**, ${r.interested.length} interested, ${r.noAnswer.length} haven’t answered. Chaperones: ${r.chaperones}.\n\n` +
        (r.going.length ? `Going:\n${list(r.going, 25)}\n\n` : '') +
        (r.interested.length ? `Interested: ${r.interested.join(', ')}.\n\n` : '') +
        (r.noAnswer.length ? `No answer yet: ${r.noAnswer.join(', ')}.` : '') +
        (wantsMessage(q) && r.noAnswer.length ? '\n\nI drafted a reminder for you to review. Nothing has been sent.' : ''),
      actions,
    }
  }

  /* Evaluations waiting for approval */
  if (/evaluation/.test(q) && /(approv|waiting|pending|review|sign off)/.test(q)) {
    const res = progressInfo(ctx, {})
    actions.push({ kind: 'link', label: 'Review evaluations', href: res.progressPage })
    if (!res.waitingForApproval.length) return { text: 'No evaluations are waiting for you.', actions }
    return {
      text: `**${res.waitingForApproval.length} evaluations** are waiting for your approval. Families see them once you approve:\n\n${list(res.waitingForApproval.map((e) => `${e.sailor}, from ${e.coach} (${e.written})`))}`,
      actions,
    }
  }

  /* Progress and evaluations */
  if (/move up|ready for|progress|skills?\b|evaluation|evals?\b|how (is|'s) \w+ doing|how.s \w+ doing/.test(q)) {
    const todayIso = format(ctx.now, 'yyyy-MM-dd')
    const here = (id: string) =>
      ctx.s.registrations.some((r) => {
        const se = r.sailorId === id && r.status === 'confirmed' ? ctx.s.sessions.find((x) => x.id === r.sessionId) : undefined
        return !!se && se.startDate <= todayIso && se.endDate >= todayIso
      })
    const named = ctx.s.sailors.filter((k) => new RegExp(`\\b${k.firstName.toLowerCase()}\\b`).test(q))
    const kid = named.find((k) => (k.id === 's-hazel' || k.id === 's-finn' || k.id === 's-lucy') && here(k.id)) ?? named.find((k) => here(k.id))
    const program = matchPrograms(q).length ? q : undefined
    const res = progressInfo(ctx, { sailor: kid ? `${kid.firstName} ${kid.lastName}` : undefined, program })
    actions.push({ kind: 'link', label: 'Open progress', href: '/admin/progress' })
    if (kid && res.rows[0]) {
      const r = res.rows[0]
      return {
        text:
          `**${r.sailor}** (${r.team}): ${r.skills} ${r.track} skills${r.workingOn.length ? `, working on ${r.workingOn.join(', ').toLowerCase()}` : ''}. Evaluation: ${r.evaluation}.` +
          (r.evaluationText ? `\n\n**Going well:** ${r.evaluationText.strengths}\n\n**Working on:** ${r.evaluationText.workOn}${r.evaluationText.nextStep ? `\n\n**Next step:** ${r.evaluationText.nextStep}` : ''}` : ''),
        actions,
      }
    }
    if (/evaluation|evals?\b/.test(q)) {
      const missing = res.rows.filter((r) => r.evaluation === 'not written')
      return { text: `**${missing.length} of ${res.rows.length}** sailors this week don’t have an evaluation yet.\n\n${list(missing.map((r) => `${r.sailor} (${r.team})`), 15)}`, actions }
    }
    const ready = res.rows.filter((r) => r.readyToMoveUp)
    const close = res.rows.filter((r) => !r.readyToMoveUp && Number(r.skills.split(' ')[0]) >= 6)
    return {
      text:
        (ready.length ? `**Ready to move up** (every skill ticked off):\n${list(ready.map((r) => `${r.sailor}, ${r.track}`))}\n\n` : 'Nobody has every skill ticked off yet.\n\n') +
        (close.length ? `**Close** (6 or more of 8):\n${list(close.map((r) => `${r.sailor} (${r.skills})`), 12)}` : ''),
      actions,
    }
  }

  /* Incidents */
  if (/incident|injur|accident|near.?miss|hurt|capsiz/.test(q)) {
    const res = incidentsInfo(ctx, { status: /open|unresolved|follow/.test(q) ? 'open' : 'all' })
    actions.push({ kind: 'link', label: 'Open incident reports', href: '/admin/incidents' })
    if (!res.incidents.length) return { text: 'No incident reports.', actions }
    return {
      text: list(res.incidents.map((i) => `**${i.when}** (${i.type.replace('-', ' ')}, ${i.severity}, ${i.status}): ${i.description} Parents told: ${i.parentsNotified}.`), 8),
      actions,
    }
  }

  /* Boats */
  if (/\b(boats?|ribs?|whalers?|outboard|motor|fleet|equipment|optis)\b/.test(q) && /repair|broken|fix|work|ready|status|service|down|need|wrong/.test(q)) {
    const res = equipmentInfo(ctx, {})
    actions.push({ kind: 'link', label: 'Open boats & equipment', href: '/admin/equipment' })
    return {
      text: `**${res.totals.ready} of ${res.totals.all}** boats are ready. These need work:\n\n${list(res.boats.map((b) => `**${b.name}** (${b.status.replace(/-/g, ' ')}): ${b.issue ?? 'no details'}`))}`,
      actions,
    }
  }

  /* Calendar */
  if (/coming up|upcoming|calendar|schedule|when is|when's|regatta|deadline|this weekend|next week|events?\b|banquet|meeting/.test(q)) {
    const res = calendarInfo(ctx, { search: /when is|when's/.test(q) ? eventWord : undefined, days: /week/.test(q) ? 7 : 60 })
    actions.push({ kind: 'link', label: 'Open calendar', href: '/admin/calendar' })
    if (!res.events.length) return { text: 'Nothing on the calendar for that.', actions }
    return {
      text: list(res.events.map((e) => `**${e.date}**: ${e.title}${e.time ? `, ${e.time}` : ''}${e.location ? ` at ${e.location}` : ''}`), 10),
      actions,
    }
  }

  /* One-off forms sent to families (permission slips) */
  if (/permission|slip|sent (a |the )?form|forms? (we|i) sent/.test(q)) {
    const reqs = formRequestsInfo(ctx)
    actions.push({ kind: 'link', label: 'Open forms & waivers', href: '/admin/forms' })
    if (!reqs.length) return { text: 'No forms have been sent out for signature yet.', actions }
    return {
      text: reqs
        .map((r) => `**${r.form}**: ${r.signed} of ${r.of} signed${r.due ? `, due ${r.due}` : ''}.${r.notSignedYet.length ? `\n\nStill waiting on:\n${list(r.notSignedYet, 15)}` : ''}`)
        .join('\n\n'),
      actions,
    }
  }

  /* Swim checks */
  if (/swim\s*(check|test)|passed (the |a )?swim|can.?t swim/.test(q) && !/\bforms?\b|sign/.test(q)) {
    // Drop the phrase "swim check" before reading the scope.
    const sc = scopeOf(q.replace(/swim\s*(check|test)s?|passed (the |a )?swim|can.?t swim/g, ''))
    const res = swimChecksInfo(ctx, sc)
    if (!res.needSwimCheck) return { text: `Everyone registered${sc.program || sc.week ? ' there' : ''} has passed a swim check.`, actions }
    return {
      text: `**${res.needSwimCheck} of ${res.sailorsChecked} sailors**${sc.program || sc.week ? ' in that group' : ''} still need a swim check. Coaches can record it from the roster on their phone.\n\n${list(res.rows.map((r) => `[${r.sailor}](${r.familyHref}): ${r.status}`), 15)}`,
      actions,
    }
  }

  /* Attendance */
  if (/on the water|attendance|absent|missed|missing practice|checked in|who.?s here|picked up|went home|sign(ed)? out|ashore/.test(q)) {
    const sc = scopeOf(q)
    const res = attendanceInfo(ctx, sc)
    if (!res.sessions.length) return { text: 'No sessions are running right now.', actions }
    const concerns = /missed|attendance|absent a lot|skipping/.test(q) && !/today/.test(q)
    const text = res.sessions
      .filter((s) => (concerns ? s.attendanceConcerns.length : true))
      .map((s) => {
        if (concerns) return `**[${s.session}](${s.href})**:\n${list(s.attendanceConcerns)}`
        const t = s.today
        const parts = [
          t.onTheWater.length ? `**${t.onTheWater.length} on the water**: ${t.onTheWater.join(', ')}` : '',
          t.here.length ? `${t.here.length} here on land: ${t.here.join(', ')}` : '',
          t.absent.length ? `Absent: ${t.absent.join(', ')}` : '',
          t.wentHome.length ? `Went home: ${t.wentHome.join('; ')}` : '',
          t.notCheckedIn ? `${t.notCheckedIn} not checked in yet` : '',
        ].filter(Boolean)
        return `**[${s.session}](${s.href})**${s.practiceToday ? '' : ' (no practice today)'}:\n${list(parts.length ? parts : ['Nobody checked in yet'])}`
      })
      .join('\n\n')
    return { text: text || 'Nobody has a worrying attendance record right now.', actions }
  }

  /* Who's out, late or being picked up by someone else */
  if (/(who('s| is)? out|absent|out today|picking (\w+ )?up|picked up|pickup|running late|late today|leaving early|day notes?|parent notes? (for )?today)/.test(q)) {
    const res = parentNotesInfo(ctx, { date: /tomorrow|this week|upcoming|coming/.test(q) ? 'upcoming' : undefined })
    actions.push({ kind: 'link', label: 'Open attendance', href: res.attendancePage })
    if (!res.rows.length) return { text: `Nobody has told the coaches anything for ${res.date}.`, actions }
    return {
      text: `Parents sent **${res.rows.length} note${res.rows.length === 1 ? '' : 's'}** for ${res.date}. The coaches already see them on their rosters:\n\n${list(res.rows.map((r) => `**${r.sailor}** ${r.what}${r.note ? ` (“${r.note}”)` : ''}, from ${r.toldBy.split(' ')[0]}${r.coach ? `. Coach: ${r.coach}` : ''}`))}`,
      actions,
    }
  }

  /* Inbox */
  if (/(inbox|unread|new messages|any messages|who (wrote|messaged|emailed)|waiting (on|for) me|questions from parents)/.test(q)) {
    const res = inboxInfo(ctx, {})
    actions.push({ kind: 'link', label: 'Open the inbox', href: res.inboxPage })
    const waiting = res.rows.filter((r) => r.waitingForDirector)
    if (!waiting.length) return { text: 'Nothing is waiting for you in the inbox.', actions }
    return {
      text: `**${waiting.length} conversation${waiting.length === 1 ? '' : 's'}** waiting for you:\n\n${list(waiting.map((r) => `**${r.subject}**, ${r.lastFrom}: “${r.lastMessage}”`))}`,
      actions,
    }
  }

  /* Parent notes */
  if (/\bnotes?\b|parents? (said|wrote|told)|anything (i|coaches) should know/.test(q) && !/\bforms?\b/.test(q)) {
    const sc = scopeOf(q)
    const res = sailorsInfo(ctx, { ...sc, limit: 200 })
    const withNotes = res.rows.filter((r) => r.parentNote)
    if (!withNotes.length) return { text: 'No parent notes for that group.', actions }
    return {
      text: `**${withNotes.length} sailors** have notes from parents:\n\n${list(withNotes.map((r) => `[${r.name}](${r.familyHref}): ${r.parentNote}`), 15)}`,
      actions,
    }
  }

  /* Money: lives in the club's registration system */
  if (/\b(owe|owes|owing|balance|unpaid|outstanding payment|payment|collected|revenue|tuition|money)\b/.test(q)) {
    return {
      text: 'Burgee doesn’t handle payments: sign-ups and balances stay in your registration system (Clubspot or whatever the club uses). I can tell you who is signed up for which weeks, though.',
      actions: [{ kind: 'link', label: 'Open registrations', href: '/admin/registrations' }],
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
        channels: ['push', 'email'],
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
        list(f.sailors.map((k) => `**${k.name}** (${k.fleet})${k.medicalAlerts.length ? `, ${k.medicalAlerts.join('; ')}` : ''}${k.formsMissing.length ? `, missing ${k.formsMissing.join(', ').toLowerCase()}` : ''}: ${f.registrations.filter((r) => r.sailor === k.name).map((r) => `${r.session} (${r.status})`).join('; ') || 'no registrations'}`)),
      actions,
    }
  }
  const kid = ctx.s.sailors.find((k) => q.includes(`${k.firstName} ${k.lastName}`.toLowerCase()))
  if (kid) {
    const r = sailorsInfo(ctx, { name: `${kid.firstName} ${kid.lastName}` }).rows[0]
    return {
      text: `**${r.name}**, ${r.age}, ${r.fleet} ([${r.family} family](${r.familyHref})).${r.medicalAlerts.length ? ` Medical: ${r.medicalAlerts.join('; ')}.` : ''}${r.parentNote ? ` Parent note: “${r.parentNote}”` : ''} Swim check: ${r.swimCheck}.${r.formsMissing.length ? ` Missing ${r.formsMissing.join(', ').toLowerCase()}.` : ''}\n\n${list(r.registrations)}`,
      actions,
    }
  }

  return {
    text:
      "I can look up who's out today, messages waiting for you, evaluations to approve, staff certifications, rosters and coach ratios, missing forms, medical alerts, regattas, and any family or sailor by name. Try one of the suggestions, or ask something like \"who's picking up early today?\"",
    actions,
  }
}

export const SUGGESTIONS = [
  'Who still needs their SafeSport?',
  "Who's out today?",
  'Which evaluations need my approval?',
  'Who hasn’t signed the Harbor Island permission slip?',
  'Who still needs a swim check?',
  'Remind families who are missing forms',
]
