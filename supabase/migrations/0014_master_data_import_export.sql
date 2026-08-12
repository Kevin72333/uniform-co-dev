-- Atomic master-data import and role-scoped export.

create table public.master_import_batches (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('INSTITUTIONS', 'DEPARTMENTS', 'UNIFORM_ITEMS', 'SUPPLIERS', 'SUPPLIER_ITEMS')),
  source_filename text,
  status text not null default 'PREPARING' check (status in ('PREPARING', 'APPLIED', 'FAILED')),
  row_count integer not null default 0 check (row_count >= 0),
  error_count integer not null default 0 check (error_count >= 0),
  created_by uuid not null references public.app_accounts(id),
  completed_at timestamptz,
  error_message text
);

create table public.master_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.master_import_batches(id),
  row_number integer not null check (row_number > 1),
  raw_values jsonb not null,
  status text not null check (status in ('VALIDATED', 'ERROR')),
  error_code text,
  error_message text,
  unique (batch_id, row_number)
);

alter table public.master_import_batches enable row level security;
alter table public.master_import_rows enable row level security;
create policy master_import_batches_read on public.master_import_batches
  for select to authenticated using (private.has_role('HR') or private.has_role('PROCUREMENT'));
create policy master_import_rows_read on public.master_import_rows
  for select to authenticated using (private.has_role('HR') or private.has_role('PROCUREMENT'));
revoke all on table public.master_import_batches, public.master_import_rows from public, anon, authenticated;
grant select on public.master_import_batches, public.master_import_rows to authenticated;

create or replace function public.apply_master_import(
  p_entity_type text,
  p_source_filename text,
  p_rows jsonb,
  p_idempotency_key text,
  p_request_fingerprint text
)
returns public.master_import_batches
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  current_account uuid;
  command_row public.operation_commands;
  batch_row public.master_import_batches;
  row_value jsonb;
  entity_type text := upper(btrim(coalesce(p_entity_type, '')));
  row_no integer := 1;
  row_count integer := 0;
  error_count integer := 0;
  code text;
  name text;
  unit text;
  institution_code text;
  department_code text;
  supplier_code text;
  item_code text;
  minimum_order_quantity bigint;
  error_code text;
  error_message text;
  seen_values text[] := '{}'::text[];
  target_id uuid;
  item_id_target uuid;
