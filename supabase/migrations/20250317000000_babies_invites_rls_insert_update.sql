-- Leisti įterpti ir atnaujinti babies, baby_members, baby_invites (RLS)

-- babies: INSERT – prisijungęs gali kurti, jei created_by = auth.uid()
drop policy if exists "Babies insert by authenticated" on public.babies;
create policy "Babies insert by authenticated"
  on public.babies for insert
  to authenticated
  with check (auth.uid() is not null and created_by = auth.uid());

-- babies: UPDATE – leisti kūrėjui arba nariui
drop policy if exists "Babies update by creator or member" on public.babies;
create policy "Babies update by creator or member"
  on public.babies for update
  to authenticated
  using (
    exists (
      select 1 from public.baby_members m
      where m.baby_id = babies.id and m.user_id = auth.uid()
    )
    or babies.created_by = auth.uid()
  )
  with check (
    exists (
      select 1 from public.baby_members m
      where m.baby_id = babies.id and m.user_id = auth.uid()
    )
    or babies.created_by = auth.uid()
  );

-- baby_members: INSERT – leisti tik pridėti save (user_id = auth.uid())
drop policy if exists "Members insert self" on public.baby_members;
create policy "Members insert self"
  on public.baby_members for insert
  to authenticated
  with check (auth.uid() is not null and user_id = auth.uid());

-- baby_invites: INSERT – kurti gali tik savo pakvietimus
drop policy if exists "Invites insert by creator" on public.baby_invites;
create policy "Invites insert by creator"
  on public.baby_invites for insert
  to authenticated
  with check (auth.uid() is not null and created_by = auth.uid());

-- baby_invites: UPDATE – kūrėjas gali redaguoti; priėmėjas gali nustatyti used_by = auth.uid() tik nepriimtam (used_by is null)
drop policy if exists "Invites update for use" on public.baby_invites;
create policy "Invites update for use"
  on public.baby_invites for update
  to authenticated
  using (created_by = auth.uid() or used_by is null)
  with check (created_by = auth.uid() or used_by = auth.uid());
