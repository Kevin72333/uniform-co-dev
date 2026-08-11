-- Seasonal campaign, approval, procurement and receipt transactions.

alter table public.seasonal_approval_submissions
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.app_accounts(id),
  add column if not exists return_reason text;

create or replace function public.create_seasonal_campaign(
  p_campaign_no text,
  p_name text,
  p_window_start date,
  p_window_end date,
  p_idempotency_key text,
  p_request_fingerprint text
)
returns public.seasonal_campaigns
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  current_account uuid;
  command_row public.operation_commands;
  campaign_row public.seasonal_campaigns;
begin
  current_account := private.current_account_id();
  if auth.uid() is null or coalesce(auth.jwt() ->> 'role', '') <> 'authenticated'
     or current_account is null or not private.has_role('HR') then
    raise exception using errcode = '42501', message = 'HR role is required';
  end if;
  if btrim(coalesce(p_campaign_no, '')) = '' or btrim(coalesce(p_name, '')) = ''
     or p_window_end < p_window_start then
    raise exception 'Campaign fields are invalid';
  end if;
  if btrim(coalesce(p_idempotency_key, '')) = '' or btrim(coalesce(p_request_fingerprint, '')) = '' then
    raise exception 'idempotency_key and request_fingerprint are required';
  end if;
  insert into public.operation_commands (
    operation_code, idempotency_key, canonical_request_fingerprint, actor_account_id
  ) values (
    'CREATE_SEASONAL_CAMPAIGN', p_idempotency_key, p_request_fingerprint, current_account
  ) on conflict (operation_code, idempotency_key) do nothing returning * into command_row;
  if command_row.id is null then
    select * into command_row from public.operation_commands
    where operation_code = 'CREATE_SEASONAL_CAMPAIGN' and idempotency_key = p_idempotency_key for update;
    if command_row.actor_account_id <> current_account
       or command_row.canonical_request_fingerprint <> p_request_fingerprint then
      raise exception using errcode = '40001', message = 'idempotency key conflicts with another request';
    end if;
    if command_row.status = 'SUCCEEDED' then
      select * into campaign_row from public.seasonal_campaigns where id = command_row.result_entity_id;
      return campaign_row;
    end if;
    raise exception using errcode = '40001', message = 'campaign operation is already in progress or failed';
  end if;
  insert into public.seasonal_campaigns (
    campaign_no, name, status, window_start, window_end, created_by
  ) values (
    left(btrim(p_campaign_no), 80), left(btrim(p_name), 200), 'DRAFT', p_window_start, p_window_end, current_account
  ) returning * into campaign_row;
  update public.operation_commands
  set status = 'SUCCEEDED', result_entity_type = 'seasonal_campaigns',
      result_entity_id = campaign_row.id, succeeded_at = now()
  where id = command_row.id;
  return campaign_row;
end;
$$;

create or replace function public.open_seasonal_campaign(
  p_campaign_id uuid,
  p_idempotency_key text,
  p_request_fingerprint text
)
returns public.seasonal_campaigns
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  current_account uuid;
  command_row public.operation_commands;
  campaign_row public.seasonal_campaigns;
begin
  current_account := private.current_account_id();
  if auth.uid() is null or coalesce(auth.jwt() ->> 'role', '') <> 'authenticated'
     or current_account is null or not private.has_role('HR') then
    raise exception using errcode = '42501', message = 'HR role is required';
  end if;
  if btrim(coalesce(p_idempotency_key, '')) = '' or btrim(coalesce(p_request_fingerprint, '')) = '' then
    raise exception 'idempotency_key and request_fingerprint are required';
  end if;
  insert into public.operation_commands (
    operation_code, idempotency_key, canonical_request_fingerprint, actor_account_id
  ) values (
    'OPEN_SEASONAL_CAMPAIGN', p_idempotency_key, p_request_fingerprint, current_account
  ) on conflict (operation_code, idempotency_key) do nothing returning * into command_row;
  if command_row.id is null then
    select * into command_row from public.operation_commands
    where operation_code = 'OPEN_SEASONAL_CAMPAIGN' and idempotency_key = p_idempotency_key for update;
    if command_row.actor_account_id <> current_account
       or command_row.canonical_request_fingerprint <> p_request_fingerprint then
      raise exception using errcode = '40001', message = 'idempotency key conflicts with another request';
    end if;
    if command_row.status = 'SUCCEEDED' then
      select * into campaign_row from public.seasonal_campaigns where id = command_row.result_entity_id;
      return campaign_row;
    end if;
    raise exception using errcode = '40001', message = 'campaign operation is already in progress or failed';
  end if;
  select * into campaign_row from public.seasonal_campaigns where id = p_campaign_id for update;
  if campaign_row.id is null or campaign_row.status <> 'DRAFT' then
    raise exception 'Only DRAFT campaigns can be opened';
  end if;
  update public.seasonal_campaigns set status = 'OPEN' where id = p_campaign_id returning * into campaign_row;
  update public.operation_commands
  set status = 'SUCCEEDED', result_entity_type = 'seasonal_campaigns',
      result_entity_id = campaign_row.id, succeeded_at = now()
  where id = command_row.id;
  return campaign_row;