begin
  current_account := private.current_account_id();
  if auth.uid() is null or coalesce(auth.jwt() ->> 'role', '') <> 'authenticated' or current_account is null then
    raise exception using errcode = '42501', message = 'Authenticated account is required';
  end if;
  if entity_type not in ('INSTITUTIONS', 'DEPARTMENTS', 'UNIFORM_ITEMS', 'SUPPLIERS', 'SUPPLIER_ITEMS')
     or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0
     or btrim(coalesce(p_idempotency_key, '')) = '' or btrim(coalesce(p_request_fingerprint, '')) = '' then
    raise exception 'Master import fields are invalid';
  end if;
  if not (private.has_role('HR') or (private.has_role('PROCUREMENT') and entity_type in ('SUPPLIERS', 'SUPPLIER_ITEMS'))) then
    raise exception using errcode = '42501', message = 'Role cannot manage this master data';
  end if;
  insert into public.operation_commands (operation_code, idempotency_key, canonical_request_fingerprint, actor_account_id)
  values ('APPLY_MASTER_IMPORT_' || entity_type, p_idempotency_key, p_request_fingerprint, current_account)
  on conflict (operation_code, idempotency_key) do nothing returning * into command_row;
  if command_row.id is null then
    select * into command_row from public.operation_commands
    where operation_code = 'APPLY_MASTER_IMPORT_' || entity_type and idempotency_key = p_idempotency_key for update;
    if command_row.actor_account_id <> current_account or command_row.canonical_request_fingerprint <> p_request_fingerprint then raise exception using errcode = '40001', message = 'idempotency key conflicts with another request'; end if;
    if command_row.status = 'SUCCEEDED' then select * into batch_row from public.master_import_batches where id = command_row.result_entity_id; return batch_row; end if;
    raise exception using errcode = '40001', message = 'Master import is already in progress or failed';
  end if;
  insert into public.master_import_batches (entity_type, source_filename, created_by)
  values (entity_type, left(nullif(btrim(p_source_filename), ''), 255), current_account)
  returning * into batch_row;
  for row_value in select value from jsonb_array_elements(p_rows) loop
    row_no := row_no + 1; row_count := row_count + 1; error_code := null; error_message := null;
    code := btrim(coalesce(row_value ->> case when entity_type = 'SUPPLIERS' then 'supplierCode' else 'code' end, ''));
    name := btrim(coalesce(row_value ->> 'name', ''));
    unit := btrim(coalesce(row_value ->> 'unit', ''));
    institution_code := btrim(coalesce(row_value ->> 'institutionCode', ''));
    department_code := btrim(coalesce(row_value ->> 'departmentCode', ''));
    supplier_code := btrim(coalesce(row_value ->> 'supplierCode', ''));
    item_code := btrim(coalesce(row_value ->> 'itemCode', ''));
    minimum_order_quantity := null;
    if coalesce(row_value ->> 'minimumOrderQuantity', '') ~ '^[0-9]{1,18}$' then minimum_order_quantity := (row_value ->> 'minimumOrderQuantity')::bigint; end if;
    if row_value ? 'isActive' and lower(coalesce(row_value ->> 'isActive', '')) not in ('true', 'false') then
      error_code := 'INVALID_BOOLEAN'; error_message := 'isActive 必須是 true 或 false';
    end if;
    if entity_type = 'INSTITUTIONS' then
      if code = '' or name = '' then error_code := 'EMPTY_REQUIRED'; error_message := '機構代碼與名稱不可空白'; end if;
      if error_code is null and code = any(seen_values) then error_code := 'DUPLICATE_CODE'; error_message := '批次內機構代碼重複'; end if;
      if error_code is null then seen_values := array_append(seen_values, code); end if;
    elsif entity_type = 'DEPARTMENTS' then
      if institution_code = '' or code = '' or name = '' then error_code := 'EMPTY_REQUIRED'; error_message := '機構代碼、部門代碼與名稱不可空白'; end if;
      if error_code is null and (institution_code || ':' || code) = any(seen_values) then error_code := 'DUPLICATE_CODE'; error_message := '批次內部門代碼重複'; end if;
      if error_code is null and not exists (select 1 from public.institutions i where i.code = institution_code and i.is_active) then error_code := 'INSTITUTION_NOT_FOUND'; error_message := '機構不存在或已停用'; end if;
      if error_code is null then seen_values := array_append(seen_values, institution_code || ':' || code); end if;
    elsif entity_type = 'UNIFORM_ITEMS' then
      if code = '' or name = '' or unit = '' then error_code := 'EMPTY_REQUIRED'; error_message := '品號、品名與單位不可空白'; end if;
      if error_code is null and code = any(seen_values) then error_code := 'DUPLICATE_CODE'; error_message := '批次內品號重複'; end if;
      if error_code is null then seen_values := array_append(seen_values, code); end if;
    elsif entity_type = 'SUPPLIERS' then
      if supplier_code = '' or name = '' then error_code := 'EMPTY_REQUIRED'; error_message := '供應商代碼與名稱不可空白'; end if;
      if error_code is null and supplier_code = any(seen_values) then error_code := 'DUPLICATE_CODE'; error_message := '批次內供應商代碼重複'; end if;
      if error_code is null then seen_values := array_append(seen_values, supplier_code); end if;
    else
      if supplier_code = '' or item_code = '' or (row_value ? 'minimumOrderQuantity' and minimum_order_quantity is null) then error_code := 'EMPTY_REQUIRED'; error_message := '供應商代碼、品號與有效 MOQ 不可空白'; end if;
      if error_code is null and not exists (select 1 from public.suppliers s where s.supplier_code = supplier_code and s.is_active) then error_code := 'SUPPLIER_NOT_FOUND'; error_message := '供應商不存在或已停用'; end if;
      if error_code is null and not exists (select 1 from public.uniform_items i where i.item_code = item_code and i.is_active) then error_code := 'ITEM_NOT_FOUND'; error_message := '制服品號不存在或已停用'; end if;
    end if;
    if error_code is null then
      insert into public.master_import_rows (batch_id, row_number, raw_values, status) values (batch_row.id, row_no, row_value, 'VALIDATED');
    else
      error_count := error_count + 1;
      insert into public.master_import_rows (batch_id, row_number, raw_values, status, error_code, error_message) values (batch_row.id, row_no, row_value, 'ERROR', error_code, error_message);
    end if;
  end loop;
  update public.master_import_batches set row_count = row_count, error_count = error_count, status = case when error_count = 0 then 'APPLIED' else 'FAILED' end, completed_at = now(), error_message = case when error_count = 0 then null else 'Master import contains validation errors' end where id = batch_row.id returning * into batch_row;
  if error_count > 0 then
    update public.operation_commands set status = 'RETRYABLE_FAILED', result_entity_type = 'master_import_batches', result_entity_id = batch_row.id, last_error_code = 'VALIDATION_FAILED' where id = command_row.id;
    return batch_row;
  end if;
  for row_value in select raw_values from public.master_import_rows where batch_id = batch_row.id order by row_number loop
    if entity_type = 'INSTITUTIONS' then
      insert into public.institutions (code, name, is_active) values (btrim(row_value ->> 'code'), btrim(row_value ->> 'name'), coalesce((row_value ->> 'isActive')::boolean, true)) on conflict (code) do update set name = excluded.name, is_active = excluded.is_active;
    elsif entity_type = 'DEPARTMENTS' then
      select id into target_id from public.institutions where code = btrim(row_value ->> 'institutionCode');
      insert into public.departments (institution_id, code, name, is_active) values (target_id, btrim(row_value ->> 'code'), btrim(row_value ->> 'name'), coalesce((row_value ->> 'isActive')::boolean, true)) on conflict (institution_id, code) do update set name = excluded.name, is_active = excluded.is_active;
    elsif entity_type = 'UNIFORM_ITEMS' then
      insert into public.uniform_items (item_code, item_name, unit, size, is_active) values (btrim(row_value ->> 'code'), btrim(row_value ->> 'name'), btrim(row_value ->> 'unit'), nullif(btrim(row_value ->> 'size'), ''), coalesce((row_value ->> 'isActive')::boolean, true)) on conflict (item_code) do update set item_name = excluded.item_name, unit = excluded.unit, size = excluded.size, is_active = excluded.is_active;
    elsif entity_type = 'SUPPLIERS' then
      insert into public.suppliers (supplier_code, name, default_currency, is_active) values (btrim(row_value ->> 'supplierCode'), btrim(row_value ->> 'name'), nullif(upper(btrim(row_value ->> 'defaultCurrency')), ''), coalesce((row_value ->> 'isActive')::boolean, true)) on conflict (supplier_code) do update set name = excluded.name, default_currency = excluded.default_currency, is_active = excluded.is_active;
    else
      select id into target_id from public.suppliers where supplier_code = btrim(row_value ->> 'supplierCode');
      select id into item_id_target from public.uniform_items where item_code = btrim(row_value ->> 'itemCode');
      insert into public.supplier_uniform_items (supplier_id, item_id, minimum_order_quantity, supplier_item_code, is_active) values (target_id, item_id_target, nullif(row_value ->> 'minimumOrderQuantity', '')::bigint, nullif(btrim(row_value ->> 'supplierItemCode'), ''), coalesce((row_value ->> 'isActive')::boolean, true)) on conflict (supplier_id, item_id) do update set minimum_order_quantity = excluded.minimum_order_quantity, supplier_item_code = excluded.supplier_item_code, is_active = excluded.is_active;
    end if;
  end loop;
  update public.operation_commands set status = 'SUCCEEDED', result_entity_type = 'master_import_batches', result_entity_id = batch_row.id, succeeded_at = now() where id = command_row.id;
  return batch_row;
