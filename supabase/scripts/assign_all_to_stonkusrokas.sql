-- Visus įrašus (events) ir klausimus (questions) priskirti vartotojui stonkusrokas@gmail.com
-- Paleisti Supabase Dashboard → SQL Editor (kaip superuser, kad matytum auth.users)

DO $$
DECLARE
  target_uid uuid;
BEGIN
  SELECT id INTO target_uid
  FROM auth.users
  WHERE email = 'stonkusrokas@gmail.com'
  LIMIT 1;

  IF target_uid IS NULL THEN
    RAISE EXCEPTION 'Vartotojas su el. paštu stonkusrokas@gmail.com nerastas. Patikrink Authentication → Users.';
  END IF;

  UPDATE public.events
  SET user_id = target_uid
  WHERE user_id IS DISTINCT FROM target_uid;

  UPDATE public.questions
  SET user_id = target_uid
  WHERE user_id IS DISTINCT FROM target_uid;

  RAISE NOTICE 'Priskirta vartotojui %. events: %, questions: %',
    target_uid,
    (SELECT count(*) FROM public.events WHERE user_id = target_uid),
    (SELECT count(*) FROM public.questions WHERE user_id = target_uid);
END $$;
