-- uniform-co foundation: master data, two-warehouse balances and HR request reservations
create extension if not exists pgcrypto;

create schema if not exists private;

create type public.app_role as enum (
  'SYSTEM_ADMIN', 'HR', 'WAREHOUSE', 'PROCUREMENT', 'CEO', 'DEMAND_COORDINATOR'
);

create type public.hr_request_status as enum (
  'DRAFT', 'SUBMITTED', 'INVENTORY_REVIEW_REQUIRED', 'SHIPPED', 'CANCELLED'
);

create table public.app_accounts (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  display_name text not null,
  email_snapshot text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  account_id uuid not null references public.app_accounts(id),
  role_code public.app_role not null,
  primary key (account_id, role_code)
);

create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  is_active boolean not null default true
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id),
  code text not null,
  name text not null,
  is_active boolean not null default true,
  unique (institution_id, code),
  unique (id, institution_id)
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_no text not null unique,
  name text not null,
  institution_id uuid not null references public.institutions(id),
  department_id uuid not null,
  employment_status text not null default 'ACTIVE' check (employment_status in ('ACTIVE', 'INACTIVE')),
  job_title text,
  hire_date date,
  termination_date date,
  note text,
  foreign key (department_id, institution_id)
    references public.departments(id, institution_id)
);

create table public.uniform_items (
  id uuid primary key default gen_random_uuid(),
  item_code text not null unique,
  item_name text not null,
  unit text not null default '件',
  size text,
  category text,
  season text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  purpose text not null check (purpose in ('HR', 'GENERAL')),
  is_active boolean not null default true
);

create unique index warehouses_one_active_per_purpose
  on public.warehouses (purpose) where is_active;

create table public.inventory_balances (
  warehouse_id uuid not null references public.warehouses(id),
  item_id uuid not null references public.uniform_items(id),
  on_hand_quantity bigint not null default 0 check (on_hand_quantity >= 0),
  version bigint not null default 0 check (version >= 0),
  last_posting_id uuid,
  updated_at timestamptz not null default now(),
  primary key (warehouse_id, item_id)
);

create table public.hr_requests (
  id uuid primary key default gen_random_uuid(),
  request_no text not null unique,
  status public.hr_request_status not null default 'DRAFT',
  distribution_date date not null,
  note text,
  created_by uuid not null references public.app_accounts(id),
  submitted_at timestamptz,
  submitted_by uuid references public.app_accounts(id),
  row_version bigint not null default 0 check (row_version >= 0),
  created_at timestamptz not null default now()
);

create table public.hr_issue_lines (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.hr_requests(id),
  employee_id uuid not null references public.employees(id),
  item_id uuid not null references public.uniform_items(id),
  line_no integer not null check (line_no > 0),
  quantity bigint not null check (quantity > 0),
  employee_no_snapshot text not null,
  employee_name_snapshot text not null,
  item_code_snapshot text not null,
  item_name_snapshot text not null,
  size_snapshot text,
  unique (request_id, id),
  unique (request_id, line_no),
  unique (request_id, employee_id, item_id)
);

create table public.hr_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.hr_requests(id),
  item_id uuid not null references public.uniform_items(id),
  issue_quantity bigint not null default 0 check (issue_quantity >= 0),
  increase_quantity bigint not null default 0 check (increase_quantity >= 0),
  requested_transfer_quantity bigint generated always as (issue_quantity + increase_quantity) stored,
  item_code_snapshot text not null,
  item_name_snapshot text not null,
  unique (request_id, item_id),
  unique (request_id, id, item_id),
  check (issue_quantity + increase_quantity > 0)
);

create table public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  source_hr_request_id uuid not null references public.hr_requests(id),
  item_id uuid not null references public.uniform_items(id),
  quantity bigint not null check (quantity > 0),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'CLOSED', 'RELEASED', 'CONFLICTED')),
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  unique (source_hr_request_id, item_id)
);

create table public.inventory_postings (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  posting_kind text not null check (posting_kind in ('OPENING', 'WAREHOUSE_SHIPMENT', 'REPLENISHMENT', 'RECEIPT', 'STOCKTAKE', 'CORRECTION', 'RETURN')),
  source_entity_id uuid not null,
  posted_by uuid not null references public.app_accounts(id),
  posted_at timestamptz not null default now()
);

create table public.inventory_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  posting_id uuid not null references public.inventory_postings(id),
  line_no integer not null check (line_no > 0),
  warehouse_id uuid not null references public.warehouses(id),
  item_id uuid not null references public.uniform_items(id),
  movement_kind text not null,
  quantity_delta bigint not null,
  occurred_on date not null,
  unique (posting_id, line_no)
);

create or replace function private.current_account_id()
returns uuid
language sql
stable
security definer
set search_path = public, private
as $$
  select id
  from public.app_accounts
  where auth_user_id = auth.uid()
    and is_active
  limit 1
$$;

create or replace function private.has_role(required_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.account_id = private.current_account_id()
      and ur.role_code = required_role
  )