end;
$$;

create or replace function public.submit_seasonal_campaign(
  p_campaign_id uuid,
  p_idempotency_key text,
  p_request_fingerprint text
)
returns public.seasonal_approval_submissions
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  current_account uuid;
  command_row public.operation_commands;
  campaign_row public.seasonal_campaigns;
  submission_row public.seasonal_approval_submissions;
  next_revision integer;
  snapshot_hash text;
begin
  current_account := private.current_account_id();
  if auth.uid() is null or coalesce(auth.jwt() ->> 'role', '') <> 'authenticated'
     or current_account is null or not private.has_role('HR') then
    raise exception using errcode = '42501', message = 'HR role is required';
  end if;
  if btrim(coalesce(p_idempotency_key, '')) = '' or btrim(coalesce(p_request_fingerprint, '')) = '' then
    raise exception 'idempotency_key and request_fingerprint are required';
  end if;
  insert into public.operation_commands (
    operation_code, idempotency_key, canonical_request_fingerprint, actor_account_id
  ) values (
    'SUBMIT_SEASONAL_CAMPAIGN', p_idempotency_key, p_request_fingerprint, current_account
  ) on conflict (operation_code, idempotency_key) do nothing returning * into command_row;
  if command_row.id is null then
    select * into command_row from public.operation_commands
    where operation_code = 'SUBMIT_SEASONAL_CAMPAIGN' and idempotency_key = p_idempotency_key for update;
    if command_row.actor_account_id <> current_account
       or command_row.canonical_request_fingerprint <> p_request_fingerprint then
      raise exception using errcode = '40001', message = 'idempotency key conflicts with another request';
    end if;
    if command_row.status = 'SUCCEEDED' then
      select * into submission_row from public.seasonal_approval_submissions where id = command_row.result_entity_id;
      return submission_row;
    end if;
    raise exception using errcode = '40001', message = 'campaign submission is already in progress or failed';
  end if;

  select * into campaign_row from public.seasonal_campaigns where id = p_campaign_id for update;
  if campaign_row.id is null or campaign_row.status not in ('OPEN', 'HR_REVIEW') then
    raise exception 'Campaign is not ready for HR submission';
  end if;
  if campaign_row.status = 'OPEN' and current_date <= campaign_row.window_end then
    raise exception 'Campaign window is still open';
  end if;
  if exists (select 1 from public.seasonal_approval_submissions s where s.campaign_id = p_campaign_id and s.status = 'PENDING') then
    raise exception 'Campaign already has a pending approval submission';
  end if;
  select coalesce(max(revision), 0) + 1 into next_revision
  from public.seasonal_approval_submissions where campaign_id = p_campaign_id;
  select md5(coalesce(string_agg(
    format('%s:%s:%s', d.item_id, coalesce(d.size_snapshot, ''), d.quantity::text), '|'
    order by d.item_id, coalesce(d.size_snapshot, '')
  ), '')) into snapshot_hash
  from public.seasonal_demand_lines d
  where d.campaign_id = p_campaign_id and d.quantity > 0;
  insert into public.seasonal_approval_submissions (
    campaign_id, revision, status, demand_snapshot_hash, submitted_by
  ) values (
    p_campaign_id, next_revision, 'PENDING', snapshot_hash, current_account
  ) returning * into submission_row;
  insert into public.seasonal_approval_submission_lines (
    submission_id, item_id, demand_quantity_snapshot, item_code_snapshot,
    item_name_snapshot, size_snapshot, unit_snapshot
  )
  select submission_row.id, d.item_id, sum(d.quantity),
    coalesce(max(d.item_code_snapshot), max(i.item_code)),
    coalesce(max(d.item_name_snapshot), max(i.item_name)),
    max(d.size_snapshot), coalesce(max(d.unit_snapshot), max(i.unit))
  from public.seasonal_demand_lines d
  join public.uniform_items i on i.id = d.item_id
  where d.campaign_id = p_campaign_id and d.quantity > 0
  group by d.item_id;
  update public.seasonal_campaigns set status = 'PENDING_APPROVAL' where id = p_campaign_id;
  update public.operation_commands
  set status = 'SUCCEEDED', result_entity_type = 'seasonal_approval_submissions',
      result_entity_id = submission_row.id, succeeded_at = now()
  where id = command_row.id;
  return submission_row;