end;
$$;

create or replace function public.export_master_data(p_entity_type text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  entity_type text := upper(btrim(coalesce(p_entity_type, '')));
begin
  if auth.uid() is null or coalesce(auth.jwt() ->> 'role', '') <> 'authenticated' or private.current_account_id() is null then raise exception using errcode = '42501', message = 'Authenticated account is required'; end if;
  if not (private.has_role('HR') or (private.has_role('PROCUREMENT') and entity_type in ('SUPPLIERS', 'SUPPLIER_ITEMS'))) then raise exception using errcode = '42501', message = 'Role cannot export this master data'; end if;
  if entity_type = 'INSTITUTIONS' then return coalesce((select jsonb_agg(to_jsonb(i) order by i.code) from public.institutions i), '[]'::jsonb);
  elsif entity_type = 'DEPARTMENTS' then return coalesce((select jsonb_agg(to_jsonb(d) order by d.institution_id, d.code) from public.departments d), '[]'::jsonb);
  elsif entity_type = 'UNIFORM_ITEMS' then return coalesce((select jsonb_agg(to_jsonb(i) order by i.item_code) from public.uniform_items i), '[]'::jsonb);
  elsif entity_type = 'SUPPLIERS' then return coalesce((select jsonb_agg(to_jsonb(s) order by s.supplier_code) from public.suppliers s), '[]'::jsonb);
  elsif entity_type = 'SUPPLIER_ITEMS' then return coalesce((select jsonb_agg(to_jsonb(si) order by si.supplier_id, si.item_id) from public.supplier_uniform_items si), '[]'::jsonb);
  end if;
  raise exception 'Unsupported master export type';
end;
$$;

revoke all on function public.apply_master_import(text, text, jsonb, text, text) from public, anon;
revoke all on function public.export_master_data(text) from public, anon;
grant execute on function public.apply_master_import(text, text, jsonb, text, text) to authenticated;
grant execute on function public.export_master_data(text) to authenticated;
