create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  name text,
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.projects (
  id text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  name varchar(200) not null,
  description text,
  start_date date,
  end_date date,
  base_date date,
  status varchar(20) not null default 'active' check (status in ('active', 'archived', 'deleted')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.project_members (
  id text primary key,
  project_id text not null references public.projects (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  name varchar(100) not null,
  role varchar(20) not null default 'member' check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default timezone('utc', now()),
  unique (project_id, user_id)
);

create table if not exists public.tasks (
  id text primary key,
  project_id text not null references public.projects (id) on delete cascade,
  parent_id text references public.tasks (id) on delete cascade,
  level integer not null default 1 check (level between 1 and 4),
  order_index integer not null default 0,
  name varchar(500) not null,
  description text,
  output varchar(500),
  assignee_id text references public.project_members (id) on delete set null,
  weight numeric(10, 6) not null default 0,
  plan_start date,
  plan_end date,
  plan_progress numeric(5, 2) not null default 0 check (plan_progress between 0 and 100),
  actual_start date,
  actual_end date,
  actual_progress numeric(5, 2) not null default 0 check (actual_progress between 0 and 100),
  status varchar(20) not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'on_hold')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_projects_owner_id on public.projects (owner_id);
create index if not exists idx_projects_status on public.projects (status);
create index if not exists idx_project_members_project_id on public.project_members (project_id);
create index if not exists idx_project_members_user_id on public.project_members (user_id);
create index if not exists idx_tasks_project_id on public.tasks (project_id);
create index if not exists idx_tasks_parent_id on public.tasks (parent_id);
create index if not exists idx_tasks_assignee_id on public.tasks (assignee_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
  set
    email = excluded.email,
    name = coalesce(excluded.name, public.profiles.name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.touch_updated_at();

drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at
before update on public.projects
for each row
execute function public.touch_updated_at();

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
before update on public.tasks
for each row
execute function public.touch_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

create or replace function public.is_project_owner(target_project_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects
    where id = target_project_id
      and owner_id = auth.uid()
  );
$$;

create or replace function public.is_project_member(target_project_id text, allowed_roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members
    where project_id = target_project_id
      and user_id = auth.uid()
      and (
        allowed_roles is null
        or role = any (allowed_roles)
      )
  );
$$;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.tasks enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
using (id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "projects_select_member_or_owner" on public.projects;
create policy "projects_select_member_or_owner"
on public.projects
for select
using (
  owner_id = auth.uid()
  or public.is_project_member(id)
);

drop policy if exists "projects_insert_owner" on public.projects;
create policy "projects_insert_owner"
on public.projects
for insert
with check (owner_id = auth.uid());

drop policy if exists "projects_update_owner_or_admin" on public.projects;
create policy "projects_update_owner_or_admin"
on public.projects
for update
using (
  owner_id = auth.uid()
  or public.is_project_member(id, array['owner', 'admin'])
)
with check (
  owner_id = auth.uid()
  or public.is_project_member(id, array['owner', 'admin'])
);

drop policy if exists "projects_delete_owner" on public.projects;
create policy "projects_delete_owner"
on public.projects
for delete
using (owner_id = auth.uid());

drop policy if exists "project_members_select_visible_projects" on public.project_members;
create policy "project_members_select_visible_projects"
on public.project_members
for select
using (
  public.is_project_owner(project_id)
  or public.is_project_member(project_id)
);

drop policy if exists "project_members_insert_owner_or_admin" on public.project_members;
create policy "project_members_insert_owner_or_admin"
on public.project_members
for insert
with check (
  public.is_project_owner(project_id)
  or public.is_project_member(project_id, array['owner', 'admin'])
);

drop policy if exists "project_members_update_owner_or_admin" on public.project_members;
create policy "project_members_update_owner_or_admin"
on public.project_members
for update
using (
  public.is_project_owner(project_id)
  or public.is_project_member(project_id, array['owner', 'admin'])
)
with check (
  public.is_project_owner(project_id)
  or public.is_project_member(project_id, array['owner', 'admin'])
);

drop policy if exists "project_members_delete_owner_or_admin" on public.project_members;
create policy "project_members_delete_owner_or_admin"
on public.project_members
for delete
using (
  public.is_project_owner(project_id)
  or public.is_project_member(project_id, array['owner', 'admin'])
);

drop policy if exists "tasks_select_visible_projects" on public.tasks;
create policy "tasks_select_visible_projects"
on public.tasks
for select
using (
  public.is_project_owner(project_id)
  or public.is_project_member(project_id)
);

drop policy if exists "tasks_insert_editors" on public.tasks;
create policy "tasks_insert_editors"
on public.tasks
for insert
with check (
  public.is_project_owner(project_id)
  or public.is_project_member(project_id, array['owner', 'admin', 'member'])
);

drop policy if exists "tasks_update_editors" on public.tasks;
create policy "tasks_update_editors"
on public.tasks
for update
using (
  public.is_project_owner(project_id)
  or public.is_project_member(project_id, array['owner', 'admin', 'member'])
)
with check (
  public.is_project_owner(project_id)
  or public.is_project_member(project_id, array['owner', 'admin', 'member'])
);

drop policy if exists "tasks_delete_editors" on public.tasks;
create policy "tasks_delete_editors"
on public.tasks
for delete
using (
  public.is_project_owner(project_id)
  or public.is_project_member(project_id, array['owner', 'admin', 'member'])
);
