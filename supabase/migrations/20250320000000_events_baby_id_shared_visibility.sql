-- Įrašai (events) priklauso kūdikiui: visi kūdikio nariai mato tuos pačius įrašus.
-- Pridedame baby_id, atgalinis užpildymas, RLS pagal baby_members.

-- 1. Pridėti baby_id į events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS baby_id uuid REFERENCES public.babies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_events_baby_id ON public.events(baby_id);

-- 2. Užpildyti esamus įrašus: kūrėjo pirmas kūdikis iš baby_members
UPDATE public.events e
SET baby_id = (
  SELECT m.baby_id
  FROM public.baby_members m
  WHERE m.user_id = e.user_id
  LIMIT 1
)
WHERE e.user_id IS NOT NULL AND e.baby_id IS NULL;

-- 3. RLS: mato įrašus, kurių baby_id priklauso vartotojui (narystė) ARBA senasis user_id = auth.uid()
DROP POLICY IF EXISTS "Users see own events" ON public.events;
CREATE POLICY "Users see own events"
  ON public.events FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      baby_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.baby_members m
        WHERE m.baby_id = events.baby_id AND m.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      user_id = auth.uid()
      AND (
        baby_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.baby_members m
          WHERE m.baby_id = events.baby_id AND m.user_id = auth.uid()
        )
      )
    )
  );
