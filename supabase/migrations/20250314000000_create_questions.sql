-- Klausimai daktarui: lentelė klausimams ir atsakymams saugoti Supabase
create table if not exists public.questions (
  id text primary key,
  question text not null,
  answer text default '',
  created_at timestamptz default now()
);

-- RLS: leisti anon skaityti / įterpti / atnaujinti / trinti (kaip events)
alter table public.questions enable row level security;

create policy "Allow anon full access to questions"
  on public.questions
  for all
  to anon
  using (true)
  with check (true);
