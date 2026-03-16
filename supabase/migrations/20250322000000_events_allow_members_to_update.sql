-- Kūdikio nariai gali atnaujinti bet kurį to kūdikio įrašą (pvz. sustabdyti kito paleistą laikmatį).
-- Ankstesnė politika reikalavo WITH CHECK (user_id = auth.uid()), todėl UPDATE galėjo tik įrašo kūrėjas.

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
      -- Įrašo kūrėjas arba bet kuris kūdikio narys gali INSERT/UPDATE
      (user_id = auth.uid() AND (
        baby_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.baby_members m
          WHERE m.baby_id = events.baby_id AND m.user_id = auth.uid()
        )
      ))
      OR (
        baby_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.baby_members m
          WHERE m.baby_id = events.baby_id AND m.user_id = auth.uid()
        )
      )
    )
  );
