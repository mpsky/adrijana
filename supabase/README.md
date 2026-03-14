# Supabase

## Migracijos

### 1. Klausimai daktarui

Paleisk `supabase/migrations/20250314000000_create_questions.sql` – sukuriama lentelė `questions`.

### 2. Vartotojo atskyrimas (RLS)

Kad kiekvienas vartotojas matytų tik savo įrašus ir klausimus, paleisk **po** to:

`supabase/migrations/20250315000000_add_user_id_rls.sql`

- Pridedamas stulpelis `user_id` į `events` ir `questions`.
- Įjungiamas Row Level Security: SELECT/INSERT/UPDATE/DELETE tik kur `user_id = auth.uid()`.

**Kaip paleisti:** Supabase Dashboard → SQL Editor → nukopijuok atitinkamo failo SQL ir Run.

### 3. Esamų duomenų priskirimas vartotojams

Kai jau yra įrašų ar klausimų be `user_id`, juos gali pririšti prie savo ir žmonos paskyrų:

1. Atidaryk `supabase/scripts/assign_existing_data_to_users.sql`.
2. Pakeisk `PASTAISYK_SAVO_UUID` į savo User UID (Supabase → Authentication → Users → nukopijuok User UID).
3. Jei skirstai tarp dviejų vartotojų – atkomentuok paskutinį bloką ir įrašyk abu UUID, datą ribai.
4. Paleisk skriptą SQL Editoriuje (vieną kartą).
