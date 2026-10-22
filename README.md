# Burgee

The operating system for a yacht club's junior sailing program. One place for the program director, coaches and parents: is practice on, who's on the water, what's today's plan, which boat is whose, how each kid is progressing, who's going to the regatta, and what still needs signing or paying.

This repo is the **clickable demo**, built on the same structure the real product will use. Everything runs in the browser against a fictional club, Saltmarsh Bay Yacht Club, on a Thursday in late October: two fall teams practice this afternoon and Summer 2027 registration has just opened. Burgee is sailing-only for now.

## The three views

| View | Who | What it does |
| --- | --- | --- |
| **Program director** (`/admin`) | Laptop | Six sections: Home, Schedule, Sailors, Staff, Messages, Club (below) |
| **Coach** (`/coach`) | Phone | Each team has four tabs. **Roster**: attendance from check-in to launch to pickup, swim checks that gate launching, parent notes, allergies. **Plan**: today's lesson plan from a library, editable. **Boats**: hulls and coach boats, with repair warnings. **Skills**: tick off each sailor's skills and write the evaluation parents read. Head coaches can make the practice call. |
| **Parent** (`/family`) | Phone | One screen per kid: is practice on today and is my kid on the water, a to-do list (waitlist offers, balances, forms, regatta answers), regattas, skills and the coach's evaluation, notes and pickups for coaches. Plus a three-week schedule, sign-up with automatic pricing, and messages. Can be added to the home screen; texts and emails still go out. |

### Director sections

| Section | Tabs | What it's for |
| --- | --- | --- |
| Home | | Today's practices with a one-tap On / Delayed / Cancelled call that texts and emails every family on the team; what needs the director; what's coming up; summer registration at a glance; the Ask Burgee bar |
| Schedule | Calendar, Regattas, Programs, Registrations, Attendance | The season. Regattas: post one, families answer Interested / Going from their app, see who's going, who hasn't answered (with a one-tap reminder), chaperones and coaches, download the entry list, link to the official entry (Clubspot, Regatta Network) |
| Sailors | Sailors, Progress, Families | Every junior; skills and evaluations by team; guardians, balances and forms |
| Staff | Directory, Certifications, Documents | Add, edit and remove staff; required certs with expiry warnings; every certificate file (SafeSport, Level 1 and 2, powerboat, first aid, background check) and club documents |
| Messages | Messages, Forms & waivers, Incident reports | Email and text; season forms and one-off forms pushed to parents with due dates; incident reports filed from the dock |
| Club | Boats, Payments, Reports, Settings | The fleet and coach boats; money by term and checks/cash; CSV reports; pricing and waitlist rules |

Switch views from the welcome page (`/`) or the **Demo view** menu. That menu also resets the demo data.

## Ask Burgee

The director can ask off-the-cuff questions from any page: the **Ask Burgee** button, the ask bar on Today, or ⌘K. Examples: "who still needs their SafeSport?", "who's going to the Fall Championship?", "is practice on today?", "how is Finn doing?", "who's on the Green Camp week 3 waitlist?", "remind families who haven't answered for the Frostbite".

- `src/assistant/query.ts` holds the data tools: certifications, sessions, waitlists, sailors, families, money, rosters, forms, attendance, swim checks, staff directory, documents, calendar, regattas, today's practice calls, skills and evaluations, boats and incident reports, plus `draft_message`. Every number in an answer comes from these.
- `src/assistant/claude.ts`: Claude calls those tools to answer. In the hosted demo it runs on the viewer's own Claude account through the artifact runtime.
- `src/assistant/local.ts`: an offline engine that recognizes common questions and answers instantly from the same tools. It's used when Claude isn't available, so the feature always works in a pitch.
- The assistant never changes data. When asked to remind people, it drafts a message that opens pre-filled on the Messages page for the director to review and send.
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
    pricing.ts     Member/non-member rates, early bird, multi-week, sibling, processing fee
    waitlist.ts    Member priority, seat counting, auto-offers with holds, registration windows
    rules.ts       Eligibility (age + fleet), cert expiry, form compliance, coach ratios, auto-grouping
    attendance.ts  Practice days, attendance, swim checks, forms pushed to parents
    regattas.ts    Who a regatta is for and who has answered
  data/        Demo data layer
    catalog.ts     Terms, programs, cert types, form templates, default settings
    curriculum.ts  Skill progression by fleet and the lesson-plan library
    seed.ts        Deterministic seed: families, sailors, registrations, calls, plans, regatta answers, skills
    store.ts       Zustand store; every UI mutation is an action here
  features/    Screens: admin/, coach/, family/, welcome
  components/  burgee/ (pennants, badges, phone shell), layout/, ui/ (shadcn)
  routes/      TanStack Router file routes
supabase/
  migrations/0001_init.sql       Postgres schema + row-level security for the real MVP
  migrations/0002_club_ops.sql   Staff directory, documents, calendar, attendance, incidents, boats, payments
  migrations/0003_practice_and_progress.sql   Practice calls, lesson plans, boat assignments, regattas, skills, evaluations
```

## Demo → MVP

The UI only talks to `src/data/store.ts`. To go live:

1. **Supabase** (database + logins): create a project, run the files in `supabase/migrations/` in order, and enable email magic-link auth. Replace each store action with a Supabase call (or an Edge Function where it must be atomic, e.g. registering and assigning seats). The domain functions in `src/domain` run unchanged on the server.
2. **Waitlist engine**: a scheduled Edge Function calls `expiredOffers` + `offersToIssue` every few minutes. In the demo this runs in the browser every 60 seconds.
3. **Payments**: swap `DemoCardForm` (`src/features/family/payment.tsx`) for Stripe Checkout or Payment Element. Clubs connect their own Stripe account via Stripe Connect.
4. **Email & texts**: Resend (email) and Twilio (SMS) behind a `send-announcement` function.
5. **Files**: certificate photos and club documents go to a private Supabase Storage bucket (`documents`), with the `documents` table holding the metadata. The demo keeps small uploads in the browser and shows a sample preview for seeded files.
6. **Installable app**: add `vite-plugin-pwa` for a web app manifest and offline shell so parents and coaches can add Burgee to their home screen; web push can then carry practice calls alongside texts.
7. **Hosting**: Vercel. `npm run build` outputs a static SPA. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## Built on

The app shell (sidebar, command palette, shadcn/ui components, theming) is adapted from [satnaing/shadcn-admin](https://github.com/satnaing/shadcn-admin), MIT licensed. Its license is kept in `LICENSE-shadcn-admin`. Stack: React 19, Vite, TypeScript, Tailwind CSS 4, TanStack Router, Zustand, Recharts, dnd-kit.

All club, family and staff names in the demo are fictional.
