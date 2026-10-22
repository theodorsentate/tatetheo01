-- Burgee — club operations
-- Staff directory details, documents, calendar, attendance and swim checks,
-- forms pushed to parents, incident reports, the boat fleet and the payment
-- ledger. Mirrors the matching types in src/domain/types.ts.

-- ───────────────────────── Staff directory ─────────────────────────

alter table coaches
  add column emergency_name text,
  add column emergency_phone text,
  add column emergency_relationship text,
  add column started_season text,          -- 'Summer 2023'
  add column school text,
  add column notes text,                   -- director-only
  add column active boolean not null default true,
  add column removed_at timestamptz;       -- set when removed; history is kept

-- Parent notes and approved pickups live on the sailor.
alter table sailors
  add column parent_note text,
  add column parent_note_updated_at timestamptz,
  add column parent_note_by text,
  add column authorized_pickups text[] not null default '{}';

-- ───────────────────────── Documents ─────────────────────────
-- Files live in the private Storage bucket `documents` at
-- {club_id}/{document_id}/{file_name}; this table holds the metadata.

create table documents (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs on delete cascade,
  title text not null,
  kind text not null check (kind in ('certification', 'club', 'other')),
  coach_id uuid references coaches on delete set null,
  cert_type_id text references cert_types,
  certification_id uuid references certifications on delete set null,
  description text,
  storage_path text not null,
  file_name text not null,
  mime text not null,
  size_bytes bigint not null,
  expires date,
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid references auth.users
);
create index documents_club_idx on documents (club_id, kind);
create index documents_coach_idx on documents (coach_id);

-- ───────────────────────── Calendar ─────────────────────────
-- Practices and camp weeks come from sessions; these are everything else.

create table club_events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs on delete cascade,
  title text not null,
  kind text not null check (kind in ('regatta', 'deadline', 'meeting', 'social', 'training')),
  starts_on date not null,
  ends_on date,
  time_label text,
  location text,
  program_ids uuid[] not null default '{}',
  notes text
);

-- ───────────────────────── Attendance & swim checks ─────────────────────────

create type attendance_status as enum ('present', 'absent', 'on-water', 'ashore', 'picked-up');
create table attendance (
  session_id uuid not null references sessions on delete cascade,
  sailor_id uuid not null references sailors on delete cascade,
  practice_date date not null,
  status attendance_status not null,
  picked_up_by text,
  launched_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by text not null,
  primary key (session_id, sailor_id, practice_date)
);

create table swim_checks (
  id uuid primary key default gen_random_uuid(),
  sailor_id uuid not null references sailors on delete cascade,
  result text not null check (result in ('passed', 'not-passed')),
  checked_on date not null,
  checked_by text not null,
  note text
);
create index swim_checks_sailor_idx on swim_checks (sailor_id, checked_on desc);

-- ───────────────────────── Forms pushed to parents ─────────────────────────

alter table form_templates
  add column required boolean not null default true,   -- false = one-off (permission slip)
  add column custom boolean not null default false;

create table form_requests (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs on delete cascade,
  template_id uuid not null references form_templates on delete cascade,
  family_ids uuid[] not null,              -- resolved at send time
  sailor_ids uuid[] not null default '{}', -- per-sailor forms
  audience_label text not null,
  due_date date,
  message text not null,
  channels text[] not null,
  sent_at timestamptz not null default now(),
  sent_by uuid references auth.users
);

-- ───────────────────────── Incident reports ─────────────────────────

create table incidents (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs on delete cascade,
  occurred_at timestamptz not null,
  session_id uuid references sessions on delete set null,
  sailor_ids uuid[] not null default '{}',
  type text not null check (type in ('capsize-rescue', 'injury', 'near-miss', 'equipment', 'behavior', 'weather', 'other')),
  severity text not null check (severity in ('minor', 'moderate', 'serious')),
  description text not null,
  action_taken text not null,
  parents_notified boolean not null default false,
  notified_how text,
  reported_by text not null,
  reported_by_user uuid references auth.users,
  status text not null default 'open' check (status in ('open', 'closed'))
);

-- ───────────────────────── Boats & equipment ─────────────────────────

create table boats (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs on delete cascade,
  kind text not null check (kind in ('Opti', 'Club 420', 'ILCA', 'RIB', 'Whaler', 'Other')),
  name text not null,
  status text not null default 'ready' check (status in ('ready', 'needs-repair', 'out-of-service')),
  assigned_to text,
  last_inspected date,
  issue text
);

