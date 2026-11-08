-- ============================================================================
-- Sight Companion - Supabase / PostgreSQL setup (corrected)
-- ============================================================================
-- Run this entire file in: Supabase Dashboard -> SQL Editor -> New query -> Run
-- ============================================================================

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  is_guest    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint profiles_email_check check (email is null or char_length(trim(email)) > 0)
);

create index if not exists profiles_created_at_idx on public.profiles (created_at desc);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create table if not exists public.user_preferences (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null unique references public.profiles(id) on delete cascade,
  voice_on          boolean not null default true,
  contrast          boolean not null default false,
  text_size         integer not null default 2,
  rate              numeric(3,2) not null default 1.00,
  volume            numeric(3,2) not null default 1.00,
  voice             text not null default '',
  reduced_motion    boolean not null default false,
  backend_speech    boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint user_preferences_text_size_check check (text_size between 1 and 3),
  constraint user_preferences_rate_check check (rate between 0.50 and 2.00),
  constraint user_preferences_volume_check check (volume between 0.00 and 1.00)
);

create index if not exists user_preferences_user_id_idx on public.user_preferences (user_id);

drop trigger if exists user_preferences_set_updated_at on public.user_preferences;
create trigger user_preferences_set_updated_at
before update on public.user_preferences
for each row execute function public.set_updated_at();

create table if not exists public.detection_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  label        text not null,
  confidence   numeric(4,3),
  distance     text,
  direction    text,
  level        text not null default 'safe',
  message      text,
  box          jsonb,
  created_at   timestamptz not null default now(),
  constraint detection_events_label_check check (char_length(trim(label)) > 0),
  constraint detection_events_confidence_check check (confidence is null or (confidence between 0 and 1)),
  constraint detection_events_level_check check (level in ('safe','careful','danger'))
);

create index if not exists detection_events_user_created_idx
  on public.detection_events (user_id, created_at desc);
create index if not exists detection_events_level_idx on public.detection_events (level);

create table if not exists public.ocr_results (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  text         text not null,
  confidence   numeric(4,3),
  created_at   timestamptz not null default now(),
  constraint ocr_results_text_check check (char_length(trim(text)) > 0),
  constraint ocr_results_confidence_check check (confidence is null or (confidence between 0 and 1))
);

create index if not exists ocr_results_user_created_idx
  on public.ocr_results (user_id, created_at desc);

create table if not exists public.activity_log (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  type         text not null,
  title        text not null,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  constraint activity_log_type_check check (type in ('object','sign','safe','session','settings','auth')),
  constraint activity_log_title_check check (char_length(trim(title)) > 0)
);

create index if not exists activity_log_user_created_idx
  on public.activity_log (user_id, created_at desc);
create index if not exists activity_log_type_idx on public.activity_log (type);

create table if not exists public.contact_messages (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.profiles(id) on delete set null,
  name         text not null,
  email        text not null,
  message      text not null,
  created_at   timestamptz not null default now(),
  constraint contact_messages_name_check check (char_length(trim(name)) > 0),
  constraint contact_messages_email_check check (char_length(trim(email)) > 0),
  constraint contact_messages_message_check check (char_length(trim(message)) > 0)
);

create index if not exists contact_messages_user_created_idx
  on public.contact_messages (user_id, created_at desc);
create index if not exists contact_messages_created_at_idx
  on public.contact_messages (created_at desc);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Profile/preference creation is automatic and not based on authorization decisions.
  -- is_guest defaults to false; user-editable metadata is not used for security.
  -- full_name is informational only.
  insert into public.profiles (id, email, full_name, is_guest)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), ''),
    false
  )
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Restrict direct execution; only the trigger (running as owner) should invoke it.
revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles          enable row level security;
alter table public.user_preferences enable row level security;
alter table public.detection_events enable row level security;
alter table public.ocr_results      enable row level security;
alter table public.activity_log     enable row level security;
alter table public.contact_messages enable row level security;

-- profiles
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using (auth.uid() = id);
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (auth.uid() = id);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists profiles_delete_own on public.profiles;
create policy profiles_delete_own on public.profiles
  for delete to authenticated using (auth.uid() = id);

-- user_preferences
drop policy if exists prefs_select_own on public.user_preferences;
create policy prefs_select_own on public.user_preferences
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists prefs_insert_own on public.user_preferences;
create policy prefs_insert_own on public.user_preferences
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists prefs_update_own on public.user_preferences;
create policy prefs_update_own on public.user_preferences
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists prefs_delete_own on public.user_preferences;
create policy prefs_delete_own on public.user_preferences
  for delete to authenticated using (auth.uid() = user_id);

-- detection_events
drop policy if exists det_select_own on public.detection_events;
create policy det_select_own on public.detection_events
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists det_insert_own on public.detection_events;
create policy det_insert_own on public.detection_events
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists det_update_own on public.detection_events;
create policy det_update_own on public.detection_events
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists det_delete_own on public.detection_events;
create policy det_delete_own on public.detection_events
  for delete to authenticated using (auth.uid() = user_id);

-- ocr_results
drop policy if exists ocr_select_own on public.ocr_results;
create policy ocr_select_own on public.ocr_results
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists ocr_insert_own on public.ocr_results;
create policy ocr_insert_own on public.ocr_results
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists ocr_update_own on public.ocr_results;
create policy ocr_update_own on public.ocr_results
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists ocr_delete_own on public.ocr_results;
create policy ocr_delete_own on public.ocr_results
  for delete to authenticated using (auth.uid() = user_id);

-- activity_log
drop policy if exists act_select_own on public.activity_log;
create policy act_select_own on public.activity_log
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists act_insert_own on public.activity_log;
create policy act_insert_own on public.activity_log
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists act_update_own on public.activity_log;
create policy act_update_own on public.activity_log
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists act_delete_own on public.activity_log;
create policy act_delete_own on public.activity_log
  for delete to authenticated using (auth.uid() = user_id);

-- contact_messages: anonymous submissions allowed; only owners can read/delete their own
drop policy if exists "contact_insert" on public.contact_messages;
create policy "contact_insert" on public.contact_messages
  for insert to anon, authenticated
  with check (user_id is null or (auth.uid() is not null and auth.uid() = user_id));

drop policy if exists "contact_select_own" on public.contact_messages;
create policy "contact_select_own" on public.contact_messages
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "contact_delete_own" on public.contact_messages;
create policy "contact_delete_own" on public.contact_messages
  for delete to authenticated using (auth.uid() = user_id);

-- Explicit Data API grants (no broad default privileges for future tables)
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.user_preferences to authenticated;
grant select, insert, update, delete on public.detection_events to authenticated;
grant select, insert, update, delete on public.ocr_results to authenticated;
grant select, insert, update, delete on public.activity_log to authenticated;
grant select, insert, update, delete on public.contact_messages to authenticated;
grant insert on public.contact_messages to anon;

-- End of Sight Companion Supabase setup


