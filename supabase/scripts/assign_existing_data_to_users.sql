-- =============================================================================
-- Esamų įrašų ir klausimų priskirimas užsiregistravusiems vartotojams
-- =============================================================================
-- 1. Supabase Dashboard → Authentication → Users
-- 2. Nukopijuok "User UID" (uuid) sau ir žmonai
-- 3. Žemiau pakeisk PASTAISYK_SAVO_UUID ir PASTAISYK_ZMONOS_UUID
-- 4. SQL Editor → įklijuok ir Run
-- =============================================================================

-- Visus įrašus (events) be vartotojo priskirti vienam vartotojui (pvz. sau):
UPDATE public.events
SET user_id = 'PASTAISYK_SAVO_UUID'::uuid
WHERE user_id IS NULL;

-- Visus klausimus (questions) be vartotojo priskirti tam pačiam vartotojui:
UPDATE public.questions
SET user_id = 'PASTAISYK_SAVO_UUID'::uuid
WHERE user_id IS NULL;

-- =============================================================================
-- Jei nori skirstyti tarp dviejų vartotojų (pvz. įrašus iki datos – tau, po – žmonai):
-- =============================================================================
-- UPDATE public.events SET user_id = 'TAVO_UUID'::uuid WHERE user_id IS NULL AND time < '2025-03-15T00:00:00Z';
-- UPDATE public.events SET user_id = 'ZMONOS_UUID'::uuid WHERE user_id IS NULL AND time >= '2025-03-15T00:00:00Z';
-- UPDATE public.questions SET user_id = 'TAVO_UUID'::uuid WHERE user_id IS NULL;