end;
$$;

create or replace function public.review_seasonal_submission(
  p_submission_id uuid,
  p_decision text,
  p_reason text,
  p_idempotency_key text,
  p_request_fingerprint text
)
returns public.seasonal_approval_submissions
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  current_account uuid;
  command_row public.operation_commands;
  submission_row public.seasonal_approval_submissions;
  campaign_row public.seasonal_campaigns;
  approval_id uuid;
  approval_no text;
begin
  current_account := private.current_account_id();
  if auth.uid() is null or coalesce(auth.jwt() ->> 'role', '') <> 'authenticated'
     or current_account is null or not private.has_role('CEO') then
    raise exception using errcode = '42501', message = 'CEO role is required';
  end if;
  if upper(coalesce(p_decision, '')) not in ('APPROVE', 'RETURN') then
    raise exception 'Decision must be APPROVE or RETURN';
  end if;
  if upper(p_decision) = 'RETURN' and btrim(coalesce(p_reason, '')) = '' then
    raise exception 'A return reason is required';
  end if;
  if btrim(coalesce(p_idempotency_key, '')) = '' or btrim(coalesce(p_request_fingerprint, '')) = '' then
    raise exception 'idempotency_key and request_fingerprint are required';
  end if;
  insert into public.operation_commands (
    operation_code, idempotency_key, canonical_request_fingerprint, actor_account_id
  ) values (
    'REVIEW_SEASONAL_SUBMISSION', p_idempotency_key, p_request_fingerprint, current_account
  ) on conflict (operation_code, idempotency_key) do nothing returning * into command_row;
  if command_row.id is null then
    select * into command_row from public.operation_commands
    where operation_code = 'REVIEW_SEASONAL_SUBMISSION' and idempotency_key = p_idempotency_key for update;
    if command_row.actor_account_id <> current_account
       or command_row.canonical_request_fingerprint <> p_request_fingerprint then
      raise exception using errcode = '40001', message = 'idempotency key conflicts with another request';
    end if;
    if command_row.status = 'SUCCEEDED' then
      select * into submission_row from public.seasonal_approval_submissions where id = command_row.result_entity_id;
      return submission_row;
    end if;
    raise exception using errcode = '40001', message = 'review is already in progress or failed';
  end if;
  select * into submission_row from public.seasonal_approval_submissions where id = p_submission_id for update;
  if submission_row.id is null or submission_row.status <> 'PENDING' then
    raise exception 'Only PENDING submissions can be reviewed';
  end if;
  select * into campaign_row from public.seasonal_campaigns where id = submission_row.campaign_id for update;
  if campaign_row.status <> 'PENDING_APPROVAL' then
    raise exception 'Campaign is not waiting for approval';
  end if;
  if upper(p_decision) = 'RETURN' then
    update public.seasonal_approval_submissions
    set status = 'RETURNED', reviewed_at = now(), reviewed_by = current_account,
        return_reason = left(btrim(p_reason), 500)
    where id = p_submission_id returning * into submission_row;
    update public.seasonal_campaigns set status = 'HR_REVIEW' where id = campaign_row.id;
  else
    approval_no := 'APP-' || substring(gen_random_uuid()::text from 1 for 8);
    insert into public.seasonal_approvals (
      approval_no, campaign_id, submission_id, demand_snapshot_hash, approved_by
    ) values (
      approval_no, campaign_row.id, submission_row.id, submission_row.demand_snapshot_hash, current_account
    ) returning id into approval_id;
    insert into public.seasonal_approval_lines (
      approval_id, item_id, demand_quantity_snapshot, approved_quantity,
      item_code_snapshot, item_name_snapshot, size_snapshot, unit_snapshot
    )
    select approval_id, l.item_id, l.demand_quantity_snapshot, l.demand_quantity_snapshot,
      l.item_code_snapshot, l.item_name_snapshot, l.size_snapshot, l.unit_snapshot
    from public.seasonal_approval_submission_lines l
    where l.submission_id = submission_row.id;
    update public.seasonal_approval_submissions
    set status = 'APPROVED', reviewed_at = now(), reviewed_by = current_account
    where id = p_submission_id returning * into submission_row;
    update public.seasonal_campaigns set status = 'APPROVED', approved_at = now() where id = campaign_row.id;
  end if;
  update public.operation_commands
  set status = 'SUCCEEDED', result_entity_type = 'seasonal_approval_submissions',
      result_entity_id = submission_row.id, succeeded_at = now()
  where id = command_row.id;
  return submission_row;
