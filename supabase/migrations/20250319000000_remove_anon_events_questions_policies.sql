-- Pašalinti anon (public) politikas iš events ir questions,
-- kad prisijungę vartotojai matytų tik savo įrašus (per "Users see own events/questions").

-- events: pašalinti visas "Anon can ..." politikas
DROP POLICY IF EXISTS "Anon can read events" ON public.events;
DROP POLICY IF EXISTS "Anon can insert events" ON public.events;
DROP POLICY IF EXISTS "Anon can update events" ON public.events;
DROP POLICY IF EXISTS "Anon can delete events" ON public.events;

-- Užtikrinti, kad authenticated mato tik savo events (jei dar nebuvo sukurta)
DROP POLICY IF EXISTS "Users see own events" ON public.events;
CREATE POLICY "Users see own events"
  ON public.events FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- questions: pašalinti panašias anon politikas, jei egzistuoja
DROP POLICY IF EXISTS "Anon can read questions" ON public.questions;
DROP POLICY IF EXISTS "Anon can insert questions" ON public.questions;
DROP POLICY IF EXISTS "Anon can update questions" ON public.questions;
DROP POLICY IF EXISTS "Anon can delete questions" ON public.questions;

DROP POLICY IF EXISTS "Users see own questions" ON public.questions;
CREATE POLICY "Users see own questions"
  ON public.questions FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());
