-- demo_comments / demo_specs: 위젯(anon publishable key)이 CRUD 하는 데모 테이블.
-- 호스티드 프로젝트와 동일 스키마 (packages/widget/src/database.types.ts 기준).
create table if not exists public.demo_comments (
  id text primary key,
  path text not null,
  x_pct double precision not null,
  y_pct double precision not null,
  anchor jsonb,
  resolved boolean not null default false,
  comments jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.demo_specs (
  id text primary key,
  path text not null,
  title text not null default '',
  status text not null default 'DRAFT',
  sections jsonb not null default '{}'::jsonb,
  updated_by text,
  updated_at timestamptz not null default now()
);

alter table public.demo_comments enable row level security;
alter table public.demo_specs enable row level security;

-- 데모 전용: anon 포함 전체 허용 (호스티드의 publishable-key CRUD 동작과 동일하게)
create policy "demo_comments_all" on public.demo_comments
  for all using (true) with check (true);
create policy "demo_specs_all" on public.demo_specs
  for all using (true) with check (true);

-- RLS 정책은 GRANT 를 대체하지 않는다. postgres 롤로 만든 테이블은 기본적으로
-- anon/authenticated 에 select/insert/update/delete 권한이 없어 정책이 있어도
-- "permission denied for table" 로 막힌다 — 위젯(anon publishable key)이 CRUD 하려면 명시 GRANT 필요.
grant select, insert, update, delete on public.demo_comments to anon, authenticated;
grant select, insert, update, delete on public.demo_specs to anon, authenticated;