end;
$$;

create or replace function public.set_seasonal_procurement_line(
  p_approval_line_id uuid,
  p_supplier_id uuid,
  p_final_purchase_quantity bigint,
  p_difference_reason text,
  p_note text,
  p_idempotency_key text,
  p_request_fingerprint text
)
returns public.seasonal_procurement_lines
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  current_account uuid;
  command_row public.operation_commands;
  approval_line_row public.seasonal_approval_lines;
  approval_row public.seasonal_approvals;
  supplier_item_row public.supplier_uniform_items;
  procurement_row public.seasonal_procurement_lines;
begin
  current_account := private.current_account_id();
  if auth.uid() is null or coalesce(auth.jwt() ->> 'role', '') <> 'authenticated'
     or current_account is null or not private.has_role('PROCUREMENT') then
    raise exception using errcode = '42501', message = 'PROCUREMENT role is required';
  end if;
  if p_final_purchase_quantity < 0 then raise exception 'final purchase quantity cannot be negative'; end if;
  if btrim(coalesce(p_idempotency_key, '')) = '' or btrim(coalesce(p_request_fingerprint, '')) = '' then
    raise exception 'idempotency_key and request_fingerprint are required';
  end if;
  insert into public.operation_commands (
    operation_code, idempotency_key, canonical_request_fingerprint, actor_account_id
  ) values (
    'SET_SEASONAL_PROCUREMENT_LINE', p_idempotency_key, p_request_fingerprint, current_account
  ) on conflict (operation_code, idempotency_key) do nothing returning * into command_row;
  if command_row.id is null then
    select * into command_row from public.operation_commands
    where operation_code = 'SET_SEASONAL_PROCUREMENT_LINE' and idempotency_key = p_idempotency_key for update;
    if command_row.actor_account_id <> current_account
       or command_row.canonical_request_fingerprint <> p_request_fingerprint then
      raise exception using errcode = '40001', message = 'idempotency key conflicts with another request';
    end if;
    if command_row.status = 'SUCCEEDED' then
      select * into procurement_row from public.seasonal_procurement_lines where id = command_row.result_entity_id;
      return procurement_row;
    end if;
    raise exception using errcode = '40001', message = 'procurement decision is already in progress or failed';
  end if;
  select * into approval_line_row from public.seasonal_approval_lines where id = p_approval_line_id for update;
  if approval_line_row.id is null then raise exception 'Approval line not found'; end if;
  select a.* into approval_row from public.seasonal_approvals a where a.id = approval_line_row.approval_id for update;
  if approval_row.id is null or approval_row.status <> 'APPROVED' then raise exception 'Approval is not final'; end if;
  select * into supplier_item_row from public.supplier_uniform_items si
  where si.supplier_id = p_supplier_id and si.item_id = approval_line_row.item_id and si.is_active for update;
  if supplier_item_row.supplier_id is null then raise exception 'Supplier does not supply this item'; end if;
  if supplier_item_row.minimum_order_quantity is not null
     and p_final_purchase_quantity > 0 and p_final_purchase_quantity < supplier_item_row.minimum_order_quantity then
    raise exception 'Final purchase quantity is below the supplier MOQ';
  end if;
  if p_final_purchase_quantity <> approval_line_row.approved_quantity
     and btrim(coalesce(p_difference_reason, '')) = '' then
    raise exception 'A difference reason is required when purchase quantity differs';
  end if;
  insert into public.seasonal_procurement_lines (
    approval_line_id, item_id, supplier_id, approved_quantity_snapshot,
    minimum_order_quantity_snapshot, final_purchase_quantity, difference_reason, note, decided_by
  ) values (
    approval_line_row.id, approval_line_row.item_id, p_supplier_id, approval_line_row.approved_quantity,
    supplier_item_row.minimum_order_quantity, p_final_purchase_quantity,
    nullif(btrim(p_difference_reason), ''), nullif(btrim(p_note), ''), current_account
  )
  on conflict (approval_line_id) do update set
    supplier_id = excluded.supplier_id,
    minimum_order_quantity_snapshot = excluded.minimum_order_quantity_snapshot,
    final_purchase_quantity = excluded.final_purchase_quantity,
    difference_reason = excluded.difference_reason,
    note = excluded.note, decided_at = now(), decided_by = current_account
  returning * into procurement_row;
  update public.operation_commands
  set status = 'SUCCEEDED', result_entity_type = 'seasonal_procurement_lines',
      result_entity_id = procurement_row.id, succeeded_at = now()
  where id = command_row.id;
  return procurement_row;
