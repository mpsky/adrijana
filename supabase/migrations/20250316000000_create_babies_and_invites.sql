-- Kūdikių ir pakvietimų schema (daugelio tėvų palaikymas)

-- Lentelė kūdikiams
create table if not exists public.babies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  birth_iso timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

-- Lentelė nariams (tėvams / globėjams)
create table if not exists public.baby_members (
  baby_id uuid not null references public.babies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'parent',
  created_at timestamptz default now(),
  primary key (baby_id, user_id)
);

create index if not exists idx_baby_members_user_id on public.baby_members(user_id);

-- Lentelė pakvietimams (unikalus kodas prisijungti prie kūdikio)
create table if not exists public.baby_invites (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  code text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_baby_invites_code on public.baby_invites(code);

-- RLS kūdikiams: mato tik nariai arba kūrėjas
alter table public.babies enable row level security;

drop policy if exists "Babies visible to members" on public.babies;
create policy "Babies visible to members"
  on public.babies for select
  to authenticated
  using (
    exists (
      select 1 from public.baby_members m
      where m.baby_id = babies.id and m.user_id = auth.uid()
    )
    or babies.created_by = auth.uid()
  );

-- RLS nariams: mato tik savo kūdikių narystes
alter table public.baby_members enable row level security;

drop policy if exists "Members see own memberships" on public.baby_members;
create policy "Members see own memberships"
  on public.baby_members for select
  to authenticated
  using (user_id = auth.uid());

-- RLS pakvietimams: mato tik savo sukurtus arba pagal kodą per specialų endpointą
alter table public.baby_invites enable row level security;

drop policy if exists "Creators see own invites" on public.baby_invites;
create policy "Creators see own invites"
  on public.baby_invites for select
  to authenticated
  using (created_by = auth.uid());

