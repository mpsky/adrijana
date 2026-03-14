-- Leisti prisijungusiam vartotojui skaityti nepriimtus pakvietimus pagal kodą (kad galėtų priimti)
drop policy if exists "Invites select unused by code for accept" on public.baby_invites;
create policy "Invites select unused by code for accept"
  on public.baby_invites for select
  to authenticated
  using (used_by is null);