-- ───────────────────────── Payments ledger ─────────────────────────
-- Card payments are written by the Stripe webhook; checks, cash and refunds
-- by the director. Negative amount = refund.

create table ledger_entries (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs on delete cascade,
  family_id uuid not null references families on delete cascade,
  registration_ids uuid[] not null default '{}',
  amount numeric(10, 2) not null,
  method text not null check (method in ('card', 'check', 'cash', 'refund')),
  memo text not null default '',
  stripe_payment_intent text,
  recorded_at timestamptz not null default now(),
  recorded_by uuid references auth.users
);

-- ───────────────────────── Row-level security ─────────────────────────

create or replace function my_coach_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from coaches where user_id = auth.uid() and active
$$;

create or replace function session_club(s uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select p.club_id from sessions x join programs p on p.id = x.program_id where x.id = s
$$;

alter table coaches enable row level security;
alter table certifications enable row level security;
alter table documents enable row level security;
alter table club_events enable row level security;
alter table attendance enable row level security;
alter table swim_checks enable row level security;
alter table form_requests enable row level security;
alter table incidents enable row level security;
alter table boats enable row level security;
alter table ledger_entries enable row level security;

-- Directors: full access to their club.
create policy director_coaches on coaches for all using (has_role(club_id, 'director'));
create policy director_certs on certifications for all
  using (exists (select 1 from coaches c where c.id = coach_id and has_role(c.club_id, 'director')));
create policy director_documents on documents for all using (has_role(club_id, 'director'));
create policy director_events on club_events for all using (has_role(club_id, 'director'));
create policy director_attendance on attendance for all using (has_role(session_club(session_id), 'director'));
create policy director_swim on swim_checks for all
  using (exists (select 1 from sailors s join families f on f.id = s.family_id where s.id = sailor_id and has_role(f.club_id, 'director')));
create policy director_requests on form_requests for all using (has_role(club_id, 'director'));
create policy director_incidents on incidents for all using (has_role(club_id, 'director'));
create policy director_boats on boats for all using (has_role(club_id, 'director'));
create policy director_ledger on ledger_entries for all using (has_role(club_id, 'director'));

-- Coaches: the staff directory (minus director notes, via the view below),
-- their own certificates and files, attendance and swim checks for sailors
-- they coach, filing incident reports, and the fleet.
create policy coach_self on coaches for select using (id in (select my_coach_ids()));
create policy coach_own_certs on certifications for all using (coach_id in (select my_coach_ids()));
create policy coach_own_documents on documents for all using (coach_id in (select my_coach_ids()));
create policy coach_club_documents on documents for select using (kind = 'club' and has_role(club_id, 'coach'));
create policy coach_events on club_events for select using (has_role(club_id, 'coach'));
create policy coach_attendance on attendance for all using (sailor_id in (select my_coached_sailor_ids()));
create policy coach_swim on swim_checks for all using (sailor_id in (select my_coached_sailor_ids()));
create policy coach_incidents_insert on incidents for insert with check (has_role(club_id, 'coach'));
create policy coach_incidents_read on incidents for select using (reported_by_user = auth.uid());
create policy coach_boats on boats for select using (has_role(club_id, 'coach'));
create policy coach_boats_update on boats for update using (has_role(club_id, 'coach'));

-- Guardians: their kids' attendance (the live "on the water" status), swim
-- checks, the club calendar, forms sent to them and their own payments.
create policy guardian_attendance on attendance for select
  using (sailor_id in (select id from sailors where family_id in (select my_family_ids())));
create policy guardian_swim on swim_checks for select
  using (sailor_id in (select id from sailors where family_id in (select my_family_ids())));
create policy guardian_events on club_events for select using (has_role(club_id, 'guardian'));
create policy guardian_requests on form_requests for select
  using (family_ids && array(select my_family_ids()));
create policy guardian_ledger on ledger_entries for select using (family_id in (select my_family_ids()));

-- Staff directory as coaches see it: contact details, no director notes.
create view staff_directory with (security_invoker = false) as
  select c.id, c.club_id, c.name, c.role, c.email, c.phone, c.activities, c.started_season
  from coaches c
  where c.active and exists (select 1 from memberships m where m.user_id = auth.uid() and m.club_id = c.club_id and m.role in ('director', 'coach'));

-- Storage: create a private bucket named `documents`, then
--   insert into storage.buckets (id, name, public) values ('documents', 'documents', false);
-- and add storage policies mirroring director_documents / coach_own_documents
-- on the first path segment (club_id) and second (document id).
