-- Refresh employee identity snapshots at the exact OPEN transition, then freeze them.

create or replace function private.freeze_seasonal_scope_snapshots()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
begin
  if new.status = 'OPEN' and old.status is distinct from 'OPEN' then
    update public.seasonal_campaign_employees ce
    set employee_no_snapshot = e.employee_no,
        employee_name_snapshot = e.name,
        institution_id_snapshot = e.institution_id,
        department_id_snapshot = e.department_id
    from public.employees e
    where ce.campaign_id = new.id and ce.employee_id = e.id;
  end if;
  return new;
end;
$$;

drop trigger if exists seasonal_scope_snapshot_at_open on public.seasonal_campaigns;
create trigger seasonal_scope_snapshot_at_open
after update of status on public.seasonal_campaigns
for each row execute function private.freeze_seasonal_scope_snapshots();

revoke all on function private.freeze_seasonal_scope_snapshots() from public, anon, authenticated;
