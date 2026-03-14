-- Klausimai ir svoris priskiriami kūdikiui: visi to kūdikio nariai mato tą patį turinį.

-- 1) questions: pridėti baby_id ir created_by, backfill, RLS pagal baby_members

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS baby_id uuid REFERENCES public.babies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_questions_baby_id ON public.questions(baby_id);

-- Užpildyti esamus klausimus pagal vartotojo pirmą kūdikį
UPDATE public.questions q
SET baby_id = (
  SELECT m.baby_id
  FROM public.baby_members m
  WHERE m.user_id = q.user_id
  LIMIT 1
)
WHERE q.user_id IS NOT NULL AND q.baby_id IS NULL;

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own questions" ON public.questions;
DROP POLICY IF EXISTS "Allow anon full access to questions" ON public.questions;
DROP POLICY IF EXISTS "Questions visible to baby members" ON public.questions;

CREATE POLICY "Questions visible to baby members"
  ON public.questions FOR ALL
  TO authenticated
  USING (
    baby_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.baby_members m
      WHERE m.baby_id = questions.baby_id AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    baby_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.baby_members m
      WHERE m.baby_id = questions.baby_id AND m.user_id = auth.uid()
    )
  );

-- 2) weights: nauja lentelė kūdikio svoriui, RLS pagal baby_members

create table if not exists public.weights (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  time timestamptz not null,
  weight_grams integer not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists idx_weights_baby_id_time
  on public.weights (baby_id, time);

alter table public.weights enable row level security;

drop policy if exists "Weights visible to members" on public.weights;
create policy "Weights visible to members"
  on public.weights for all
  to authenticated
  using (
    exists (
      select 1 from public.baby_members m
      where m.baby_id = weights.baby_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.baby_members m
      where m.baby_id = weights.baby_id and m.user_id = auth.uid()
    )
  );