end;
$$;

create or replace function public.create_purchase_order(
  p_po_no text,
  p_procurement_line_id uuid,
  p_ordered_quantity bigint,
  p_order_date date,
  p_idempotency_key text,
  p_request_fingerprint text
)
returns public.purchase_orders
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  current_account uuid;
  command_row public.operation_commands;
  procurement_row public.seasonal_procurement_lines;
  supplier_row public.suppliers;
  po_row public.purchase_orders;
  allocated_quantity bigint;
  current_limit bigint;
  existing_po record;
  existing_po_line record;
begin
  current_account := private.current_account_id();
  if auth.uid() is null or coalesce(auth.jwt() ->> 'role', '') <> 'authenticated'
     or current_account is null or not private.has_role('PROCUREMENT') then
    raise exception using errcode = '42501', message = 'PROCUREMENT role is required';
  end if;
  if btrim(coalesce(p_po_no, '')) = '' or p_ordered_quantity <= 0 then raise exception 'PO fields are invalid'; end if;
  if btrim(coalesce(p_idempotency_key, '')) = '' or btrim(coalesce(p_request_fingerprint, '')) = '' then
    raise exception 'idempotency_key and request_fingerprint are required';
  end if;
  insert into public.operation_commands (
    operation_code, idempotency_key, canonical_request_fingerprint, actor_account_id
  ) values (
    'CREATE_PURCHASE_ORDER', p_idempotency_key, p_request_fingerprint, current_account
  ) on conflict (operation_code, idempotency_key) do nothing returning * into command_row;
  if command_row.id is null then
    select * into command_row from public.operation_commands
    where operation_code = 'CREATE_PURCHASE_ORDER' and idempotency_key = p_idempotency_key for update;
    if command_row.actor_account_id <> current_account
       or command_row.canonical_request_fingerprint <> p_request_fingerprint then
      raise exception using errcode = '40001', message = 'idempotency key conflicts with another request';
    end if;
    if command_row.status = 'SUCCEEDED' then
      select * into po_row from public.purchase_orders where id = command_row.result_entity_id;
      return po_row;
    end if;
    raise exception using errcode = '40001', message = 'purchase order is already in progress or failed';
  end if;
  select * into procurement_row from public.seasonal_procurement_lines where id = p_procurement_line_id for update;
  if procurement_row.id is null then raise exception 'Procurement decision not found'; end if;
  select * into supplier_row from public.suppliers where id = procurement_row.supplier_id and is_active for update;
  if supplier_row.id is null then raise exception 'Supplier is not active'; end if;
  for existing_po in
    select po.id from public.purchase_orders po
    join public.purchase_order_lines pol on pol.purchase_order_id = po.id
    where pol.seasonal_procurement_line_id = procurement_row.id
    order by po.id
    for update
  loop
    null;
  end loop;
  for existing_po_line in
    select pol.id from public.purchase_order_lines pol
    where pol.seasonal_procurement_line_id = procurement_row.id
    order by pol.id
    for update
  loop
    null;
  end loop;
  current_limit := coalesce((
    select c.new_purchase_limit_quantity from public.seasonal_procurement_line_changes c
    where c.procurement_line_id = procurement_row.id order by c.revision desc limit 1
  ), procurement_row.final_purchase_quantity);
  select coalesce(sum(case
    when po.status = 'CANCELLED' then 0
    when po.status = 'CLOSED_SHORT' then coalesce((
      select sum(prl.accepted_quantity) from public.purchase_receipt_lines prl
      join public.purchase_receipts pr on pr.id = prl.receipt_id
      where pr.purchase_order_id = po.id and pr.status = 'POSTED'
        and prl.purchase_order_line_id = po_line.id
    ), 0)
    else po_line.ordered_quantity end), 0)
  into allocated_quantity
  from public.purchase_order_lines po_line
  join public.purchase_orders po on po.id = po_line.purchase_order_id
  where po_line.seasonal_procurement_line_id = procurement_row.id;
  if allocated_quantity + p_ordered_quantity > current_limit then
    raise exception 'Purchase order allocation exceeds current purchase limit';
  end if;
  insert into public.purchase_orders (
    po_no, supplier_id, supplier_code_snapshot, supplier_name_snapshot,
    status, order_date, created_by, ordered_at, ordered_by
  ) values (
    left(btrim(p_po_no), 80), supplier_row.id, supplier_row.supplier_code, supplier_row.name,
    'ORDERED', p_order_date, current_account, now(), current_account
  ) returning * into po_row;
  insert into public.purchase_order_lines (
    purchase_order_id, line_no, seasonal_procurement_line_id, item_id,
    item_code_snapshot, item_name_snapshot, size_snapshot, unit_snapshot,
    initial_ordered_quantity_snapshot, ordered_quantity
  )
  select po_row.id, 1, procurement_row.id, a.item_id,
    a.item_code_snapshot, a.item_name_snapshot, a.size_snapshot, a.unit_snapshot,
    p_ordered_quantity, p_ordered_quantity
  from public.seasonal_approval_lines a
  where a.id = procurement_row.approval_line_id;
  update public.operation_commands
  set status = 'SUCCEEDED', result_entity_type = 'purchase_orders',
      result_entity_id = po_row.id, succeeded_at = now()
  where id = command_row.id;
  return po_row;
