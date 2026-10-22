-- Burgee — practice days, regattas and progress
-- Practice calls (on / delayed / cancelled), lesson plans, boat assignments,
-- regatta sign-ups, the skill progression and coach evaluations. Mirrors the
-- matching types in src/domain/types.ts.

-- ───────────────────────── Practice day ─────────────────────────

create table practice_calls (
  session_id uuid not null references sessions on delete cascade,
  practice_date date not null,
  status text not null check (status in ('on', 'delayed', 'cancelled')),
  note text,
  posted_at timestamptz not null default now(),
  posted_by text not null,
  primary key (session_id, practice_date)
);

create table lesson_plans (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions on delete cascade,
  practice_date date not null,
  title text not null,
  focus text not null default '',
  blocks jsonb not null default '[]',      -- [{ minutes, title, detail }]
  skill_ids text[] not null default '{}',
  notes text,
  updated_by text not null,
  updated_at timestamptz not null default now(),
  unique (session_id, practice_date)
);

create table boat_assignments (
  session_id uuid not null references sessions on delete cascade,
  sailor_id uuid references sailors on delete cascade,
  coach_id uuid references coaches on delete cascade,
  boat_id uuid references boats on delete set null,  -- null with own_boat = true
  own_boat boolean not null default false,
  check ((sailor_id is null) <> (coach_id is null)),
  check (own_boat = false or (sailor_id is not null and boat_id is null))
);
create unique index boat_assignments_sailor on boat_assignments (session_id, sailor_id) where sailor_id is not null;
create unique index boat_assignments_coach on boat_assignments (session_id, coach_id) where coach_id is not null;

-- ───────────────────────── Regattas ─────────────────────────
-- The regatta itself is a club_events row of kind 'regatta'.

create table regattas (
  event_id uuid primary key references club_events on delete cascade,
  levels text[] not null,                  -- fleets racing
  entry_url text,                          -- Clubspot / Regatta Network page
  entry_deadline date,
  entry_fee numeric(8, 2),
  coach_ids uuid[] not null default '{}',
  chaperones_needed int not null default 0,
  travel text
);

create table regatta_responses (
  event_id uuid not null references regattas on delete cascade,
  sailor_id uuid not null references sailors on delete cascade,
  status text not null check (status in ('interested', 'going', 'not-going')),
  chaperone boolean not null default false,
  note text,
  updated_at timestamptz not null default now(),
  updated_by text not null,
  primary key (event_id, sailor_id)
);

-- ───────────────────────── Progress ─────────────────────────

create table skills (
  id text primary key,                     -- 'green-4'
  club_id uuid references clubs on delete cascade,  -- null = Burgee default list
  track text not null check (track in ('lts', 'green', 'champ', 'c420', 'ilca')),
  area text not null,
  name text not null,
  detail text not null,
  sort int not null default 0
);

create table skill_marks (
  sailor_id uuid not null references sailors on delete cascade,
  skill_id text not null references skills on delete cascade,
  status text not null check (status in ('working', 'got-it')),
  marked_on date not null default current_date,
  marked_by text not null,
  primary key (sailor_id, skill_id)
);

create table evaluations (
  id uuid primary key default gen_random_uuid(),
  sailor_id uuid not null references sailors on delete cascade,
  session_id uuid not null references sessions on delete cascade,
  coach_id uuid references coaches on delete set null,
  written_on date not null default current_date,
  strengths text not null,
  work_on text not null,
  next_step text not null default '',
  shared boolean not null default false
);

-- ───────────────────────── Row-level security ─────────────────────────

create or replace function my_coached_session_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select g.session_id from groups g
  join group_coaches gc on gc.group_id = g.id
  where gc.coach_id in (select my_coach_ids())
$$;

create or replace function my_family_session_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select r.session_id from registrations r
  join sailors s on s.id = r.sailor_id
  where s.family_id in (select my_family_ids()) and r.status = 'confirmed'
$$;

alter table practice_calls enable row level security;
alter table lesson_plans enable row level security;
alter table boat_assignments enable row level security;
alter table regattas enable row level security;
alter table regatta_responses enable row level security;
alter table skills enable row level security;
alter table skill_marks enable row level security;
alter table evaluations enable row level security;

-- Directors: everything at their club.
create policy director_calls on practice_calls for all using (has_role(session_club(session_id), 'director'));
create policy director_plans on lesson_plans for all using (has_role(session_club(session_id), 'director'));
create policy director_boats_assign on boat_assignments for all using (has_role(session_club(session_id), 'director'));
create policy director_regattas on regattas for all
  using (exists (select 1 from club_events e where e.id = event_id and has_role(e.club_id, 'director')));
create policy director_responses on regatta_responses for all
  using (exists (select 1 from club_events e where e.id = event_id and has_role(e.club_id, 'director')));
create policy director_skills on skills for all using (club_id is null or has_role(club_id, 'director'));
create policy director_marks on skill_marks for all
  using (exists (select 1 from sailors s join families f on f.id = s.family_id where s.id = sailor_id and has_role(f.club_id, 'director')));
create policy director_evaluations on evaluations for all using (has_role(session_club(session_id), 'director'));

-- Coaches: their own sessions. Head coaches make the practice call.
create policy coach_calls_read on practice_calls for select using (session_id in (select my_coached_session_ids()));
create policy coach_calls_write on practice_calls for insert
  with check (session_id in (select my_coached_session_ids())
    and exists (select 1 from coaches c where c.id in (select my_coach_ids()) and c.role = 'head-coach'));
create policy coach_plans on lesson_plans for all using (session_id in (select my_coached_session_ids()));
create policy coach_boats_assign on boat_assignments for all using (session_id in (select my_coached_session_ids()));
create policy coach_regattas on regattas for select
  using (exists (select 1 from club_events e where e.id = event_id and has_role(e.club_id, 'coach')));
create policy coach_responses on regatta_responses for select using (sailor_id in (select my_coached_sailor_ids()));
create policy everyone_skills on skills for select using (true);
create policy coach_marks on skill_marks for all using (sailor_id in (select my_coached_sailor_ids()));
create policy coach_evaluations on evaluations for all using (session_id in (select my_coached_session_ids()));

-- Guardians: calls and plans for their kids' teams, regatta answers for their
-- own kids, skills, and evaluations once a coach shares them.
create policy guardian_calls on practice_calls for select using (session_id in (select my_family_session_ids()));
create policy guardian_regattas on regattas for select
  using (exists (select 1 from club_events e where e.id = event_id and has_role(e.club_id, 'guardian')));
create policy guardian_responses on regatta_responses for all
  using (sailor_id in (select id from sailors where family_id in (select my_family_ids())));
create policy guardian_marks on skill_marks for select
  using (sailor_id in (select id from sailors where family_id in (select my_family_ids())));
create policy guardian_evaluations on evaluations for select
  using (shared and sailor_id in (select id from sailors where family_id in (select my_family_ids())));