$$;

create or replace function public.submit_hr_request(p_request_id uuid)
returns public.hr_requests
language plpgsql
security definer
set search_path = public, private
as $$
declare
  request_row public.hr_requests;
  item_row record;
  combined_on_hand bigint;
  active_reserved bigint;
  issue_sum bigint;
begin
  if not (private.has_role('HR') or private.has_role('SYSTEM_ADMIN')) then
    raise exception using errcode = '42501', message = 'HR role is required';
  end if;

  select * into request_row
  from public.hr_requests
  where id = p_request_id
  for update;

  if request_row.id is null then
    raise exception 'HR request does not exist';
  end if;
  if request_row.status <> 'DRAFT' then
    raise exception 'Only DRAFT requests can be submitted';
  end if;

  for item_row in
    select * from public.hr_request_items where request_id = p_request_id order by item_id for update
  loop
    select coalesce(sum(b.on_hand_quantity), 0)
      into combined_on_hand
    from public.inventory_balances b
    join public.warehouses w on w.id = b.warehouse_id
    where b.item_id = item_row.item_id
      and w.is_active
      and w.purpose in ('HR', 'GENERAL');

    perform 1
    from public.inventory_balances b
    join public.warehouses w on w.id = b.warehouse_id
    where b.item_id = item_row.item_id
      and w.is_active
      and w.purpose in ('HR', 'GENERAL')
    for update;

    select coalesce(sum(r.quantity), 0)
      into active_reserved
    from public.inventory_reservations r
    where r.item_id = item_row.item_id and r.status = 'ACTIVE';

    select coalesce(sum(l.quantity), 0)
      into issue_sum
    from public.hr_issue_lines l
    where l.request_id = p_request_id and l.item_id = item_row.item_id;

    if issue_sum <> item_row.issue_quantity then
      raise exception 'Issue summary does not match employee lines for item %', item_row.item_id;
    end if;
    if item_row.requested_transfer_quantity > combined_on_hand - active_reserved then
      raise exception 'Requested quantity exceeds available stock for item %', item_row.item_id;
    end if;

    insert into public.inventory_reservations (source_hr_request_id, item_id, quantity)
    values (p_request_id, item_row.item_id, item_row.requested_transfer_quantity);
  end loop;

  update public.hr_requests
  set status = 'SUBMITTED',
      submitted_at = now(),
      submitted_by = private.current_account_id(),
      row_version = row_version + 1
  where id = p_request_id
  returning * into request_row;

  return request_row;
end;
$$;

revoke all on function public.submit_hr_request(uuid) from public, anon;
grant execute on function public.submit_hr_request(uuid) to authenticated;

alter table public.app_accounts enable row level security;
alter table public.user_roles enable row level security;
alter table public.institutions enable row level security;
alter table public.departments enable row level security;
alter table public.employees enable row level security;
alter table public.uniform_items enable row level security;
alter table public.warehouses enable row level security;
alter table public.inventory_balances enable row level security;
alter table public.hr_requests enable row level security;
alter table public.hr_issue_lines enable row level security;
alter table public.hr_request_items enable row level security;
alter table public.inventory_reservations enable row level security;
alter table public.inventory_postings enable row level security;
alter table public.inventory_ledger_entries enable row level security;

create policy app_accounts_self_read on public.app_accounts
  for select to authenticated using (auth_user_id = auth.uid());
create policy user_roles_self_read on public.user_roles
  for select to authenticated using (account_id = private.current_account_id());

create policy institutions_active_read on public.institutions
  for select to authenticated using (is_active);
create policy departments_active_read on public.departments
  for select to authenticated using (is_active);
create policy employees_authorized_read on public.employees
  for select to authenticated using (private.has_role('HR') or private.has_role('WAREHOUSE'));
create policy uniform_items_active_read on public.uniform_items
  for select to authenticated using (is_active);
create policy warehouses_active_read on public.warehouses
  for select to authenticated using (is_active);
create policy inventory_balances_read on public.inventory_balances
  for select to authenticated using (private.has_role('HR') or private.has_role('WAREHOUSE'));
create policy hr_requests_read on public.hr_requests
  for select to authenticated using (private.has_role('HR') or private.has_role('WAREHOUSE'));
create policy hr_issue_lines_read on public.hr_issue_lines
  for select to authenticated using (private.has_role('HR') or private.has_role('WAREHOUSE'));
create policy hr_request_items_read on public.hr_request_items
  for select to authenticated using (private.has_role('HR') or private.has_role('WAREHOUSE'));
create policy inventory_reservations_read on public.inventory_reservations
  for select to authenticated using (private.has_role('HR') or private.has_role('WAREHOUSE'));
create policy inventory_postings_read on public.inventory_postings
  for select to authenticated using (private.has_role('HR') or private.has_role('WAREHOUSE'));
create policy inventory_ledger_entries_read on public.inventory_ledger_entries
  for select to authenticated using (private.has_role('HR') or private.has_role('WAREHOUSE'));
