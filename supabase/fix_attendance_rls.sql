DROP POLICY IF EXISTS "attendance_select" ON public.attendance;
DROP POLICY IF EXISTS "attendance_insert" ON public.attendance;
DROP POLICY IF EXISTS "attendance_update" ON public.attendance;
DROP POLICY IF EXISTS "attendance_delete" ON public.attendance;

CREATE POLICY "attendance_select" ON public.attendance
  FOR SELECT TO authenticated
  USING (
    exists (
      select 1 from public.projects p
      where p.id = attendance.project_id
        and p.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.project_members pm
      where pm.project_id = attendance.project_id
        and pm.user_id = auth.uid()
    )
    or is_admin()
  );

CREATE POLICY "attendance_insert" ON public.attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    exists (
      select 1 from public.projects p
      where p.id = attendance.project_id
        and p.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.project_members pm
      where pm.project_id = attendance.project_id
        and pm.user_id = auth.uid()
    )
    or is_admin()
  );

CREATE POLICY "attendance_update" ON public.attendance
  FOR UPDATE TO authenticated
  USING (
    exists (
      select 1 from public.projects p
      where p.id = attendance.project_id
        and p.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.project_members pm
      where pm.project_id = attendance.project_id
        and pm.user_id = auth.uid()
    )
    or is_admin()
  );

CREATE POLICY "attendance_delete" ON public.attendance
  FOR DELETE TO authenticated
  USING (
    exists (
      select 1 from public.projects p
      where p.id = attendance.project_id
        and p.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.project_members pm
      where pm.project_id = attendance.project_id
        and pm.user_id = auth.uid()
    )
    or is_admin()
  );