end;
$$;

create or replace function public.create_purchase_receipt_draft(
  p_receipt_no text,
  p_purchase_order_line_id uuid,
  p_delivered_quantity bigint,
  p_accepted_quantity bigint,
  p_rejected_quantity bigint,
  p_rejection_reason text,
  p_received_on date,
  p_idempotency_key text,
  p_request_fingerprint text
)
returns public.purchase_receipts
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  current_account uuid;
  command_row public.operation_commands;
  po_line_row public.purchase_order_lines;
  po_row public.purchase_orders;
  receipt_row public.purchase_receipts;
begin
  current_account := private.current_account_id();
  if auth.uid() is null or coalesce(auth.jwt() ->> 'role', '') <> 'authenticated'
     or current_account is null or not private.has_role('WAREHOUSE') then
    raise exception using errcode = '42501', message = 'WAREHOUSE role is required';
  end if;
  if btrim(coalesce(p_receipt_no, '')) = '' or p_delivered_quantity <= 0
     or p_accepted_quantity < 0 or p_rejected_quantity < 0
     or p_accepted_quantity + p_rejected_quantity <> p_delivered_quantity then
    raise exception 'Receipt quantities are invalid';
  end if;
  if p_rejected_quantity > 0 and btrim(coalesce(p_rejection_reason, '')) = '' then
    raise exception 'A rejection reason is required';
  end if;
  if btrim(coalesce(p_idempotency_key, '')) = '' or btrim(coalesce(p_request_fingerprint, '')) = '' then
    raise exception 'idempotency_key and request_fingerprint are required';
  end if;
  insert into public.operation_commands (
    operation_code, idempotency_key, canonical_request_fingerprint, actor_account_id
  ) values (
    'CREATE_PURCHASE_RECEIPT_DRAFT', p_idempotency_key, p_request_fingerprint, current_account
  ) on conflict (operation_code, idempotency_key) do nothing returning * into command_row;
  if command_row.id is null then
    select * into command_row from public.operation_commands
    where operation_code = 'CREATE_PURCHASE_RECEIPT_DRAFT' and idempotency_key = p_idempotency_key for update;
    if command_row.actor_account_id <> current_account
       or command_row.canonical_request_fingerprint <> p_request_fingerprint then
      raise exception using errcode = '40001', message = 'idempotency key conflicts with another request';
    end if;
    if command_row.status = 'SUCCEEDED' then
      select * into receipt_row from public.purchase_receipts where id = command_row.result_entity_id;
      return receipt_row;
    end if;
    raise exception using errcode = '40001', message = 'receipt draft is already in progress or failed';
  end if;
  select * into po_line_row from public.purchase_order_lines where id = p_purchase_order_line_id for update;
  select * into po_row from public.purchase_orders where id = po_line_row.purchase_order_id for update;
  if po_row.id is null or po_row.status in ('CANCELLED', 'CLOSED_SHORT') then
    raise exception 'Purchase order is not open for receipt';
  end if;
  insert into public.purchase_receipts (
    receipt_no, purchase_order_id, status, received_on, created_by
  ) values (
    left(btrim(p_receipt_no), 80), po_row.id, 'DRAFT', p_received_on, current_account
  ) returning * into receipt_row;
  insert into public.purchase_receipt_lines (
    receipt_id, purchase_order_id, purchase_order_line_id, item_id,
    delivered_quantity, accepted_quantity, rejected_quantity, rejection_reason,
    item_code_snapshot, item_name_snapshot
  ) values (
    receipt_row.id, po_row.id, po_line_row.id, po_line_row.item_id,
    p_delivered_quantity, p_accepted_quantity, p_rejected_quantity, nullif(btrim(p_rejection_reason), ''),
    po_line_row.item_code_snapshot, po_line_row.item_name_snapshot
  );
  update public.operation_commands
  set status = 'SUCCEEDED', result_entity_type = 'purchase_receipts',
      result_entity_id = receipt_row.id, succeeded_at = now()
  where id = command_row.id;
  return receipt_row;
