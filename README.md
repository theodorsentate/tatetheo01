# Burgee

Junior program operations for yacht clubs: registration, waitlists, rosters, coach certifications, waivers and parent messages for junior sailing, swim and tennis.

This repo is the **clickable demo**, built on the same structure the real product will use. Everything runs in the browser against a fictional club, Saltmarsh Bay Yacht Club, set in late October: fall race teams are on the water and Summer 2027 registration has just opened.

## The three views

| View | Who | What it does |
| --- | --- | --- |
| **Program director** (`/admin`) | Laptop | Today's to-dos, a summer season board (weeks × programs), programs & capacity, registrations, drag-and-drop roster builder, waitlists, families, staff certifications, messages, forms, pricing and waitlist settings |
| **Coach** (`/coach`) | Phone | Attendance (check in → launch → ashore → signed out to an approved pickup) with a live "on the water" count, swim checks that gate launching, parent notes, allergies, tap-to-call guardians, weather call, certification renewals |
| **Parent** (`/family`) | Phone | Claim waitlist offers, pay balances, register kids by eligibility with automatic sibling/multi-week/early-bird pricing, sign season forms and one-off forms the club sends (with due dates), notes for coaches and approved pickups, live "on the water" status |

Directors can also **send forms to parents**: pick a season form or build a one-off (a regatta permission slip, say), choose who gets it and a due date, and track who has signed, with a one-click nudge for the rest. Session pages have an **Attendance** tab with the season's record and swim check status per sailor.

Switch views from the welcome page (`/`) or the **Demo view** menu. That menu also resets the demo data.

## Ask Burgee

The director can ask off-the-cuff questions from any page: the **Ask Burgee** button, the ask bar on Today, or ⌘K. Examples: "who still needs their SafeSport?", "who's on the Green Camp week 3 waitlist?", "what does the Barrow family owe?", "remind families who are missing forms".

- `src/assistant/query.ts` holds the data tools: certifications, sessions, waitlists, sailors, families, money, rosters, forms, plus `draft_message`. Every number in an answer comes from these.
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
  data/        Demo data layer
    catalog.ts     Terms, programs, cert types, form templates, default settings
    seed.ts        Deterministic seed: 65 families, 114 sailors, ~470 registrations
    store.ts       Zustand store; every UI mutation is an action here
  features/    Screens: admin/, coach/, family/, welcome
  components/  burgee/ (pennants, badges, phone shell), layout/, ui/ (shadcn)
  routes/      TanStack Router file routes
supabase/
  migrations/0001_init.sql   Postgres schema + row-level security for the real MVP
```

## Demo → MVP

The UI only talks to `src/data/store.ts`. To go live:

1. **Supabase** (database + logins): create a project, run `supabase/migrations/0001_init.sql`, and enable email magic-link auth. Replace each store action with a Supabase call (or an Edge Function where it must be atomic, e.g. registering and assigning seats). The domain functions in `src/domain` run unchanged on the server.
2. **Waitlist engine**: a scheduled Edge Function calls `expiredOffers` + `offersToIssue` every few minutes. In the demo this runs in the browser every 60 seconds.
3. **Payments**: swap `DemoCardForm` (`src/features/family/payment.tsx`) for Stripe Checkout or Payment Element. Clubs connect their own Stripe account via Stripe Connect.
4. **Email & texts**: Resend (email) and Twilio (SMS) behind a `send-announcement` function.
5. **Hosting**: Vercel. `npm run build` outputs a static SPA. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## Built on

The app shell (sidebar, command palette, shadcn/ui components, theming) is adapted from [satnaing/shadcn-admin](https://github.com/satnaing/shadcn-admin), MIT licensed. Its license is kept in `LICENSE-shadcn-admin`. Stack: React 19, Vite, TypeScript, Tailwind CSS 4, TanStack Router, Zustand, Recharts, dnd-kit.

All club, family and staff names in the demo are fictional.
