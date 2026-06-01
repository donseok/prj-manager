-- 전역 명함첩(contacts) 테이블
create table if not exists public.contacts (
  id uuid primary key,
  name text not null,
  company text,
  department text,
  title text,
  mobile text,
  phone text,
  fax text,
  email text,
  address text,
  website text,
  tags text[] not null default '{}',
  memo text,
  card_image text,                          -- base64 data URL
  linked_project_ids text[] not null default '{}',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contacts_name_idx on public.contacts (name);
create index if not exists contacts_tags_idx on public.contacts using gin (tags);
create index if not exists contacts_linked_projects_idx on public.contacts using gin (linked_project_ids);

alter table public.contacts enable row level security;

-- 모든 로그인(authenticated) 사용자: 조회·등록·수정·삭제 허용
drop policy if exists "contacts_select" on public.contacts;
drop policy if exists "contacts_insert" on public.contacts;
drop policy if exists "contacts_update" on public.contacts;
drop policy if exists "contacts_delete" on public.contacts;

create policy "contacts_select" on public.contacts for select to authenticated using (true);
create policy "contacts_insert" on public.contacts for insert to authenticated with check (true);
create policy "contacts_update" on public.contacts for update to authenticated using (true) with check (true);
create policy "contacts_delete" on public.contacts for delete to authenticated using (true);

grant select, insert, update, delete on public.contacts to authenticated;