end;
$$;

create or replace function public.post_purchase_receipt(
  p_receipt_id uuid,
  p_idempotency_key text,
  p_request_fingerprint text
)
returns public.purchase_receipts
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  current_account uuid;
  command_row public.operation_commands;
  receipt_row public.purchase_receipts;
  po_row public.purchase_orders;
  po_line_row public.purchase_order_lines;
  receipt_line_row public.purchase_receipt_lines;
  general_warehouse_id uuid;
  balance_row public.inventory_balances;
  accepted_to_date bigint;
  remaining_to_accept bigint;
  posting_id uuid;
begin
  current_account := private.current_account_id();
  if auth.uid() is null or coalesce(auth.jwt() ->> 'role', '') <> 'authenticated'
     or current_account is null or not private.has_role('WAREHOUSE') then
    raise exception using errcode = '42501', message = 'WAREHOUSE role is required';
  end if;
  if btrim(coalesce(p_idempotency_key, '')) = '' or btrim(coalesce(p_request_fingerprint, '')) = '' then
    raise exception 'idempotency_key and request_fingerprint are required';
  end if;
  insert into public.operation_commands (
    operation_code, idempotency_key, canonical_request_fingerprint, actor_account_id
  ) values (
    'POST_PURCHASE_RECEIPT', p_idempotency_key, p_request_fingerprint, current_account
  ) on conflict (operation_code, idempotency_key) do nothing returning * into command_row;
  if command_row.id is null then
    select * into command_row from public.operation_commands
    where operation_code = 'POST_PURCHASE_RECEIPT' and idempotency_key = p_idempotency_key for update;
    if command_row.actor_account_id <> current_account
       or command_row.canonical_request_fingerprint <> p_request_fingerprint then
      raise exception using errcode = '40001', message = 'idempotency key conflicts with another request';
    end if;
    if command_row.status = 'SUCCEEDED' then
      select * into receipt_row from public.purchase_receipts where id = command_row.result_entity_id;
      return receipt_row;
    end if;
    raise exception using errcode = '40001', message = 'receipt POST is already in progress or failed';
  end if;
  select * into receipt_row from public.purchase_receipts where id = p_receipt_id for update;
  if receipt_row.id is null or receipt_row.status <> 'DRAFT' then raise exception 'Only DRAFT receipts can be posted'; end if;
  select * into po_row from public.purchase_orders where id = receipt_row.purchase_order_id for update;
  if po_row.status in ('CANCELLED', 'CLOSED_SHORT') then raise exception 'Purchase order is closed for receipt'; end if;
  select * into receipt_line_row from public.purchase_receipt_lines where receipt_id = p_receipt_id order by id limit 1 for update;
  select * into po_line_row from public.purchase_order_lines where id = receipt_line_row.purchase_order_line_id for update;
  perform 1 from public.seasonal_procurement_lines sp
  where sp.id = (
    select pol.seasonal_procurement_line_id from public.purchase_order_lines pol where pol.id = po_line_row.id
  ) for update;
  select coalesce(sum(prl.accepted_quantity), 0) into accepted_to_date
  from public.purchase_receipt_lines prl
  join public.purchase_receipts pr on pr.id = prl.receipt_id
  where pr.purchase_order_id = po_row.id and pr.status = 'POSTED'
    and prl.purchase_order_line_id = po_line_row.id;
  remaining_to_accept := po_line_row.ordered_quantity - accepted_to_date;
  if receipt_line_row.accepted_quantity > remaining_to_accept then
    raise exception 'Accepted receipt quantity exceeds ordered quantity';
  end if;
  select id into general_warehouse_id from public.warehouses where purpose = 'GENERAL' and is_active;
  if general_warehouse_id is null then raise exception 'An active GENERAL warehouse is required'; end if;
  insert into public.inventory_balances (warehouse_id, item_id)
  values (general_warehouse_id, po_line_row.item_id)
  on conflict (warehouse_id, item_id) do nothing;
  select * into balance_row from public.inventory_balances
  where warehouse_id = general_warehouse_id and item_id = po_line_row.item_id for update;
  insert into public.inventory_postings (
    idempotency_key, posting_kind, source_entity_id, posted_by
  ) values (p_idempotency_key, 'RECEIPT', p_receipt_id, current_account)
  returning id into posting_id;
  if receipt_line_row.accepted_quantity > 0 then
    insert into public.inventory_ledger_entries (
      posting_id, line_no, warehouse_id, item_id, movement_kind, quantity_delta, occurred_on
    ) values (
      posting_id, 1, general_warehouse_id, po_line_row.item_id,
      'RECEIPT_IN', receipt_line_row.accepted_quantity, receipt_row.received_on
    );
    update public.inventory_balances
    set on_hand_quantity = on_hand_quantity + receipt_line_row.accepted_quantity,
        version = version + 1, last_posting_id = posting_id, updated_at = now()
    where warehouse_id = general_warehouse_id and item_id = po_line_row.item_id;
  end if;
  update public.purchase_receipts
  set status = 'POSTED', posted_at = now(), posted_by = current_account
  where id = p_receipt_id returning * into receipt_row;
  select coalesce(sum(prl.accepted_quantity), 0) into accepted_to_date
  from public.purchase_receipt_lines prl
  join public.purchase_receipts pr on pr.id = prl.receipt_id
  where pr.purchase_order_id = po_row.id and pr.status = 'POSTED'
    and prl.purchase_order_line_id = po_line_row.id;
  if accepted_to_date >= po_line_row.ordered_quantity then
    update public.purchase_orders set status = 'RECEIVED' where id = po_row.id;
  else
    update public.purchase_orders set status = 'PARTIALLY_RECEIVED' where id = po_row.id;
  end if;
  update public.operation_commands
  set status = 'SUCCEEDED', result_entity_type = 'purchase_receipts',
      result_entity_id = p_receipt_id, succeeded_at = now()
  where id = command_row.id;
  return receipt_row;
