# Burgee

The day-to-day app for a yacht club's junior sailing program. One place for the program director, coaches, parents and older sailors: is sailing on today, who's on the water, who's out or getting picked up early, today's plan, how each kid is progressing, who's going to the regatta, and a conversation with the coach when something comes up.

Burgee works **alongside** the club's registration system (Clubspot, a spreadsheet, paper). Sign-ups and payments stay there; Burgee imports the roster and runs the summer from it.

This repo is the **clickable demo**, built on the same structure the real product will use. Everything runs in the browser against a fictional club, Saltmarsh Bay Yacht Club, on a Wednesday in July: week 5 of summer camp, with morning (AM) and afternoon (PM) groups. The **Demo view** menu can jump to the afternoon, when the PM groups sail. Burgee is sailing-only for now.

## The five views

| View | Who | What it does |
| --- | --- | --- |
| **Program director** (`/admin`) | Laptop or phone | Seven sections: Home, Schedule, Registrations, Sailors, Staff, Messages, Club (below) |
| **Coach** (`/coach`) | Phone | Today's AM and PM groups. Each group has four tabs. **Roster**: check-in, launch, ashore and sign-out to an approved pickup; swim checks that gate launching; parents' notes for the day (out, late, leaving early, someone else picking up) right on the roster; an **emergency card** with contacts and medical notes for that group only. **Plan**: today's lesson plan (the head coach plans for everyone, or each coach for their own group, set per program). **Boats**. **Skills**: Introduced → In progress → Completed for each sailor, and evaluations that go to the director for approval. Only the director makes the practice call. |
| **Parent** (`/family`) | Phone | One screen per kid: is sailing on and is my kid on the water; two taps to tell the coaches they're out, late, leaving early or being picked up by someone else; a to-do list (forms, regatta answers); news from the club; skills and the coach's evaluation; who's in their group this week; their weeks. Plus a three-week schedule with **Add to calendar**, and two-way messages with coaches and the director. |
| **Sailor** (`/sailor`) | Phone | For older sailors: today's call and plan, their regattas, skills and evaluation, and messages with their coaches. Parents are copied on every conversation automatically (SafeSport). |
| **Junior committee** (`/committee`) | Laptop | A read-only season report: sailors, attendance, sailing days, staff certifications, safety, programs and what Burgee handled. No names, phone numbers or medical details. |

### Director sections

| Section | Tabs | What it's for |
| --- | --- | --- |
| Home | | Today's AM and PM groups with a one-tap On / Delayed / Cancelled call; what needs the director, split into **Today**, **This week** and **Later**; the week at a glance; what's coming up; the Ask Burgee bar |
| Schedule | Calendar, Regattas, Programs, Attendance | The season. Regattas: families answer Interested / Going from their app; see who's going, who hasn't answered (with a one-tap reminder), chaperones; link to the official entry |
| Registrations | | Who's signed up for which weeks, one row per sailor. **Import roster** takes a CSV or a Clubspot export and matches it to programs and weeks; importing twice doesn't duplicate anything |
| Sailors | Sailors, Progress, Families | Every junior; skills, plus the **evaluations waiting for approval**; guardians and forms |
| Staff | Directory, Certifications, Documents | Add, edit and remove staff; required certs with expiry warnings; every certificate file |
| Messages | Inbox, Announcements, Forms & waivers, Incident reports | Two-way conversations (the director can also read every conversation in the program); announcements go out as an app notification and email, with a switch to also text when it's urgent |
| Club | Boats, Reports, Settings | The fleet and coach boats; CSV reports; club details and the emergency card every coach carries |

Switch views from the welcome page (`/`) or the **Demo view** menu. That menu also resets the demo data.

## Ask Burgee

The director can ask off-the-cuff questions from any page: the **Ask Burgee** button, the ask bar on Home, or ⌘K. Examples: "who's out today?", "any messages waiting for me?", "which evaluations need my approval?", "who still needs their SafeSport?", "who's going to the Lowcountry championship?", "is practice on today?", "remind families who are missing forms".

