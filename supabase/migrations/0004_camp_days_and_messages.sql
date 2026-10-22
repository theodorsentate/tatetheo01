-- Burgee — camp days, conversations and approvals
-- Two-way messages with SafeSport copying, parent day notes, evaluation
-- approval, teen sailor and committee logins, AM/PM camps and the emergency
-- card. Registration and payments stay in the club's registration system;
-- Burgee imports rosters.

-- ───────────────────────── Logins ─────────────────────────

alter type club_role add value if not exists 'sailor';     -- older sailors, parents always copied
alter type club_role add value if not exists 'committee';  -- read-only season report

alter table sailors add column user_id uuid references auth.users on delete set null;

-- ───────────────────────── Programs ─────────────────────────

alter table programs
  add column slot text check (slot in ('AM', 'PM')),
  add column plan_owner text not null default 'head-coach' check (plan_owner in ('head-coach', 'each-coach'));

alter table lesson_plans add column group_id uuid references groups on delete cascade;

-- The director makes the practice call; coaches read it.
drop policy if exists coach_calls_write on practice_calls;

-- ───────────────────────── Club settings: the emergency card ─────────────────────────

alter table clubs
  add column emergency_address text,
  add column emergency_vhf text,
  add column emergency_hospital text,
  add column emergency_harbormaster text;

-- ───────────────────────── Skills and evaluations ─────────────────────────

-- US Sailing Skill Up's three steps.
alter table skill_marks drop constraint if exists skill_marks_status_check;
alter table skill_marks add constraint skill_marks_status_check check (status in ('introduced', 'working', 'got-it'));

-- Coaches write; the director approves before families see it.
alter table evaluations
  add column status text not null default 'draft' check (status in ('draft', 'pending', 'shared')),
  add column approved_by uuid references auth.users,
  add column approved_at timestamptz;
update evaluations set status = 'shared' where shared;
drop policy if exists guardian_evaluations on evaluations;
alter table evaluations drop column shared;
create policy guardian_evaluations on evaluations for select
  using (status = 'shared' and sailor_id in (select id from sailors where family_id in (select my_family_ids())));
-- Coaches can't approve their own evaluations.
create or replace function evaluations_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'shared' and not has_role(session_club(new.session_id), 'director') then
    raise exception 'Only the program director can share an evaluation with a family';
  end if;
  return new;
end $$;
create trigger evaluations_guard before insert or update on evaluations for each row execute function evaluations_guard();

-- ───────────────────────── Parent day notes ─────────────────────────

create table day_notes (
  id uuid primary key default gen_random_uuid(),
  sailor_id uuid not null references sailors on delete cascade,
  on_date date not null,
  kind text not null check (kind in ('absent', 'late', 'early', 'pickup')),
  detail text,                              -- who is picking up, or what time
  note text,
  created_by uuid references auth.users,
  created_by_name text not null,
  created_at timestamptz not null default now(),
  unique (sailor_id, on_date, kind)
);
alter table day_notes enable row level security;
create policy director_day_notes on day_notes for all
  using (exists (select 1 from sailors s join families f on f.id = s.family_id where s.id = sailor_id and has_role(f.club_id, 'director')));
create policy guardian_day_notes on day_notes for all
  using (sailor_id in (select id from sailors where family_id in (select my_family_ids())));
create policy coach_day_notes on day_notes for select using (sailor_id in (select my_coached_sailor_ids()));

-- ───────────────────────── Conversations ─────────────────────────
-- A participant is the director, a coach, a family or a sailor. Any thread
-- with a sailor must include that sailor's family (SafeSport: adults'
-- messages to minors stay open, with a parent copied).

create type participant_kind as enum ('director', 'coach', 'family', 'sailor');

create table threads (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs on delete cascade,
  subject text not null,
  family_id uuid references families on delete cascade,
  sailor_id uuid references sailors on delete cascade,
  announcement_id uuid references announcements on delete set null,
  created_at timestamptz not null default now()
);