end;
$$;

revoke all on function public.create_seasonal_campaign(text, text, date, date, text, text) from public, anon;
revoke all on function public.open_seasonal_campaign(uuid, text, text) from public, anon;
revoke all on function public.submit_seasonal_campaign(uuid, text, text) from public, anon;
revoke all on function public.review_seasonal_submission(uuid, text, text, text, text) from public, anon;
revoke all on function public.set_seasonal_procurement_line(uuid, uuid, bigint, text, text, text, text) from public, anon;
revoke all on function public.create_purchase_order(text, uuid, bigint, date, text, text) from public, anon;
revoke all on function public.create_purchase_receipt_draft(text, uuid, bigint, bigint, bigint, text, date, text, text) from public, anon;
revoke all on function public.post_purchase_receipt(uuid, text, text) from public, anon;
grant execute on function public.create_seasonal_campaign(text, text, date, date, text, text) to authenticated;
grant execute on function public.open_seasonal_campaign(uuid, text, text) to authenticated;
grant execute on function public.submit_seasonal_campaign(uuid, text, text) to authenticated;
grant execute on function public.review_seasonal_submission(uuid, text, text, text, text) to authenticated;
grant execute on function public.set_seasonal_procurement_line(uuid, uuid, bigint, text, text, text, text) to authenticated;
grant execute on function public.create_purchase_order(text, uuid, bigint, date, text, text) to authenticated;
grant execute on function public.create_purchase_receipt_draft(text, uuid, bigint, bigint, bigint, text, date, text, text) to authenticated;
grant execute on function public.post_purchase_receipt(uuid, text, text) to authenticated;
