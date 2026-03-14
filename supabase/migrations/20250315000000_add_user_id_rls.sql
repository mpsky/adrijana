-- Vartotojo atskyrimas: kiekvienas mato tik savo įrašus ir klausimus.
-- events: pridėti user_id, RLS pagal auth.uid()
-- questions: pridėti user_id, RLS pagal auth.uid()

-- Lentelė events (tarkime jau egzistuoja) – pridėti user_id
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_events_user_id ON public.events(user_id);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Pašalinti senas politikas, jei buvo leidžiama visiems
DROP POLICY IF EXISTS "Allow anon full access to events" ON public.events;
DROP POLICY IF EXISTS "Users see own events" ON public.events;
CREATE POLICY "Users see own events"
  ON public.events FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Seni įrašai be user_id – nematomi (user_id IS NULL). Jei reikia juos pririšti prie vartotojo, atnaujink rankiniu būdu.

-- questions – pridėti user_id
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_questions_user_id ON public.questions(user_id);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon full access to questions" ON public.questions;
DROP POLICY IF EXISTS "Users see own questions" ON public.questions;
CREATE POLICY "Users see own questions"
  ON public.questions FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());
