-- Burgee — initial schema
-- Mirrors src/domain/types.ts one table per entity. Multi-tenant by club_id.
-- Row-level security: staff see their club; coaches see the sailors in their
-- groups; guardians see only their own family.

create extension if not exists "pgcrypto";

-- ───────────────────────── Tenancy & people ─────────────────────────

create table clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text not null,
  season text not null,                -- '2026–27'
  support_email text,
  cert_warning_days int not null default 45,
  member_priority boolean not null default true,
  auto_offer boolean not null default true,
  hold_hours int not null default 48,
  sibling_discount_pct numeric not null default 10,
  multi_week_discount_pct numeric not null default 5,
  multi_week_min int not null default 4,
  early_bird_pct numeric not null default 10,
  processing_fee_pct numeric not null default 0,
  created_at timestamptz not null default now()
);

-- Who can log in, and as what, at each club.
create type club_role as enum ('director', 'coach', 'guardian');
create table memberships (
  user_id uuid not null references auth.users on delete cascade,
  club_id uuid not null references clubs on delete cascade,
  role club_role not null,
  primary key (user_id, club_id, role)
);

create table families (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs on delete cascade,
  name text not null,
  membership text not null check (membership in ('member', 'non-member')),
  member_number text,
  address text,
  created_at timestamptz not null default now()
);

create table guardians (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  user_id uuid references auth.users on delete set null,  -- set once they log in
  name text not null,
  email text not null,
  phone text,
  relationship text,
  sms_opt_in boolean not null default false
);

create table sailors (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  first_name text not null,
  last_name text not null,
  dob date not null,
  level text not null,                 -- 'opti-green', 'club-420', …
  shirt_size text,
  medical_alerts text[] not null default '{}'
);

create type staff_role as enum ('program-director', 'head-coach', 'instructor', 'assistant', 'swim-coach', 'tennis-pro');
create table coaches (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs on delete cascade,
  user_id uuid references auth.users on delete set null,
  name text not null,
  role staff_role not null,
  email text,
  phone text,
  activities text[] not null default '{sailing}'
);

create table cert_types (
  id text primary key,                 -- 'l1', 'fa', 'safesport', …
  club_id uuid references clubs on delete cascade,  -- null = shared default
  name text not null,
  valid_months int not null,
  required_for staff_role[] not null
);

create table certifications (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references coaches on delete cascade,
  cert_type_id text not null references cert_types,
  issued date not null,
  expires date not null,
  file_path text                       -- storage object for the uploaded card
);

-- ───────────────────────── Programs ─────────────────────────

create table terms (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs on delete cascade,
  name text not null,
  season text not null check (season in ('fall', 'spring', 'summer')),
  start_date date not null,
  end_date date not null,
  registration_opens date not null,
  member_priority_until date,
  early_bird_until date
);

create table pricing_tiers (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs on delete cascade,
  name text not null,
  unit text not null check (unit in ('week', 'term')),
  member_cents int not null,
  non_member_cents int not null
);

create table programs (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs on delete cascade,
  name text not null,
  activity text not null check (activity in ('sailing', 'swim', 'tennis')),
  format text not null check (format in ('camp', 'team')),
  levels text[] not null,
  min_age int not null,
  max_age int not null,
  description text,
  pricing_tier_id uuid not null references pricing_tiers,
  ratio int not null default 8,
  color text,
  required_form_ids uuid[] not null default '{}'
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs on delete cascade,
  term_id uuid not null references terms on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  days text,
  time text,
  capacity int not null check (capacity > 0),
  price_override_member_cents int,
  price_override_non_member_cents int,
  status text not null default 'open' check (status in ('open', 'closed'))
);

-- ───────────────────────── Registrations ─────────────────────────

create type registration_status as enum ('confirmed', 'pending-payment', 'waitlisted', 'offered', 'cancelled');
create table registrations (
  id uuid primary key default gen_random_uuid(),
  sailor_id uuid not null references sailors on delete cascade,
  session_id uuid not null references sessions on delete cascade,
  status registration_status not null,
  created_at timestamptz not null default now(),
  offer_expires_at timestamptz,
  price_cents int not null,
  price_lines jsonb not null default '[]',
  paid_cents int not null default 0,
  stripe_payment_intent text
);
-- One live registration per sailor per session.
create unique index registrations_one_live on registrations (sailor_id, session_id) where status <> 'cancelled';
create index registrations_session on registrations (session_id, status, created_at);

create table groups (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions on delete cascade,
  name text not null,
  resource text
);
create table group_coaches (
  group_id uuid references groups on delete cascade,
  coach_id uuid references coaches on delete cascade,
  primary key (group_id, coach_id)
);
create table group_sailors (
  group_id uuid references groups on delete cascade,
  sailor_id uuid references sailors on delete cascade,
  primary key (group_id, sailor_id)
);

-- ───────────────────────── Forms & messages ─────────────────────────

create table form_templates (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs on delete cascade,
  name text not null,
  short text not null,
  description text,
  body text not null,
  fields jsonb not null default '[]',
  scope text not null check (scope in ('sailor', 'family'))
);

create table form_submissions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references form_templates on delete cascade,
  family_id uuid not null references families on delete cascade,
  sailor_id uuid references sailors on delete cascade,
  season text not null,
  signed_by text not null,
  signed_at timestamptz not null default now(),
  signer_ip inet,
  values jsonb not null default '{}'
);

create table announcements (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs on delete cascade,
  title text not null,
  body text not null,
  category text not null,
  audience jsonb not null,             -- { kind: 'program', programId } …
  channels text[] not null,
  sent_at timestamptz not null default now(),
  sent_by uuid references auth.users,
  recipients int not null default 0
);

-- ───────────────────────── Row-level security ─────────────────────────

create or replace function has_role(c uuid, r club_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships m where m.user_id = auth.uid() and m.club_id = c and m.role = r)
$$;

create or replace function my_family_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select family_id from guardians where user_id = auth.uid()
$$;

create or replace function my_coached_sailor_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select gs.sailor_id from group_sailors gs
  join group_coaches gc on gc.group_id = gs.group_id
  join coaches c on c.id = gc.coach_id
  where c.user_id = auth.uid()
$$;

alter table families enable row level security;
alter table guardians enable row level security;
alter table sailors enable row level security;
alter table registrations enable row level security;
alter table form_submissions enable row level security;

-- Directors: full access to their club.
create policy director_families on families for all using (has_role(club_id, 'director'));
create policy director_sailors on sailors for all
  using (exists (select 1 from families f where f.id = family_id and has_role(f.club_id, 'director')));
create policy director_registrations on registrations for all
  using (exists (select 1 from sailors s join families f on f.id = s.family_id where s.id = sailor_id and has_role(f.club_id, 'director')));

-- Guardians: their own family only.
create policy guardian_family on families for select using (id in (select my_family_ids()));
create policy guardian_guardians on guardians for select using (family_id in (select my_family_ids()));
create policy guardian_sailors on sailors for all using (family_id in (select my_family_ids()));
create policy guardian_registrations_read on registrations for select
  using (sailor_id in (select id from sailors where family_id in (select my_family_ids())));
create policy guardian_forms on form_submissions for all using (family_id in (select my_family_ids()));

-- Coaches: read the sailors (and their medical form) in groups they coach.
create policy coach_sailors on sailors for select using (id in (select my_coached_sailor_ids()));
create policy coach_forms on form_submissions for select using (sailor_id in (select my_coached_sailor_ids()));

-- New registrations from guardians go through the `register` edge function,
-- which prices the cart with src/domain/pricing.ts and assigns seats or
-- waitlist positions atomically, so guardians get no direct insert policy.