create table thread_participants (
  thread_id uuid not null references threads on delete cascade,
  kind participant_kind not null,
  ref_id uuid,                               -- coach, family or sailor id; null for the director
  last_read_at timestamptz,
  primary key (thread_id, kind, ref_id)
);

create table thread_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references threads on delete cascade,
  from_kind participant_kind not null,
  from_ref uuid,
  from_name text not null,
  from_user uuid references auth.users,
  body text not null,
  sent_at timestamptz not null default now()
);
create index thread_messages_thread_idx on thread_messages (thread_id, sent_at);

-- SafeSport: adding a sailor adds their family.
create or replace function copy_parents() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'sailor' then
    insert into thread_participants (thread_id, kind, ref_id)
    select new.thread_id, 'family', s.family_id from sailors s where s.id = new.ref_id
    on conflict do nothing;
  end if;
  return new;
end $$;
create trigger thread_copy_parents after insert on thread_participants for each row execute function copy_parents();

-- Families can't be removed from a thread their child is in.
create or replace function keep_parents() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.kind = 'family' and exists (
    select 1 from thread_participants p join sailors s on s.id = p.ref_id
    where p.thread_id = old.thread_id and p.kind = 'sailor' and s.family_id = old.ref_id
  ) then
    raise exception 'A sailor''s family stays on every conversation that includes the sailor';
  end if;
  return old;
end $$;
create trigger thread_keep_parents before delete on thread_participants for each row execute function keep_parents();

create or replace function my_thread_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select p.thread_id from thread_participants p
  where (p.kind = 'family' and p.ref_id in (select my_family_ids()))
     or (p.kind = 'coach' and p.ref_id in (select my_coach_ids()))
     or (p.kind = 'sailor' and p.ref_id in (select id from sailors where user_id = auth.uid()))
     or (p.kind = 'director' and exists (select 1 from threads t where t.id = p.thread_id and has_role(t.club_id, 'director')))
$$;

alter table threads enable row level security;
alter table thread_participants enable row level security;
alter table thread_messages enable row level security;

-- The director can read every conversation in the program (oversight).
create policy director_threads on threads for all using (has_role(club_id, 'director'));
create policy director_participants on thread_participants for all
  using (exists (select 1 from threads t where t.id = thread_id and has_role(t.club_id, 'director')));
create policy director_messages on thread_messages for all
  using (exists (select 1 from threads t where t.id = thread_id and has_role(t.club_id, 'director')));

-- Everyone else: only threads they are in.
create policy member_threads on threads for select using (id in (select my_thread_ids()));
create policy member_participants on thread_participants for select using (thread_id in (select my_thread_ids()));
create policy member_messages_read on thread_messages for select using (thread_id in (select my_thread_ids()));
create policy member_messages_write on thread_messages for insert with check (thread_id in (select my_thread_ids()) and from_user = auth.uid());

-- ───────────────────────── Teen sailors and the committee ─────────────────────────

create policy sailor_self on sailors for select using (user_id = auth.uid());
create policy sailor_marks on skill_marks for select using (sailor_id in (select id from sailors where user_id = auth.uid()));
create policy sailor_evaluations on evaluations for select
  using (status = 'shared' and sailor_id in (select id from sailors where user_id = auth.uid()));

-- The committee reads aggregates only, through this view: no names, phones or medical details.
create view committee_season_summary with (security_invoker = false) as
  select p.club_id,
         x.term_id,
         p.name as program,
         count(distinct x.id) as weeks,
         count(distinct r.sailor_id) as sailors,
         count(r.id) as sailor_weeks,
         sum(x.capacity) as capacity
  from sessions x
  join programs p on p.id = x.program_id
  left join registrations r on r.session_id = x.id and r.status = 'confirmed'
  where has_role(p.club_id, 'committee') or has_role(p.club_id, 'director')
  group by p.club_id, x.term_id, p.name;