- `src/assistant/query.ts` holds the data tools: certifications, sessions, waitlists, sailors, families, rosters, forms, attendance, swim checks, the inbox, parents' day notes, staff directory, documents, calendar, regattas, today's practice calls, skills and evaluations (including approvals), boats and incident reports, plus `draft_message`. Every number in an answer comes from these.
- `src/assistant/claude.ts`: Claude calls those tools to answer. In the hosted demo it runs on the viewer's own Claude account through the artifact runtime.
- `src/assistant/local.ts`: an offline engine that recognizes common questions and answers instantly from the same tools. It's used when Claude isn't available, so the feature always works in a pitch.
- The assistant never changes data. When asked to remind people, it drafts an announcement that opens pre-filled on the Announcements page for the director to review and send.
- **For the MVP:** move `askClaude` into a server function (a Supabase Edge Function) that calls the Anthropic Messages API with the same instructions and tool definitions, running the query functions against the club's Postgres data.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # domain rules + seed sanity tests
npm run build        # production build → dist/
npm run build:demo   # one self-contained HTML file → dist-demo/index.html
```

`build:demo` inlines everything and uses hash routing, so the single file works when opened from disk, emailed, or hosted anywhere.

## How it's organized

```
src/
  domain/      Pure business rules, no React. This is the product's brain.
    types.ts       Entities: Program, Session, Family, Sailor, Registration, Coach, Group, Form…
    import.ts      Matching an imported roster (CSV or Clubspot export) to programs and weeks
    pricing.ts     Member/non-member rates and discounts (kept for later; payments live in the club's system for now)
    waitlist.ts    Waitlist order and seat counting
    rules.ts       Eligibility (age + fleet), cert expiry, form compliance, coach ratios, auto-grouping
    attendance.ts  Practice days, attendance, swim checks, forms pushed to parents
    regattas.ts    Who a regatta is for and who has answered
  data/        Demo data layer
    catalog.ts     Terms, programs, cert types, form templates, default settings
    curriculum.ts  Skill progression by fleet and the lesson-plan library
    seed.ts        Deterministic seed: families, sailors, registrations, calls, plans, regatta answers, skills
    store.ts       Zustand store; every UI mutation is an action here
  features/    Screens: admin/, coach/, family/, sailor/, committee/, inbox/ (two-way messages), welcome
  lib/clock.ts The demo clock: a fixed camp day that moves in real time
  components/  burgee/ (pennants, badges, phone shell), layout/, ui/ (shadcn)
  routes/      TanStack Router file routes
supabase/
  migrations/0001_init.sql       Postgres schema + row-level security for the real MVP
  migrations/0002_club_ops.sql   Staff directory, documents, calendar, attendance, incidents, boats, payments
  migrations/0003_practice_and_progress.sql   Practice calls, lesson plans, boat assignments, regattas, skills, evaluations
  migrations/0004_camp_days_and_messages.sql  Conversations with SafeSport parent copying, day notes, evaluation approval, sailor and committee logins
```

## Demo → MVP

The UI only talks to `src/data/store.ts`. To go live:

1. **Supabase** (database + logins): create a project, run the files in `supabase/migrations/` in order, and turn on email sign-in (parents and coaches create an account from an invite link). Replace each store action with a Supabase call. The domain functions in `src/domain` run unchanged on the server.
2. **Roster import**: the same `src/domain/import.ts` matching runs in an Edge Function; later, a direct sync with Clubspot's export.
3. **Notifications**: web push for everything, plus email (Resend). Texts (Twilio) only for urgent announcements and practice calls that change the plan.
4. **Clock**: replace `src/lib/clock.ts` with `() => new Date()`.
5. **Files**: certificate photos and club documents go to a private Supabase Storage bucket (`documents`), with the `documents` table holding the metadata. The demo keeps small uploads in the browser and shows a sample preview for seeded files.
6. **Installable app**: add `vite-plugin-pwa` for a web app manifest and offline shell so parents and coaches can add Burgee to their home screen; web push can then carry practice calls alongside texts.
7. **Hosting**: Vercel. `npm run build` outputs a static SPA. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## Built on

The app shell (sidebar, command palette, shadcn/ui components, theming) is adapted from [satnaing/shadcn-admin](https://github.com/satnaing/shadcn-admin), MIT licensed. Its license is kept in `LICENSE-shadcn-admin`. Stack: React 19, Vite, TypeScript, Tailwind CSS 4, TanStack Router, Zustand, Recharts, dnd-kit.

All club, family and staff names in the demo are fictional.
